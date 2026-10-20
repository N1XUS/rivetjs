// LAZY-ROWS T5 (spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.4): lazy `<For>` rows materialise in the
// browser by running their row function in adopt mode over the server nodes (`dom-adopt.ts` `_adoptRow`, `dom-resume.ts`):
// on the first event inside the row (cold, before the runtime booted, and live), on a wake (a signal the rows read changed:
// every row of the For), on a reconcile of their re-created For (kept rows stay inert, materialising later through the
// client For), and on `_materialise(node)` (cdk focus targets). No element is created, replaced or moved: ids, input values
// and node identity survive; per-row `_regionState` values are adopted; row effects run at materialise (R6). The dev
// verifier swaps a row whose markup does not match (create + swap of that row only).
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { ResumeState } from "@rivetjs/runtime/resume-format";
import { withIdScope } from "@rivetjs/runtime/id";
import type { Page } from "playwright";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { LAZY_ROWS_BUILD, withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type R = { id: number; label: string; tags: string[] };
const source = `import { For, Show, clientEffect } from "@rivetjs/runtime/dom";
import { signal, _regionState } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/runtime/id";
function Cell(p) {
  return <td class="c" onClick={p.on}>{p.label}</td>;
}
// A ref (a local the row's effect reads: it runs at materialise and must see the live element) and a nested For.
function Tags(p) {
  let el;
  clientEffect(() => void (el.dataset.ref = "" + p.id));
  return <td ref={(e) => (el = e)}><For each={p.tags} by={(t) => t}>{(t) => <span>{t()}</span>}</For></td>;
}
// The server render has no bias; a browser render with one shows whether a value was created afresh or adopted.
const bias = () => globalThis.__bias ?? 0;
function Item(p) {
  const n = _regionState(() => signal(p.row().id * 10 + bias()));
  const open = _regionState(() => signal(p.row().id === 2));
  // Rows 2 and 9 hold a client effect: a lazy row with one materialises at idle (entry \`effects\`), the others stay inert.
  if (p.row().id % 7 === 2) clientEffect(() => void (globalThis.__fx ??= []).push(p.row().id));
  return <li id={createId()} data-id={p.row().id}>
    <button class="inc" onClick={() => n.set(n() + 1)}>{n()}</button>
    <Show when={open()} fallback={<i>closed</i>}><b>open</b></Show>
    <button class="tog" onClick={() => open.set(!open())}>t</button>
    <input class="in" value={p.row().label} />
  </li>;
}
export function Page(p) {
  const sel = signal(3);
  const list = signal(p.rows);
  return <main>
    <p id="sel">{sel()}</p>
    <button id="all" onClick={() => sel.set(-1)}>all</button>
    <button id="add" onClick={() => list.set([...list(), { id: 9, label: "new", tags: [] }])}>add</button>
    <table id="t"><tbody><For each={() => p.rows} by={(r) => r.id}>{(row, i) =>
      <tr id={createId()} class={sel() === row().id || sel() === -1 ? "on" : "off"}>
        <td>Item {row().label} #{i()}</td>
        <Cell label={row().label} on={() => sel.set(row().id)} />
        <td><Show when={sel() === row().id}><b>sel</b></Show></td>
        <Tags id={row().id} tags={row().tags} />
      </tr>}</For></tbody></table>
    <ul id="u"><For each={list} by={(r) => r.id}>{(row) => <Item row={row} />}</For></ul>
  </main>;
}`;
const dom = compileResume(source, "dom", "src/t5.tsx");
const mod = await importServer<{ Page(p: { rows: R[] }): ServerValue }>(compileResume(source, "server", "src/t5.tsx").code);
const manifest: ResumeManifest = {
  hash: "t5",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  lazyRows: true,
};
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const rows: R[] = [
  { id: 1, label: "a", tags: ["x", "y"] },
  { id: 2, label: "b", tags: [] },
  { id: 3, label: "c", tags: ["z"] },
];
process.env.RIVET_LAZY_ROWS = "on";
let body: string;
try {
  body = (await resumableToString(() => withIdScope("rv", () => mod.Page({ rows })), { manifest })) as string;
} finally {
  delete process.env.RIVET_LAZY_ROWS;
}
const state = JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(body)![1]!) as ResumeState;
assert.equal(state.L?.length, 2, "both Fors are lazy");
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  ...LAZY_ROWS_BUILD,
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + body + "</body></html>",
  // The server markup alone (no state, no loader): `_adoptRow` driven directly.
  "/bare": "<!doctype html><html><head></head><body>" + body.replace(/<script[\s\S]*?<\/script>/g, "") + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

