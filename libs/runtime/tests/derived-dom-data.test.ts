// DOM data on derived (DERIVED-C5), server side: with `manifest.domData` the page's HTML is the same as without it except
// the first row's anchor id (`<!--r0<n>[-->`), on the string and the byte writer; the tail's `d` entries stand for the
// arrays left out of the records' props, and a list whose row template shows no item value (or an empty list) is left as is.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString, renderDerived } from "@rivetjs/runtime/server-derived";
import { NodeStreamWriter } from "@rivetjs/runtime/node";
import { Writable } from "node:stream";
import { derivedDom } from "../dom-data-derived.ts";
import { _derivedDom } from "../server-derived-dom.ts";
import { importServer } from "./resume/compile.ts";

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
const tailOf = (html: string): { b: unknown[][]; d?: unknown[][] } => JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
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
