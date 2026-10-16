// Ported from React Spectrum (react-stately/test/virtualizer/ScrollAnchor.test.ts), Apache-2.0, © Adobe:
// every case (jest expect → node:assert). Plus an engine-level case: a layout anchored to its end edge.
import { describe, test } from "vitest";
import assert from "node:assert/strict";
import {
  captureScrollAnchor,
  computeScrollAnchorTarget,
  getEdgeSnapTarget,
  isNearEdge,
  resolveScrollAdjustment,
  ScrollAnchorTracker,
  type ScrollAnchor,
  type ScrollAnchorInfo,
} from "../virtualizer/scroll-anchor.ts";
import { LayoutInfo } from "../virtualizer/layout-info.ts";
import { Rect } from "../virtualizer/rect.ts";
import { Size } from "../virtualizer/size.ts";
import { ListLayout } from "../virtualizer/list-layout.ts";
import { createCollection } from "../virtualizer/collection.ts";
import { Virtualizer } from "../virtualizer/virtualizer-core.ts";

describe('captureScrollAnchor', () => {
  test('does not anchor to an item that only slivers into the viewport by a pixel or two', () => {
    let visibleRect = new Rect(0, 1023, 400, 468);

    // Substantially visible: fully inside the viewport, 9px from the top.
    let substantiallyVisible = new LayoutInfo(
      'item',
      'substantially-visible',
      new Rect(0, 1032, 400, 40)
    );
    // Nearly scrolled out: only its bottom 1px overlaps the viewport.
    let sliver = new LayoutInfo('item', 'sliver', new Rect(0, 976, 400, 48));

    let anchor = captureScrollAnchor('end', 'y', visibleRect, [
      ['substantially-visible', substantiallyVisible],
      ['sliver', sliver]
    ]);

    assert.equal(anchor?.key, 'substantially-visible');
  });

  test('returns null when the only candidate is a sub-threshold sliver, rather than anchoring to it', () => {
    let visibleRect = new Rect(0, 1023, 400, 468);
    let onlyCandidate = new LayoutInfo('item', 'only-candidate', new Rect(0, 976, 400, 48));

    let anchor = captureScrollAnchor('end', 'y', visibleRect, [['only-candidate', onlyCandidate]]);

    assert.equal(anchor, null);
  });

  test('picks the item with the smallest offset among multiple substantially-visible candidates', () => {
    let visibleRect = new Rect(0, 1023, 400, 468);
    let closer = new LayoutInfo('item', 'closer', new Rect(0, 1032, 400, 40));
    let farther = new LayoutInfo('item', 'farther', new Rect(0, 1080, 400, 48));

    let anchor = captureScrollAnchor('end', 'y', visibleRect, [
      ['farther', farther],
      ['closer', closer]
    ]);

    assert.equal(anchor?.key, 'closer');
  });
});

