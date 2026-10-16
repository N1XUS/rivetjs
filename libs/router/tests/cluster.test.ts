// Node adapter multi-core serving (`adapters/cluster.ts`, `start({ workers })`): connections spread over the workers,
// `revalidate()` reaches every worker's route cache, a crashed worker is replaced, close drains and stops them all.
// Runs `tests/cluster-app.ts` as a child process (2 workers).
import { test } from "vitest";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { fileURLToPath } from "node:url";
import { serve } from "../adapters/node.ts";

const get = (url: string) =>
  new Promise<string>((done, fail) => {
    // A fresh connection per request (no keep-alive): the primary hands each one to the next worker.
    const req = request(url, { agent: false, headers: { connection: "close" } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => done(body));
    });
    req.on("error", fail);
    req.end();
  });
const run = (mode: string) => {
  const child = spawn(process.execPath, [fileURLToPath(new URL("./cluster-app.ts", import.meta.url))], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, CLUSTER_MODE: mode },
  });
  let out = "";
  child.stdout.on("data", (chunk) => (out += chunk));
  child.stderr.on("data", (chunk) => (out += chunk));
  const exited = new Promise<number | null>((done) => child.once("exit", done));
  return { child, exited, out: () => out };
};
const until = async (check: () => Promise<boolean>) => {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error("timed out");
};

test("cluster: round robin over the workers, revalidate() reaches every worker, crashed workers replaced, close stops all", async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL("./cluster-app.ts", import.meta.url))], { stdio: ["pipe", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (chunk) => (out += chunk));
  child.stderr.on("data", (chunk) => (out += chunk));
  try {
    await until(async () => /URL \S+ 2/.test(out));
    const url = /URL (\S+)/.exec(out)![1]!;
    const pids = new Set<string>();
    for (let i = 0; i < 8; i++) pids.add(await get(url + "/pid"));
    assert.equal(pids.size, 2);
    // Each worker stores its own copy of /a (per-process cache: render 1 of each) …
    const page = async () => {
      const [pid, n] = (await get(url + "/a")).slice(3, -4).split(" ");
      return { pid: pid!, n: Number(n) };
    };
    const seen = new Map<string, number>();
    await until(async () => {
      const { pid, n } = await page();
      seen.set(pid, n);
      return seen.size === 2;
    });
    assert.deepEqual([...seen.values()], [1, 1]);
    for (let i = 0; i < 4; i++) assert.equal((await page()).n, 1);
    // … and a revalidate() in one worker drops it in both: each renders /a again (render 2).
    assert.equal(await get(url + "/rv"), "1");
    const after = new Map<string, number>();
    await until(async () => {
      const { pid, n } = await page();
      after.set(pid, n);
      // The relay is asynchronous: the other worker may answer once more from its old copy.
      return after.size === 2 && [...after.values()].every((value) => value === 2);
    });
    assert.deepEqual([...after.values()], [2, 2]);
    // A crashed worker is replaced by a new one.
    await get(url + "/crash").catch(() => "");
    await until(async () => {
      const now = new Set<string>();
      for (let i = 0; i < 6; i++) now.add(await get(url + "/pid").catch(() => ""));
      now.delete("");
      return now.size === 2 && [...now].some((pid) => !pids.has(pid));
    });
    assert.match(out, /exited \(3\); starting another/);
    // Close drains and stops every worker; the primary exits.
    const exited = new Promise<number | null>((done) => child.once("exit", done));
    child.stdin.write("close\n");
    assert.equal(await exited, 0);
    assert.match(out, /CLOSED/);
    await assert.rejects(get(url + "/pid"));
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
  }
});

test("cluster: a worker failing before it listens rejects start() without forking replacements", async () => {
  const { child, exited, out } = run("fail-start");
  try {
    assert.equal(await exited, 0);
    assert.match(out(), /REJECTED .*exited \(4\) before listening/);
    assert.match(out(), /FORKS 2\b/);
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
  }
});

test("cluster: workers that keep exiting make the primary give up and exit 1 once none is left", async () => {
  const { child, exited, out } = run("give-up");
  try {
    assert.equal(await exited, 1);
    assert.match(out(), /STARTED/);
    assert.match(out(), /workers keep exiting \(last: 5\); not restarting/);
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
  }
});

test("serve({ reusePort }): needs a fixed port; only where the kernel balances (Linux, FreeBSD)", async () => {
  const handler = () => new Response("ok");
  await assert.rejects(serve({ handler, port: 0, reusePort: true }), /needs a fixed port/);
  if (process.platform !== "linux" && process.platform !== "freebsd")
    await assert.rejects(serve({ handler, port: 41_987, reusePort: true }), /only on Linux and FreeBSD/);
});
