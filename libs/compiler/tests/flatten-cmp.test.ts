import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

// FLATTEN-CMP (2026-10-06): resume-mode server cells that cannot record anything compile without the
// `_rBind` / `_rAttr` wrapper (plain slots: same HTML, no symbol).
const resume = { module: "src/m.tsx" };
const both = (source: string) => {
  const server = compile(source, { target: "server", filename: "src/m.tsx", resume });
  const dom = compile(source, { target: "dom", filename: "src/m.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  assert.deepEqual(
    dom.symbols!.map((s) => s.id),
    server.symbols!.map((s) => s.id),
  );
  return { code: server.code.replaceAll(/\s+/g, " "), symbols: server.symbols!.map((s) => [s.kind, s.captures]) };
};

const GETTERS = `import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Link } from "@rivetjs/router/client";
import { Card } from "./ui.tsx";
export function P(props: { rows: { id: number; name: string }[] }) {
  const sel = signal(-1);
  return <ul><For each={() => props.rows} by={(r) => r.id}>{(row, index) => (
    <li data-id={row().id} data-n={"n" + index()} data-sel={sel() === row().id}>
      {row().name}{index() + 1}{sel() === row().id ? "*" : ""}{row().name ? <b>{row().name}</b> : null}
      <Link to={"/r/" + row().id}>go</Link><Card id={row().id} />
    </li>
  )}</For></ul>;
}
export function Q(props: { rows: string[] }) {
  return <ul><For each={() => props.rows} by={(r) => r}>{(row) => { row = () => "x"; return <li>{row()}</li>; }}</For>
    {props.rows.map((r) => <i>{r}</i>)}</ul>;
}
export function V(props: { get: () => string }) { return <p>{props.get()}</p>; }
`;

test("1: For row getter reads (row() / index()) are plain cells; signal reads, JSX and other components keep their sites", () => {
  const { code, symbols } = both(GETTERS);
  assert.match(code, /__rivetAttribute\("data-id", row\(\)\.id\)/);
  assert.match(code, /__rivetAttribute\("data-n", "n" \+ index\(\)\)/);
  assert.match(code, /__rivetR_id\(\), row\(\)\.name, index\(\) \+ 1, __rivetR_bind/);
  // Bare router/client `Link` with getter-only props: inline `<a href={_linkHref(to)}>` (compile/server_link.rs), no site.
  assert.match(code, /__rivetAttribute\("href", __rivetLinkHref\("\/r\/" \+ row\(\)\.id\)\)/);
  assert.match(code, /"<a", ">go<\/a>"/);
  assert.deepEqual(symbols, [
    ["region", ["props", "sel"]], // the For
    ["attr", ["sel", "row"]], // data-sel reads a signal
    ["bind", ["sel", "row"]], // {sel() === row().id ? "*" : ""}
    ["bind", ["row"]], // a JSX branch keeps its site
    ["region", ["row"]], // a user component
    ["region", ["props"]], // Q's For
    ["bind", ["row"]], // a reassigned row parameter is no getter
    ["bind", ["props"]], // .map
    ["bind", ["props"]], // props.get(): any other call
  ]);
});

// Server render of resume-compiled code (runtime test helper resolves the runtime specifiers).
const render = async (source: string, serverListMounts?: boolean) => {
  const { importServer } = await import("../../runtime/tests/resume/compile.ts");
  // Same (native) module instance as the imported fixture's recorder hooks.
  const { resumableToString } = await importServer<{ resumableToString(f: () => never, o: object): string | Promise<string> }>(
    'export { resumableToString } from "@rivetjs/runtime/server-resume";',
  );
  const server = compile(source, { target: "server", filename: "src/m.tsx", resume, serverListMounts });
  const dom = compile(source, { target: "dom", filename: "src/m.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  const mod = await importServer<{ Page(): never }>(server.code);
  const manifest = { runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols!.map((s) => [s.id, "/c.js"])) };
  return { code: server.code, html: (await resumableToString(() => mod.Page(), { manifest })) as string };
};

test("1: For rows render the same markup without the getter-only wrappers", async () => {
  const { html } = await render(`import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/server";
export function Page() {
  const items = signal([{ id: 1, name: "a" }, { id: 2, name: "b" }]), sel = signal(2);
  return <ul><For each={items} by={(r) => r.id}>{(row, index) => <li data-id={row().id} data-sel={sel() === row().id}>{row().name}{index()}{sel() === row().id ? "*" : ""}</li>}</For></ul>;
}`);
  // Getter cells: plain text; the signal cell: a text binding; `data-sel`: a binding (data-r).
  assert.match(html, /^<ul><!--r\d*\[--><!--r\d*\[--><li data-id="1" data-sel="false" data-r="\d+">a0<!--r\d*--><!--\/--><\/li><!--\]-->/);
  assert.match(html, /<li data-id="2" data-sel="true" data-r="\d+">b1<!--r\d*-->\*<!--\/--><\/li>/);
});

const LISTS = `import { signal } from "@rivetjs/reactivity";
function Row({ item }: { item: { id: number; name: string } }) {
  return <li data-id={item.id}>{item.name}</li>;
}
function Clicky({ item }: { item: { id: number; name: string } }) {
  return <li onClick={() => console.log(item.id)}>{item.name}</li>;
}
export function Page() {
  const items = signal([{ id: 1, name: "a<" }, { id: 2, name: "b" }]);
  return <main>
    <ul class="native">{items().map((x) => <li title={x.name}>{x.id}</li>)}</ul>
    <ul class="twin">{items().map((x) => <Row item={x} />)}</ul>
    <ul class="handler">{items().map((x) => <li onClick={() => console.log(x.id)}>{x.name}</li>)}</ul>
    <ul class="twin-handler">{items().map((x) => <Clicky item={x} />)}</ul>
  </main>;
}`;

test("2: resume mode lowers site-free .map rows to list mounts; rows with resume sites keep records", async () => {
  const lists = await render(LISTS);
  const plain = await render(LISTS, false);
  assert.equal(lists.html, plain.html);
  assert.equal(lists.code.match(/__rivetList\(/g)?.length, 2, lists.code);
  assert.match(lists.code, /function Row__rivetTape\(/);
  assert.doesNotMatch(lists.code, /Clicky__rivetTape/);
  assert.doesNotMatch(plain.code, /__rivetList\(/);
  assert.match(lists.html, /<ul class="native"><!--r\d*\[--><li title="a&lt;">1<\/li>/);
});

test("resume list eligibility isolates nested and neighboring sites across Unicode source spans", async () => {
  // CONTAIN-INDEX (`rust/src/resume/bounds.rs`): the containment index must keep the scan's inclusive bounds.
  const source = `// é 😀 — site-free neighbors must not inherit a nested handler
const rows = [1, 2];
export function Page() {
  return <main>
    {rows.map(x => <p>{x}</p>)}
    {rows.map(x => <section>{rows.map(y => <button onClick={() => console.log(x + y)}>{x + y}</button>)}</section>)}
    {rows.map(x => <p>{x}</p>)}
  </main>;
}`;
  const lists = await render(source);
  const plain = await render(source, false);
  assert.equal(lists.html, plain.html);
  assert.equal(lists.code.match(/__rivetList\(/g)?.length, 2, lists.code);
  assert.doesNotMatch(plain.code, /__rivetList\(/);
});
