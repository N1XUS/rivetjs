// TABLE-NATIVE — static Table stories: `/table-static` (proven call sites: native `<table>` markup) keeps table semantics
// (no `role=grid`, `th scope`, accessible name), no resume record covers a table (the story shell's own router records
// wrap the page: an input boots the shell, never the tables) and input (pointer, keyboard, text selection) leaves the
// server nodes as they are; `/table-static-parity` measures each native table against its grid-path twin (same boxes,
// same paint). The interactive grid path (selection, sort, keyboard) stays covered by `table.test.ts`. A docs frame
// without a shell (ui-docs `table-basic`) ships 0 JS files (`scripts/size-report/frames.mjs`, TABLE-NATIVE report).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("table static: native markup, no record, input leaves the server nodes", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  try {
    await page.goto(s.origin + "/table-static");
    await page.waitForLoadState("networkidle");
    const t = "#ts-large-table";
    assert.equal(await page.$eval(t, (el) => el.tagName), "TABLE");
    assert.equal(await page.getAttribute(t, "role"), null);
    assert.equal(await page.getAttribute(t, "tabindex"), null);
    assert.equal(await page.getAttribute(t, "aria-labelledby"), "ts-large-title");
    assert.match((await page.getAttribute(t, "class")) ?? "", /^table__content min-w-\[600px\]$/);
    assert.equal(await page.$$eval(`${t} tbody tr`, (els) => els.length), 120);
    assert.deepEqual(await page.$$eval(`${t} thead th`, (els) => els.map((el) => el.getAttribute("scope"))), ["col", "col", "col"]);
    assert.deepEqual(await page.$eval(`${t} tbody tr`, (tr) => [...tr.children].map((el) => `${el.tagName} ${el.getAttribute("scope")} ${el.className}`)), [
      "TH row table__cell",
      "TD null table__cell",
      "TD null table__cell",
    ]);
    assert.equal(await page.$$eval("[tabindex], [role=grid], [role=row], [data-key]", (els) => els.length), 0);
    // Auto form: header + body from `columns` / `items`, the name on the `<table>`, the footer after the scroll container.
    assert.equal(await page.getAttribute("#ts-auto table", "aria-label"), "Team");
    assert.equal(await page.getAttribute("#ts-auto", "aria-label"), null);
    assert.deepEqual(await page.$$eval("#ts-auto tbody th[scope=row]", (els) => els.map((el) => el.textContent)), ["Kate", "John"]);
    assert.equal(await page.textContent("#ts-auto [data-slot=table-footer]"), "2 members");
    // Accessibility tree: a table with column / row headers (not a grid).
    const snapshot = await page.locator("#ts-auto table").ariaSnapshot();
    assert.match(snapshot, /^- table "Team"/);
    assert.match(snapshot, /columnheader "Name"/);
    assert.match(snapshot, /rowheader "Kate"/);
    // No record covers a table: the boundary markers inside them have no record, no record chunk is a table chunk.
    const covered = await page.evaluate(() => {
      const state = JSON.parse(document.querySelector("script[type='rivet/boundaries']")?.textContent ?? '{"b":[],"u":[]}') as { b: number[][]; u: string[] };
      const recorded = new Set(state.b.map((r) => String(r[0])));
      const inside: string[] = [];
      for (const root of document.querySelectorAll("#ts-large, #ts-auto")) {
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT);
        for (let n: Node | null = walk.currentNode; n; n = walk.nextNode()) {
          const id = n.nodeType === 8 ? /^b(\d+)$/.exec((n as Comment).data)?.[1] : (n as Element).getAttribute("data-b");
          if (id && recorded.has(id)) inside.push(id);
        }
      }
      return { inside, chunks: state.u.filter((u) => /table/.test(u)) };
    });
    assert.deepEqual(covered, { inside: [], chunks: [] });
    assert.deepEqual(seen.scripts, [], "nothing before input");
    // Input: pointer, keyboard, a text selection. The tables keep their server nodes and markup (the shell's adopt run
    // renders the native branch over them: same markup on both sides).
    const html = await page.evaluate(() => {
      (window as { __ts?: Element }).__ts = document.querySelector("#ts-large-table")!;
      return document.querySelector("#ts-large")!.outerHTML + document.querySelector("#ts-auto")!.outerHTML;
    });
    await page.hover(`${t} tbody tr:nth-child(3)`);
    await page.click(`${t} tbody tr:nth-child(3) td:nth-child(2)`);
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowDown");
    await page.dblclick(`${t} tbody tr:nth-child(5) td:nth-child(3)`);
    await page.click("#ts-auto tbody th");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.evaluate(() => (window as { __ts?: Element }).__ts === document.querySelector("#ts-large-table")), true, "same table node");
    assert.equal(await page.evaluate(() => document.querySelector("#ts-large")!.outerHTML + document.querySelector("#ts-auto")!.outerHTML), html);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});

test("table static: native tables measure and paint as their grid-path twins (primary + secondary)", async () => {
  const page = await s.browser.newPage({ viewport: { width: 800, height: 900 } });
  const seen = watch(page);
  try {
    await page.goto(s.origin + "/table-static-parity");
    await page.waitForLoadState("networkidle");
    for (const variant of ["primary", "secondary"]) {
      assert.equal(await page.getAttribute(`#tp-native-${variant} table`, "role"), null, `${variant}: native`);
      assert.equal(await page.getAttribute(`#tp-grid-${variant} table`, "role"), "grid", `${variant}: grid twin`);
      const look = (root: string) =>
        page.$$eval(`${root} :is(table, thead, tbody, tr, th, td)`, (els) => {
          const base = els[0]!.getBoundingClientRect();
          return els.map((el) => {
            const r = el.getBoundingClientRect();
            const c = getComputedStyle(el);
            return [
              el.tagName === "TH" && el.closest("tbody") ? "TD" : el.tagName,
              Math.round(r.x - base.x),
              Math.round(r.y - base.y),
              Math.round(r.width),
              Math.round(r.height),
              c.backgroundColor,
              c.color,
              c.fontWeight,
              c.textAlign,
              c.fontSize,
              c.borderStartStartRadius,
              c.borderEndEndRadius,
              c.borderBottomWidth,
              c.paddingInlineStart,
            ].join(" ");
          });
        });
      assert.deepEqual(await look(`#tp-native-${variant}`), await look(`#tp-grid-${variant}`), variant);
    }
    // Hover fill: the native row follows `:hover` like the grid row (`:hover` / `data-hovered`); transitions settle first.
    const cell = (root: string) => `${root} tbody tr:nth-child(1) td:nth-child(2)`;
    const hovered = async (root: string) => {
      await page.hover(cell(root));
      await page.waitForTimeout(400);
      return page.$eval(cell(root), (el) => getComputedStyle(el).backgroundColor);
    };
    const resting = await page.$eval(cell("#tp-native-primary"), (el) => getComputedStyle(el).backgroundColor);
    const native = await hovered("#tp-native-primary");
    assert.notEqual(native, resting, "native row hover fill");
    assert.equal(native, await hovered("#tp-grid-primary"));
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});
