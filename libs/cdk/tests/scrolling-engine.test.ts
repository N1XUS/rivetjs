// Ported from Angular Components src/cdk/scrolling/{virtual-scroll-viewport,scrollable,
// scroll-dispatcher,viewport-ruler}.spec.ts and src/cdk-experimental/scrolling/
// virtual-scroll-viewport.spec.ts (MIT, © Google LLC): the engines in real Chromium layout, mounted
// in plain DOM (fixtures/scrolling-mount.ts) — no Angular TestBed / zone.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright";
import { bundle } from "./bundle.ts";

let browser: Browser, page: Page;
const source = bundle(`export * from "./fixtures/scrolling-mount.ts";`);
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 800, height: 600 } });
});
afterAll(() => browser?.close());

/** Fresh blank page with the bundle; run `fn` in it. */
async function run<T, A = undefined>(fn: (arg: A) => T | Promise<T>, arg?: A): Promise<T> {
  await page.setContent("<!doctype html><html><head></head><body style='margin:0'></body></html>");
  await page.addScriptTag({ content: await source });
  return page.evaluate(fn as never, arg as never) as Promise<T>;
}
declare const cdk: typeof import("./fixtures/scrolling-mount.ts");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- CdkVirtualScrollViewport with FixedSizeVirtualScrollStrategy ----

test("fixed: initial render, data length, viewport size, rendered range, content size", async () => {
  const r = await run(async () => {
    const t = cdk.mount();
    await t.init();
    const vp = t.viewport();
    return {
      children: t.wrapper.querySelectorAll(".item").length,
      length: vp.getDataLength(),
      size: vp.getViewportSize(),
      range: vp.getRenderedRange(),
      contentSize: vp.measureRenderedContentSize(),
      rangeSize: vp.measureRangeSize({ start: 1, end: 3 }),
    };
  });
  assert.equal(r.children, 4, "should render 4 50px items to fill 200px space");
  assert.equal(r.length, 10);
  assert.equal(r.size, 200);
  assert.deepEqual(r.range, { start: 0, end: 4 });
  assert.equal(r.contentSize, 200);
  assert.equal(r.rangeSize, 100, "combined size of 2 50px items");
});

test("fixed: should update viewport size (checkViewportSize) and on window resize", async () => {
  const r = await run(async () => {
    const t = cdk.mount();
    await t.init();
    const vp = t.viewport();
    t.el.style.height = "300px";
    vp.checkViewportSize();
    const a = vp.getViewportSize();
    t.el.style.height = "500px";
    vp.checkViewportSize();
    const b = vp.getViewportSize();
    let called = 0;
    const original = vp.checkViewportSize.bind(vp);
    vp.checkViewportSize = () => (called++, original());
    window.dispatchEvent(new Event("resize"));
    await new Promise((res) => setTimeout(res, 40));
    return { a, b, called };
  });
  assert.equal(r.a, 300);
  assert.equal(r.b, 500);
  assert.ok(r.called > 0, "resize listener (debounced) calls checkViewportSize");
});

test("fixed: should contract the rendered range when changing to less data", async () => {
  const r = await run(async () => {
    const t = cdk.mount();
    await t.init();
    const vp = t.viewport();
    const before = vp.getRenderedRange();
    t.items.set([0, 1]);
    await new Promise((res) => setTimeout(res, 0));
    const two = vp.getRenderedRange();
    t.items.set([]);
    await new Promise((res) => setTimeout(res, 0));
    return { before, two, none: vp.getRenderedRange() };
  });
  assert.deepEqual(r.before, { start: 0, end: 4 });
  assert.deepEqual(r.two, { start: 0, end: 2 });
  assert.deepEqual(r.none, { start: 0, end: 0 });
});

test("fixed: rendered content offset and scroll offset after scrolling", async () => {
  const r = await run(async () => {
    const t = cdk.mount();
    await t.init();
    await t.scroll(55);
    const vp = t.viewport();
    return { offset: vp.getOffsetToRenderedContentStart(), scroll: vp.measureScrollOffset() };
  });
  assert.equal(r.offset, 50, "50px offset since first 50px item is not rendered");
  assert.equal(r.scroll, 55);
});

