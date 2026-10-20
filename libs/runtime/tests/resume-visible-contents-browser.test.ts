// `when("visible")` on a `display: contents` target (framework island roots): the element has no box, so an
// IntersectionObserver on it never fires; dom-resume observes its element children (≤ 48) instead.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = `
import { clientEffect } from "@rivetjs/runtime/dom";
export function Page() {
  let island;
  let box;
  let nested;
  let empty;
  clientEffect(() => { island.dataset.fired = "1"; }, { when: "visible" });
  clientEffect(() => { nested.dataset.fired = "1"; }, { when: "visible" });
  clientEffect(() => { empty.dataset.fired = "1"; }, { when: "visible" });
  clientEffect(() => { box.dataset.fired = "1"; }, { when: "visible" });
  return <main>
    <div style={{ height: "6000px" }}>spacer</div>
    <div id="island" ref={(el) => (island = el)} style={{ display: "contents" }}><p id="kid" style={{ height: "40px" }}>kid</p></div>
    <div style={{ height: "6000px" }}>spacer</div>
    <div id="nested" ref={(el) => (nested = el)} style={{ display: "contents" }}><div style={{ display: "contents" }}><p id="deep" style={{ height: "40px" }}>deep</p></div></div>
    <div id="empty" ref={(el) => (empty = el)} style={{ display: "contents" }}>text only</div>
    <div style={{ height: "6000px" }}>spacer</div>
    <div id="box" ref={(el) => (box = el)} style={{ height: "40px" }}>box</div>
  </main>;
}
`;
const dom = compileResume(source, "dom", "src/contents.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/contents.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const manifest: ResumeManifest = {
  hash: "contents",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
Object.assign(files, symbolModules(byComponent));
const html = "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Page(), { manifest })) + "</body></html>";

test("visible on a display:contents wrapper below the fold fires only once a descendant scrolls into view (nested wrappers; none: idle)", async () => {
  const result = await withPage({ ...files, "/": html }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto("http://rivet.test/");
    const fired = (id: string) => p.evaluate((i) => document.getElementById(i)!.dataset.fired ?? "", id);
    // Idle passes, nothing in view (rootMargin 100%): neither effect runs.
    await p.waitForTimeout(400);
    const before = { island: await fired("island"), nested: await fired("nested"), box: await fired("box") };
    // No element with a box inside: falls back to idle (already fired).
    const empty = await fired("empty");
    await p.evaluate(() => document.getElementById("kid")!.scrollIntoView());
    await p.waitForFunction(() => document.getElementById("island")!.dataset.fired === "1", null, { timeout: 3000 }).catch(() => {});
    const afterKid = { island: await fired("island"), box: await fired("box") };
    // Nested contents wrappers: their descendants are observed.
    const nestedBefore = await fired("nested");
    await p.evaluate(() => document.getElementById("deep")!.scrollIntoView());
    await p.waitForFunction(() => document.getElementById("nested")!.dataset.fired === "1", null, { timeout: 3000 }).catch(() => {});
    const nestedAfter = await fired("nested");
    // A boxed target still observes itself.
    await p.evaluate(() => document.getElementById("box")!.scrollIntoView());
    await p.waitForFunction(() => document.getElementById("box")!.dataset.fired === "1", null, { timeout: 3000 }).catch(() => {});
    return { errors, before, empty, afterKid, nestedBefore, nestedAfter, box: await fired("box") };
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.before, { island: "", nested: "", box: "" });
  assert.equal(result.empty, "1");
  assert.equal(result.nestedBefore, "");
  assert.equal(result.nestedAfter, "1");
  assert.deepEqual(result.afterKid, { island: "1", box: "" });
  assert.equal(result.box, "1");
});