// Tag every element (identity: a moved / replaced node loses its tag) and read back what changed.
const mark = (page: Page): Promise<void> =>
  page.evaluate(() => document.querySelectorAll("#t *, #u *").forEach((el, i) => ((el as unknown as { __m: number }).__m = i)));
const unmarked = (page: Page, selector: string): Promise<string[]> =>
  page.evaluate(
    (s) => [...document.querySelectorAll(s + " *")].filter((el) => (el as unknown as { __m?: number }).__m === undefined).map((el) => el.outerHTML),
    selector,
  );
const handled = (page: Page, selector: string): Promise<boolean[]> =>
  page.evaluate((s) => [...document.querySelectorAll(s)].map((el) => typeof (el as unknown as { $$click?: unknown }).$$click === "function"), selector);
async function open(page: Page, errors: string[], path = "/"): Promise<void> {
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://rivet.test" + path);
}
const text = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [selector, value], { timeout: 5000 });

test("first click (cold, before the runtime booted): the row materialises in place and its handler runs; the wake materialises the other rows in place", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    await open(page, errors);
    await mark(page);
    const ids = await page.evaluate(() => [...document.querySelectorAll("#t tr")].map((tr) => tr.id));
    const texts = await page.evaluate(() => [...document.querySelectorAll("#t tr")].map((tr) => tr.firstElementChild!.textContent));
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#t tr")].map((tr) => tr.className)), ["off", "off", "on"]);
    assert.deepEqual(await handled(page, "#t td.c"), [false, false, false]);
    await page.click("#t tr:nth-of-type(2) td.c");
    await text(page, "#sel", "2");
    await page.waitForFunction(() => document.querySelector("#t tr:nth-of-type(1)")!.className === "off");
    // `sel` is a read of the rows: its first change materialised every row (bindings now), none was replaced. Row 3 woke
    // with a Show branch the server rendered and the new value hides (a local swap inside its cell); row 2's branch is new.
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#t tr")].map((tr) => tr.className)), ["off", "on", "off"]);
    assert.deepEqual(await handled(page, "#t td.c"), [true, true, true]);
    assert.deepEqual(await unmarked(page, "#t"), ["<b>sel</b>"]);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#t b")].map((b) => b.closest("tr")!.rowIndex)), [1]);
    // Ids replay (`_rowIdPrefix` seed), text is the server's (merged server text split into the template's nodes).
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#t tr")].map((tr) => tr.id)), ids);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#t tr")].map((tr) => tr.firstElementChild!.textContent)), texts);
    // Refs got the live elements; a binding update after materialisation reaches every row.
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#t td:last-child")].map((td) => (td as HTMLElement).dataset.ref)), [
      "1",
      "2",
      "3",
    ]);
    await page.click("#all");
    await page.waitForFunction(() => [...document.querySelectorAll("#t tr")].every((tr) => tr.className === "on"));
    await page.click("#t tr:nth-of-type(3) td.c");
    await text(page, "#sel", "3");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#t b")].map((b) => b.closest("tr")!.rowIndex)), [2]);
    assert.deepEqual(errors, []);
  });
});

