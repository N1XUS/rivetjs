// Bare rows (MARKERS 2026-11-06): a resumed keyed list whose row plan renders exactly one root element ships its rows
// without row region markers — the row is its element. Pins, on the real derived server + DOM targets: the server HTML has
// no row marker; rows built on demand (no idle build) count their index from the nearest built row before them (`enclosing`
// → `bareRow`) and a later event walks a bounded number of siblings; a materialised row adopts between two anchors it gets
// then; keyed row writers (`touched`) write the right unbuilt row; a reorder moves bare and anchored rows; a list beside
// other content (not sole) claims its bare rows by count; a filter removes the dropped rows' elements only.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
const ITEMS = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, label: "row " + (i + 1) }));
export function List() {
  const picked = signal(0);
  const order = signal(0);
  const query = signal("");
  const side = signal(0);
  const items = () => {
    const q = query();
    const all = q ? ITEMS.filter((item) => String(item.id).endsWith(q)) : ITEMS;
    return order() ? all.slice().reverse() : all;
  };
  return (
    <section>
      <input id="q" value={query()} onInput={(e) => query.set((e.currentTarget as HTMLInputElement).value)} />
      <button type="button" id="rev" onClick={() => order.set(order() ? 0 : 1)}>rev</button>
      <output id="picked">{picked()}</output>
      <output id="side">{side()}</output>
      <ul id="rows">
        <For each={items} by={(item) => item.id}>
          {(item) => (
            <li class={picked() === item().id ? "row sel" : "row"} data-id={item().id}>
              <button type="button" class="pick" onClick={() => picked.set(item().id)}>{item().label}</button>
            </li>
          )}
        </For>
      </ul>
      <ol id="side-rows">
        <li id="head">head</li>
        <For each={() => ITEMS.slice(0, 5)} by={(item) => item.id}>
          {(item) => (
            <li data-id={item().id}>
              <button type="button" class="side" onClick={() => side.set(item().id)}>{item().label}</button>
            </li>
          )}
        </For>
        <li id="tail">tail</li>
      </ol>
    </section>
  );
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/list.tsx", boundaries: ["List"], independent: ["List"] };

async function files(): Promise<{ served: Record<string, string>; html: string }> {
  const server = compile(SOURCE, { target: "server", filename: "list.tsx", resume } as never);
  const dom = compile(SOURCE, { target: "dom", filename: "list.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { List } = await importServer<{ List: () => ServerValue }>(server.code);
  const symbols = { "src/list.tsx#List": "/list.js" };
  const html = (await derivedToString(() => List(), { manifest: { hash: "t", runtime: "/rt.js", symbols } } as never)) as string;
  return {
    html,
    served: {
      ...DERIVED_BUILD,
      "/": "<!doctype html><html><body>" + html + "</body></html>",
      "/rt.js": 'export { default } from "/dom-derived.ts";',
      "/list.js": rewrite(dom.code),
    },
  };
}
const selected = (page: import("playwright").Page) =>
  page.evaluate(() => [...document.querySelectorAll("#rows li.sel")].map((li) => (li as HTMLElement).dataset.id));

compiled("bare rows: no row markers; on-demand rows, anchors, keyed writes, reorder, a non-sole list and a filter", async () => {
  const { served, html } = await files();
  // No row marker: the list slot's content pair, then the row elements.
  assert.match(html, /<ul id="rows"><!--\[--><li class="row" data-id="1">/);
  assert.doesNotMatch(html, /<!--r\d*\[-->/);
  assert.match(html, /<li id="head">head<\/li><!--\[--><li data-id="1">/);
  await withPage(served, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Rows on demand: no idle row build.
    await page.addInitScript(() => void ((window as unknown as Record<string, unknown>).requestIdleCallback = () => 0));
    await page.goto("http://rivet.test/");
    // 280 is built first (its index counted from the list's start); 290 / 285 count from a built row; 3 from the start.
    for (const id of [280, 290, 285, 3]) {
      await page.click(`#rows li[data-id="${id}"] .pick`);
      await page.waitForFunction((id) => document.querySelector("#picked")!.textContent === String(id), id, { timeout: 2000 });
      assert.deepEqual(await selected(page), [String(id)], `row ${id} picked`);
    }
    // A materialised bare row adopted between two empty anchors; unbuilt rows have none.
    const shape = await page.evaluate(() => {
      const ul = document.querySelector("#rows")!;
      return { comments: [...ul.childNodes].filter((n) => n.nodeType === 8).length, rows: ul.querySelectorAll("li").length };
    });
    assert.deepEqual(shape, { comments: 2 + 2 * 4, rows: 300 });
    // A later event in a late row walks a bounded number of siblings (stops at the nearest built row).
    const reads = await page.evaluate(() => {
      const d = Object.getOwnPropertyDescriptor(Node.prototype, "previousSibling")!;
      let n = 0;
      Object.defineProperty(Node.prototype, "previousSibling", {
        configurable: true,
        get: function (this: Node) {
          return (n++, d.get!.call(this));
        },
      });
      const el = document.querySelector('#rows li[data-id="292"] .pick')!;
      try {
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, pointerType: "mouse", isPrimary: true }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
      } finally {
        Object.defineProperty(Node.prototype, "previousSibling", d);
      }
      return n;
    });
    assert.ok(reads < 200, `previousSibling reads: ${reads}`);
    await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "292");
    assert.deepEqual(await selected(page), ["292"]);
    // A list beside other content claims its bare rows by count.
    await page.click('#side-rows li[data-id="4"] .side');
    await page.waitForFunction(() => document.querySelector("#side")!.textContent === "4");
    // Reorder: every row moves (bare ones and anchored ones); clicks still reach the right rows.
    await page.click("#rev");
    await page.waitForFunction(() => document.querySelector("#rows li")!.getAttribute("data-id") === "300");
    const ids = await page.evaluate(() => [...document.querySelectorAll("#rows li")].map((li) => +(li as HTMLElement).dataset.id!));
    assert.deepEqual(
      ids,
      Array.from({ length: 300 }, (_, i) => 300 - i),
    );
    for (const id of [5, 285, 150]) {
      await page.click(`#rows li[data-id="${id}"] .pick`);
      await page.waitForFunction((id) => document.querySelector("#picked")!.textContent === String(id), id);
      assert.deepEqual(await selected(page), [String(id)]);
    }
    // A filter removes the dropped rows' elements (and the dropped anchored rows' anchors); nothing inert stays.
    await page.click("#rev");
    await page.waitForFunction(() => document.querySelector("#rows li")!.getAttribute("data-id") === "1");
    await page.fill("#q", "5");
    await page.waitForFunction(() => document.querySelectorAll("#rows li").length === 30);
    const after = await page.evaluate(() => {
      const ul = document.querySelector("#rows")!;
      return {
        ids: [...ul.querySelectorAll("li")].map((li) => +(li as HTMLElement).dataset.id!),
        comments: [...ul.childNodes].filter((n) => n.nodeType === 8).length,
      };
    });
    assert.deepEqual(
      after.ids,
      Array.from({ length: 30 }, (_, i) => i * 10 + 5),
    );
    // Kept anchored rows: 5, 285 (two anchors each; the slot's server content pair left at the first change).
    assert.equal(after.comments, 2 * 2);
    await page.click('#rows li[data-id="215"] .pick');
    await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "215");
    assert.deepEqual(await selected(page), ["215"]);
    await page.fill("#q", "");
    await page.waitForFunction(() => document.querySelectorAll("#rows li").length === 300);
    await page.click('#rows li[data-id="2"] .pick');
    await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "2");
    assert.deepEqual(await selected(page), ["2"]);
    assert.deepEqual(errors, []);
  });
});
