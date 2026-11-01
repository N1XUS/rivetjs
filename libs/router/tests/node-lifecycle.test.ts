// Node adapter lifecycle hooks (backend plan T4): `serve({ ready })` → `/readyz` 503 `starting` until the hook says
// true (answer cached 1 s, one call per probe burst, a throw = not ready + onError); `serve({ onClose })` runs after the
// server stopped accepting and drained, inside `grace`; `closeOnSignals` exits 0, or 1 when the hook fails.
import { test } from "vitest";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "../adapters/node.ts";
import { readinessOf } from "../adapters/lifecycle.ts";

const status = async (url: string) => {
  const response = await fetch(url);
  return `${response.status} ${await response.text()}`;
};
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

test("ready: /readyz 503 starting until true, cached for 1 s, one call per burst; throws are not ready", async () => {
  let ok: boolean | null = false,
    calls = 0;
  const errors: unknown[] = [];
  const serving = await serve({
    port: 0,
    handler: () => new Response("app"),
    onError: (error) => void errors.push(error),
    ready: async () => {
      calls++;
      await sleep(20);
      if (ok === null) throw new Error("db down");
      return ok === true;
    },
  });
  try {
    const burst = await Promise.all(Array.from({ length: 5 }, () => status(serving.url + "/readyz")));
    assert.deepEqual(burst, Array(5).fill("503 starting"));
    assert.equal(calls, 1);
    ok = true;
    assert.equal(await status(serving.url + "/readyz"), "503 starting", "cached answer");
    assert.equal(calls, 1);
    await sleep(1_050);
    assert.equal(await status(serving.url + "/readyz"), "200 ready");
    assert.equal(calls, 2);
    // The app is served regardless of readiness; liveness is not readiness.
    assert.equal(await status(serving.url + "/x"), "200 app");
    assert.equal(await status(serving.url + "/healthz"), "200 ok");
    ok = null;
    await sleep(1_050);
    assert.equal(await status(serving.url + "/readyz"), "503 starting");
    assert.match(String(errors[0]), /db down/);
  } finally {
    await serving.close();
  }
});

test("readinessOf: a synchronous throw settles as not ready and the next check calls the hook again", async () => {
  let calls = 0;
  const errors: unknown[] = [];
  const state = readinessOf(
    () => {
      calls++;
      if (calls === 1) throw new Error("sync boom");
      return true;
    },
    (error) => void errors.push(error),
  );
  assert.equal(await state.check(), false);
  assert.match(String(errors[0]), /sync boom/);
  assert.equal(await state.check(), true, "a stuck in-flight call would replay the first answer");
  assert.equal(calls, 2);
});

test("ready unset: /readyz answers without calling anything (ready / draining as before)", async () => {
  const serving = await serve({ port: 0, handler: () => new Response("app") });
  try {
    assert.equal(await status(serving.url + "/readyz"), "200 ready");
  } finally {
    await serving.close();
  }
});

test("onClose order: stop accepting → drain in-flight → onClose → close() resolves", async () => {
  const events: string[] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>((done) => (release = done));
  const serving = await serve({
    port: 0,
    handler: async () => {
      await gate;
      events.push("drained");
      return new Response("finished");
    },
    ready: () => true,
    onClose: async () => {
      events.push(serving.server.listening ? "onClose (still listening)" : "onClose");
      await sleep(20);
    },
  });
  const slow = fetch(serving.url + "/slow").then((response) => response.text());
  await sleep(50);
  const closed = serving.close().then(() => events.push("closed"));
  await sleep(20);
  events.push("released");
  release();
  assert.equal(await slow, "finished");
  await closed;
  assert.deepEqual(events, ["released", "drained", "onClose", "closed"]);
  await assert.rejects(fetch(serving.url + "/healthz"));
});

test("onClose bounded by grace (counted from close()); a throwing hook rejects close()", async () => {
  const hung = await serve({ port: 0, grace: 150, handler: () => new Response("x"), onClose: () => new Promise<void>(() => {}) });
  const started = performance.now();
  await assert.rejects(hung.close(), /onClose did not finish within grace \(150 ms\)/);
  const took = performance.now() - started;
  assert.ok(took >= 140 && took < 1_000, String(took));
  const failing = await serve({ port: 0, handler: () => new Response("x"), onClose: async () => Promise.reject(new Error("pool close failed")) });
  await assert.rejects(failing.close(), /pool close failed/);
  // close() is idempotent: the same settled promise.
  await assert.rejects(failing.close(), /pool close failed/);
});

test("closeOnSignals: SIGTERM drains, awaits onClose, exits 0; a failing onClose exits 1", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-lifecycle-"));
  const adapter = new URL("../adapters/node.ts", import.meta.url).pathname;
  const run = async (hook: string) => {
    const script = join(dir, `server-${Math.random().toString(36).slice(2)}.ts`);
    await writeFile(
      script,
      `import { serve, closeOnSignals } from ${JSON.stringify(adapter)};\n` +
        `const serving = await serve({ port: 0, handler: () => new Response("x"), onClose: ${hook} });\n` +
        `closeOnSignals(serving);\nconsole.log("listening " + serving.url);\n`,
    );
    const child = spawn(process.execPath, [script], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "",
      err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    while (!out.includes("listening")) {
      if (child.exitCode !== null) throw new Error(`exited early: ${err}`);
      await sleep(20);
    }
    child.kill("SIGTERM");
    const code = await new Promise<number | null>((done) => child.once("exit", done));
    return { code, out, err };
  };
  try {
    const ok = await run(`async () => { await new Promise((r) => setTimeout(r, 30)); console.log("onClose ran"); }`);
    assert.equal(ok.code, 0, ok.err);
    assert.match(ok.out, /onClose ran/);
    const bad = await run(`async () => { throw new Error("consumer stop failed"); }`);
    assert.equal(bad.code, 1);
    assert.match(bad.err, /consumer stop failed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 20_000);
