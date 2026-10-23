// Derived model, boundary recorder (M2 lane A, R1): `_rB` / `_rBOut` / `_rBEnd` / `_rBAttr` / `_rSig` under
// `derivedToString` — boundary records, keyed values, wake lists, markers and the values-only tail on the ssr-bench
// `/resume` page shape (spike S1's page). The fixture is hand-lowered to
// the ABI (as the compiler emits it) and compiled with the plain server target, so the suite runs on today's wasm; the
// last case compiles the un-lowered page with `resume: { module }` .
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import { renderToString } from "@rivetjs/runtime/server";
import type { ServerValue } from "@rivetjs/runtime/server";
import { _rB, _rBOut, _rBEnd, _rBAttr, _rSig, _rSigStore, derivedToString } from "@rivetjs/runtime/server-derived";
import { isData } from "../server-derived.ts";
import { importServer } from "./resume/compile.ts";
import type { BoundaryTail } from "@rivetjs/runtime/resume-format";

type Row = { id: number; values: number[] };
type Data = { title: string; rows: Row[] };
const manifest = { hash: "t", runtime: "/rt.js", symbols: {} as Record<string, string> };

// The ssr-bench `/resume` page (nested layout with a signal + handler, keyed <For> rows with a per-row handler + reactive
// attribute, a Show branch); `lowered`: what the derived server target emits for it (boundary + keyed-state calls).
const page = (lowered: boolean) => `
import { signal } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
${lowered ? 'import { _rB, _rBOut, _rBEnd, _rSig } from "@rivetjs/runtime/server-derived";' : ""}
export function Layout(props) {
  ${lowered ? 'const B = _rB("Layout", 0); try {' : ""}
  const theme = ${lowered ? '_rSig("k-0", "light")' : 'signal("light")'};
  ${lowered ? "return _rBOut(B, (" : "return ("}
    <div data-layout="resume">
      <nav><button type="button" onClick={() => theme.set("dark")}>Theme {theme()}</button></nav>
      {props.children}
    </div>
  )${lowered ? ")" : ""};
  ${lowered ? "} finally { _rBEnd(B); }" : ""}
}
export function Page(props) {
  ${lowered ? 'const B = _rB("Page", 1, props); try {' : ""}
  const data = props.data;
  const selected = ${lowered ? '_rSig("k-1", -1)' : "signal(-1)"};
  const open = ${lowered ? '_rSig("k-2", false)' : "signal(false)"};
  const mode = props.theme();
  ${lowered ? "return _rBOut(B, (" : "return ("}
    <main data-mode={mode}>
      <h1>{data.title}</h1>
      <Show when={() => open()} fallback={<p>closed</p>}><p>open</p></Show>
      <section data-grid="">
        <For each={() => data.rows} by={(row) => row.id}>
          {(row) => (
            <article data-row={row().id} data-state={selected() === row().id ? "selected" : "even"}>
              <button type="button" onClick={() => selected.set(row().id)}>Pick</button>
              <dl><dt>Field</dt><dd>{row().values[0]}</dd></dl>
            </article>
          )}
        </For>
      </section>
    </main>
  )${lowered ? ")" : ""};
  ${lowered ? "} finally { _rBEnd(B); }" : ""}
}
export function App(props) {
  ${lowered ? 'const B = _rB("App", 0); try {' : ""}
  const theme = ${lowered ? '_rSig("k-3", "x")' : 'signal("x")'};
  ${lowered ? "return _rBOut(B, (" : "return ("}<Layout><Page data={props.data} theme={theme} /></Layout>)${lowered ? ")" : ""};
  ${lowered ? "} finally { _rBEnd(B); }" : ""}
}
`;
const data: Data = { title: "Records", rows: Array.from({ length: 200 }, (_, i) => ({ id: i + 1, values: [i * 3] })) };

const tailOf = (html: string): { script: string; tail: BoundaryTail } => {
  const match = html.match(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s);
  assert.ok(match, "boundaries tail present:\n" + html.slice(-400));
  return { script: match[0], tail: JSON.parse(match[1]!) as BoundaryTail };
};

type AppModule = { App: (p: { data: Data }) => ServerValue };
async function loweredApp(): Promise<AppModule["App"]> {
  const out = compile(page(true), { target: "server", filename: "page.tsx" });
  assert.deepEqual(out.diagnostics, []);
  return (await importServer<AppModule>(out.code)).App;
}