test("fixed: should measure range size when items has a margin", async () => {
  const size = await run(async () => {
    const t = cdk.mount({ hasMargin: true });
    await t.init();
    return t.viewport().measureRangeSize({ start: 1, end: 3 });
  });
  assert.equal(size, 110, "2 50px items with a 10px margin");
});

test("fixed: total content size (vertical, horizontal), orientation classes", async () => {
  const r = await run(async () => {
    const v = cdk.mount();
    await v.init();
    v.viewport().setTotalContentSize(10000);
    await new Promise((res) => setTimeout(res, 0));
    const h = cdk.mount({ orientation: "horizontal" });
    await h.init();
    h.viewport().setTotalContentSize(10000);
    await new Promise((res) => setTimeout(res, 0));
    return {
      height: v.el.scrollHeight,
      width: h.el.scrollWidth,
      vClass: v.el.classList.contains("cdk-virtual-scroll-orientation-vertical"),
      hClass: h.el.classList.contains("cdk-virtual-scroll-orientation-horizontal"),
    };
  });
  assert.equal(r.height, 10000);
  assert.equal(r.width, 10000);
  assert.ok(r.vClass && r.hClass);
});

test("fixed: setRenderedRange renders exactly that range", async () => {
  const texts = await run(async () => {
    const t = cdk.mount();
    await t.init();
    t.viewport().setRenderedRange({ start: 2, end: 3 });
    await new Promise((res) => setTimeout(res, 0));
    return [...t.wrapper.querySelectorAll(".item")].map((el) => el.textContent!.trim());
  });
  assert.deepEqual(texts, ["2 - 2"]);
});

test("fixed: content offset to-start and to-end (rewritten after render)", async () => {
  const r = await run(async () => {
    const t = cdk.mount();
    await t.init();
    const vp = t.viewport();
    vp.setRenderedContentOffset(10, "to-start");
    await new Promise((res) => setTimeout(res, 0));
    const start = vp.getOffsetToRenderedContentStart();
    const contentSize = vp.measureRenderedContentSize();
    vp.setRenderedContentOffset(contentSize + 10, "to-end");
    const pending = vp.getOffsetToRenderedContentStart();
    await new Promise((res) => requestAnimationFrame(res));
    await new Promise((res) => setTimeout(res, 0));
    return { start, contentSize, pending, end: vp.getOffsetToRenderedContentStart() };
  });
  assert.equal(r.start, 10);
  assert.ok(r.contentSize > 0);
  assert.equal(r.pending, null, "to-end offset is not a start offset until rewritten");
  assert.equal(r.end, 10);
});

test("Rivet: callbacks handed over after an API scroll get the scrolled index they missed", async () => {
  const r = await run(async () => {
    const t = cdk.mount();
    await t.initBare();
    await t.scroll(100);
    await new Promise((res) => setTimeout(res, 0));
    const before = t.scrolledToIndex;
    t.attachCallbacks();
    const after = t.scrolledToIndex;
    t.attachCallbacks();
    return [before, after];
  });
  assert.deepEqual(r, [0, 2]);
});

for (const orientation of ["vertical", "horizontal"] as const) {
  test(`fixed: scrollToOffset / scrollToIndex (${orientation})`, async () => {
    const r = await run(
      async (orientation) => {
        const t = cdk.mount({ orientation });
        await t.init();
        const vp = t.viewport();
        vp.scrollToOffset(100);
        await t.scroll();
        await new Promise((res) => setTimeout(res, 100));
        const a = { offset: vp.measureScrollOffset(), range: vp.getRenderedRange() };
        await t.scroll(0);
        vp.scrollToIndex(2);
        await t.scroll();
        return { a, b: { offset: vp.measureScrollOffset(), range: vp.getRenderedRange() } };
      },
      orientation,
    );
    assert.deepEqual(r.a, { offset: 100, range: { start: 2, end: 6 } });
    assert.deepEqual(r.b, { offset: 100, range: { start: 2, end: 6 } });
  });
}

test("fixed: should output scrolled index", async () => {
  const r = await run(async () => {
    const t = cdk.mount();
    await t.init();
    await t.scroll(99);
    await new Promise((res) => setTimeout(res, 0));
    const a = t.scrolledToIndex;
    await t.scroll(100);
    await new Promise((res) => setTimeout(res, 0));
    return [a, t.scrolledToIndex];
  });
  assert.deepEqual(r, [1, 2]);
});

