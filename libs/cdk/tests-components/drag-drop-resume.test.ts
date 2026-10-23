// Resumability of the Angular CDK drag-drop components (story `/drag-drop`, spec drag-drop.md §5):
// server markup, nothing loaded before the lists scroll into view (`preload = "visible"`), the first
// drag after the visible preload runs synchronously, a cold press is replayed after its chunks load
// (and dropped when it was released meanwhile), handles never scroll on a cold touch; a drop reorders
// the `For` rows by adoption (known gap, `test.fails`). These tests time the viewport trigger and cold presses.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page, Route } from "playwright";
import { among, chunksOf, codeOf, stories, watch, type Stories, type Watch } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

/**
 * Drag-drop handler chunks: the chunks holding the component symbols, from the build manifest (`resume-Drag-…` etc. with
 * `chunks: "component"`, the story route's chunk by default). `DRAG` is the one holding `Drag`'s own handlers.
 */
const dragChunks = () => chunksOf(/#(Drag|DragHandle|DropList|DropListGroup)$/);
const dragScripts = (seen: Watch) => among(seen.scripts, dragChunks());
const dragLoaded = (page: Page, options?: { timeout: number }) =>
  page.waitForFunction(
    (chunks) => performance.getEntriesByType("resource").some((entry) => chunks.includes(new URL(entry.name).pathname)),
    [...chunksOf(/#Drag$/)],
    options,
  );
const text = (page: Page, id: string) => page.evaluate((id) => document.getElementById(id)?.textContent ?? null, id);
const order = (page: Page) => page.evaluate(() => [...document.querySelectorAll("#list > .cdk-drag")].map((el) => el.textContent));
const center = (page: Page, id: string) =>
  page.evaluate((id) => {
    const rect = document.getElementById(id)!.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, id);

/** Holds every script request until `release()` (a slow network for the drag-drop code). */
async function holdScripts(page: Page) {
  const held: Route[] = [];
  let open = false;
  // The drag-drop symbol chunks + the shared code only they import (`drag-…` module chunks with component chunks).
  const code = codeOf(/#(Drag|DragHandle|DropList|DropListGroup|DragDropStory)$/);
  await page.route(/\/assets\/.*\.js$/, (route) => {
    if (open || !code.has(new URL(route.request().url()).pathname.replace(/\.deps\.js$/, ".js"))) return route.continue();
    held.push(route);
  });
  return {
    get count() {
      return held.length;
    },
    release() {
      open = true;
      held.splice(0).forEach((route) => route.continue());
    },
  };
}

test("server markup: structure attributes, handle native-interaction styles, free drag transform, inert templates", async () => {
  const html = await (await fetch(s.origin + "/drag-drop")).text();
  assert.match(html, /id="list" class="cdk-drop-list rv-DropList" data-orientation="vertical" data-rv-drop-list=""/);
  assert.match(html, /id="item-Zero" class="cdk-drag rv-Drag" data-rv-drag=""/);
  // `toggleNativeDragInteractions(handle, false)` byte for byte.
  assert.match(
    html,
    /touch-action:none;-webkit-user-drag:none;-webkit-tap-highlight-color:transparent;user-select:none;-ms-user-select:none;-webkit-user-select:none;-moz-user-select:none" id="handle" class="cdk-drag-handle rv-DragHandle" data-rv-drag-handle=""/,
  );
  // Upstream sets no touch-action on a drag root at rest.
  assert.doesNotMatch(html, /id="item-Zero"[^>]*touch-action/);
  // One style attribute (MATRIX-1: the style group joins the spread object at its source position).
  assert.match(html, /id="free" class="cdk-drag rv-Drag" data-rv-drag="" data-rv-free-position="" style="[^"]*transform:translate3d\(20px, 10px, 0\)"/);
  assert.doesNotMatch(html, /id="free"[^>]* style="[^>]* style="/);
  assert.match(html, /<template data-rv-drag-preview="" data-match-size=""><div id="free-preview">preview<\/div><\/template>/);
  assert.match(html, /<template data-rv-drag-placeholder=""><div id="free-placeholder">placeholder<\/div><\/template>/);
});

test("nothing drag-drop related loads before the lists are visible; scrolling them in preloads it", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/drag-drop");
  await page.waitForTimeout(800);
  assert.deepEqual(dragScripts(seen), []);
  await page.evaluate(() => document.getElementById("list")!.scrollIntoView());
  await dragLoaded(page, { timeout: 5000 });
  assert.ok(among(seen.scripts, chunksOf(/#Drag$/)).length > 0);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("first drag after the visible preload starts synchronously; the drop reports the new index", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/drag-drop");
  await page.evaluate(() => document.getElementById("list")!.scrollIntoView());
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500); // prefetched modules evaluate in an idle slice
  const started = await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>("#list > .cdk-drag")) (el as unknown as { tag: string }).tag = el.textContent!;
    const item = document.getElementById("item-Zero")!;
    const rect = item.getBoundingClientRect();
    const at = { clientX: rect.left + 5, clientY: rect.top + 5, bubbles: true, cancelable: true, button: 0, buttons: 1, detail: 1 };
    item.dispatchEvent(new MouseEvent("mousedown", at));
    document.dispatchEvent(new MouseEvent("mousemove", { ...at, clientY: at.clientY + 20 }));
    const result = { preview: !!document.querySelector(".cdk-drag-preview"), placeholder: !!document.querySelector(".cdk-drag-placeholder") };
    // (Synthetic events report `pageY` without the page scroll, so the sorting part uses the real mouse below.)
    document.dispatchEvent(new MouseEvent("mouseup", { ...at, clientY: at.clientY + 20, buttons: 0 }));
    return result;
  });
  assert.deepEqual(started, { preview: true, placeholder: true });
  await page.waitForFunction(() => document.getElementById("drops")?.textContent === "1", null, { timeout: 2000 });
  const from = await center(page, "item-Zero");
  const to = await center(page, "item-Two");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 20, { steps: 4 });
  await page.mouse.move(to.x, to.y + 5, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() => document.getElementById("drops")?.textContent === "2", null, { timeout: 2000 });
  assert.equal(await text(page, "order"), "One,Two,Zero,Three");
  // Control: a `For` that is no component child re-renders.
  await page.waitForFunction(() => document.getElementById("plain")?.textContent === "OneTwoZeroThree", null, { timeout: 2000 });
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// Known gap (runtime / compiler, not drag-drop): a `For` passed as a component's children (`<DropList>`)
// renders without region markers on the server, so on a resumed page it never re-renders: the rows keep
// their server order after `items.set(...)`. Flips to passing once component children resume as regions.
test("a drop reorders the For rows inside <DropList> by adoption (same elements)", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/drag-drop");
  await page.evaluate(() => document.getElementById("list")!.scrollIntoView());
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>("#list > .cdk-drag")) (el as unknown as { tag: string }).tag = el.textContent!;
  });
  const from = await center(page, "item-Zero");
  const to = await center(page, "item-Two");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 20, { steps: 4 });
  await page.mouse.move(to.x, to.y + 5, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() => document.getElementById("drops")?.textContent === "1", null, { timeout: 2000 });
  await page.waitForFunction(() => document.querySelector("#list > .cdk-drag")?.textContent !== "Zero", null, { timeout: 2000 }).catch(() => {});
  const rows = await order(page);
  const tags = await page.evaluate(() => [...document.querySelectorAll("#list > .cdk-drag")].map((el) => (el as unknown as { tag?: string }).tag));
  await page.close();
  assert.deepEqual(rows, ["One", "Two", "Zero", "Three"]);
  // Same elements, moved: every row still carries the tag set before the drop.
  assert.deepEqual(tags, rows);
});

