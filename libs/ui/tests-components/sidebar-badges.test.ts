// Sidebar badges next to menu actions — resumed story app (`/sidebar-badges`). User bug 2026-10-09: a count badge and a
// `showOnHover` "more" action were drawn on top of each other (both at the item's end). Now: an always-visible action
// (no `showOnHover`, or any action below 768 px) pushes the badge / chip toward the start; a `showOnHover` action takes
// the badge's place on hover / focus (badge fades out), never both at once; the button's text never runs under either;
// collapsed to icons both are hidden. LTR + RTL static panels, badge + MenuAction, chip + MenuActions, sm / lg sizes.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { BrowserContext, Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page, seen: ReturnType<typeof watch>) => Promise<void>, viewport = { width: 1280, height: 720 }): Promise<void> {
  const context: BrowserContext = await s.browser.newContext({ viewport });
  const page = await context.newPage();
  const seen = watch(page);
  try {
    await page.goto(s.origin + "/sidebar-badges");
    await page.waitForLoadState("networkidle");
    await body(page, seen);
  } finally {
    await context.close();
  }
}

const ITEMS = ["hover", "always", "chip", "chip-always", "sm", "lg"];
const HOVER_ITEMS = ["hover", "chip", "sm", "lg"];

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
interface Layout {
  badge: Box | null;
  action: Box | null;
  /** End edge of the button's content box (padding excluded), in the reading direction. */
  textEnd: number;
  rtl: boolean;
}

/** Visible (displayed, opacity > 0.05) badge / chip and action / actions boxes of `#<id>`, after transitions settle. */
async function layout(page: Page, id: string): Promise<Layout> {
  await page.waitForFunction((id) => document.getElementById(id)!.getAnimations({ subtree: true }).length === 0, id);
  return page.evaluate((id) => {
    const li = document.getElementById(id)!;
    const vis = (el: Element | null) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || Number(cs.opacity) < 0.05) return null;
      const b = el.getBoundingClientRect();
      return b.width && b.height ? { left: b.left, right: b.right, top: b.top, bottom: b.bottom } : null;
    };
    const button = li.querySelector(":scope > .sidebar__menu-button")!;
    const b = button.getBoundingClientRect();
    const cs = getComputedStyle(button);
    const rtl = cs.direction === "rtl";
    return {
      badge: vis(li.querySelector(":scope > :is(.sidebar__menu-badge, .sidebar__menu-chip)")),
      action: vis(li.querySelector(":scope > :is(.sidebar__menu-action, .sidebar__menu-actions)")),
      textEnd: rtl ? b.left + parseFloat(cs.paddingInlineEnd) : b.right - parseFloat(cs.paddingInlineEnd),
      rtl,
    };
  }, id);
}

const overlaps = (a: Box, b: Box) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

/** No visible badge over a visible action; the text box ends before both. */
function assertClear(l: Layout, label: string): void {
  if (l.badge && l.action) assert.ok(!overlaps(l.badge, l.action), `${label}: badge overlaps the action`);
  for (const [name, box] of [
    ["badge", l.badge],
    ["action", l.action],
  ] as const) {
    if (!box) continue;
    if (l.rtl) assert.ok(l.textEnd >= box.right - 0.5, `${label}: text runs under the ${name} (rtl)`);
    else assert.ok(l.textEnd <= box.left + 0.5, `${label}: text runs under the ${name}`);
  }
}

for (const prefix of ["bd", "bd-rtl"]) {
  test(`sidebar badges (${prefix}): desktop rest + hover / focus swap, never both on top of each other`, () =>
    onPage(async (page, seen) => {
      for (const item of ITEMS) {
        const id = `${prefix}-${item}`;
        const l = await layout(page, id);
        assert.ok(l.badge, `${id}: badge visible at rest`);
        if (HOVER_ITEMS.includes(item)) assert.equal(l.action, null, `${id}: showOnHover action hidden at rest`);
        else assert.ok(l.action, `${id}: action visible`);
        assertClear(l, `${id} rest`);
      }
      for (const item of HOVER_ITEMS) {
        const id = `${prefix}-${item}`;
        await page.hover(`#${id} > .sidebar__menu-button`);
        const l = await layout(page, id);
        assert.ok(l.action, `${id}: action shown on hover`);
        assert.equal(l.badge, null, `${id}: badge hidden while the action shows`);
        assertClear(l, `${id} hover`);
      }
      await page.mouse.move(1200, 700);
      const id = `${prefix}-hover`;
      await page.focus(`#${id} > .sidebar__menu-button`);
      const focusedLayout = await layout(page, id);
      assert.ok(focusedLayout.action, `${id}: action shown on focus`);
      assert.equal(focusedLayout.badge, null, `${id}: badge hidden on focus`);
      assert.deepEqual(seen.errors, []);
    }));

  test(`sidebar badges (${prefix}): < 768 px every action shows, the badge sits before it`, () =>
    onPage(
      async (page, seen) => {
        for (const item of ITEMS) {
          const id = `${prefix}-${item}`;
          const l = await layout(page, id);
          assert.ok(l.badge && l.action, `${id}: badge + action visible`);
          if (l.rtl) assert.ok(l.badge.left >= l.action.right, `${id}: badge after the action's left edge (rtl)`);
          else assert.ok(l.badge.right <= l.action.left, `${id}: badge before the action`);
          assertClear(l, `${id} narrow`);
        }
        assert.deepEqual(seen.errors, []);
      },
      { width: 600, height: 720 },
    ));
}

test("sidebar badges: collapsed to icons hides the badge and the action (hover too), 36 px row", () =>
  onPage(async (page, seen) => {
    assert.equal(await page.getAttribute('[data-slot="sidebar"]', "data-state"), "collapsed");
    await page.hover("#bd-icon-item > .sidebar__menu-button");
    const r = await page.$eval("#bd-icon-item", (li) => {
      const d = (sel: string) => getComputedStyle(li.querySelector(sel)!).display;
      const b = li.querySelector(".sidebar__menu-button")!.getBoundingClientRect();
      return { badge: d(".sidebar__menu-badge"), action: d(".sidebar__menu-action"), w: b.width, h: b.height };
    });
    assert.deepEqual(r, { badge: "none", action: "none", w: 36, h: 36 });
    assert.deepEqual(seen.errors, []);
  }));