for (const orientation of ["vertical", "horizontal"] as const)
  for (const direction of ["forward", "backward"] as const)
    test(`fixed: should update viewport as user scrolls ${direction} (${orientation})`, async () => {
      const failures = await run(
        async ({ orientation, direction }) => {
          const t = cdk.mount({ orientation });
          await t.init();
          const vp = t.viewport();
          const bad: string[] = [];
          const max = 50 * 10 - 200;
          const offsets: number[] = [];
          if (direction === "forward") for (let o = 1; o <= max; o += 10) offsets.push(o);
          else for (let o = max - 1; o >= 0; o -= 10) offsets.push(o);
          for (const offset of offsets) {
            await t.scroll(offset);
            const expected = { start: Math.floor(offset / 50), end: Math.ceil((offset + 200) / 50) };
            const range = vp.getRenderedRange();
            if (range.start !== expected.start || range.end !== expected.end) bad.push(`range at ${offset}: ${JSON.stringify(range)}`);
            if (vp.getOffsetToRenderedContentStart() !== expected.start * 50) bad.push(`offset at ${offset}`);
            if (vp.measureRenderedContentSize() !== (expected.end - expected.start) * 50) bad.push(`size at ${offset}`);
          }
          return bad;
        },
        { orientation, direction },
      );
      assert.deepEqual(failures, []);
    });

test("fixed: buffer elements at the end (top), both ends (middle), start (bottom)", async () => {
  const r = await run(async () => {
    const top = cdk.mount({ minBufferPx: 50, maxBufferPx: 50 });
    await top.init();
    const a = top.viewport().getRenderedRange();
    top.destroy();
    const mid = cdk.mount({ minBufferPx: 50, maxBufferPx: 50 });
    await mid.init();
    await mid.scroll(100);
    await new Promise((res) => setTimeout(res, 100));
    const b = mid.viewport().getRenderedRange();
    mid.destroy();
    const bottom = cdk.mount({ minBufferPx: 50, maxBufferPx: 50 });
    await bottom.init();
    await bottom.scroll(300);
    await new Promise((res) => setTimeout(res, 100));
    return { a, b, c: bottom.viewport().getRenderedRange() };
  });
  assert.deepEqual(r.a, { start: 0, end: 5 });
  assert.deepEqual(r.b, { start: 1, end: 7 });
  assert.deepEqual(r.c, { start: 5, end: 10 });
});

test("fixed: dynamic item size and buffer size (updateItemAndBufferSize)", async () => {
  const r = await run(async () => {
    const t = cdk.mount();
    await t.init();
    await t.scroll(100);
    const vp = t.viewport();
    const a = vp.getRenderedRange();
    (vp.scrollStrategy as InstanceType<typeof cdk.FixedSizeVirtualScrollStrategy>).updateItemAndBufferSize(100, 0, 0);
    await new Promise((res) => setTimeout(res, 100));
    const b = vp.getRenderedRange();
    const u = cdk.mount();
    await u.init();
    await u.scroll(100);
    (u.viewport().scrollStrategy as InstanceType<typeof cdk.FixedSizeVirtualScrollStrategy>).updateItemAndBufferSize(50, 50, 50);
    await new Promise((res) => setTimeout(res, 0));
    return { a, b, c: u.viewport().getRenderedRange() };
  });
  assert.deepEqual(r.a, { start: 2, end: 6 });
  assert.deepEqual(r.b, { start: 1, end: 3 }, "2 100px items fill 200px");
  assert.deepEqual(r.c, { start: 1, end: 7 }, "1 buffer element on each side");
});

