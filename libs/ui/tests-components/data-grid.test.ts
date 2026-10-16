// DataGrid (Rivet addition) — resumed story app (`/data-grid`): SSR markup + HeroUI table CSS applied; nothing of the grid
// runs before an interaction (no client re-render: server rows keep their nodes through sort / select); header click sorts,
// checkbox / select-all select (two-way signal on the page), keyboard navigation after resume, virtualized 10k rows render
// one window and scrolling swaps rows; first-interaction latency on a throttled network is reported (and bounded); visual
// regressions: row headers are `td` with the table look + rounded corners, the body frame stays rounded while rows scroll
// under the sticky header (pixel samples), pinned cells are opaque in every row state while scrolled, resizers stay inside
// the scroll container.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, focused, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 900, height: 900 } });
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

const names = (page: Page, grid: string) => page.$$eval(`${grid} tbody tr[data-key] [data-column=name]`, (cells) => cells.map((c) => c.textContent));

test("data-grid: SSR markup, HeroUI table CSS, first virtual window only", () =>
  onPage(async (page) => {
    const response = await page.goto(s.origin + "/data-grid");
    const html = await response!.text();
    assert.match(html, /<div data-slot="data-grid" class="table-root data-grid table-root--primary"/);
    // `id` names the grid element (the `<table role="grid">`)
    assert.match(html, /<table role="grid" class="table__content data-grid__content" id="dg"/);
    assert.equal((html.match(/data-rv-select=""/g) ?? []).length, 6, "row checkboxes of #dg only (the virtual grid shows none)");
    const virtualRows = await page.locator("#dg-virtual tbody tr[data-key]").count();
    assert.ok(virtualRows > 0 && virtualRows < 40, `one window (${virtualRows})`);
    assert.equal(await page.getAttribute("#dg-virtual", "aria-rowcount"), "10001");
    // vendored CSS: the primary root paints the secondary surface, sticky header cell has a background
    const bg = await page.$eval(".data-grid:has(#dg)", (el) => getComputedStyle(el).backgroundColor);
    assert.notEqual(bg, "rgba(0, 0, 0, 0)");
    assert.equal(await page.$eval("#dg thead th[data-column=name]", (el) => getComputedStyle(el).position), "sticky");
  }));

test("data-grid: resumed sort + selection keep the server rows; keyboard after resume", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/data-grid");
    await page.waitForLoadState("networkidle");
    // tag server-rendered rows: a client re-render would drop the marks
    await page.$$eval("#dg tbody tr[data-key]", (rows) => rows.forEach((r) => ((r as unknown as { __server: boolean }).__server = true)));
    assert.deepEqual(await names(page, "#dg"), ["Mara Quinn", "Ilya Brandt", "Tomasz Ek", "Noor Haddad", "Celia Varga", "Bo Lindqvist"]);
    await page.click("#dg thead th[data-column=name]");
    await page.waitForFunction(() => document.querySelector("#dg th[data-column=name]")?.getAttribute("aria-sort") === "ascending");
    assert.deepEqual(await names(page, "#dg"), ["Bo Lindqvist", "Celia Varga", "Ilya Brandt", "Mara Quinn", "Noor Haddad", "Tomasz Ek"]);
    assert.ok(
      await page.$$eval("#dg tbody tr[data-key]", (rows) => rows.every((r) => (r as unknown as { __server?: boolean }).__server === true)),
      "sorted rows are the server nodes (moved, not re-created)",
    );
    await page.click("#dg tbody tr[data-key='4'] [data-rv-select]");
    await page.waitForFunction(() => document.querySelector("#dg-selected")?.textContent === "4");
    assert.equal(await page.getAttribute("#dg tbody tr[data-key='4']", "aria-selected"), "true");
    await page.click("#dg [data-rv-select-all]");
    await page.waitForFunction(() => document.querySelector("#dg-selected")?.textContent === "all");
    assert.equal(await page.locator("#dg tbody tr[aria-selected=true]").count(), 6);
    // keyboard: focus a cell, move down, Enter = row action (selection non-empty → toggles instead in toggle mode; clear first)
    await page.click("#dg [data-rv-select-all]");
    await page.waitForFunction(() => document.querySelector("#dg-selected")?.textContent === "");
    await page.focus("#dg tbody tr[data-key='6'] [data-column=name]");
    await page.keyboard.press("ArrowDown");
    assert.equal((await focused(page)).role, "rowheader");
    assert.equal(await page.evaluate(() => document.activeElement?.closest("tr")?.getAttribute("data-key")), "5");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-column")), "age");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#dg-action")?.textContent === "5");
    assert.deepEqual(seen.errors, []);
  }));