test("cold press: a mousedown before the code loaded is replayed and the drag continues", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const hold = await holdScripts(page);
  await page.goto(s.origin + "/drag-drop");
  await page.evaluate(() => document.getElementById("list")!.scrollIntoView());
  const from = await center(page, "item-Zero");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 3);
  await page.waitForTimeout(200);
  assert.ok(hold.count > 0, "drag-drop code was still loading");
  hold.release();
  await dragLoaded(page);
  await page.waitForTimeout(800);
  const to = await center(page, "item-Two");
  await page.mouse.move(from.x, from.y + 20, { steps: 4 });
  await page.mouse.move(to.x, to.y + 5, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() => document.getElementById("drops")?.textContent === "1", null, { timeout: 3000 });
  assert.equal(await text(page, "last"), "0>2");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("cold press released before the code loaded: the replayed press starts no drag", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const hold = await holdScripts(page);
  await page.goto(s.origin + "/drag-drop");
  await page.evaluate(() => document.getElementById("list")!.scrollIntoView());
  const from = await center(page, "item-Zero");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(200);
  assert.ok(hold.count > 0, "drag-drop code was still loading");
  hold.release();
  await dragLoaded(page);
  await page.waitForTimeout(300);
  await page.mouse.move(from.x, from.y + 60, { steps: 6 });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => !!document.querySelector(".cdk-drag-preview, .cdk-drag-dragging")), false);
  assert.equal(await text(page, "drops"), "0");
  assert.deepEqual(await order(page), ["Zero", "One", "Two", "Three"]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("touch: a server-rendered handle blocks native panning before any code runs", async () => {
  const context = await s.browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 400, height: 700 } });
  const page = await context.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/drag-drop");
  const style = await page.evaluate(() => {
    const computed = getComputedStyle(document.getElementById("handle")!);
    return { touchAction: computed.touchAction, userSelect: computed.userSelect };
  });
  assert.deepEqual(style, { touchAction: "none", userSelect: "none" });
  assert.deepEqual(dragScripts(seen), []);
  await context.close();
});