test("fixed: dynamic item array (shrink to bottom, dynamic buffer, keep position)", async () => {
  const r = await run(async () => {
    const t = cdk.mount();
    await t.init();
    await t.scroll(300);
    const vp = t.viewport();
    const a = vp.getOffsetToRenderedContentStart();
    t.items.set(Array(5).fill(0));
    await new Promise((res) => setTimeout(res, 0));
    const b = vp.getOffsetToRenderedContentStart();
    const u = cdk.mount();
    await u.init();
    await u.scroll(300);
    u.items.set(Array(5).fill(0));
    (u.viewport().scrollStrategy as InstanceType<typeof cdk.FixedSizeVirtualScrollStrategy>).updateItemAndBufferSize(50, 50, 50);
    await new Promise((res) => setTimeout(res, 0));
    const c = u.viewport().getOffsetToRenderedContentStart();
    const k = cdk.mount({ items: Array(100).fill(0) });
    await k.init();
    await k.scroll(2500);
    const d = k.viewport().getOffsetToRenderedContentStart();
    k.items.set(Array(54).fill(0));
    await new Promise((res) => setTimeout(res, 0));
    return { a, b, c, d, e: k.viewport().getOffsetToRenderedContentStart() };
  });
  assert.equal(r.a, 300, "scrolled to bottom of 10 item list");
  assert.equal(r.b, 50, "scrolled to bottom of 5 item list");
  assert.equal(r.c, 0, "render from first item");
  assert.equal(r.d, 2500);
  assert.equal(r.e, 2500, "kept the scroll position");
});

test("fixed: works with a Set-derived array and signal data", async () => {
  const r = await run(async () => {
    const t = cdk.mount({ items: [...new Set(["hello", "world", "how", "are", "you"])] });
    await t.init();
    const a = t.viewport().getRenderedRange();
    const e = cdk.mount({ items: [] });
    await e.init();
    const b = e.viewport().getRenderedRange();
    e.items.set([1, 2, 3]);
    await new Promise((res) => setTimeout(res, 0));
    return { a, b, c: e.viewport().getRenderedRange() };
  });
  assert.deepEqual(r.a, { start: 0, end: 4 });
  assert.deepEqual(r.b, { start: 0, end: 0 });
  assert.deepEqual(r.c, { start: 0, end: 3 });
});

test("fixed: render up to maxBufferPx when buffer dips below minBufferPx", async () => {
  const r = await run(async () => {
    const t = cdk.mount({ minBufferPx: 50, maxBufferPx: 100 });
    await t.init();
    const vp = t.viewport();
    const a = vp.getRenderedRange();
    await t.scroll(50);
    const b = vp.getRenderedRange();
    await t.scroll(51);
    return { a, b, c: vp.getRenderedRange() };
  });
  assert.deepEqual(r.a, { start: 0, end: 6 });
  assert.deepEqual(r.b, { start: 0, end: 6 }, "no additional buffer yet");
  assert.deepEqual(r.c, { start: 0, end: 8 }, "2 more buffer items");
});

test("fixed: throws if maxBufferPx < minBufferPx", async () => {
  const message = await run(() => {
    try {
      cdk.mount({ minBufferPx: 100, maxBufferPx: 99 });
      return "";
    } catch (e) {
      return (e as Error).message;
    }
  });
  assert.equal(message, "CDK virtual scroll: maxBufferPx must be greater than or equal to minBufferPx");
});

test("fixed: registers with / deregisters from ScrollDispatcher", async () => {
  const r = await run(async () => {
    const t = cdk.mount();
    await t.init();
    const dispatcher = cdk.scrollDispatcher();
    const scrollable = t.viewport().scrollable;
    const registered = dispatcher.scrollContainers.has(scrollable);
    t.destroy();
    return { registered, after: dispatcher.scrollContainers.has(scrollable) };
  });
  assert.deepEqual(r, { registered: true, after: false });
});

test("fixed: trackBy value by default vs index (row reuse), many scrollToIndex calls don't throw", async () => {
  const r = await run(async () => {
    const byValue = cdk.mount({ items: [] });
    await byValue.init();
    byValue.items.set([0]);
    await new Promise((res) => setTimeout(res, 0));
    const first = byValue.wrapper.querySelector(".item");
    byValue.items.set([1]);
    await new Promise((res) => setTimeout(res, 0));
    const valueReplaced = byValue.wrapper.querySelector(".item") !== first;
    const byIndex = cdk.mount({ items: [], trackByIndex: true });
    await byIndex.init();
    byIndex.items.set([0]);
    await new Promise((res) => setTimeout(res, 0));
    const f2 = byIndex.wrapper.querySelector(".item");
    byIndex.items.set([1]);
    await new Promise((res) => setTimeout(res, 0));
    const indexKept = byIndex.wrapper.querySelector(".item") === f2;
    const many = cdk.mount({ items: Array(200).fill(0), trackByIndex: true });
    await many.init();
    for (let i = 0; i < 50; i++) {
      many.viewport().scrollToIndex(i);
      await many.scroll();
    }
    return { valueReplaced, indexKept, created: many.created() };
  });
  assert.ok(r.valueReplaced, "trackBy value: a new value is a new row");
  assert.ok(r.indexKept, "trackBy index: the row is kept");
  assert.ok(r.created > 0);
});