test("data-grid: virtualized 10k rows scroll swaps the window; sort on 10k", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/data-grid");
    await page.waitForLoadState("networkidle");
    const scroller = ".data-grid__scroll-container:has(#dg-virtual)";
    await page.$eval(scroller, (el) => (el.scrollTop = 40 * 5000));
    await page.waitForFunction(() => !!document.querySelector("#dg-virtual tbody tr[data-key='5000']"));
    const count = await page.locator("#dg-virtual tbody tr[data-key]").count();
    assert.ok(count < 40, `window only (${count})`);
    assert.equal(await page.getAttribute("#dg-virtual tbody tr[data-key='5000']", "aria-rowindex"), "5002");
    await page.$eval(scroller, (el) => (el.scrollTop = 0));
    await page.click("#dg-virtual thead th[data-column=age]");
    await page.waitForFunction(() => document.querySelector("#dg-virtual th[data-column=age]")?.getAttribute("aria-sort") === "ascending");
    const ages = await page.$$eval("#dg-virtual tbody tr[data-key] [data-column=age]", (c) => c.slice(0, 3).map((x) => Number(x.textContent)));
    assert.deepEqual(ages, [0, 0, 0]);
    assert.deepEqual(seen.errors, []);
  }));

test("data-grid: first interaction on a throttled network (Slow 4G-like) sorts within budget", () =>
  onPage(async (page) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await page.goto(s.origin + "/data-grid", { waitUntil: "domcontentloaded" });
    // scroll the grid into view so visible preloads start, then click at once (no networkidle wait)
    const t0 = Date.now();
    await page.click("#dg thead th[data-column=age]");
    await page.waitForFunction(() => document.querySelector("#dg th[data-column=age]")?.getAttribute("aria-sort") === "ascending", undefined, {
      timeout: 15_000,
    });
    const ms = Date.now() - t0;
    console.info(`[data-grid] cold sort click → sorted on throttled network: ${ms} ms`);
    assert.ok(ms < 6000, `cold first interaction ${ms} ms`);
  }));

/** Pixel `[r, g, b]` at page coordinates `points` of a fresh viewport screenshot (decoded in the page). */
async function pixels(page: Page, points: Array<[number, number]>): Promise<number[][]> {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ png, points }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / window.innerWidth;
      return points.map(([x, y]) => [...ctx.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data.slice(0, 3)]);
    },
    { png, points },
  );
}

const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]!) <= 3);

test("data-grid: row headers are td cells with the table look; first-column body corners are rounded", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/data-grid");
    const cells = await page.$$eval("#dg-pinned tbody tr[data-key] > [data-column=name]", (els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          role: el.getAttribute("role"),
          align: cs.textAlign,
          weight: cs.fontWeight,
          ss: cs.borderStartStartRadius,
          es: cs.borderEndStartRadius,
        };
      }),
    );
    for (const c of cells) {
      assert.equal(c.tag, "TD");
      assert.equal(c.role, "rowheader");
      assert.ok(c.align === "start" || c.align === "left", `row header aligned ${c.align}`);
      assert.equal(c.weight, "400");
    }
    assert.notEqual(cells[0]!.ss, "0px", "first row, first column: top-start corner rounded");
    assert.notEqual(cells.at(-1)!.es, "0px", "last row, first column: bottom-start corner rounded");
    // #dg: the checkbox column is the first column; its corner cells are rounded too
    const first = await page.$eval("#dg tbody tr[data-key]:first-child > :first-child", (el) => getComputedStyle(el).borderStartStartRadius);
    const last = await page.$eval("#dg tbody tr[data-key]:last-of-type > :first-child", (el) => getComputedStyle(el).borderEndStartRadius);
    assert.notEqual(first, "0px");
    assert.notEqual(last, "0px");
    // row checkboxes take the table's secondary checkbox look: an unchecked box is filled (visible on the row surface)
    const [box, cell] = await page.$eval("#dg tbody tr[data-key] [data-rv-select]:not([aria-checked=true])", (el) => [
      getComputedStyle(el.querySelector(".checkbox__control")!).backgroundColor,
      getComputedStyle(el.closest("td")!).backgroundColor,
    ]);
    assert.notEqual(box, cell, `unchecked row checkbox ${box} differs from its cell ${cell}`);
  }));