test("a row without shared reads materialises alone (at idle when it holds a client effect): _regionState adopted, effects run once, ids and markup kept, siblings inert, typed input kept", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    await page.addInitScript(() => ((globalThis as unknown as { __bias: number }).__bias = 1000));
    await open(page, errors);
    await mark(page);
    const before = await page.evaluate(() => [...document.querySelectorAll("#u li")].map((li) => li.outerHTML));
    // Typed into row 3 before it materialises: the adopt run's `value` write must not take it away.
    await page.fill("#u li:nth-of-type(3) .in", "typed");
    // Row 2 holds a client effect: materialised at idle, before any event reached it; rows 1 and 3 stay inert.
    await page.waitForFunction(() => ((globalThis as unknown as { __fx?: number[] }).__fx ?? []).length > 0);
    assert.deepEqual(await handled(page, "#u .inc"), [false, true, false]);
    await page.click("#u li:nth-of-type(2) .inc");
    // Adopted: 20 (server) + 1 — a browser-created value would start at 1020.
    await text(page, "#u li:nth-of-type(2) .inc", "21");
    await page.waitForFunction(() => ((globalThis as unknown as { __fx?: number[] }).__fx ?? []).length > 0);
    assert.deepEqual(await page.evaluate(() => (globalThis as unknown as { __fx: number[] }).__fx), [2]);
    assert.deepEqual(await handled(page, "#u .inc"), [false, true, false]);
    assert.deepEqual(await unmarked(page, "#u"), []);
    const after = await page.evaluate(() => [...document.querySelectorAll("#u li")].map((li) => li.outerHTML));
    assert.deepEqual([after[0], after[2]], [before[0], before[2]]);
    assert.equal(after[1]!.replace(">21<", ">20<").replace(/<!---->/g, ""), before[1]);
    // The adopted Show branch and state (`open` = true on the server for row 2).
    await page.click("#u li:nth-of-type(2) .tog");
    await page.waitForFunction(() => document.querySelector("#u li:nth-of-type(2) i")?.textContent === "closed");
    // Row 3: materialises on its click, the typed value survives, the input is the same node.
    await page.click("#u li:nth-of-type(3) .inc");
    await text(page, "#u li:nth-of-type(3) .inc", "31");
    assert.equal(await page.inputValue("#u li:nth-of-type(3) .in"), "typed");
    assert.deepEqual(await page.evaluate(() => (globalThis as unknown as { __fx: number[] }).__fx), [2]);
    assert.deepEqual(await unmarked(page, "#u li:nth-of-type(3)"), []);
    assert.deepEqual(errors, []);
  });
});

test("reconcile: the re-created For keys the server rows — kept rows stay inert, new rows are created, a kept row materialises later through the client For", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    await open(page, errors);
    await mark(page);
    // Row 2 materialised before the reconcile: its bindings live on in the re-created For.
    await page.click("#u li:nth-of-type(2) .inc");
    await text(page, "#u li:nth-of-type(2) .inc", "21");
    await page.click("#add");
    await page.waitForFunction(() => document.querySelectorAll("#u li").length === 4);
    assert.deepEqual(await unmarked(page, "#u li:nth-of-type(-n+3)"), []);
    assert.deepEqual(await handled(page, "#u .inc"), [false, true, false, true]);
    await page.waitForFunction(() => ((globalThis as unknown as { __fx?: number[] }).__fx ?? []).length === 2);
    assert.deepEqual(await page.evaluate(() => (globalThis as unknown as { __fx: number[] }).__fx), [2, 9]);
    // A kept inert row materialises on its click, through the For's row function (its item and owner).
    await page.click("#u li:nth-of-type(1) .inc");
    await text(page, "#u li:nth-of-type(1) .inc", "11");
    await page.click("#u li:nth-of-type(2) .inc");
    await text(page, "#u li:nth-of-type(2) .inc", "22");
    await page.click("#u li:nth-of-type(4) .inc");
    await text(page, "#u li:nth-of-type(4) .inc", "91");
    assert.deepEqual(await unmarked(page, "#u li:nth-of-type(-n+3)"), []);
    assert.deepEqual(errors, []);
  });
});