describe('computeScrollAnchorTarget', () => {
  test('returns null when the anchored item can no longer be found', () => {
    let anchor: ScrollAnchor = {key: 'gone', corner: 'topLeft', offset: 10};
    let visibleRect = new Rect(0, 100, 400, 468);
    let contentSize = new Size(400, 2000);

    let target = computeScrollAnchorTarget(anchor, 'y', () => null, visibleRect, contentSize);

    assert.equal(target, null);
  });

  test('returns null when the anchored item has not moved relative to the viewport', () => {
    let anchor: ScrollAnchor = {key: 'item', corner: 'topLeft', offset: 10};
    let visibleRect = new Rect(0, 100, 400, 468);
    let contentSize = new Size(400, 2000);
    let layoutInfo = new LayoutInfo('item', 'item', new Rect(0, 110, 400, 40));

    let target = computeScrollAnchorTarget(anchor, 'y', () => layoutInfo, visibleRect, contentSize);

    assert.equal(target, null);
  });

  test('returns the new viewport coordinate needed to preserve the anchor offset', () => {
    // Anchor was captured 10px from the top of the viewport. Content was prepended above it,
    // pushing it down another 200px, so the viewport must scroll down 200px to compensate.
    let anchor: ScrollAnchor = {key: 'item', corner: 'topLeft', offset: 10};
    let visibleRect = new Rect(0, 100, 400, 468);
    let contentSize = new Size(400, 2000);
    let layoutInfo = new LayoutInfo('item', 'item', new Rect(0, 310, 400, 40));

    let target = computeScrollAnchorTarget(anchor, 'y', () => layoutInfo, visibleRect, contentSize);

    assert.equal(target, 300);
  });

  test('clamps the target to 0 when the naive computation would be negative', () => {
    let anchor: ScrollAnchor = {key: 'item', corner: 'topLeft', offset: 100};
    let visibleRect = new Rect(0, 100, 400, 468);
    let contentSize = new Size(400, 2000);
    // Item moved up, so the naive target would be negative.
    let layoutInfo = new LayoutInfo('item', 'item', new Rect(0, 0, 400, 40));

    let target = computeScrollAnchorTarget(anchor, 'y', () => layoutInfo, visibleRect, contentSize);

    assert.equal(target, 0);
  });

  test('clamps the target to the max scroll offset when it would exceed the content size', () => {
    let anchor: ScrollAnchor = {key: 'item', corner: 'topLeft', offset: 10};
    let visibleRect = new Rect(0, 100, 400, 468);
    let contentSize = new Size(400, 600);
    // Item moved far down, well past what the content size can accommodate.
    let layoutInfo = new LayoutInfo('item', 'item', new Rect(0, 5000, 400, 40));

    let target = computeScrollAnchorTarget(anchor, 'y', () => layoutInfo, visibleRect, contentSize);

    assert.equal(target, 600 - 468);
  });

  test('supports the x axis', () => {
    let anchor: ScrollAnchor = {key: 'item', corner: 'topLeft', offset: 10};
    let visibleRect = new Rect(100, 0, 468, 400);
    let contentSize = new Size(2000, 400);
    let layoutInfo = new LayoutInfo('item', 'item', new Rect(310, 0, 40, 400));

    let target = computeScrollAnchorTarget(anchor, 'x', () => layoutInfo, visibleRect, contentSize);

    assert.equal(target, 300);
  });
});

describe('getEdgeSnapTarget', () => {
  test('returns 0 for the start edge regardless of sizes', () => {
    let contentSize = new Size(400, 2000);
    let visibleRect = new Rect(0, 500, 400, 468);

    assert.equal(getEdgeSnapTarget('start', 'y', contentSize, visibleRect), 0);
  });

  test('returns the max scroll offset for the end edge', () => {
    let contentSize = new Size(400, 2000);
    let visibleRect = new Rect(0, 500, 400, 468);

    assert.equal(getEdgeSnapTarget('end', 'y', contentSize, visibleRect), 2000 - 468);
  });

  test('clamps the end edge target to 0 when content is smaller than the viewport', () => {
    let contentSize = new Size(400, 200);
    let visibleRect = new Rect(0, 0, 400, 468);

    assert.equal(getEdgeSnapTarget('end', 'y', contentSize, visibleRect), 0);
  });
});

describe('isNearEdge', () => {
  test('is true for the start edge when within the threshold', () => {
    let contentSize = new Size(400, 2000);
    let visibleRect = new Rect(0, 10, 400, 468);

    assert.equal(isNearEdge(visibleRect, contentSize, 'start', 'y', 10), true);
  });

  test('is false for the start edge when beyond the threshold', () => {
    let contentSize = new Size(400, 2000);
    let visibleRect = new Rect(0, 11, 400, 468);

    assert.equal(isNearEdge(visibleRect, contentSize, 'start', 'y', 10), false);
  });

  test('is true for the end edge when within the threshold', () => {
    let contentSize = new Size(400, 2000);
    // distance from end = 2000 - (1532 + 468) = 0
    let visibleRect = new Rect(0, 1532, 400, 468);

    assert.equal(isNearEdge(visibleRect, contentSize, 'end', 'y', 10), true);
  });

  test('is false for the end edge when beyond the threshold', () => {
    let contentSize = new Size(400, 2000);
    let visibleRect = new Rect(0, 1500, 400, 468);

    assert.equal(isNearEdge(visibleRect, contentSize, 'end', 'y', 10), false);
  });
});

