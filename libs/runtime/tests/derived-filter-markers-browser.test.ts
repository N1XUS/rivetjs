// Derived model, a resumed list's first filter (FILTER 2026-11-05): the client `_for` that takes the server rows drops the
// filtered-out rows' `<li>`s only — their server row markers stay as inert empty pairs (`_adoption.inert`; 900 removals
// instead of 2,700 on the resume-bench filter). The kept rows keep working (a click materialises the right row), a keyed
// write's row writers skip the dropped rows (the empty pair's "next element" is a neighbour's), a cleared filter brings the
// rows back as client rows, and a second filter drops earlier kept rows cleanly (one `each` run per later key: the slot
// follows the client list's rows, FILTER2; one at the first key too: the slot hands its run to the client list, EACH). Rows are primed at idle after the unit
// adopted (the same rows the first change would build). Compiled with the real derived server + DOM targets.
// MARKERS 2026-11-06: rows of a one-root row plan ship bare (no markers): the dropped rows' elements leave and nothing stays;
// a row of two root elements keeps its markers (the inert-pair path).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const source = (sep: boolean): string => `import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
const ITEMS = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, label: (i % 3 ? "plain " : "golf ") + i }));
export function List() {
  const query = signal("");
  const picked = signal(0);
  return (
    <section>
      <input id="q" value={query()} onInput={(e) => query.set((e.currentTarget as HTMLInputElement).value)} />
      <output id="picked">{picked()}</output>
      <ul id="rows">
        <For each={() => ((globalThis as { eachRuns?: number }).eachRuns = ((globalThis as { eachRuns?: number }).eachRuns ?? 0) + 1, query() ? ITEMS.filter((item) => item.label.includes(query())) : ITEMS)} by={(item) => item.id}>
          {(item) => (
            ${sep ? "<>" : ""}
              <li class={picked() === item().id ? "row sel" : "row"} data-id={item().id}>
                <button type="button" onClick={() => picked.set(item().id)}>{item().label}</button>
              </li>
              ${sep ? "<hr /></>" : ""}
          )}
        </For>
      </ul>
    </section>
  );
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/list.tsx", boundaries: ["List"], independent: ["List"] };

for (const sep of [false, true])
  compiled(
    `first filter (${sep ? "marked rows: dropped rows leave inert marker pairs" : "bare rows: dropped rows leave nothing"}); kept rows, keyed writes and later filters stay right`,
    async () => {
      const SOURCE = source(sep);
      const server = compile(SOURCE, { target: "server", filename: "list.tsx", resume } as never);
      const dom = compile(SOURCE, { target: "dom", filename: "list.tsx", resume } as never);
      assert.deepEqual(server.diagnostics, []);
      assert.deepEqual(dom.diagnostics, []);
      const { List } = await importServer<{ List: () => ServerValue }>(server.code);
      const symbols = { "src/list.tsx#List": "/list.js" };
      const html = (await derivedToString(() => List(), { manifest: { hash: "t", runtime: "/rt.js", symbols } } as never)) as string;
      const served = {
        ...DERIVED_BUILD,
        "/": "<!doctype html><html><body>" + html + "</body></html>",
        "/rt.js": 'export { default } from "/dom-derived.ts";',
        "/list.js": rewrite(dom.code),
      };
      await withPage(served, async (page) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("http://rivet.test/");
        const state = () =>
          page.evaluate(() => {
            const ul = document.querySelector("#rows")!;
            const comments = [...ul.childNodes].filter((n) => n.nodeType === 8).map((n) => (n as Comment).data.replace(/\d+/g, ""));
            return {
              ids: [...ul.querySelectorAll("li")].map((li) => li.dataset.id + (li.classList.contains("sel") ? "*" : "")),
              comments: comments.length,
              // Balanced: no `]` before its opener at the list's level.
              balanced: comments.reduce((depth, d) => (depth < 0 ? depth : d === "]" ? depth - 1 : d.endsWith("[") ? depth + 1 : depth), 0) === 0,
            };
          });
        const removed = await page.evaluate(() => {
          const w = window as unknown as { removed: string[] };
          w.removed = [];
          new MutationObserver((records) => {
            for (const r of records) for (const n of r.removedNodes) w.removed.push(n.nodeName + (n.nodeType === 8 ? ":" + (n as Comment).data : ""));
          }).observe(document.querySelector("#rows")!, { childList: true });
          return true;
        });
        assert.ok(removed);
        assert.equal((await state()).ids.length, 30);
        await page.click("#q");
        await page.waitForTimeout(50);
        const eachRuns = () => page.evaluate(() => (globalThis as { eachRuns?: number }).eachRuns ?? 0);
        const first = await eachRuns();
        await page.keyboard.type("g");
        await page.waitForFunction(() => document.querySelectorAll("#rows li").length === 10);
        // EACH 2026-11-06: the first key's `each` runs once — the slot's run, handed to the client `_for` it builds.
        assert.equal((await eachRuns()) - first, 1);
        let s = await state();
        assert.deepEqual(s.ids, ["1", "4", "7", "10", "13", "16", "19", "22", "25", "28"]);
        if (sep) assert.equal(s.comments, 60, "every server row's marker pair stays (10 kept rows, 20 inert empty pairs)");
        else assert.equal(s.comments, 0, "bare rows: no row marker at all");
        assert.ok(s.balanced);
        const names = await page.evaluate(() => (window as unknown as { removed: string[] }).removed);
        // The dropped rows' elements leave, plus the server's content pair around the list slot (as before); no row marker.
        assert.equal(names.filter((name) => name === "LI").length, 20);
        assert.deepEqual(names.filter((name) => name !== "LI" && name !== "HR").sort(), ["#comment:[", "#comment:]"]);
        assert.equal(names.filter((name) => name === "HR").length, sep ? 20 : 0);
        if (!sep) assert.match(html, /<ul id="rows"><!--\[--><li /);
        // A kept row's click materialises that row (its handler, its item); the keyed `picked` write updates the rows' class
        // without touching the empty pairs' neighbours.
        await page.click('li[data-id="7"] button');
        await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "7");
        s = await state();
        assert.deepEqual(s.ids, ["1", "4", "7*", "10", "13", "16", "19", "22", "25", "28"]);
        await page.click('li[data-id="13"] button');
        await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "13");
        assert.deepEqual((await state()).ids, ["1", "4", "7", "10", "13*", "16", "19", "22", "25", "28"]);
        // A second filter drops earlier kept rows; clearing it brings every row back (client rows for the dropped ones).
        await page.focus("#q");
        const runs = () => page.evaluate(() => (globalThis as { eachRuns?: number }).eachRuns ?? 0);
        const before = await runs();
        await page.keyboard.type("olf 1");
        await page.waitForFunction(() => document.querySelectorAll("#rows li").length === 3);
        assert.deepEqual((await state()).ids, ["13*", "16", "19"]);
        // FILTER2 2026-11-05: once the client list exists the slot follows its rows only — one `each` run per key, not two.
        assert.equal((await runs()) - before, 5);
        await page.fill("#q", "");
        await page.waitForFunction(() => document.querySelectorAll("#rows li").length === 30);
        s = await state();
        assert.deepEqual(
          s.ids,
          Array.from({ length: 30 }, (_, i) => String(i + 1) + (i === 12 ? "*" : "")),
        );
        assert.ok(s.balanced);
        await page.click('li[data-id="2"] button');
        await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "2");
        assert.deepEqual(
          (await state()).ids.filter((id) => id.endsWith("*")),
          ["2*"],
        );
        assert.deepEqual(errors, []);
      });
    },
  );
