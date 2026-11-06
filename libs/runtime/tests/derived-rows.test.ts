// Derived model, server rows (DERIVED-S 2026-10-21): a list-mounted keyed `<For>` on the derived server target calls
// `_rFor` (`@rivetjs/runtime/server-derived`), which writes its rows from one list tape inside `<!--r[-->…<!--]-->` (byte
// writers: the WebAssembly row emitter) instead of one row record + REGION record per row through the resume row hook.
// Differential: the same page with the tape off (`_setDerivedRows(false)`: every row through `For` + the row hook) gives
// the same HTML and tail once row marker ids are dropped (the derived client claims row groups by balance, never by id),
// on the string and the byte writer, for plain rows, escaping, holes, a subclass array, nested lists, a boundary component row
// (no list mount: the row hook) and a cross-boundary keyed read inside a row (wake list).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { _oneRoot, _rB, _rBEnd, _rBOut, _rFor, _setDerivedRows, derivedToString, renderDerived } from "@rivetjs/runtime/server-derived";
import { _listPlan, attribute, compiledTemplate, renderToString } from "@rivetjs/runtime/server";
import { NodeStreamWriter } from "@rivetjs/runtime/node";
import { Writable } from "node:stream";
import { importServer } from "./resume/compile.ts";

const manifest = { hash: "t", runtime: "/rt.js", symbols: {} as Record<string, string> };
const source = `
import { signal } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
function Cell(props) {
  return <td data-k={props.k}>{props.v}</td>;
}
export function Page(props) {
  const selected = signal(-1);
  const data = props.data;
  return (
    <main>
      <ul>
        <For each={() => data.rows} by={(row) => row.id}>
          {(row) => (
            <li data-row={row().id} data-state={selected() === row().id ? "on" : "off"} title={row().label}>
              <button type="button" onClick={() => selected.set(row().id)}>{row().label}</button>
              <span>{props.theme()}</span>
              <b>{row().values[0]}</b>
            </li>
          )}
        </For>
      </ul>
      <table><tbody><For each={() => data.rows} by={(row) => row.id}>{(row) => <Cell k={row().id} v={row().label} />}</For></tbody></table>
      <For each={() => data.groups} by={(g) => g.name}>
        {(g) => (
          <section data-group={g().name}>
            <For each={() => g().items} by={(i) => i}>{(i, n) => <i data-n={n()}>{i()}</i>}</For>
            <Show when={() => selected() > 0}><em>picked</em></Show>
          </section>
        )}
      </For>
    </main>
  );
}
export function App(props) {
  const theme = signal("light");
  return <div><Page data={props.data} theme={theme} /></div>;
}
`;
type Row = { id: number; label: string; values: number[] };
type Data = { rows: Row[]; groups: { name: string; items: string[] }[] };
const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, label: i % 3 ? "row " + i : `<b>"${i}"</b> & 'é€漢字𝄞'`, values: [i * 7] }));
const groups = [
  { name: "a", items: ["x", "y"] },
  { name: "b", items: [] },
  { name: "c<", items: ["z&"] },
];
const ids = (html: string): string => html.replace(/<!--r\d*\[-->/g, "<!--r[-->");
// Bare rows (MARKERS 2026-11-06: a one-root row plan writes no row markers): compared with the row hook's marked rows with
// every row region marker dropped (`<!--]-->` also closes other regions: dropped on both sides alike).
const unmarked = (html: string): string => html.replace(/<!--r\d*\[-->|<!--\]-->/g, "");

const derived = hasDerivedModel();
type AppModule = { App: (p: { data: Data }) => ServerValue };
async function app(): Promise<AppModule["App"]> {
  const out = compile(source, { target: "server", filename: "page.tsx", resume: { module: "src/page.tsx" } });
  assert.deepEqual(out.diagnostics, []);
  assert.match(out.code, /_rFor as /, "list-mounted Fors call the derived For");
  return (await importServer<AppModule>(out.code)).App;
}
async function bytes(factory: () => ServerValue): Promise<string> {
  const parts: Buffer[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _e, done) {
      parts.push(Buffer.from(chunk));
      done();
    },
  });
  const writer = new NodeStreamWriter(sink);
  await renderDerived(factory, writer, { manifest });
  await writer.finish();
  return Buffer.concat(parts).toString();
}
async function both(App: AppModule["App"], data: Data): Promise<{ tape: [string, string]; rows: [string, string] }> {
  const render = async (): Promise<[string, string]> => [
    (await derivedToString(() => App({ data }), { manifest })) as string,
    await bytes(() => App({ data })),
  ];
  const tape = await render();
  _setDerivedRows(false);
  try {
    return { tape, rows: await render() };
  } finally {
    _setDerivedRows(true);
  }
}

