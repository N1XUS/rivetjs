// Adopted server rows of a keyed For survive a refetched list (2026-10-08): the first client update after resume gets
// new item objects for unchanged rows (live page revalidation, any `set(fetched)`). A row whose fresh item equals the
// server item in data keeps its server nodes and resumed bindings (`dom-adopt.ts` `same`); a changed item still
// re-creates its row (its resumed bindings read the server item).
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
type Row = { id: number; name: string; tags: string[]; at: Date };
const make = (): Row[] => [1, 2, 3].map((id) => ({ id, name: "row " + id, tags: ["a", "b"], at: new Date(id * 1000) }));
export function Page() {
  const rows = signal(make());
  return <main>
    <button id="same" onClick={() => rows.set(make())}>same</button>
    <button id="edit" onClick={() => rows.set(make().map((r) => (r.id === 2 ? { ...r, name: "changed" } : r)))}>edit</button>
    <button id="tags" onClick={() => rows.set(make().map((r) => (r.id === 3 ? { ...r, tags: ["a"] } : r)))}>tags</button>
    <ul id="list"><For each={rows()} by={(r) => r.id}>{(r) => <li class={"r" + r().id}>{r().name} {r().tags.join()}</li>}</For></ul>
  </main>;
}
`;
const dom = compileResume(source, "dom", "src/rows.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/rows.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const manifest: ResumeManifest = { hash: "rows", runtime: "/rt.js", symbols: symbolUrls(dom.symbols) };
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
Object.assign(files, symbolModules(byComponent));

async function run(button: string): Promise<{ kept: string[]; text: string; errors: string[] }> {
  const page = "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Page(), { manifest })) + "</body></html>";
  return withPage({ ...files, "/": page }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto("http://rivet.test/");
    await p.evaluate(() => document.querySelectorAll("#list li").forEach((li) => ((li as unknown as { __kept: boolean }).__kept = true)));
    const before = await p.evaluate(() => document.querySelector("#list")!.innerHTML);
    await p.click(button);
    // The region re-creation runs on the click (deferred first-click flush): wait for it, then a frame.
    await p.waitForFunction((b) => document.querySelector("#list")!.innerHTML !== b, before, { timeout: 1000 }).catch(() => {});
    await p.waitForTimeout(50);
    return p.evaluate((e) => {
      const lis = [...document.querySelectorAll("#list li")];
      return {
        kept: lis.filter((li) => (li as unknown as { __kept?: boolean }).__kept).map((li) => li.className),
        text: lis.map((li) => li.textContent).join("|"),
        errors: e,
      };
    }, errors);
  });
}

test("refetched list with equal data: every server row is kept", async () => {
  const out = await run("#same");
  assert.deepEqual(out.kept, ["r1", "r2", "r3"]);
  assert.equal(out.text, "row 1 a,b|row 2 a,b|row 3 a,b");
  assert.deepEqual(out.errors, []);
});

test("refetched list with one changed row: only that row is re-created (also a nested array change)", async () => {
  const edit = await run("#edit");
  assert.deepEqual(edit.kept, ["r1", "r3"]);
  assert.equal(edit.text, "row 1 a,b|changed a,b|row 3 a,b");
  const tags = await run("#tags");
  assert.deepEqual(tags.kept, ["r1", "r2"]);
  assert.equal(tags.text, "row 1 a,b|row 2 a,b|row 3 a");
  assert.deepEqual([...edit.errors, ...tags.errors], []);
});

// A row whose own render reads a signal no site inside it binds (cdk TabPanels: an unselected TabPanel renders nothing)
// is re-created with its region even when its fresh item equals the server one (`reads` row flag): kept, it never showed
// the newly selected panel (cdk-docs tabs-nested, 2026-10-08).
const panels = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
const make = () => [1, 2, 3].map((id) => ({ id }));
function Panel(props: { id: number; sel: () => number }) {
  if (props.sel() !== props.id) return null;
  return <li class={"p" + props.id}>panel {props.id}</li>;
}
export function Page() {
  const sel = signal(1);
  const list = () => (sel(), make());
  return <main>
    <button id="pick" onClick={() => sel.set(2)}>pick</button>
    <ul id="list"><For each={list()} by={(r) => r.id}>{(r) => <Panel id={r().id} sel={sel} />}</For></ul>
  </main>;
}
`;
test("a row whose own render read a signal is re-created with its region (equal data or not)", async () => {
  const pdom = compileResume(panels, "dom", "src/panels.tsx");
  const pserver = await importServer<{ Page(): ServerValue }>(compileResume(panels, "server", "src/panels.tsx").code);
  const groups = symbolChunks(pdom.symbols);
  const pmanifest: ResumeManifest = {
    hash: "panels",
    runtime: "/rt.js",
    symbols: symbolUrls(pdom.symbols),
  };
  const served: Record<string, Served> = { "/fixture.mjs": rewrite(pdom.code), "/rt.js": files["/rt.js"]! };
  for (const [path, symbols] of Object.entries(groups)) served[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
  const page = "<!doctype html><html><head></head><body>" + (await resumableToString(() => pserver.Page(), { manifest: pmanifest })) + "</body></html>";
  await withPage({ ...served, "/": page }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto("http://rivet.test/");
    assert.equal(await p.evaluate(() => document.querySelector("#list")!.textContent), "panel 1");
    await p.click("#pick");
    await p.waitForFunction(() => document.querySelector("#list")!.textContent === "panel 2", null, { timeout: 2000 });
    assert.deepEqual(errors, []);
  });
});

