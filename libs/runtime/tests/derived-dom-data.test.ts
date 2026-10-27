// DOM data on derived (DERIVED-C5), server side: with `manifest.domData` the page's HTML is the same as without it except
// the first row's anchor id (`<!--r0<n>[-->`), on the string and the byte writer; the tail's `d` entries stand for the
// arrays left out of the records' props, and a list whose row template shows no item value (or an empty list) is left as is.
import { test } from "vitest";
import assert from "node:assert/strict";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString, renderDerived } from "@rivetjs/runtime/server-derived";
import { NodeStreamWriter } from "@rivetjs/runtime/node";
import { Writable } from "node:stream";
import { derivedDom } from "../dom-data-derived.ts";
import { _derivedDom } from "../server-derived-dom.ts";
import { importServer } from "./resume/compile.ts";
// Tail v2 (ZERO S2) in its flush shape (names resolved, runs expanded), loosely typed like the JSON it was.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tailJson = (tail: unknown): any => expandTail(tail as never);

// The server half of a `{ domData: true }` build (the compiler plugin serves `dom-data-derived.ts` with it).
derivedDom.api = _derivedDom;
const source = `
import { For } from "@rivetjs/runtime/dom";
export function App(props) {
  return (
    <main>
      <ul>
        <For each={() => props.rows} by={(row) => row.id}>
          {(row) => (
            <li data-id={row().id} class={row().id % 2 ? "odd" : "even"}>
              <span>{row().label}</span>
              <b>{row().n}</b>
            </li>
          )}
        </For>
      </ul>
      <ol>
        <For each={() => props.blank} by={(row) => row.id}>{() => <li>-</li>}</For>
      </ol>
    </main>
  );
}
`;
const RESUME = { module: "src/page.tsx", boundaries: ["App"], independent: ["App"] };
const manifest = { hash: "t", runtime: "/rt.js", symbols: { "src/page.tsx#App": "/page.js" } };
type Props = { rows: { id: number; label: string; n: number }[]; blank: { id: number }[] };
const props = (n: number): Props => ({
  rows: Array.from({ length: n }, (_, i) => ({ id: i + 1, label: i % 4 ? "row " + i : `<i>"${i}"</i> & é𝄞`, n: i * 3 })),
  blank: [{ id: 1 }, { id: 2 }],
});
const tailOf = (html: string): { b: unknown[][]; d?: unknown[][] } =>
  tailJson(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));
const body = (html: string): string => html.replace(/<script type="rivet\/boundaries".*$/s, "").replace(/<!--r0\d+\[-->/g, "<!--r[-->");

async function bytes(factory: () => ServerValue, domData: boolean): Promise<string> {
  const parts: Buffer[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _e, done) {
      parts.push(Buffer.from(chunk));
      done();
    },
  });
  const writer = new NodeStreamWriter(sink);
  await renderDerived(factory, writer, { manifest: { ...manifest, ...(domData ? { domData: true } : {}) } });
  await writer.finish();
  return Buffer.concat(parts).toString();
}

(hasDerivedModel() ? test : test.skip)("domData: same HTML but the anchor (string + byte writer); d entries replace the shown arrays", async () => {
  const out = compile(source, { target: "server", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(out.diagnostics, []);
  const { App } = await importServer<{ App: (p: Props) => ServerValue }>(out.code);
  for (const n of [0, 1, 5, 120]) {
    const p = props(n);
    const off = (await derivedToString(() => App(p), { manifest })) as string;
    const on = (await derivedToString(() => App(p), { manifest: { ...manifest, domData: true } })) as string;
    assert.equal(await bytes(() => App(p), true), on, `rows=${n}: string and byte writer agree`);
    assert.equal(body(on), body(off), `rows=${n}: same rows`);
    const tail = tailOf(on),
      record = tail.b[0]!,
      kept = record[5] as Record<string, unknown>;
    // `blank` shows no item value: kept in the props.
    assert.deepEqual(kept.blank, p.blank);
    if (n === 0) {
      assert.equal(tail.d, undefined);
      assert.deepEqual(kept.rows, []);
      continue;
    }
    assert.equal(kept.rows, 0);
    assert.equal(tail.d!.length, 1);
    assert.deepEqual(tail.d![0]!.slice(0, 4), [record[0], 0, ["rows"], n]);
    assert.equal((on.match(/<!--r00\[-->/g) ?? []).length, 1);
    // No row value is written into the tail (the labels are in the page only).
    assert.doesNotMatch(JSON.stringify(tail), /row 1/);
  }
});

// ROWS-SSR: a value row 0 shows twice (the ssr-bench `/resume` shape: `{ id: 0, values: [0, 1, …] }`, the id in an attribute
// and `values[0]` as text) gave both leaves the first slot, so every later row (id ≠ values[0]) shipped whole. Each leaf now
// takes a slot no earlier leaf took; misfits still ship whole (row 2's changed value).
const benchSource = `
import { For } from "@rivetjs/runtime/dom";
export function App(props) {
  return (
    <section>
      <For each={() => props.rows} by={(row) => row.id}>
        {(row) => (
          <article data-row={row().id}>
            <dd>{row().values[0]}</dd>
            <dd>{row().values[1]}</dd>
          </article>
        )}
      </For>
    </section>
  );
}
`;
(hasDerivedModel() ? test : test.skip)("domData: row 0's repeated value takes distinct slots (no whole rows on the bench shape)", async () => {
  const out = compile(benchSource, { target: "server", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(out.diagnostics, []);
  const { App } = await importServer<{ App: (p: { rows: { id: number; values: number[] }[] }) => ServerValue }>(out.code);
  const rows = Array.from({ length: 6 }, (_, id) => ({ id, values: [id * 100, id * 100 + 1] }));
  const html = (await derivedToString(() => App({ rows }), { manifest: { ...manifest, domData: true } })) as string;
  const entry = tailOf(html).d![0]!;
  assert.deepEqual(entry[4], { id: 1, values: [2, 3] }, "skeleton: three leaves");
  assert.deepEqual(entry[5], ["#article:@data-row", "#dd:0", "#dd:1"], "three distinct paths");
  assert.equal(entry[7], undefined, "no whole rows");
  // A row whose value differs in kind from its DOM text (a string where row 0 has a number) still ships whole.
  const mixed = rows.map((r, i) => (i === 2 ? { id: r.id, values: [String(r.values[0]), r.values[1]] } : r));
  const html2 = (await derivedToString(() => App({ rows: mixed as never }), { manifest: { ...manifest, domData: true } })) as string;
  assert.deepEqual(Object.keys(tailOf(html2).d![0]![7] as object), ["2"]);
});
