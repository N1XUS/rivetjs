// DOM data on derived (DERIVED-C5): with `manifest.domData` (builds with `resume: { domData: true }`),
// a list written from one tape whose rows show item values as an element's whole text (or a plain attribute) leaves the
// items array out of its record's props: the tail's `d` entry carries the item skeleton + the literals, the first row is
// anchored `<!--r0<n>[-->`, and the browser (`DOM_DATA` switch on) rebuilds the items from the page's rows. Values the
// page cannot spell (CR, a lone surrogate), a row whose shape differs and rows whose DOM text is not the value ship as
// before. Real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { switchContent } from "../../compiler/switches.ts";
import { derivedDom } from "../dom-data-derived.ts";
import { _derivedDom } from "../server-derived-dom.ts";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";
// Tail v2 (ZERO S2) in its flush shape (names resolved, runs expanded), loosely typed like the JSON it was.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tailJson = (tail: unknown): any => expandTail(tail as never);

// The server half of a `{ domData: true }` build (the compiler plugin serves `dom-data-derived.ts` with it).
derivedDom.api = _derivedDom;
const PAGE = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";

export function List(props) {
  const picked = signal("");
  return (
    <section>
      <p id="picked">{picked()}</p>
      <ul id="rows">
        <For each={() => props.rows} by={(row) => row.id}>
          {(row) => (
            <li data-id={row().id}>
              <button type="button" onClick={() => picked.set(row().label + "|" + row().id + "|" + row().score + "|" + row().tag.join(","))}>
                {row().label}
              </button>
              <b>{row().score}</b>
            </li>
          )}
        </For>
      </ul>
      <button type="button" id="sum" onClick={() => picked.set(String(props.rows.reduce((a, r) => a + r.score, 0)) + ":" + props.rows.length)}>
        sum
      </button>
    </section>
  );
}

export const ROWS = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  label: i === 3 ? "<b>\\"x\\"</b> & 'é€漢字𝄞'" : i === 5 ? "line\\rfeed" : "row " + i,
  score: i * 7,
  tag: ["t" + (i % 3)],
  ...(i === 7 ? { extra: true } : {}),
}));

// The route root (independent: its data props, the loader data, are recorded).
export function App(props) {
  return (
    <main>
      <List rows={props.rows} />
    </main>
  );
}
`;
const RESUME = { module: "src/page.tsx", boundaries: ["App", "List"], independent: ["App"] };
const symbols = Object.fromEntries(RESUME.boundaries.map((name) => ["src/page.tsx#" + name, "/page.js"]));
type Tail = { b: [number, number, number, string, unknown, Record<string, unknown>?][]; d?: unknown[][] };

async function render(domData: boolean): Promise<{ html: string; tail: Tail }> {
  const out = compile(PAGE, { target: "server", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(out.diagnostics, []);
  const { App, ROWS } = await importServer<{ App: (props: { rows: unknown[] }) => ServerValue; ROWS: unknown[] }>(out.code);
  const html = (await derivedToString(() => App({ rows: ROWS }), {
    manifest: { hash: "t", runtime: "/rt.js", symbols, ...(domData ? { domData: true } : {}) },
  })) as string;
  return { html, tail: tailJson(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!)) };
}
const appProps = (tail: Tail): Record<string, unknown> => tail.b.find((r) => r[3] === "src/page.tsx#App")![5]!;

const compiled = hasDerivedModel() ? test : test.skip;

compiled("server: the rows array leaves the props for a d entry; rows the page cannot spell or of another shape ship whole", async () => {
  const off = await render(false);
  assert.equal(off.tail.d, undefined);
  assert.equal((appProps(off.tail).rows as unknown[]).length, 40);
  assert.doesNotMatch(off.html, /<!--r0\d+\[-->/);
  const on = await render(true);
  assert.equal(appProps(on.tail).rows, 0, "left out of the props");
  assert.equal(on.tail.d?.length, 1);
  const [record, anchor, path, count, , paths, , whole] = on.tail.d![0]! as [
    number,
    number,
    (string | number)[],
    number,
    unknown,
    string[],
    unknown[],
    Record<string, unknown>,
  ];
  assert.equal(record, on.tail.b.find((r) => r[3] === "src/page.tsx#App")![0]);
  assert.deepEqual(path, ["rows"]);
  assert.equal(count, 40);
  assert.match(on.html, new RegExp("<!--r0" + anchor + "\\[-->"));
  assert.ok(
    paths.some((p) => p.startsWith("#")),
    "score: a number path",
  );
  // CR (the parser drops it) and the row with an extra key: whole; the escaped label is read back from the page.
  assert.deepEqual(Object.keys(whole ?? {}).sort(), ["5", "7"]);
  assert.ok(on.html.length < off.html.length, "smaller document");
});

async function files(): Promise<Record<string, string>> {
  const { html } = await render(true);
  const dom = compile(PAGE, { target: "dom", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(dom.diagnostics, []);
  return {
    ...DERIVED_BUILD,
    "/dom-data.ts": switchContent("dom-data", (module) => "/" + module + ".ts")!,
    "/": '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code),
  };
}

compiled("browser: row values come back from the page (escaping, numbers, literals, whole rows), cold and after idle", async () => {
  const served = await files();
  for (const idle of [false, true])
    await withPage(served, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      if (!idle) await page.addInitScript(() => void ((window as unknown as Record<string, unknown>).requestIdleCallback = () => 0));
      await page.goto("http://rivet.test/");
      if (idle) await page.waitForTimeout(300);
      await page.click('li[data-id="4"] button');
      await page.waitForFunction(() => document.querySelector("#picked")!.textContent !== "");
      assert.equal(await page.textContent("#picked"), "<b>\"x\"</b> & 'é€漢字𝄞'|4|21|t0");
      await page.click('li[data-id="6"] button');
      await page.waitForFunction(() => document.querySelector("#picked")!.textContent!.startsWith("line"));
      assert.equal(await page.textContent("#picked"), "line\nfeed|6|35|t2".replace("\n", "\r"));
      await page.click("#sum");
      await page.waitForFunction(() => document.querySelector("#picked")!.textContent!.includes(":"));
      assert.equal(await page.textContent("#picked"), String((39 * 40 * 7) / 2) + ":40");
      assert.deepEqual(errors, []);
    });
});