// ---- RTL ----

test("rtl horizontal: initially at the right showing item 0; scrolls left; offsets from the right; index", async () => {
  const r = await run(async () => {
    const t = cdk.mount({ orientation: "horizontal", dir: "rtl" });
    await t.init();
    const vp = t.viewport();
    const a = { right: vp.measureScrollOffset("right"), transform: t.wrapper.style.transform, first: t.wrapper.querySelector(".item")!.textContent!.trim() };
    await t.scroll(500);
    await new Promise((res) => setTimeout(res, 100));
    const b = { transform: t.wrapper.style.transform, first: t.wrapper.querySelector(".item")!.textContent!.trim() };
    const u = cdk.mount({ orientation: "horizontal", dir: "rtl" });
    await u.init();
    u.viewport().scrollToOffset(100);
    await u.scroll();
    const c = u.viewport().measureScrollOffset("right");
    const w = cdk.mount({ orientation: "horizontal", dir: "rtl" });
    await w.init();
    w.viewport().scrollToIndex(2);
    await w.scroll();
    await new Promise((res) => setTimeout(res, 100));
    return { a, b, c, d: w.wrapper.querySelector(".item")!.textContent!.trim(), index: w.scrolledToIndex };
  });
  assert.equal(r.a.right, 0);
  assert.match(r.a.transform, /translateX\(0(px)?\)/);
  assert.equal(r.a.first, "0 - 0");
  assert.equal(r.b.transform, "translateX(-300px)");
  assert.equal(r.b.first, "6 - 6");
  assert.equal(r.c, 100);
  assert.equal(r.d, "2 - 2");
  assert.equal(r.index, 2);
});

test("rtl: total content size (vertical, horizontal)", async () => {
  const r = await run(async () => {
    const v = cdk.mount({ dir: "rtl" });
    await v.init();
    v.viewport().setTotalContentSize(10000);
    const h = cdk.mount({ dir: "rtl", orientation: "horizontal" });
    await h.init();
    h.viewport().setTotalContentSize(10000);
    await new Promise((res) => setTimeout(res, 0));
    return [v.el.scrollHeight, h.el.scrollWidth];
  });
  assert.deepEqual(r, [10000, 10000]);
});

// ---- append only ----

test("appendOnly: keeps rendered items, offset always 0, no transform while scrolling", async () => {
  const r = await run(async () => {
    const t = cdk.mount({ items: Array.from({ length: 1000 }, (_, i) => i), appendOnly: true });
    await t.init();
    const vp = t.viewport();
    vp.setRenderedRange({ start: 100, end: 200 });
    await new Promise((res) => setTimeout(res, 0));
    vp.setRenderedRange({ start: 10, end: 50 });
    await new Promise((res) => setTimeout(res, 0));
    const range = vp.getRenderedRange();
    const u = cdk.mount({ items: Array.from({ length: 1000 }, (_, i) => i), appendOnly: true });
    await u.init();
    await u.scroll(55);
    const offset = u.viewport().getOffsetToRenderedContentStart();
    const size = u.viewport().measureRenderedContentSize();
    u.viewport().setRenderedContentOffset(size + 10, "to-end");
    await new Promise((res) => requestAnimationFrame(res));
    await new Promise((res) => setTimeout(res, 0));
    const toEnd = u.viewport().getOffsetToRenderedContentStart();
    u.viewport().setRenderedContentOffset(10, "to-start");
    await new Promise((res) => setTimeout(res, 0));
    const toStart = u.viewport().getOffsetToRenderedContentStart();
    const w = cdk.mount({ items: Array.from({ length: 1000 }, (_, i) => i), appendOnly: true });
    await w.init();
    await w.scroll(0);
    const t0 = w.wrapper.style.transform;
    await w.scroll(500);
    return { range, offset, size, toEnd, toStart, t0, t1: w.wrapper.style.transform };
  });
  assert.deepEqual(r.range, { start: 0, end: 200 });
  assert.equal(r.offset, 0);
  assert.ok(r.size > 0);
  assert.equal(r.toEnd, 0);
  assert.equal(r.toStart, 0);
  assert.equal(r.t0, "translateY(0px)");
  assert.equal(r.t1, "translateY(0px)");
});

