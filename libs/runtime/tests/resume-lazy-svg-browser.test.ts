// LAZY-FLIP 2026-10-21: a lazy `<For>` row with static SVG shapes (`_svgShapes`, kit `Icon`) materialises over the server
// `<path>` nodes instead of replacing them: `_svgShapes` clones pass through the adopt hook (`_adoption.node`, kind 0) like
// a `_tpl` clone, so the probe records them and the adopt run gets the server's back (ui fuzz: `/icons`, `/data-grid`, …
// "server node(s) replaced on the resumed page, kept by CSR: path").
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { ResumeState } from "@rivetjs/runtime/resume-format";
import { withIdScope } from "@rivetjs/runtime/id";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { LAZY_ROWS_BUILD, withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type R = { id: number; label: string };
const source = `import { For, _svgShapes } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
const CHECK = [["path", { d: "M20 6 9 17l-5-5" }], ["circle", { cx: "12", cy: "12", r: "10" }]];
export function Page(p) {
  const sel = signal(0);
  return <ul id="u"><For each={() => p.rows} by={(r) => r.id}>{(row) =>
    <li><button class={sel() === row().id ? "on" : "off"} onClick={() => sel.set(row().id)}><svg viewBox="0 0 24 24">{_svgShapes(CHECK)}</svg>{row().label}</button></li>}</For></ul>;
}`;
const dom = compileResume(source, "dom", "src/svg.tsx");
const mod = await importServer<{ Page(p: { rows: R[] }): ServerValue }>(compileResume(source, "server", "src/svg.tsx").code);
const manifest: ResumeManifest = { hash: "svg", runtime: "/rt.js", symbols: symbolUrls(dom.symbols), lazyRows: true };
const rows: R[] = [
  { id: 1, label: "a" },
  { id: 2, label: "b" },
  { id: 3, label: "c" },
];
process.env.RIVET_LAZY_ROWS = "on";
let body: string;
try {
  body = (await resumableToString(() => withIdScope("rv", () => mod.Page({ rows })), { manifest })) as string;
} finally {
  delete process.env.RIVET_LAZY_ROWS;
}
const state = JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(body)![1]!) as ResumeState;
assert.equal(state.L?.length, 1, "the For is lazy");
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  ...LAZY_ROWS_BUILD,
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + body + "</body></html>",
};
Object.assign(files, symbolModules(symbolChunks(dom.symbols)));

test("lazy rows: materialising rows keeps their server SVG shapes (no node replaced), and the shapes stay SVG", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.evaluate(() => document.querySelectorAll("#u *").forEach((el) => ((el as unknown as { __m: number }).__m = 1)));
    await page.click("#u li:nth-of-type(2) button");
    // `sel` is a read of every row: its first change materialised them all.
    await page.waitForFunction(() => [...document.querySelectorAll("#u button")].map((b) => b.className).join() === "off,on,off");
    const unmarked = await page.evaluate(() =>
      [...document.querySelectorAll("#u *")].filter((el) => (el as unknown as { __m?: number }).__m === undefined).map((el) => el.outerHTML),
    );
    assert.deepEqual(unmarked, []);
    assert.deepEqual(
      await page.evaluate(() =>
        [...document.querySelectorAll("#u svg > *")].map((el) => el.localName + ":" + (el.namespaceURI === "http://www.w3.org/2000/svg")),
      ),
      ["path:true", "circle:true", "path:true", "circle:true", "path:true", "circle:true"],
    );
    await page.click("#u li:nth-of-type(3) button");
    await page.waitForFunction(() => [...document.querySelectorAll("#u button")].map((b) => b.className).join() === "off,off,on");
    assert.deepEqual(errors, []);
  });
});