// Uniform rows (compact `{i, d, a, w: 1}` form) whose own render read a signal: `w` there is the rows' reads flag, not a
// Show branch spec (`{w, k}`) — the browser read the rows as a branch of region 1 and threw "reading 'start'" on the
// first change (cdk Tree createTreeData, 2026-10-09).
const compact = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
const make = () => [1, 2, 3, 4].map((id) => ({ id }));
export function Page() {
  const sel = signal(1);
  const list = () => (sel(), make());
  return <main>
    <button id="pick" onClick={() => sel.set(2)}>pick</button>
    <button id="first" onClick={() => sel.set(1)}>first</button>
    <ul id="list"><For each={list()} by={(r) => r.id}>{(r) => {
      const on = sel() === r().id;
      return <li class={on ? "on" : "off"} onClick={() => sel.set(r().id)}>row {r().id}</li>;
    }}</For></ul>
  </main>;
}
`;
test("compact rows whose own render read a signal: re-created, not read as a branch", async () => {
  const cdom = compileResume(compact, "dom", "src/compact.tsx");
  const cserver = await importServer<{ Page(): ServerValue }>(compileResume(compact, "server", "src/compact.tsx").code);
  const groups = symbolChunks(cdom.symbols);
  const cmanifest: ResumeManifest = {
    hash: "compact",
    runtime: "/rt.js",
    symbols: symbolUrls(cdom.symbols),
  };
  const served: Record<string, Served> = { "/fixture.mjs": rewrite(cdom.code), "/rt.js": files["/rt.js"]! };
  for (const [path, symbols] of Object.entries(groups)) served[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
  const html = await resumableToString(() => cserver.Page(), { manifest: cmanifest });
  assert.match(html, /"w":1/, "compact rows carry the reads flag");
  const page = "<!doctype html><html><head></head><body>" + html + "</body></html>";
  await withPage({ ...served, "/": page }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    p.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await p.goto("http://rivet.test/");
    assert.equal(await p.evaluate(() => [...document.querySelectorAll("#list li")].map((li) => li.className).join()), "on,off,off,off");
    await p.click("#pick");
    await p.waitForFunction(() => [...document.querySelectorAll("#list li")].map((li) => li.className).join() === "off,on,off,off", null, { timeout: 2000 });
    assert.deepEqual(errors, []);
  });
});