// ---- custom scrolling element / window ----

test("custom scrolling element: viewport offset and scroll offset", async () => {
  const r = await run(async () => {
    const t = cdk.mount({ scrollable: "element", items: Array.from({ length: 100 }, (_, i) => i) });
    await t.init();
    const vp = t.viewport();
    const viewportOffset = vp.measureViewportOffset("top");
    await t.scroll(100);
    return { viewportOffset, scroll: vp.measureScrollOffset("top"), isElement: vp.scrollable !== (vp as unknown) };
  });
  assert.equal(r.viewportOffset, 50, "scrolling-element padding-top: 50");
  assert.equal(r.scroll, 50, "actual scroll offset - viewport offset");
  assert.ok(r.isElement);
});

test("scrollable window: measures scroll offset against the document", async () => {
  const scroll = await run(async () => {
    document.body.insertAdjacentHTML("afterbegin", '<div style="height:50px"></div>');
    const t = cdk.mount({ scrollable: "window", items: Array.from({ length: 1000 }, (_, i) => i) });
    await t.init();
    const vp = t.viewport();
    vp.scrollToOffset(100);
    document.dispatchEvent(new Event("scroll"));
    await new Promise((res) => setTimeout(res, 50));
    return vp.measureScrollOffset("top");
  });
  assert.equal(scroll, 50, "actual scroll offset - viewport offset");
});

// ---- AutoSizeVirtualScrollStrategy (cdk-experimental) ----

test("autosize: initial state for uniform items, extra content if first item is smaller than average, buffer check", async () => {
  const r = await run(async () => {
    const uniform = cdk.mount({ autosize: true, sizes: Array(10).fill(50) });
    await uniform.init();
    await new Promise((res) => setTimeout(res, 50));
    const a = { children: uniform.wrapper.querySelectorAll(".item").length, range: uniform.viewport().getRenderedRange() };
    uniform.destroy();
    const varied = cdk.mount({ autosize: true, items: [50, 200, 200, 200, 200, 200], sizes: [50, 200, 200, 200, 200, 200] });
    await varied.init();
    await new Promise((res) => setTimeout(res, 50));
    const b = varied.wrapper.querySelectorAll(".item").length;
    let error = "";
    try {
      cdk.mount({ autosize: true, minBufferPx: 100, maxBufferPx: 99 });
    } catch (e) {
      error = (e as Error).message;
    }
    return { a, b, error };
  });
  assert.equal(r.a.children, 4, "4 50px items fill 200px");
  assert.deepEqual(r.a.range, { start: 0, end: 4 });
  assert.equal(r.b, 4, "4 items fill 200px based on the 50px estimate from the first item");
  assert.equal(r.error, "CDK virtual scroll: maxBufferPx must be greater than or equal to minBufferPx");
});

// ---- CdkScrollable (scrollable.spec.ts) ----