describe('resolveScrollAdjustment', () => {
  let visibleRect = new Rect(0, 500, 400, 468);
  let contentSize = new Size(400, 2000);

  test('returns the anchor-based target when the anchor resolves', () => {
    let anchor: ScrollAnchor = {key: 'item', corner: 'topLeft', offset: 10};
    let layoutInfo = new LayoutInfo('item', 'item', new Rect(0, 610, 400, 40));

    let result = resolveScrollAdjustment(
      'end',
      'y',
      anchor,
      false,
      false,
      false,
      0,
      () => layoutInfo,
      visibleRect,
      contentSize
    );

    assert.equal(result?.y, 600);
  });

  test('falls back to snapping to the edge when there is no anchor and near the edge', () => {
    let result = resolveScrollAdjustment(
      'end',
      'y',
      null,
      true,
      false,
      false,
      0,
      () => null,
      visibleRect,
      contentSize
    );

    assert.equal(result?.y, 2000 - 468);
  });

  test('falls back to snapping to the edge when item sizes changed but content grew', () => {
    let result = resolveScrollAdjustment(
      'end',
      'y',
      null,
      true,
      false,
      true,
      50,
      () => null,
      visibleRect,
      contentSize
    );

    assert.equal(result?.y, 2000 - 468);
  });

  test('returns null when the edge-snap target is already the current position', () => {
    // visibleRect is already at the bottom edge.
    let atEdge = new Rect(0, 2000 - 468, 400, 468);

    let result = resolveScrollAdjustment(
      'end',
      'y',
      null,
      true,
      false,
      false,
      0,
      () => null,
      atEdge,
      contentSize
    );

    assert.equal(result, null);
  });

  test('returns null when not near the edge and there is no anchor', () => {
    let result = resolveScrollAdjustment(
      'end',
      'y',
      null,
      false,
      false,
      false,
      0,
      () => null,
      visibleRect,
      contentSize
    );

    assert.equal(result, null);
  });

  test('returns null when the user is actively scrolling, even if near the edge', () => {
    let result = resolveScrollAdjustment(
      'end',
      'y',
      null,
      true,
      true,
      false,
      0,
      () => null,
      visibleRect,
      contentSize
    );

    assert.equal(result, null);
  });

  test('returns null when items are still resizing and content did not grow', () => {
    let result = resolveScrollAdjustment(
      'end',
      'y',
      null,
      true,
      false,
      true,
      0,
      () => null,
      visibleRect,
      contentSize
    );

    assert.equal(result, null);
  });
});

