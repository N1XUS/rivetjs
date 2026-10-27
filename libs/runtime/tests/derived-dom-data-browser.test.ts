// DOM data on derived (DERIVED-C5): with `manifest.domData` (the reader chunk URL: builds with `resume.domData` on and a qualifying list),
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

// The server half of a `domData` (default) build (the compiler plugin serves `dom-data-derived.ts` with it).
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
    manifest: { hash: "t", runtime: "/rt.js", symbols, ...(domData ? { domData: "/dom-data-reader.ts" } : {}) },
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
    await withPage(served, async (page, requests) => {
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
      // The reader is its own module, named by the tail (`D`).
      assert.equal(requests.filter((path) => path === "/dom-data-reader.ts").length, 1);
    });
});

compiled("browser: a page without `d` entries never fetches the reader", async () => {
  const served = await files();
  const { html } = await render(false);
  served["/"] = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + "</body></html>";
  await withPage(served, async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.click('li[data-id="4"] button');
    await page.waitForFunction(() => document.querySelector("#picked")!.textContent !== "");
    assert.equal(await page.textContent("#picked"), "<b>\"x\"</b> & 'é€漢字𝄞'|4|21|t0");
    assert.ok(!requests.includes("/dom-data-reader.ts"), requests.join(" "));
  });
});

// A row text that also depends on a non-data value: the server shows the item's value, so it ships as DOM data; a
// write then turns the rows' text into something else before anything read their items. Every path that writes into a
// lazy row (a keyed write's row writers, with or without the index; a live prop; a module signal; a component child)
// reads that row's DOM data first (`readRow`), so the items read later are the server's.
const MASKED = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";

const global = signal(false);
export function Global() {
  return <button type="button" id="global" onClick={() => global.set(!global())}>global</button>;
}
function Label(p) {
  return <span>{p.text}</span>;
}

export function List(props) {
  const picked = signal("");
  const masked = signal(false);
  return (
    <section>
      <p id="picked">{picked()}</p>
      <button type="button" id="mask" onClick={() => masked.set(!masked())}>mask</button>
      <ul id="rows">
        <For each={() => props.rows} by={(row) => row.id}>
          {(row, index) => (
            <li data-id={row().id}>
              <button type="button" onClick={() => picked.set(row().label + "|" + row().id)}>
                ROW_TEXT
              </button>
            </li>
          )}
        </For>
      </ul>
      <button type="button" id="all" onClick={() => picked.set(props.rows.map((r) => r.label).join(","))}>all</button>
    </section>
  );
}

export const ROWS = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, label: "row " + i }));

export function App(props) {
  const outer = signal(false);
  return (
    <main>
      <Global />
      <button type="button" id="outer" onClick={() => outer.set(!outer())}>outer</button>
      <List rows={props.rows} outer={outer()} />
    </main>
  );
}
`;
const MASKED_RESUME = { module: "src/page.tsx", boundaries: ["App", "List", "Global"], independent: ["App", "Global"] };
const maskedSymbols = Object.fromEntries(MASKED_RESUME.boundaries.map((name) => ["src/page.tsx#" + name, "/page.js"]));
// [row text, the button that changes it]
const MASKS: Record<string, [string, string]> = {
  "keyed write": ['{masked() ? "***" : row().label}', "#mask"],
  "keyed write with the index": ['{masked() ? "*" + index() : row().label}', "#mask"],
  "live prop": ['{props.outer ? "***" : row().label}', "#outer"],
  "module signal": ['{global() ? "***" : row().label}', "#global"],
  "component child": ['<Label text={masked() ? "***" : row().label} />', "#mask"],
};
for (const [name, [text, button]] of Object.entries(MASKS))
  compiled("browser: a write that changes unread rows' text (" + name + ") leaves the items read back later the server's", async () => {
    const source = MASKED.replace("ROW_TEXT", text);
    const out = compile(source, { target: "server", filename: "page.tsx", resume: MASKED_RESUME } as never);
    assert.deepEqual(out.diagnostics, []);
    const { App, ROWS } = await importServer<{ App: (props: { rows: unknown[] }) => ServerValue; ROWS: unknown[] }>(out.code);
    const html = (await derivedToString(() => App({ rows: ROWS }), {
      manifest: { hash: "t", runtime: "/rt.js", symbols: maskedSymbols, domData: "/dom-data-reader.ts" },
    })) as string;
    const tail = tailJson(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));
    assert.equal(tail.d?.length, 1, "the labels ship as DOM data");
    const dom = compile(source, { target: "dom", filename: "page.tsx", resume: MASKED_RESUME } as never);
    assert.deepEqual(dom.diagnostics, []);
    const served = {
      ...DERIVED_BUILD,
      "/dom-data.ts": switchContent("dom-data", (module) => "/" + module + ".ts")!,
      "/": '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + "</body></html>",
      "/rt.js": 'export { default } from "/dom-derived.ts";',
      "/page.js": rewrite(dom.code),
    };
    await withPage(served, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      // Cold: no idle read before the write.
      await page.addInitScript(() => void ((window as unknown as Record<string, unknown>).requestIdleCallback = () => 0));
      await page.goto("http://rivet.test/");
      await page.click(button);
      await page.waitForFunction(() => document.querySelector('li[data-id="4"] button')!.textContent!.trim().startsWith("*"));
      await page.click('li[data-id="4"] button');
      await page.waitForFunction(() => document.querySelector("#picked")!.textContent !== "");
      assert.equal(await page.textContent("#picked"), "row 3|4");
      await page.click("#all");
      await page.waitForFunction(() => document.querySelector("#picked")!.textContent!.includes(","));
      assert.equal(await page.textContent("#picked"), "row 0,row 1,row 2,row 3,row 4,row 5");
      await page.click(button);
      await page.waitForFunction(() => document.querySelector('li[data-id="6"] button')!.textContent!.trim() === "row 5");
      assert.deepEqual(errors, []);
    });
  });