for (const dir of ["ltr", "rtl"] as const)
  test(`CdkScrollable (${dir}): initial position, scrollTo top/bottom/left/right/start/end, measureScrollOffset`, async () => {
    const r = await run((dir) => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<div id="s" dir="${dir}" style="width:100px;height:100px;overflow:auto"><div style="width:300px;height:300px"></div></div>`,
      );
      const el = document.getElementById("s")!;
      const scrollable = new cdk.CdkScrollable(el).init();
      const m = () => ["top", "bottom", "left", "right", "start", "end"].map((edge) => scrollable.measureScrollOffset(edge as never));
      const out: Record<string, number[]> = { initial: m() };
      scrollable.scrollTo({ top: 0, left: 0 });
      out.topLeft = m();
      scrollable.scrollTo({ bottom: 0, right: 0 });
      out.bottomRight = m();
      scrollable.scrollTo({ top: 0, end: 0 });
      out.topEnd = m();
      scrollable.scrollTo({ bottom: 0, start: 0 });
      out.bottomStart = m();
      for (const key in out) out[key] = out[key]!.map((n) => n + 0); // -0 → 0 (Jasmine toBe(0) semantics)
      return out;
    }, dir);
    // [top, bottom, left, right, start, end]; max scroll = 200.
    if (dir === "ltr") {
      assert.deepEqual(r.initial, [0, 200, 0, 200, 0, 200], "scrolled to top-left");
      assert.deepEqual(r.topLeft, [0, 200, 0, 200, 0, 200]);
      assert.deepEqual(r.bottomRight, [200, 0, 200, 0, 200, 0]);
      assert.deepEqual(r.topEnd, [0, 200, 200, 0, 200, 0]);
      assert.deepEqual(r.bottomStart, [200, 0, 0, 200, 0, 200]);
    } else {
      assert.deepEqual(r.initial, [0, 200, 200, 0, 0, 200], "scrolled to top-right");
      assert.deepEqual(r.topLeft, [0, 200, 0, 200, 200, 0]);
      assert.deepEqual(r.bottomRight, [200, 0, 200, 0, 0, 200]);
      assert.deepEqual(r.topEnd, [0, 200, 0, 200, 200, 0]);
      assert.deepEqual(r.bottomStart, [200, 0, 200, 0, 0, 200]);
    }
  });

// ---- ScrollDispatcher (scroll-dispatcher.spec.ts) ----

test("ScrollDispatcher: register / deregister, notify via scrollable and service (throttled), unsubscribe, complete", async () => {
  const r = await run(async () => {
    document.body.insertAdjacentHTML("beforeend", '<div id="s" style="height:100px;overflow:auto"><div style="height:9999px"></div></div>');
    const dispatcher = new cdk.ScrollDispatcher(document);
    const scrollable = new cdk.CdkScrollable(document.getElementById("s")!, { dispatcher }).init();
    const registered = dispatcher.scrollContainers.has(scrollable);
    let directive = 0,
      service = 0;
    scrollable.elementScrolled().subscribe(() => directive++);
    dispatcher.scrolled(100).subscribe(() => service++);
    document.getElementById("s")!.dispatchEvent(new Event("scroll"));
    const immediate = { directive, service };
    await new Promise((res) => setTimeout(res, 110));
    const throttled = service;
    // unsubscribe from the global scrollable
    let global = 0;
    const sub = dispatcher.scrolled(0).subscribe(() => global++);
    document.dispatchEvent(new Event("scroll"));
    sub.unsubscribe();
    document.dispatchEvent(new Event("scroll"));
    // same scrollable twice
    let twice = 0;
    const s2 = dispatcher.scrolled(0).subscribe(() => twice++);
    dispatcher.register(scrollable);
    dispatcher.deregister(scrollable);
    document.getElementById("s")!.dispatchEvent(new Event("scroll"));
    s2.unsubscribe();
    // completion
    let completed = false,
      scrollableCompleted = false;
    dispatcher.scrolled(0).subscribe({ complete: () => (completed = true) });
    const other = new cdk.CdkScrollable(document.getElementById("s")!, { dispatcher }).init();
    other.elementScrolled().subscribe({ complete: () => (scrollableCompleted = true) });
    other.destroy();
    const afterDestroy = dispatcher.scrollContainers.has(other);
    dispatcher.destroy();
    return { registered, immediate, throttled, global, twice, completed, scrollableCompleted, afterDestroy };
  });
  assert.ok(r.registered);
  assert.deepEqual(r.immediate, { directive: 1, service: 0 }, "service waits for the throttle");
  assert.equal(r.throttled, 1);
  assert.equal(r.global, 1);
  assert.equal(r.twice, 0, "deregistered scrollable no longer notifies");
  assert.ok(r.completed);
  assert.ok(r.scrollableCompleted);
  assert.equal(r.afterDestroy, false);
});

test("ScrollDispatcher: nested scrollables, ancestorScrolled, lazy global listener", async () => {
  const r = await run(() => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="scrollable-1"><div id="scrollable-1a"><div id="interesting"></div></div><div id="scrollable-1b"></div></div><div id="scrollable-2"></div>`,
    );
    const dispatcher = new cdk.ScrollDispatcher(document);
    for (const id of ["scrollable-1", "scrollable-1a", "scrollable-1b", "scrollable-2"]) new cdk.CdkScrollable(document.getElementById(id)!, { dispatcher }).init();
    const el = document.getElementById("interesting")!;
    const ids = dispatcher.getAncestorScrollContainers(el).map((s) => s.getElementRef().nativeElement.id);
    const viaRef = dispatcher.getAncestorScrollContainers({ nativeElement: el }).map((s) => s.getElementRef().nativeElement.id);
    let count = 0;
    const sub = dispatcher.ancestorScrolled(el, 0).subscribe(() => count++);
    document.getElementById("scrollable-1")!.dispatchEvent(new Event("scroll"));
    const one = count;
    document.dispatchEvent(new Event("scroll"));
    const two = count;
    document.getElementById("scrollable-2")!.dispatchEvent(new Event("scroll"));
    const stranger = count;
    sub.unsubscribe();
    const lazy: boolean[] = [dispatcher._hasGlobalListener];
    const s = dispatcher.scrolled(0).subscribe(() => {});
    lazy.push(dispatcher._hasGlobalListener);
    s.unsubscribe();
    lazy.push(dispatcher._hasGlobalListener, dispatcher.scrollContainers.size === 4);
    dispatcher.scrolled(0).subscribe(() => {});
    dispatcher.destroy();
    lazy.push(dispatcher._hasGlobalListener);
    return { ids, viaRef, one, two, stranger, lazy };
  });
  assert.deepEqual(r.ids, ["scrollable-1", "scrollable-1a"]);
  assert.deepEqual(r.viaRef, ["scrollable-1", "scrollable-1a"]);
  assert.equal(r.one, 1);
  assert.equal(r.two, 2, "document scroll counts");
  assert.equal(r.stranger, 2, "non-ancestor scroll ignored");
  assert.deepEqual(r.lazy, [false, true, false, true, false]);
});

