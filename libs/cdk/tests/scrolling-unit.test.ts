// Pure scrolling logic: strategies against a fake viewport (Angular strategy semantics), the server
// measurement model behind `createVirtualScroll`, and the RxJS-replacement streams.
import { test } from "vitest";
import assert from "node:assert/strict";
import { untrack } from "@rivetjs/reactivity";
import { auditTime, distinct, Emitter, filter } from "../scrolling/emitter.ts";
import { FixedSizeVirtualScrollStrategy } from "../scrolling/fixed-size-virtual-scroll.ts";
import { AutoSizeVirtualScrollStrategy, ItemSizeAverager } from "../scrolling/auto-size-virtual-scroll.ts";
import { contentTransform, createVirtualScroll, VirtualScrollModel } from "../scrolling/state.ts";
import type { ListRange, VirtualScrollStrategyViewport } from "../scrolling/virtual-scroll-strategy.ts";

/** Fake viewport: fixed item size, settable scroll offset. */
function fake(length: number, size: number, item = 50) {
  const v = {
    range: { start: 0, end: 0 } as ListRange,
    total: 0,
    offset: 0,
    scroll: 0,
    getDataLength: () => length,
    getViewportSize: () => size,
    getRenderedRange: () => v.range,
    setRenderedRange: (r: ListRange) => (v.range = r),
    setTotalContentSize: (s: number) => (v.total = s),
    setRenderedContentOffset: (o: number) => (v.offset = o),
    getOffsetToRenderedContentStart: () => v.offset,
    measureScrollOffset: () => v.scroll,
    measureRenderedContentSize: () => (v.range.end - v.range.start) * item,
    measureRangeSize: (r: ListRange) => (r.end - r.start) * item,
    scrollToOffset: (o: number) => (v.scroll = o),
  };
  return v satisfies VirtualScrollStrategyViewport;
}

test("fixed strategy: attach sets total size and range; scrolling, buffers, scrolledIndexChange (distinct)", () => {
  const v = fake(10, 200);
  const s = new FixedSizeVirtualScrollStrategy(50, 0, 0);
  const seen: number[] = [];
  s.scrolledIndexChange.subscribe((i) => seen.push(i));
  s.attach(v);
  assert.equal(v.total, 500);
  assert.deepEqual(v.range, { start: 0, end: 4 });
  v.scroll = 55;
  s.onContentScrolled();
  assert.deepEqual(v.range, { start: 1, end: 6 });
  assert.equal(v.offset, 50);
  s.onContentScrolled();
  assert.deepEqual(seen, [0, 1], "distinct indices");
  s.scrollToIndex(3, "auto");
  assert.equal(v.scroll, 150);
  assert.throws(() => s.updateItemAndBufferSize(50, 100, 99), /maxBufferPx must be greater than or equal to minBufferPx/);
  s.detach();
});

test("fixed strategy: data shrinking while scrolled to the bottom moves the range to the new end", () => {
  const v = fake(10, 200);
  const s = new FixedSizeVirtualScrollStrategy(50, 0, 0);
  s.attach(v);
  v.scroll = 300;
  s.onContentScrolled();
  assert.deepEqual(v.range, { start: 6, end: 10 });
  const w = fake(5, 200);
  Object.assign(w, { range: v.range, scroll: 300 });
  s.attach(w);
  assert.equal(w.offset, 50);
  assert.deepEqual(w.range, { start: 1, end: 5 });
});

test("ItemSizeAverager: weighted average, ignores empty samples, reset", () => {
  const a = new ItemSizeAverager(50);
  assert.equal(a.getAverageItemSize(), 50);
  a.addSample({ start: 0, end: 4 }, 100);
  assert.equal(a.getAverageItemSize(), 25);
  a.addSample({ start: 4, end: 8 }, 300);
  assert.equal(a.getAverageItemSize(), 50);
  a.addSample({ start: 0, end: 0 }, 1000);
  assert.equal(a.getAverageItemSize(), 175, "an empty range adds no weight but its size still counts (original behaviour)");
  const z = new ItemSizeAverager(10);
  z.addSample({ start: 0, end: 0 }, 99);
  assert.equal(z.getAverageItemSize(), 10, "no weight at all: unchanged");
  a.reset();
  assert.equal(a.getAverageItemSize(), 50);
});

test("autosize strategy: initial range from the estimate; unsupported APIs throw like the original", () => {
  const v = fake(100, 200, 50);
  const s = new AutoSizeVirtualScrollStrategy(0, 100);
  s.attach(v);
  assert.deepEqual(v.range, { start: 0, end: 6 }, "4 visible + 2 buffer (100px / 50px)");
  s.onContentRendered();
  assert.equal(v.total, 5000);
  assert.throws(() => s.scrollToIndex(), /scrollToIndex is currently not supported/);
  assert.throws(() => s.scrolledIndexChange.subscribe(() => {}), /scrolledIndexChange is currently not supported/);
  assert.throws(() => s.updateBufferSize(10, 5), /maxBufferPx/);
});

test("server model: createVirtualScroll renders the strategy's first range (fixed / autosize / appendOnly)", () => {
  const fixed = createVirtualScroll({ items: Array.from({ length: 1000 }, (_, i) => i), itemSize: 50, initialViewportSize: 200 });
  assert.deepEqual(untrack(fixed.range), { start: 0, end: 8 }, "200px viewport + 200px max buffer");
  assert.equal(untrack(fixed.totalSize), 50000);
  assert.equal(untrack(fixed.transform), "translateY(0px)");
  const none = createVirtualScroll({ items: [1, 2, 3], itemSize: 20 });
  assert.deepEqual(untrack(none.range), { start: 0, end: 3 });
  const auto = createVirtualScroll({ items: Array(100).fill(0), autosize: true, initialViewportSize: 200 });
  assert.deepEqual(untrack(auto.range), { start: 0, end: 8 });
  assert.equal(untrack(auto.totalSize), 5000, "estimated 50px per item");
  assert.equal(new VirtualScrollModel(10, 0, 50, true).run(new FixedSizeVirtualScrollStrategy(50, 0, 0)).offset, 0);
  assert.throws(() => createVirtualScroll({ items: [], minBufferPx: 10, maxBufferPx: 5 }), /maxBufferPx/);
});

test("contentTransform: axis, RTL negation, to-end", () => {
  assert.equal(contentTransform("vertical", 10), "translateY(10px)");
  assert.equal(contentTransform("horizontal", 10, true), "translateX(-10px)");
  assert.equal(contentTransform("vertical", 10, true, true), "translateY(10px) translateY(-100%)");
});

test("streams: Emitter (subscribe / complete / count), distinct, filter, auditTime", async () => {
  const counts: number[] = [];
  const e = new Emitter<number>((n) => counts.push(n));
  const got: number[] = [];
  const sub = filter(distinct(e), (n) => n > 0).subscribe((n) => got.push(n));
  e.next(1);
  e.next(1);
  e.next(0);
  e.next(2);
  assert.deepEqual(got, [1, 2]);
  sub.unsubscribe();
  let done = false;
  e.subscribe({ complete: () => (done = true) });
  e.complete();
  assert.ok(done);
  assert.equal(e.count, 0);
  const a = new Emitter<number>();
  const audited: number[] = [];
  auditTime(a, 5).subscribe((n) => audited.push(n));
  a.next(1);
  a.next(2);
  await new Promise((r) => setTimeout(r, 15));
  assert.deepEqual(audited, [2], "latest value after the audit window");
});
