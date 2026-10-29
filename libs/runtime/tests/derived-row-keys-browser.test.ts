// Keyed state inside `<For>` rows is numbered per row (ROW-KEYS 2026-10-29). A lazy row adopts in a run of its own that
// counts its keyed `_sig` calls from 1, while the server used to number them across all of the boundary's rows (`K`,
// `K#2`, …): the second row adopted the first row's value, and keyed state after the list in the boundary's own run took
// a row's key (ui `/pro-forms` RadioButtonGroup `items`: `aria-describedby="#15"` where the server wrote `#16`). Both
// sides now name a row's keys by the row's place (`K@<row path>`), so a row adopted on its own, the boundary run that
// skips its lazy rows and a unit rendered in the browser all find the server's values.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { _setDerivedRows, derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

// A non-boundary component with keyed state whose init differs per render (as `resumedId` / `createId` do): only the
// shipped value keeps the id the server rendered.
const source = (row: string, mismatch = false) => `import { For } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
let n = 0;
function Item(props) {
  const id = signal((typeof window === "undefined" ? "s" : "c") + n++);
  return <button class="item" data-id={id()} onClick={() => props.pick(id())}>{props.label}</button>;
}
function Wrap(props) {
  return <span class="wrap">{props.children}</span>;
}
export function App() {
  const picked = signal("");
  const items = signal([{ id: "a" }, { id: "b" }, { id: "c" }]);
  return <main>
    <output>{picked()}</output>${mismatch ? `{typeof window === "undefined" ? <i>server</i> : <em>browser</em>}` : ""}
    <ul><For each={items} by={(x) => x.id}>{${row}}</For></ul>
    <ol><For each={() => ["x", "y"]} by={(x) => x}>{(x) => <li><Item label={x()} pick={(v) => picked.set(v)} /></li>}</For></ol>
    <Item label="tail" pick={(v) => picked.set(v)} />
  </main>;
}`;
// Rows the server writes from one list tape (`_rFor`, a list-mounted `<For>`); rows holding a `<For>` of their own (nested
// rows); the same through the row hook (`For`, `_setDerivedRows(false)`).
const FLAT = `(x) => <li><Item label={x().id} pick={(v) => picked.set(v)} /></li>`;
const NESTED = `(x) => <li><Item label={x().id} pick={(v) => picked.set(v)} /><For each={() => [1, 2]} by={(k) => k}>{(k) => <Item label={x().id + k()} pick={(v) => picked.set(v)} />}</For></li>`;
const SLOT = `(x) => <li><Wrap><Item label={x().id} pick={(v) => picked.set(v)} /></Wrap></li>`;
const ROWS: Record<string, [row: string, tape: boolean, mismatch?: boolean]> = {
  tape: [FLAT, true],
  nested: [NESTED, true],
  hook: [FLAT, false],
  "nested hook": [NESTED, false],
  // The row's component renders in a slot of another one: the server renders it after the row returned.
  slot: [SLOT, true],
  "slot hook": [SLOT, false],
  // The boundary's markup differs in the browser: it renders there on its first event, its rows inside that run (each
  // counted as its row), with the record's values.
  "browser render": [NESTED, true, true],
};

for (const [name, [row, tape, mismatch]] of Object.entries(ROWS))
  test(`derived rows: a lazily adopted row keeps the server's keyed values (${name})`, async () => {
    const options = { resume: { module: "keys", boundaries: ["App"] } };
    const ssr = compile(source(row, mismatch), { target: "server", filename: "keys.server.tsx", ...options } as never);
    const dom = compile(source(row, mismatch), { target: "dom", filename: "keys.dom.tsx", ...options } as never);
    assert.deepEqual(ssr.diagnostics, []);
    assert.deepEqual(dom.diagnostics, []);
    assert.match(ssr.code, /_rFor/);
    const { App } = await importServer<{ App: () => ServerValue }>(ssr.code);
    const manifest = { hash: "t", runtime: "/rt.js", symbols: { "keys#App": "/page.js" } };
    _setDerivedRows(tape);
    let html: string;
    try {
      html = await derivedToString(() => App(), { manifest });
    } finally {
      _setDerivedRows(true);
    }
    await withPage(
      {
        ...DERIVED_BUILD,
        "/": "<!doctype html><body>" + html + "</body>",
        "/rt.js": 'export { default } from "/dom-derived.ts";',
        "/page.js": rewrite(dom.code),
      },
      async (page) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => message.type() === "warning" && errors.push(message.text()));
        await page.goto("http://rivet.test/");
        const ids = await page.locator(".item").evaluateAll((els) => els.map((el) => [el.textContent, el.getAttribute("data-id")]));
        // Every server id is distinct, written in render order.
        assert.equal(new Set(ids.map(([, id]) => id)).size, ids.length);
        assert.ok(ids.every(([, id]) => id!.startsWith("s")));
        // Later rows first (each adopts on its own), then the second list, then the keyed state after both lists.
        for (const label of ["c", "b", "y", "tail", "a", ...(row === NESTED ? ["b2", "a1"] : [])]) {
          const want = ids.find(([text]) => text === label)![1];
          await page.locator(".item", { hasText: new RegExp("^" + label + "$") }).click();
          await page.waitForFunction((id) => document.querySelector("output")!.textContent === id, want, { timeout: 2000 }).catch(() => {});
          assert.equal(await page.textContent("output"), want, label);
        }
        if (mismatch) assert.equal(await page.textContent("main em"), "browser");
        // Adopted runs (or the browser's render) kept the server's ids on the page.
        assert.deepEqual(await page.locator(".item").evaluateAll((els) => els.map((el) => [el.textContent, el.getAttribute("data-id")])), ids);
        assert.deepEqual(errors, []);
      },
    );
  });