test("_materialise(node) (cdk focus / activedescendant targets): synchronous once the row's chunk loaded, false outside lazy rows", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    await open(page, errors);
    await mark(page);
    // Boot the runtime and load the list rows' chunk through a click in another row.
    await page.click("#u li:nth-of-type(1) .inc");
    await text(page, "#u li:nth-of-type(1) .inc", "11");
    const result = await page.evaluate(async () => {
      const { _materialise } = (await import("/dom.ts" as string)) as { _materialise(node: Node): boolean };
      const li = document.querySelector("#u li:nth-of-type(3)")!;
      const before = typeof (li.querySelector(".inc") as unknown as { $$click?: unknown }).$$click;
      return [
        _materialise(document.getElementById("all")!),
        _materialise(li.querySelector(".in")!),
        before,
        typeof (li.querySelector(".inc") as unknown as { $$click?: unknown }).$$click,
      ];
    });
    assert.deepEqual(result, [false, true, "undefined", "function"]);
    assert.deepEqual(await unmarked(page, "#u"), []);
    assert.deepEqual(errors, []);
  });
});

test("_adoptRow (row symbol + the components it calls): handler, binding, ref, nested For adopt the server nodes; the verifier swaps a mismatching row only", async () => {
  const row = dom.symbols.find((s) => s.kind === "slot" && s.locals.includes("Cell"))!;
  // Records in render order: the table's For first.
  const forId = state.L![0]![0];
  await withPage(files, async (page) => {
    const errors: string[] = [];
    await open(page, errors, "/bare");
    await mark(page);
    const result = await page.evaluate(
      async ([path, name, items, forId]) => {
        const [{ _adoptRow }, { signal }, { _inIdScope, _rowIdPrefix }, chunk] = (await Promise.all([
          import("/dom-adopt.ts" as string),
          import("/reactivity.mjs" as string),
          import("/id.ts" as string),
          import(path as string),
        ])) as [
          { _adoptRow: (...a: unknown[]) => unknown },
          { signal: <T>(v: T) => (() => T) & { set(v: T): void } },
          { _inIdScope: <T>(s: object, fn: () => T) => T; _rowIdPrefix: (f: number, k: number) => string },
          Record<string, (sel: unknown) => (item: () => unknown, index: () => number) => unknown>,
        ];
        const sel = signal(3);
        const fn = chunk[name as string]!(sel);
        const trs = [...document.querySelectorAll("#t tr")];
        const warnings: string[] = [];
        const adopt = (k: number, verify: boolean) => {
          const start = trs[k]!.previousSibling!,
            end = trs[k]!.nextSibling!;
          return _adoptRow(
            null,
            <T>(run: () => T) => _inIdScope({ prefix: _rowIdPrefix(forId as number, k), n: 0 }, run),
            () =>
              fn(
                () => (items as unknown[])[k],
                () => k,
              ),
            start,
            end,
            verify ? (first: string) => warnings.push(first) : null,
          );
        };
        adopt(0, true);
        adopt(1, true);
        // Row 3's static attribute drifted (an extension, a proxy): the verifier names it and swaps that row only.
        trs[2]!.querySelector("td.c")!.setAttribute("class", "x");
        adopt(2, true);
        const live = [...document.querySelectorAll("#t tr")];
        sel.set(2);
        await new Promise((r) => setTimeout(r));
        (live[0]!.querySelector("td.c") as HTMLElement).click();
        await new Promise((r) => setTimeout(r));
        return {
          warnings,
          same: live.map((tr, k) => tr === trs[k]),
          classes: live.map((tr) => tr.className),
          sel: sel(),
          refs: live.map((tr) => (tr.lastElementChild as HTMLElement).dataset.ref),
          spans: live[0]!.querySelectorAll("span").length,
          // Every server element of row 1 kept (its `<b>sel</b>` is new: selected since).
          kept: [...live[0]!.querySelectorAll("*")].filter((el) => (el as unknown as { __m?: number }).__m === undefined).map((el) => el.outerHTML),
        };
      },
      ["/c/" + row.component + ".js", row.id.split("#")[1]!, rows, forId] as const,
    );
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0]!, /class="x".*template has "c"/);
    // Rows 1 and 2 adopted (the same nodes, bindings live), row 3 swapped (create + swap).
    assert.deepEqual(result.same, [true, true, false]);
    assert.deepEqual(result.classes, ["on", "off", "off"]);
    assert.equal(result.sel, 1);
    assert.deepEqual(result.refs, ["1", "2", "3"]);
    assert.equal(result.spans, 2);
    assert.deepEqual(result.kept, ["<b>sel</b>"]);
    assert.deepEqual(errors, []);
  });
});