(derived ? test : test.skip)("tape rows = row-hook rows (string + byte writer), modulo row marker ids", async () => {
  const App = await app();
  for (const n of [0, 1, 3, 200]) {
    const data = { rows: rows(n), groups };
    const { tape, rows: perRow } = await both(App, data);
    assert.equal(tape[0], tape[1], `rows=${n}: string and byte writer agree`);
    assert.equal(unmarked(tape[0]), unmarked(perRow[0]), `rows=${n}: string writer`);
    assert.equal(unmarked(tape[1]), unmarked(perRow[1]), `rows=${n}: byte writer`);
    // Tape rows: one root element each, bare (no row markers); the row hook's rows keep theirs.
    assert.equal((tape[0].match(/<!--r\[--><li /g) ?? []).length, 0);
    assert.equal((tape[0].match(/<li data-row/g) ?? []).length, n);
    assert.equal((perRow[0].match(/<!--r\d*\[--><li /g) ?? []).length, n);
    // `Cell` is a boundary (never a flattened twin): no list mount, its rows keep the row hook (and their ids).
    assert.equal((tape[0].match(/<!--r\d*\[--><td /g) ?? []).length, n);
    // A row whose nested list and Show sit inside its root element is bare too.
    assert.equal((tape[0].match(/<!--r\[--><section /g) ?? []).length, 0);
    assert.equal((tape[0].match(/<section data-group/g) ?? []).length, groups.length);
  }
  // The cross-boundary read (App's `theme` read in Page's rows) still wakes Page.
  const html = (await derivedToString(() => App({ data: { rows: rows(2), groups } }), { manifest })) as string;
  const tail = JSON.parse(html.match(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s)![1]!) as { w?: Record<string, number[]> };
  assert.deepEqual(Object.values(tail.w ?? {}), [[2]]);
});

test("holes and array subclasses: row by row, same markers and content as the row hook", async () => {
  // Hand-lowered `_rFor` (the derived target's call shape) inside a boundary: plan + tape writer as the compiler emits them.
  const plan = _listPlan(["<p", ">", "</p>"], [["data-i", "html"], null]);
  const page = (items: readonly unknown[]) => () => {
    const B = _rB("P", 0);
    try {
      return _rBOut(
        B,
        _rFor({
          each: items,
          by: (_item: unknown, index: number) => index,
          children: (get: () => unknown, at: () => number) => compiledTemplate(["<p", ">", "</p>"], [attribute("data-i", at()), String(get())]),
          $list: [plan, (tape: unknown[], base: number, item: unknown, index: number) => ((tape[base] = index), (tape[base + 1] = String(item)))],
        } as never),
      );
    } finally {
      _rBEnd(B);
    }
  };
  class Sub extends Array<unknown> {}
  for (const items of [[1, , 3], Sub.from(["a", "b"]), ["x<", "y"]]) {
    const tape = (await derivedToString(page(items), { manifest })) as string;
    _setDerivedRows(false);
    const perRow = (await derivedToString(page(items), { manifest })) as string;
    _setDerivedRows(true);
    // Holes / subclasses keep their row markers; a plain dense array of one-root rows is bare (MARKERS).
    const plain = Object.getPrototypeOf(items) === Array.prototype && Object.keys(items).length === items.length;
    assert.equal(plain ? unmarked(tape) : ids(tape), plain ? unmarked(perRow) : ids(perRow));
    assert.equal((tape.match(/<!--r\[-->/g) ?? []).length, plain ? 0 : items.length);
  }
  // Outside a derived render `_rFor` is `For`: no markers.
  assert.equal(renderToString(page(["q"])() as never), '<p data-i="0">q</p>');
});

// MARKERS (2026-11-06): which row plans are proven to render exactly one root element (their rows ship bare).
test("one-root proof: one element around every slot, nothing at the top", () => {
  const plan = (fragments: string[], entries: (readonly [string, "html"] | null)[]) => _listPlan(fragments, entries);
  const yes = [
    plan(["<li>", "</li>"], [null]),
    plan(["<li", ">", "</li>"], [["class", "html"], null]),
    plan(['<li data-x="a>b">', "<span>", "</span></li>"], [null, null]),
    plan(["<tr><td>", "</td><!--c--><td>", "</td></tr>"], [null, null]),
    plan(["<input", ">"], [["value", "html"]]),
    plan(['<svg viewBox="0 0 1 1"><path d="M0"/>', "</svg>"], [null]),
    plan(["<li>", "<br>", "</li>"], [null, null]),
    // A flattened child component inside the root (its OPEN / CLOSE bounds write nothing).
    _listPlan(["<li>", "</li>"], [_listPlan(["<b>", "</b>"], [null])]),
  ];
  const no = [
    plan(["", "<li>x</li>"], [null]),
    plan(["<li>x</li>", ""], [null]),
    plan(["<li>a</li><li>b</li>"], []),
    plan(["<!--b-->", "<li>x</li>"], [null]),
    plan([" <li>x</li>"], []),
    plan(["<li>x</li> "], []),
    plan(["<li>", ""], [null]),
    plan(["<br><br>"], []),
    plan(["<li><textarea>", "</textarea></li>"], [null]),
    plan(["text"], []),
    plan([""], []),
    // A flattened child at the top (its own root beside nothing: the child's fragments decide).
    _listPlan(["", ""], [_listPlan(["<b>", "</b><i></i>"], [null])]),
  ];
  for (const p of yes) assert.equal(_oneRoot(p), true, JSON.stringify(p.fragments));
  for (const p of no) assert.equal(_oneRoot(p), false, JSON.stringify(p.fragments));
  assert.equal(_oneRoot(_listPlan(["", ""], [_listPlan(["<b>", "</b>"], [null])])), true, "a flattened one-root child alone");
});