test("data-grid: the body frame stays rounded while rows scroll under the sticky header (primary + secondary)", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/data-grid");
    await page.waitForLoadState("networkidle");
    for (const id of ["#dg-virtual", "#dg-secondary"]) {
      const mask = await page.$eval(`.data-grid__scroll-container:has(${id})`, (el) => getComputedStyle(el).maskImage);
      assert.match(mask, /radial-gradient/, `${id} frame mask`);
    }
    const scroller = ".data-grid__scroll-container:has(#dg-virtual)";
    await page.$eval(scroller, (el) => el.scrollIntoView({ block: "center" }));
    for (const top of [0, 40 * 5000 + 17, 40 * 10_000]) {
      await page.$eval(scroller, (el, top) => (el.scrollTop = top), top);
      await page.waitForTimeout(100);
      const box = await page.$eval(scroller, (el) => {
        const r = el.getBoundingClientRect();
        const header = el.querySelector("thead tr")!.getBoundingClientRect().height;
        return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: header };
      });
      const [headerBg, cornerSS, cornerSE, cornerES, cornerEE, inside] = await pixels(page, [
        [(box.l + box.r) / 2, box.t + box.h - 2],
        // 3 px into each corner: outside the body's 16 px arc, inside the root's larger rounded box
        [box.l + 3, box.t + box.h + 3],
        [box.r - 4, box.t + box.h + 3],
        [box.l + 3, box.b - 4],
        [box.r - 4, box.b - 4],
        [box.l + 60, box.t + box.h + 30],
      ]);
      // the corners just below the header show the root's surface (= the header cells' colour), not the white rows
      for (const [name, px] of [
        ["top-start", cornerSS],
        ["top-end", cornerSE],
        ["bottom-start", cornerES],
        ["bottom-end", cornerEE],
      ] as const)
        assert.ok(near(px!, headerBg!), `scrollTop ${top}: ${name} corner ${px} ≈ header ${headerBg}`);
      assert.ok(!near(inside!, headerBg!), `scrollTop ${top}: body interior ${inside} differs from the frame ${headerBg}`);
    }
  }));

test("data-grid: pinned cells stay opaque (default / hover / selected) while columns scroll under them", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/data-grid");
    await page.waitForLoadState("networkidle");
    const scroller = ".data-grid__scroll-container:has(#dg-pinned)";
    await page.$eval(scroller, (el) => {
      el.scrollIntoView({ block: "center" });
      el.scrollLeft = 120;
    });
    assert.ok((await page.$eval(scroller, (el) => el.scrollLeft)) > 0, "the pinned grid scrolls sideways");
    await page.hover("#dg-pinned tbody tr[data-key='3'] [data-column=name]");
    const opaque = (c: string) => c !== "transparent" && !/\/\s*0?\.\d|rgba\([^)]*,\s*0?\.\d+\)|rgba\([^)]*,\s*0\)/.test(c);
    for (const key of ["1", "2", "3"]) {
      const bgs = await page.$$eval(`#dg-pinned tbody tr[data-key='${key}'] [data-pinned]`, (els) => els.map((el) => getComputedStyle(el).backgroundColor));
      assert.equal(bgs.length, 2);
      for (const bg of bgs) assert.ok(opaque(bg), `row ${key} pinned background ${bg} is opaque`);
    }
    // the scrolled-under column's text never shows through: the pinned cell's centre paints only the pinned cell's colour
    const cell = await page.$eval("#dg-pinned tbody tr[data-key='3'] [data-column=name]", (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.right - 6, y: r.top + r.height / 2 };
    });
    assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("data-column"), cell), "name");
  }));

test("data-grid: column resizers stay inside the scroll container and on top of the next header", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/data-grid");
    const result = await page.$eval(".data-grid__scroll-container:has(#dg)", (el) => {
      const frame = el.getBoundingClientRect();
      return {
        overflow: el.scrollWidth - el.clientWidth,
        resizers: [...el.querySelectorAll<HTMLElement>("[data-rv-resizer]")].map((r) => {
          const b = r.getBoundingClientRect();
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return {
            id: r.dataset.rvResizer,
            inside: b.left >= frame.left && b.right <= frame.right && b.top >= frame.top && b.bottom <= frame.bottom,
            hit: hit === r,
          };
        }),
      };
    });
    assert.equal(result.overflow, 0, "no horizontal overflow at rest");
    assert.ok(result.resizers.length >= 2);
    for (const r of result.resizers) {
      assert.ok(r.inside, `resizer ${r.id} inside the scroll container`);
      assert.ok(r.hit, `resizer ${r.id} hit-testable (not under the next sticky header)`);
    }
  }));
