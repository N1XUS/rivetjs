// Lazy collection rows T3 (spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.1 / §5), story
// `/lazy-rows`: the ids inside a collection row (option / row / cell / item ids, slot ids, `aria-labelledby` /
// `aria-describedby` chains) come from the row's seeded id scope only, so a browser re-run of the row function
// reproduces the server markup. Per row kind (ListBox option + section, GridList row + section, Menu item + section,
// Table row + cell, Tree item): the server-rendered seeded copy (`#lazy-rows-seeded`) and the same views mounted in the
// browser (`#lazy-rows-client`) are compared row by row, byte for byte, after removing what only the server writes
// (comment markers, resume attributes) and putting attributes in name order. Plus: the plain 100-row collections resume and select.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const KINDS: [name: string, rows: string][] = [
  ["listbox", '[role="option"], [role="group"]'],
  ["gridlist", '[role="row"], [role="rowgroup"]'],
  ["menu", '[role="menuitem"], [role="group"]'],
  ["table", "tbody > tr, tbody td, tbody th"],
  ["tree", '[role="row"]'],
];

/** Outer HTML of every row element of `#<prefix>-<kind>` inside `root`, without comments / resume attributes. */
const rowsOf = (page: Page, root: string, host: string, selector: string) =>
  page.evaluate(
    ([root, host, selector]) => {
      const el = document.querySelector(`${root} ${host}`)!.cloneNode(true) as Element;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_COMMENT);
      const comments: Node[] = [];
      while (walker.nextNode()) comments.push(walker.currentNode);
      for (const c of comments) c.parentNode!.removeChild(c);
      // Resume attributes go; the rest in name order, `style` as the CSSOM writes it (the server and the DOM runtime
      // serialize attributes in their own order and spacing).
      for (const node of [el, ...el.querySelectorAll("*")]) {
        const attrs = node
          .getAttributeNames()
          .filter((name) => !/^data-r[a-z]*$/.test(name))
          .sort()
          .map((name) => [name, name === "style" ? (node as HTMLElement).style.cssText : node.getAttribute(name)!] as const);
        for (const name of node.getAttributeNames()) node.removeAttribute(name);
        for (const [name, value] of attrs) node.setAttribute(name, value);
      }
      return [...el.querySelectorAll(selector!)].map((row) => row.outerHTML);
    },
    [root, host, selector] as const,
  );

/** The first difference of two strings, with some context (server vs browser). */
function firstDifference(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 60);
  return `server …${a.slice(from, i + 60)}… / browser …${b.slice(from, i + 60)}…`;
}

test("lazy rows: seeded row ids are byte-equal between the server render and a browser re-run", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/lazy-rows");
  await page.click("#lazy-rows-mount");
  await page.waitForSelector("#lazy-rows-client #ls-tree [role=row]");
  for (const [kind, selector] of KINDS) {
    const server = await rowsOf(page, "#lazy-rows-seeded", `#ls-${kind}`, selector);
    const browser = await rowsOf(page, "#lazy-rows-client", `#ls-${kind}`, selector);
    assert.ok(server.length >= 100, `${kind}: 100 server rows (${server.length})`);
    assert.equal(browser.length, server.length, `${kind}: same row count`);
    for (let i = 0; i < server.length; i++) if (browser[i] !== server[i]) assert.fail(`${kind} row ${i} differs: ${firstDifference(server[i]!, browser[i]!)}`);
    // Generated ids inside a row come from its seed (`rvr…`) or the host (`ls-…`), never from a page counter.
    for (const id of server.join("").matchAll(/ id="([^"]+)"/g)) assert.doesNotMatch(id[1]!, /^rv[cst]?\d+$/, `${kind}: ${id[1]} is not row-scoped`);
  }
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("lazy rows: the plain 100-row collections resume (a click selects an option and a table row)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/lazy-rows");
  assert.equal(await page.$$eval("#lr-listbox [role=option]", (els) => els.length), 100);
  assert.equal(await page.$$eval("#lr-table tbody tr", (els) => els.length), 100);
  await page.click("#lr-listbox [data-key='o42']");
  await page.waitForFunction(() => document.querySelector("#lr-listbox [data-key='o42']")?.getAttribute("aria-selected") === "true", null, { timeout: 5000 });
  await page.click("#lr-table tbody tr[data-key='r7'] td");
  await page.waitForFunction(() => document.querySelector("#lr-table tr[data-key='r7']")?.getAttribute("aria-selected") === "true", null, { timeout: 5000 });
  assert.deepEqual(seen.errors, []);
  await page.close();
});
