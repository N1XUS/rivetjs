// LAZY-COST (+ LAZY-COST-2: settled component rows, `writable`, rendered by one renderer per For): a lazy `<For>` whose row is
// a row plan (`$rows`, R-PLAN) writes its rows from one list tape
// (`server-resume.ts` `lazyPlanRows`: region plan without ids, WebAssembly row emitter on byte writers) instead of rendering
// each row to a string. Differential: every case renders with row plans (default) and with `_setLazyPlans(false)` (each row
// through `lazyRowValue`, the pre-LAZY-COST path): the same resume state, and the same HTML once chained marker ids are
// normalised (the tape rows leave strided row marker ids out, `<!--r[-->`, as row region plans do; both browser marker
// scans — `dom-resume.ts` `markers()`, the lazy add-on — read them).
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { _setLazyPlans, renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { NodeStreamWriter } from "@rivetjs/runtime/node";
import { withIdScope } from "@rivetjs/runtime/id";
import { compileResume, importServer, symbolUrls } from "./resume/compile.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Row = { id: number; label: string; n: number; parts: unknown };

const source = `import { For } from "@rivetjs/runtime/dom";
import { signal, selector } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/runtime/id";
export const sel = signal(2);
const isSel = selector(sel);
// The ssr-bench /resume row: a reactive attribute, a handler, plain attributes and text (escaped), a link.
export function Bench(p) {
  return <section><For each={() => p.rows} by={(r) => r.id}>{(row) =>
    <article data-row={row().id} data-state={sel() === row().id ? "selected" : "even"}>
      <h2><a href={"/resume?rows=" + row().id}>Record &amp; {row().label}</a></h2>
      <dl><dt>n</dt><dd>{row().n}</dd><dt>label</dt><dd title={row().label}>{row().label}</dd></dl>
      <button type="button" onClick={() => sel.set(row().id)}>Pick</button>
    </article>}</For></section>;
}
// Index reads, a capture handler, a selector read (keyed wake: entry [12]).
export function Indexed(p) {
  return <ol><For each={() => p.rows} by={(r) => r.id}>{(row, i) =>
    <li data-i={i()} class={isSel(row().id) ? "on" : "off"} onClickCapture={() => sel.set(i())}>{i() + 1}: {row().label}</li>}</For></ol>;
}
// A content slot holding an object (an array) on some rows: that row and every row after it render one by one.
export function Mixed(p) {
  return <ul><For each={() => p.rows} by={(r) => r.id}>{(row) =>
    <li onClick={() => sel.set(row().id)}>{row().parts}</li>}</For></ul>;
}
// An id created in a row slot: the row's id seed (\`_rowIdPrefix\`), so the rows render one by one.
export function Ids(p) {
  return <ul><For each={() => p.rows} by={(r) => r.id}>{(row) =>
    <li id={createId()} onClick={() => sel.set(row().id)}>{row().label}</li>}</For></ul>;
}
// No resume site in the row.
export function Plain(p) {
  return <ul><For each={() => p.rows} by={(r) => r.id}>{(row) => <li title={row().label}>{row().n}</li>}</For></ul>;
}
// LAZY-COST-2 — component rows (no row plan; the cdk collections' \`renderNodeAt\` rows): a row whose value is settled
// (compiled records, attribute / spread records, text) is kept as is and the For renders all such rows at once; one holding deferred content (a
// function child) renders to a string in the row's context.
function Item(props) {
  const id = createId();
  return <li id={id} data-key={props.k} {...props.attrs} aria-selected={isSel(props.k) ? "true" : "false"} onClick={() => sel.set(props.k)}>{props.label}</li>;
}
export function Comp(p) {
  return <ul><For each={() => p.rows} by={(r) => r.id}>{(row) => <Item k={row().id} label={row().label} attrs={{ title: row().label, "data-n": row().n }} />}</For></ul>;
}
// Content the writer renders later (a function child): its id comes from the row's seed only inside the row's context.
const later = () => <b id={createId()}>later</b>;
export function Deferred(p) {
  return <section><For each={() => p.rows} by={(r) => r.id}>{(row) =>
    <div class="wrap" title={row().label} onClick={() => sel.set(row().id)}>{later}</div>}</For></section>;
}
`;
const dom = compileResume(source, "dom", "src/plan.tsx");
const server = compileResume(source, "server", "src/plan.tsx");
for (const name of ["Comp", "Deferred"]) {
  const body = server.code.slice(server.code.indexOf("function " + name + "("));
  assert.match(body.slice(0, body.indexOf("\nexport function", 1) >>> 0), /"\$lazy"/, name + ": lazy verdict");
}
for (const name of ["Bench", "Indexed", "Mixed", "Ids", "Plain"]) {
  const body = server.code.slice(server.code.indexOf("function " + name + "("));
  assert.match(body.slice(0, body.indexOf("\nexport function", 1) >>> 0), /"\$rows"[\s\S]*"\$lazy"/, name + ": row plan + lazy verdict");
}
const mod = await importServer<Record<string, (p: { rows: Row[] }) => ServerValue>>(server.code);
const manifest: ResumeManifest = { runtime: "/rt.js", symbols: symbolUrls(dom.symbols), lazyRows: true };

afterEach(() => {
  delete process.env.RIVET_LAZY_ROWS;
  _setLazyPlans(true);
});
const rows = (n: number, rich = -1): Row[] =>
  Array.from({ length: n }, (_, k) => ({
    id: k + 1,
    label: k % 3 ? "row " + k : "<b>&" + k + "</b>",
    n: k * 7,
    parts: k === rich ? ["<i>", k, null, "part"] : "text " + k,
  }));
const stringPage = (name: string, data: Row[]): Promise<string> =>
  resumableToString(() => withIdScope("rv", () => mod[name]!({ rows: data })), { manifest }) as Promise<string>;
// Byte writer (the router's path: list rows through the WebAssembly emitter).
async function bytePage(name: string, data: Row[]): Promise<string> {
  const chunks: Buffer[] = [];
  const sink = new Readable({ read() {} }) as unknown as { write(chunk: Uint8Array | string, cb?: () => void): boolean };
  Object.assign(sink, {
    destroyed: false,
    writableEnded: false,
    writableLength: 0,
    write(chunk: Uint8Array | string, cb?: () => void) {
      chunks.push(Buffer.from(chunk as Uint8Array));
      cb?.();
      return true;
    },
  });
  const writer = new NodeStreamWriter(sink as never);
  await withIdScope("rv", () => renderResumable(() => mod[name]!({ rows: data }), writer, { manifest }));
  await writer.finish();
  return Buffer.concat(chunks).toString();
}
const normal = (html: string): string => html.replace(/<!--r\d*\[-->/g, "<!--r[-->");
// A page whose rows hold no resume site (Plain) writes no state at all.
const state = (html: string): string => /<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)?.[1] ?? "";
async function both(name: string, data: Row[], render: (name: string, data: Row[]) => Promise<string>): Promise<[string, string]> {
  process.env.RIVET_LAZY_ROWS = "on";
  _setLazyPlans(true);
  const planned = await render(name, data);
  _setLazyPlans(false);
  const rowByRow = await render(name, data);
  _setLazyPlans(true);
  return [planned, rowByRow];
}

for (const [label, render] of [
  ["string", stringPage],
  ["bytes", bytePage],
] as const)
  for (const name of ["Bench", "Indexed", "Mixed", "Ids", "Plain", "Comp", "Deferred"])
    test(`${label}: ${name} — planned lazy rows equal the row-by-row lazy rows (state byte-equal, HTML modulo chained marker ids)`, async () => {
      for (const n of [1, 2, 3, 40]) {
        const data = rows(n, name === "Mixed" ? 1 : -1);
        const [planned, rowByRow] = await both(name, data, render);
        if (name !== "Plain") assert.ok(/"L":\[\[/.test(state(planned)), "a lazy entry");
        else assert.match(planned, /<!--r\d+\[--><li title=/);
        assert.equal(state(planned), state(rowByRow));
        assert.equal(normal(planned), normal(rowByRow));
        if ((name === "Bench" || name === "Comp") && n === 40) assert.ok(planned.length < rowByRow.length, "chained marker ids left out");
        if (name === "Deferred") assert.equal(planned, rowByRow, "deferred rows: the row-by-row path, byte-equal");
      }
    });

test("Mixed / Ids: rows after the first unplannable one render one by one (their own id seeds)", async () => {
  process.env.RIVET_LAZY_ROWS = "on";
  const ids = await stringPage("Ids", rows(3));
  assert.match(ids, /<li id="rvr\d+_0_0">/);
  assert.match(ids, /<li id="rvr\d+_2_0">/);
  const mixed = await stringPage("Mixed", rows(4, 2));
  assert.match(mixed, /<li>&lt;i&gt;2part<\/li>/);
});

test("component rows: ids from the row seed on both paths (settled rows and deferred content)", async () => {
  process.env.RIVET_LAZY_ROWS = "on";
  const comp = await stringPage("Comp", rows(3));
  assert.match(comp, /<li id="rvr\d+_0_0" data-key="1" title="&lt;b&gt;&amp;0&lt;\/b&gt;" data-n="0" aria-selected="false">/);
  assert.match(comp, /<li id="rvr\d+_2_0" data-key="3"/);
  const deferred = await stringPage("Deferred", rows(2));
  assert.match(deferred, /<div class="wrap" title="row 1"><b id="rvr\d+_1_0">later<\/b><\/div>/);
});
