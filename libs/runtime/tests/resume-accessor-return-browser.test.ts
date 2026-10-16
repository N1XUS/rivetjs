// RESUME-ACCESSOR-ROW (2026-10-12): a component returning an accessor (`return () => (props.sel() === props.id ? … : …)`,
// also a concise `(props) => () => …`) is a resumable child site: the server compiles the returned arrow to
// `_rChild(_rFn(…))`, so its reads are recorded where the component renders (a For row, an element child) and the
// browser re-runs it on change. Before, the server traversal called the accessor outside every site: no reads were
// recorded and the resumed page never updated it. Fix 1: a ternary of accessors and a returned local `const` arrow too;
// fix 2: a returned hoisted `function view() {}` (For rows `#hl`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
type Row = { id: number };
function Panel(props: { id: number; sel: () => number }) {
  return () => (props.sel() === props.id ? <li class={"on p" + props.id}>on {props.id}</li> : <li class={"off p" + props.id}>off {props.id}</li>);
}
const Badge = (props: { sel: () => number }) => () => (props.sel() > 1 ? <b id="badge">many {props.sel()}</b> : <i id="badge">one</i>);
function Tern(props: { c: boolean; sel: () => number }) {
  return props.c ? () => <b>t{props.sel()}</b> : () => <i>f{props.sel()}</i>;
}
function Named(props: { sel: () => number }) {
  const view = () => (props.sel() > 1 ? <b>n many</b> : <i>n one</i>);
  return view;
}
function Hoisted(props: { id: number; sel: () => number }) {
  return view;
  function view() {
    return props.sel() === props.id ? <li>h on {props.id}</li> : <li>h off {props.id}</li>;
  }
}
export function Page() {
  const sel = signal(1);
  const rows = signal<Row[]>([{ id: 1 }, { id: 2 }, { id: 3 }]);
  return <main>
    <button id="add" onClick={() => rows.set([...rows(), { id: rows().length + 1 }])}>add</button>
    <button id="pick" onClick={() => sel.set(2)}>pick</button>
    <p id="top"><Badge sel={sel} />|<Tern c={true} sel={sel} />|<Named sel={sel} /></p>
    <ul id="list"><For each={rows()} by={(r) => r.id}>{(r) => <Panel id={r().id} sel={sel} />}</For></ul>
    <ul id="hl"><For each={rows()} by={(r) => r.id}>{(r) => <Hoisted id={r().id} sel={sel} />}</For></ul>
  </main>;
}
`;
const dom = compileResume(source, "dom", "src/accessor.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/accessor.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const manifest: ResumeManifest = {
  hash: "accessor",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
const html = "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Page(), { manifest })) + "</body></html>";

async function run(buttons: string[]): Promise<{ steps: { list: string; top: string; hl: string }[]; errors: string[] }> {
  return withPage({ ...files, "/": html }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto("http://rivet.test/");
    const steps: { list: string; top: string; hl: string }[] = [];
    const read = () =>
      p.evaluate(() => ({
        list: [...document.querySelectorAll("#list li")].map((li) => li.className + ":" + li.textContent).join("|"),
        top: document.querySelector("#top")!.textContent!,
        hl: [...document.querySelectorAll("#hl li")].map((li) => li.textContent).join("|"),
      }));
    for (const button of buttons) {
      const before = await p.evaluate(() => document.querySelector("main")!.innerHTML);
      await p.click(button);
      // First mouse click flushes one task later: wait for the page to change, then a frame.
      await p.waitForFunction((b) => document.querySelector("main")!.innerHTML !== b, before, { timeout: 2000 }).catch(() => {});
      await p.waitForTimeout(50);
      steps.push(await read());
    }
    return { steps, errors };
  });
}

test("server HTML renders the accessors", () => {
  assert.match(html, /on 1/);
  assert.match(html, /off 2/);
  assert.match(html, /one/);
});

test("a changed read re-runs the returned accessor (For row + element child)", async () => {
  const { steps, errors } = await run(["#pick", "#add"]);
  assert.deepEqual(errors, []);
  assert.deepEqual(steps[0], { list: "off p1:off 1|on p2:on 2|off p3:off 3", top: "many 2|t2|n many", hl: "h off 1|h on 2|h off 3" });
  assert.deepEqual(steps[1], {
    list: "off p1:off 1|on p2:on 2|off p3:off 3|off p4:off 4",
    top: "many 2|t2|n many",
    hl: "h off 1|h on 2|h off 3|h off 4",
  });
});

test("an items change first, then the read", async () => {
  const { steps, errors } = await run(["#add", "#pick"]);
  assert.deepEqual(errors, []);
  assert.deepEqual(steps[0], { list: "on p1:on 1|off p2:off 2|off p3:off 3|off p4:off 4", top: "one|t1|n one", hl: "h on 1|h off 2|h off 3|h off 4" });
  assert.deepEqual(steps[1], {
    list: "off p1:off 1|on p2:on 2|off p3:off 3|off p4:off 4",
    top: "many 2|t2|n many",
    hl: "h off 1|h on 2|h off 3|h off 4",
  });
});
