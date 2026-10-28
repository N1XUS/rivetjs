// JS-DIET-2 (`dom-lite-cond.ts`, `_lv`, `LiteRec.p`): lite residuals for real-page constructs — a conditional native
// subtree (`{open() ? <dialog …/> : null}`, nested conditionals in its branch), an `<input>` / `<select>` `value`, and
// live bindings / handlers over the record's props. Server = the real derived server target; the residual is what
// `derived_lite.rs` emits for SOURCE (hand-written here, same text modulo formatting).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal, computed } from "@rivetjs/reactivity";
export function App(props: { items: string[]; start: boolean }) {
  const open = signal(props.start);
  const query = signal("");
  const sort = signal("a");
  const shown = computed(() => props.items.filter((x) => x.includes(query())).length);
  return <div class="app"><button class="toggle" onClick={() => open.set(!open())}>Toggle</button><select class="sort" value={sort()} onChange={(e) => sort.set(e.currentTarget.value)}><option value="a">A</option><option value="b">B</option></select><p class="count">{shown()}</p>{open() ? <section class="dialog"><input class="q" value={query()} onInput={(e) => query.set(e.currentTarget.value)} /><nav>{"alpha".includes(query()) ? <a class="hit" href="#a" onClick={() => open.set(false)}>Alpha</a> : null}{"beta".includes(query()) ? <a class="hit" href="#b" onClick={() => open.set(false)}>Beta</a> : null}</nav><button class="close" onClick={() => open.set(false)}>Close</button></section> : null}<p class="sorted">{sort()}</p></div>;
}`;
const RESUME = { module: "src/a.tsx", boundaries: ["App"], independent: ["App"] };
// `derived_lite.rs` (JS-DIET-2) output for SOURCE: props from the record, `_lv` values, `_lo` branches with nested `_lo`.
const residual = (keys: string[]) => `import { _ls, _le, _lt, _lw, _lc, _lo, _lv } from "@rivetjs/runtime/dom-lite";
export function App$a(n, r) {
  const props = r.p;
  const open = _ls(r, ${JSON.stringify(keys[0])});
  const query = _ls(r, ${JSON.stringify(keys[1])}, "");
  const sort = _ls(r, ${JSON.stringify(keys[2])}, "a");
  const shown = _lc(() => props.items.filter((x) => x.includes(query())).length);
  const e0 = _lw(n, "f");
  _le(r, e0, "click", () => open.set(!open()));
  const e1 = _lw(n, "fn");
  _lv(e1, () => sort());
  _le(r, e1, "change", (e) => sort.set(e.currentTarget.value));
  const e2 = _lw(n, "fnn");
  _lt(e2, () => shown());
  _lo(_lw(n, "fnnn"), () => open(), (b) => {
    const e3 = _lw(b, "f");
    _lv(e3, () => query());
    _le(r, e3, "input", (e) => query.set(e.currentTarget.value));
    _lo(_lw(b, "fnf"), () => "alpha".includes(query()), (a) => {
      _le(r, a, "click", () => open.set(false));
    }, ["a", { "class": "hit", "href": "#a" }, "Alpha"]);
    _lo(_lw(b, "fnfhn"), () => "beta".includes(query()), (a) => {
      _le(r, a, "click", () => open.set(false));
    }, ["a", { "class": "hit", "href": "#b" }, "Beta"]);
    const e4 = _lw(b, "fnn");
    _le(r, e4, "click", () => open.set(false));
  }, ["section", { "class": "dialog" }, ["input", { "class": "q" }], ["nav", {}, 0, 1, 0, 1], ["button", { "class": "close" }, "Close"]]);
  const e5 = _lw(n, "fnnnhn");
  _lt(e5, () => sort());
}
export const App$c = () => import("/a-full.js");`;

const compiled = hasDerivedModel() ? test : test.skip;
async function files(start: boolean): Promise<Record<string, string>> {
  const server = compile(SOURCE, { target: "server", filename: "a.tsx", resume: RESUME } as never);
  const dom = compile(SOURCE, { target: "dom", filename: "a.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const keys = [...dom.code.matchAll(/__rivetR_sig\("([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(keys.length, 3);
  const { App } = await importServer<{ App: (props: { items: string[]; start: boolean }) => ServerValue }>(server.code);
  const html = (await derivedToString(() => App({ items: ["ab", "abc", "b"], start }), {
    manifest: { runtime: "/lite.js", symbols: { "src/a.tsx#App": "/a.js" } },
  })) as string;
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/lite.js": 'export { default } from "/dom-lite.ts";',
    "/a.js": rewrite(residual(keys)),
    "/a-full.js": rewrite(dom.code),
  };
}
const state = (page: import("playwright").Page) =>
  page.evaluate(() => ({
    dialog: document.querySelectorAll(".dialog").length,
    hits: [...document.querySelectorAll(".hit")].map((a) => a.textContent),
    count: document.querySelector(".count")!.textContent,
    sorted: document.querySelector(".sorted")!.textContent,
  }));

compiled("lite conditional subtree: a cold click builds the branch from its spec, nested branches follow the query, closing releases it", async () => {
  await withPage(await files(false), async (page, requests) => {
    await page.goto("http://rivet.test/");
    assert.deepEqual(await state(page), { dialog: 0, hits: [], count: "3", sorted: "a" });
    await page.click(".toggle");
    await page.waitForFunction(() => document.querySelectorAll(".dialog").length === 1);
    assert.deepEqual((await state(page)).hits, ["Alpha", "Beta"]);
    await page.fill(".q", "be");
    await page.waitForFunction(() => document.querySelectorAll(".hit").length === 1);
    assert.deepEqual(await state(page), { dialog: 1, hits: ["Beta"], count: "0", sorted: "a" });
    await page.fill(".q", "b");
    assert.deepEqual((await state(page)).count, "3");
    // A handler inside a nested branch closes the outer one; reopening builds it again with the current query.
    await page.click(".hit");
    await page.waitForFunction(() => document.querySelectorAll(".dialog").length === 0);
    await page.click(".toggle");
    await page.waitForFunction(() => document.querySelectorAll(".dialog").length === 1);
    assert.equal(await page.inputValue(".q"), "b");
    assert.deepEqual((await state(page)).hits, ["Beta"]);
    // Released: the removed branch's bindings no longer write its (detached) nodes.
    await page.evaluate(() => ((window as unknown as { old: Element }).old = document.querySelector(".dialog")!));
    await page.click(".close");
    await page.waitForFunction(() => document.querySelectorAll(".dialog").length === 0);
    await page.selectOption(".sort", "a");
    await page.click(".toggle");
    await page.fill(".q", "zz");
    assert.equal(await page.evaluate(() => (window as unknown as { old: Element }).old.querySelector("input")!.value), "b", "released branch stays as it was");
    assert.equal(await page.evaluate(() => (window as unknown as { old: Element }).old.querySelectorAll(".hit").length), 1);
    await page.click(".close");
    // `<select value>` with static options: a change writes the signal; the signal writes the selection.
    await page.selectOption(".sort", "b");
    await page.waitForFunction(() => document.querySelector(".sorted")!.textContent === "b");
    assert.ok(!requests.includes("/dom-derived.ts") && !requests.includes("/a-full.js"), requests.join(" "));
  });
});

compiled("lite conditional subtree: a branch the server rendered is adopted in place (its nodes kept, its handlers bound)", async () => {
  await withPage(await files(true), async (page, requests) => {
    await page.goto("http://rivet.test/");
    assert.deepEqual((await state(page)).dialog, 1);
    await page.evaluate(() => ((document.querySelector(".dialog") as unknown as { __t: number }).__t = 1));
    await page.fill(".q", "al");
    await page.waitForFunction(() => document.querySelectorAll(".hit").length === 1);
    assert.equal(await page.evaluate(() => (document.querySelector(".dialog") as unknown as { __t?: number }).__t), 1, "server nodes kept");
    assert.deepEqual(await state(page), { dialog: 1, hits: ["Alpha"], count: "0", sorted: "a" });
    await page.click(".close");
    await page.waitForFunction(() => document.querySelectorAll(".dialog").length === 0);
    assert.ok(!requests.includes("/dom-derived.ts") && !requests.includes("/a-full.js"), requests.join(" "));
  });
});
