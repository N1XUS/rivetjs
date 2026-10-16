// Deploy skew end to end (Function Bridge T30, spec §6): a page rendered by deploy v1 whose chunks come from deploy v2.
// Sources: the corpus `skew-renumbered` / `skew-changed` cases (resume/bridge-corpus.ts). The loader is not probed here
// (the corpus test cancels its reload): a skew must reload exactly once, after `rivet:resume-error` {skew}, and no v2
// handler may ever run on the v1 document. After the reload the server serves v2's HTML (the deploy switched).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { importResume, serializeAndRevive } from "@rivetjs/runtime/testing/resume";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import { cases } from "./resume/bridge-corpus.ts";

// The browser runs the same `#dev` build as this process (runtime-dev project: the development decoder's messages).
const DEV = process.execArgv.includes("--conditions=development");
const devModule = DEV ? stripTypeScriptTypes(await readFile(new URL("../dev/on.ts", import.meta.url), "utf8")) : undefined;

// Every handler records the document version it ran on (`<html data-v>`).
const instrument = (source: string): string => source.replace(/onClick=\{\(\) => (out\.set\("[^"]*"\))\}/g, "onClick={() => (globalThis.__mark(), $1)}");

async function deploy(source: string, base: string, version: string, files: Record<string, Served>): Promise<{ html: string; symbols: ResumeSymbol[] }> {
  const module = "src/page.tsx";
  const server = compileResume(instrument(source), "server", module);
  const dom = compileResume(instrument(source), "dom", module);
  const mod = await importServer<{ Page: () => never }>(server.code);
  const chunk = base + "c/Page.js";
  const manifest: ResumeManifest = {
    hash: version,
    runtime: base + "rt.js",
    builtins: base + "builtins.js",
    symbols: Object.fromEntries(server.symbols.map((s) => [s.id, chunk])),
  };
  const html = `<!doctype html><html data-v="${version}"><head></head><body>${await resumableToString(() => mod.Page(), { manifest })}</body></html>`;
  // The chunks a deploy serves (v2 overwrites v1's: same URLs).
  files[base + "fixture.mjs"] = rewrite(dom.code);
  files[base + "rt.js"] = 'import { createResume } from "/dom-resume.ts"; export default createResume({});';
  files[base + "builtins.js"] = 'import "/resume-builtins.ts";';
  files[chunk] = rewrite(compileSymbolModule(dom.symbols, base + "fixture.mjs"));
  return { html, symbols: server.symbols };
}

interface Run {
  texts: string[];
  ran: string[];
  errors: { skew?: string; message?: string }[];
  navigations: number;
}
async function run(id: string, clicks: number): Promise<Run & { v1: ResumeSymbol[] }> {
  const c = cases.find((x) => x.id === id)!;
  const base = "/" + id + "/";
  const files: Record<string, Served> = devModule ? { "/dev/off.ts": devModule } : {};
  const v1 = await deploy(c.source, base, "1", {});
  const v2 = await deploy(c.domSource!, base, "2", files);
  let documents = 0;
  Object.defineProperty(files, base, { enumerable: true, get: () => (documents++ === 0 ? v1.html : v2.html) });
  const out = await withPage(files, async (page) => {
    let navigations = 0;
    page.on("framenavigated", (frame) => frame === page.mainFrame() && navigations++);
    await page.addInitScript(() => {
      const push = (key: string, item: unknown) => sessionStorage.setItem(key, JSON.stringify([...JSON.parse(sessionStorage.getItem(key) ?? "[]"), item]));
      (globalThis as { __mark?: () => void }).__mark = () => push("ran", document.documentElement.dataset.v);
      document.addEventListener("rivet:resume-error", (event) => {
        const detail = (event as CustomEvent<{ skew?: string; message?: string }>).detail;
        push("errors", { skew: detail?.skew, message: detail?.message, v: document.documentElement.dataset.v });
      });
    });
    await page.goto("http://rivet.test" + base);
    const texts: string[] = [];
    for (let i = 0; i < clicks; i++) {
      await page.click(".go");
      await page.waitForTimeout(400);
      await page.waitForLoadState("load");
      texts.push((await page.textContent(".out"))!);
    }
    await page.waitForTimeout(100);
    const ran = await page.evaluate(() => JSON.parse(sessionStorage.getItem("ran") ?? "[]"));
    const errors = await page.evaluate(() => JSON.parse(sessionStorage.getItem("errors") ?? "[]"));
    return { texts, ran, errors, navigations };
  });
  return { ...out, v1: v1.symbols };
}

test("skew-renumbered: a handler inserted before in the next deploy — the content-stable id finds the right handler, no reload", async () => {
  const r = await run("skew-renumbered", 1);
  assert.deepEqual(r.texts, ["go"]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.navigations, 1);
  assert.deepEqual(r.ran, ["1"], "exactly one v1 handler ran");
});

test("skew-changed: the handler's code changed — `rivet:resume-error` {skew} on v1, exactly one reload, v2's handler never runs on v1", async () => {
  const r = await run("skew-changed", 2);
  // v1 click: skew → reload (v2 HTML, still idle); the click on the reloaded v2 page runs v2's handler.
  assert.equal(r.navigations, 2, "one reload");
  assert.equal(r.errors.length, 1, JSON.stringify(r.errors));
  const [error] = r.errors as { skew?: string; message?: string; v?: string }[];
  assert.equal(error!.v, "1");
  assert.ok(
    r.v1.some((s) => s.id === error!.skew),
    String(error!.skew),
  );
  // The browser decoder's message (production / development, as this process) is the one `serializeAndRevive` throws for a
  // skew: compared with the symbol id taken out.
  assert.equal(error!.message, (DEV ? "Resume symbol is missing from its chunk (deploy skew): " : "Resume symbol is not loaded: ") + error!.skew);
  const fx = await importResume<typeof import("./resume/serialize-fixture.tsx")>(new URL("./resume/serialize-fixture.tsx", import.meta.url));
  const ours = await serializeAndRevive(() => fx.Counter(), { symbols: { "libs/runtime/tests/resume/serialize-fixture.tsx": {} } }).then(
    () => undefined,
    (e: Error & { skew?: string }) => e,
  );
  assert.ok(ours?.skew);
  assert.equal(ours.message.replace(ours.skew, "<id>"), error!.message!.replace(error!.skew!, "<id>"));
  assert.ok(!r.ran.includes("1"), "no handler ran on the v1 document: " + JSON.stringify(r.ran));
  assert.deepEqual(r.texts, ["idle", "WRONG"]);
});