// ---- ViewportRuler (viewport-ruler.spec.ts) ----

test("ViewportRuler: size, bounds unscrolled / scrolled, scroll position, change events + throttle", async () => {
  const r = await run(async () => {
    const ruler = new cdk.ViewportRuler(document);
    const size = ruler.getViewportSize();
    const bounds0 = ruler.getViewportRect();
    const pos0 = ruler.getViewportScrollPosition();
    document.body.insertAdjacentHTML("beforeend", '<div id="big" style="width:6000px;height:6000px"></div>');
    scrollTo(1500, 2000);
    const bounds1 = ruler.getViewportRect();
    const pos1 = ruler.getViewportScrollPosition();
    document.getElementById("big")!.remove();
    scrollTo(0, 0);
    let resize = 0,
      orientation = 0,
      throttled = 0;
    const a = ruler.change(0).subscribe(() => resize++);
    window.dispatchEvent(new Event("resize"));
    a.unsubscribe();
    const b = ruler.change(0).subscribe(() => orientation++);
    window.dispatchEvent(new Event("orientationchange"));
    b.unsubscribe();
    const c = ruler.change(10).subscribe(() => throttled++);
    window.dispatchEvent(new Event("resize"));
    const before = throttled;
    await new Promise((res) => setTimeout(res, 20));
    c.unsubscribe();
    return { size, inner: { width: innerWidth, height: innerHeight }, bounds0, pos0, bounds1, pos1, resize, orientation, before, throttled };
  });
  assert.deepEqual(r.size, r.inner);
  assert.deepEqual(r.bounds0, { top: 0, left: 0, bottom: r.inner.height, right: r.inner.width, height: r.inner.height, width: r.inner.width });
  assert.deepEqual(r.pos0, { top: 0, left: 0 });
  assert.equal(r.bounds1.top, 2000);
  assert.equal(r.bounds1.left, 1500);
  assert.equal(r.bounds1.bottom, 2000 + r.inner.height);
  assert.equal(r.bounds1.right, 1500 + r.inner.width);
  assert.deepEqual(r.pos1, { top: 2000, left: 1500 });
  assert.equal(r.resize, 1);
  assert.equal(r.orientation, 1);
  assert.equal(r.before, 0);
  assert.equal(r.throttled, 1);
});