test("hand-lowered page: boundary records, keyed values, wake lists, markers; nothing of the serialized state", async () => {
  const App = await loweredApp();
  const html = (await derivedToString(() => App({ data }), { manifest })) as string;
  const { tail } = tailOf(html);
  // Records in creation (parent-first) order: App (page root) → Layout → Page (Layout's lazy child renders under it).
  assert.deepEqual(tail.b, [
    [1, 0, 0, "App", ["k-3", "x"]],
    [2, 1, 0, "Layout", ["k-0", "light"]],
    // Page is independent per the compiler (flags 1) but its `theme` prop is a function: demoted (8), no props.
    [3, 2, 8, "Page", ["k-1", -1, "k-2", false]],
  ]);
  // Page's body read App's `theme` signal: App's key wakes Page. Page's own reads (`selected()` in rows, `open()` in the
  // Show condition, rendered under Page's frame) wake nobody.
  assert.deepEqual(tail.w, { "1.k-3": [3] });
  // Markers: comment pairs (no `_rBAttr` in the hand lowering), row + branch regions kept, no `data-r` / text markers.
  assert.match(html, /<!--b2--><div data-layout="resume">/);
  assert.ok(html.includes("<!--/b-->"));
  assert.equal(html.match(/<!--r\d*\[-->/g)?.length, 201, "200 rows + 1 Show branch");
  assert.ok(!html.includes("data-r="));
  assert.ok(!html.includes('type="rivet/state"'));
  assert.ok(!html.includes("<!--r1-->"));
  // The App boundary rendered a component call as its root (no own element): comment markers around Layout's output.
  assert.match(html, /<!--b1--><!--b2--><div data-layout="resume">/);
});

test("ABI outside a derived render: null tokens, plain signals, plain values", async () => {
  const App = await loweredApp();
  const plain = renderToString(() => App({ data })) as string;
  assert.ok(!plain.includes("<!--b"));
  assert.ok(!plain.includes("rivet/boundaries"));
  assert.ok(plain.includes("<!--r") === false, "no row markers without a recorder");
  assert.equal(_rB("X", 3, { a: 1 }), null);
  assert.equal(_rBOut(null, "v"), "v");
  assert.equal(_rBAttr(null), null);
  _rBEnd(null);
  const s = _rSig("k", 1);
  assert.equal(s(), 1);
  s.set(2);
  assert.equal(s(), 2);
});

test("flags: independent props kept, demoted on non-data props, UNKEYED for non-data state, repeated sites, data-b", async () => {
  const held = { items: [1, 2], label: "x", nested: { ok: true, n: null } };
  const bad = { onPick: () => 1 };
  const render = () =>
    derivedToString(
      () => {
        const A = _rB("A", 1 | 2, held);
        try {
          _rSig("s-0", 1);
          _rSig("s-0", 2);
          _rSig("s-1", new Map());
          _rSigStore("s-2", { n: 1, list: [1] });
          const B = _rB("B", 1, bad);
          _rBEnd(B);
          const C = _rB("C", 1);
          _rBEnd(C);
          return _rBOut(A, [_rBAttr(A), _rBOut(C, "c")]);
        } finally {
          _rBEnd(A);
        }
      },
      { manifest },
    ) as string;
  const html = render();
  const { tail } = tailOf(html);
  assert.deepEqual(tail.b, [
    [1, 0, 1 | 2 | 4, "A", ["s-0", 1, "s-0#2", 2, "s-2", { n: 1, list: [1] }], held],
    [2, 1, 8 | 16, "B", []],
    [3, 1, 8, "C", []],
  ]);
  assert.equal(tail.w, undefined);
  // `_rBAttr` makes `data-b` and suppresses the comment pair; C (no attr) gets one.
  assert.ok(html.includes(' data-b="1"'));
  assert.ok(!html.includes("<!--b1-->"));
  assert.ok(html.includes("<!--b3-->c<!--/b-->"));
});

test("isData: JSON data only", () => {
  assert.ok(isData({ a: [1, "x", null, { b: true }] }));
  assert.ok(isData(Object.create(null)));
  for (const value of [() => 1, new Map(), new Date(), NaN, Infinity, Symbol(), undefined, [1, , 2], { d: new Date() }, new (class {})()])
    assert.equal(isData(value), false, String(value));
});

const derived = hasDerivedModel();
(derived ? test : test.skip)("compiled page under resume.model derived: the same tail shape, data-b roots, no state script", async () => {
  const out = compile(page(false), { target: "server", filename: "page.tsx", resume: { module: "src/page.tsx" } });
  assert.deepEqual(out.diagnostics, []);
  const { App } = await importServer<AppModule>(out.code);
  const html = (await derivedToString(() => App({ data }), { manifest })) as string;
  const { tail } = tailOf(html);
  // Boundary names are module-qualified (`<resume module>#<Name>`, the same in the DOM target's `_b`).
  assert.deepEqual(
    tail.b.map(([id, parent, flags, name, signals]) => [id, parent, flags, name, signals.length / 2]),
    [
      [1, 0, 0, "src/page.tsx#App", 1],
      [2, 1, 2, "src/page.tsx#Layout", 1],
      [3, 2, 2, "src/page.tsx#Page", 2],
    ],
  );
  assert.ok(html.includes('<div data-layout="resume" data-b="2">'));
  assert.ok(html.includes('data-b="3"'));
  assert.ok(!html.includes("data-r="));
  assert.ok(!html.includes('type="rivet/state"'));
  assert.deepEqual(Object.values(tail.w ?? {}), [[3]]);
});