describe('ScrollAnchorTracker', () => {
  let anchorInfo: ScrollAnchorInfo = {edge: 'end', axis: 'y', threshold: 50};

  test('captureBeforeLayout returns null when there is no anchor info', () => {
    let tracker = new ScrollAnchorTracker();
    let visibleRect = new Rect(0, 500, 400, 468);

    let anchor = tracker.captureBeforeLayout(null, [], visibleRect);

    assert.equal(anchor, null);
  });

  test('captureBeforeLayout delegates to captureScrollAnchor using the anchor info', () => {
    let tracker = new ScrollAnchorTracker();
    let visibleRect = new Rect(0, 1023, 400, 468);
    let item = new LayoutInfo('item', 'item', new Rect(0, 1032, 400, 40));

    let anchor = tracker.captureBeforeLayout(anchorInfo, [['item', item]], visibleRect);

    assert.equal(anchor?.key, 'item');
  });

  test('resolveAfterLayout returns null when there is no anchor info', () => {
    let tracker = new ScrollAnchorTracker();
    let visibleRect = new Rect(0, 500, 400, 468);
    let contentSize = new Size(400, 2000);

    let result = tracker.resolveAfterLayout({
      anchorInfo: null,
      anchor: null,
      postLayoutInfos: new Map(),
      previousVisibleRect: visibleRect,
      previousContentSize: contentSize,
      contentSize,
      itemSizeChanged: false,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    assert.equal(result, null);
  });

  test('resolveAfterLayout returns null when the previous visible rect has no area', () => {
    let tracker = new ScrollAnchorTracker();
    let contentSize = new Size(400, 2000);

    let result = tracker.resolveAfterLayout({
      anchorInfo,
      anchor: null,
      postLayoutInfos: new Map(),
      previousVisibleRect: new Rect(0, 0, 0, 0),
      previousContentSize: contentSize,
      contentSize,
      itemSizeChanged: false,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    assert.equal(result, null);
  });

  test('always snaps to the edge on the first anchored layout, even if far from it', () => {
    let tracker = new ScrollAnchorTracker();
    // Far from the bottom edge, well beyond the threshold.
    let visibleRect = new Rect(0, 0, 400, 468);
    let contentSize = new Size(400, 2000);

    let result = tracker.resolveAfterLayout({
      anchorInfo,
      anchor: null,
      postLayoutInfos: new Map(),
      previousVisibleRect: visibleRect,
      previousContentSize: contentSize,
      contentSize,
      itemSizeChanged: false,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    assert.equal(result?.y, 2000 - 468);
  });

  test('skips recomputing on later passes when nothing relevant changed', () => {
    let tracker = new ScrollAnchorTracker();
    let visibleRect = new Rect(0, 2000 - 468, 400, 468);
    let contentSize = new Size(400, 2000);

    // First pass establishes hasSnappedToEdge.
    tracker.resolveAfterLayout({
      anchorInfo,
      anchor: null,
      postLayoutInfos: new Map(),
      previousVisibleRect: visibleRect,
      previousContentSize: contentSize,
      contentSize,
      itemSizeChanged: false,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    let result = tracker.resolveAfterLayout({
      anchorInfo,
      anchor: null,
      postLayoutInfos: new Map(),
      previousVisibleRect: visibleRect,
      previousContentSize: contentSize,
      contentSize,
      itemSizeChanged: false,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    assert.equal(result, null);
  });

  test('recomputes on later passes when the content size changed', () => {
    let tracker = new ScrollAnchorTracker();
    let visibleRect = new Rect(0, 2000 - 468, 400, 468);
    let contentSize = new Size(400, 2000);

    tracker.resolveAfterLayout({
      anchorInfo,
      anchor: null,
      postLayoutInfos: new Map(),
      previousVisibleRect: visibleRect,
      previousContentSize: contentSize,
      contentSize,
      itemSizeChanged: false,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    let grownContentSize = new Size(400, 2200);
    let result = tracker.resolveAfterLayout({
      anchorInfo,
      anchor: null,
      postLayoutInfos: new Map(),
      previousVisibleRect: visibleRect,
      previousContentSize: contentSize,
      contentSize: grownContentSize,
      itemSizeChanged: false,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    assert.equal(result?.y, 2200 - 468);
  });

  test('reset() clears tracked state so the next call behaves like a first pass again', () => {
    let tracker = new ScrollAnchorTracker();
    let visibleRect = new Rect(0, 2000 - 468, 400, 468);
    let contentSize = new Size(400, 2000);

    tracker.resolveAfterLayout({
      anchorInfo,
      anchor: null,
      postLayoutInfos: new Map(),
      previousVisibleRect: visibleRect,
      previousContentSize: contentSize,
      contentSize,
      itemSizeChanged: false,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    tracker.reset();

    // Far from the edge; would return null on a non-first pass, but reset() means this counts
    // as the first pass again, so it should snap unconditionally.
    let farRect = new Rect(0, 0, 400, 468);
    let result = tracker.resolveAfterLayout({
      anchorInfo,
      anchor: null,
      postLayoutInfos: new Map(),
      previousVisibleRect: farRect,
      previousContentSize: contentSize,
      contentSize,
      itemSizeChanged: false,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    assert.equal(result?.y, 2000 - 468);
  });

  test('reuses the pre-resize "near edge" decision across a settling cascade instead of recomputing mid-resize', () => {
    let tracker = new ScrollAnchorTracker();
    let contentSize = new Size(400, 2000);
    // Near the bottom edge before resizing starts.
    let nearEdgeRect = new Rect(0, 2000 - 468, 400, 468);
    // Later, after items grew, the same viewport position is far from the (new, larger) edge.
    let farRect = new Rect(0, 0, 400, 468);

    // Pass 1 (first pass, no estimated items): establishes hasSnappedToEdge and records that
    // the viewport was near the edge.
    tracker.resolveAfterLayout({
      anchorInfo,
      anchor: null,
      postLayoutInfos: new Map(),
      previousVisibleRect: nearEdgeRect,
      previousContentSize: contentSize,
      contentSize,
      itemSizeChanged: false,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    // Pass 2 (resize begins): an estimated-size item shows up. The previous pass wasn't
    // estimating, so this pass still freely recomputes "near edge" using the still-near rect,
    // and records true.
    let estimatedItem = new LayoutInfo('item', 'item', new Rect(0, 0, 400, 40));
    estimatedItem.estimatedSize = true;
    let midResizeContentSize = new Size(400, 2100);

    let midResult = tracker.resolveAfterLayout({
      anchorInfo,
      anchor: null,
      postLayoutInfos: new Map([['item', estimatedItem]]),
      previousVisibleRect: nearEdgeRect,
      previousContentSize: contentSize,
      contentSize: midResizeContentSize,
      itemSizeChanged: true,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    assert.equal(midResult?.y, midResizeContentSize.height - nearEdgeRect.height);

    // Pass 3 (settling): sizes are no longer estimated, but the rect passed in for this pass
    // has drifted far from the (new) edge -- if the tracker recomputed naively it would decide
    // "not near edge" and refuse to snap. Because pass 2 had estimated items, this pass reuses
    // pass 2's recorded decision (true) instead, and still snaps.
    let settledItem = new LayoutInfo('item', 'item', new Rect(0, 0, 400, 40));
    let finalContentSize = new Size(400, 2200);

    let settledResult = tracker.resolveAfterLayout({
      anchorInfo,
      anchor: null,
      postLayoutInfos: new Map([['item', settledItem]]),
      previousVisibleRect: farRect,
      previousContentSize: midResizeContentSize,
      contentSize: finalContentSize,
      itemSizeChanged: true,
      isScrolling: false,
      getLayoutInfo: () => null
    });

    assert.equal(settledResult?.y, finalContentSize.height - farRect.height);
  });
});

describe("Virtualizer + UNSTABLE_getScrollAnchorInfo", () => {
  class ChatLayout<T> extends ListLayout<T> {
    override UNSTABLE_getScrollAnchorInfo(): ScrollAnchorInfo {
      return { edge: "end", axis: "y", threshold: 20, isAnchorable: (info) => info.type !== "loader" };
    }
  }
  test("first layout snaps to the end; appended content keeps following; content prepended above keeps the anchor", () => {
    const layout = new ChatLayout<unknown>({ rowHeight: 20 });
    let rect = new Rect(0, 0, 100, 100);
    let collection = createCollection(Array.from({ length: 20 }, (_, i) => ({ key: i })));
    const v = new Virtualizer<any, unknown>({
      collection,
      layout,
      delegate: { setVisibleRect: (r) => ((rect = r), run()), renderView: (_t, c) => c, invalidate() {} },
    });
    const run = () => v.render({ layout, collection, visibleRect: rect, size: new Size(rect.width, rect.height), invalidationContext: {}, isScrolling: false });
    run();
    assert.equal(rect.y, 400 - 100, "snapped to the end edge");
    collection = createCollection(Array.from({ length: 22 }, (_, i) => ({ key: i })));
    run();
    assert.equal(rect.y, 440 - 100, "near the end: follows new messages");
    // Scroll up away from the edge, then prepend 5 rows: the anchored row stays put.
    rect = new Rect(0, 100, 100, 100);
    run();
    collection = createCollection(Array.from({ length: 27 }, (_, i) => ({ key: i - 5 })));
    run();
    assert.equal(rect.y, 200, "anchor kept: viewport moved by the prepended 100px");
  });
});
