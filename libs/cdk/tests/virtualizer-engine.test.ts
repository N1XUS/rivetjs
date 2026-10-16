// Virtualizer engine + layouts. Ported cases: react-stately/test/virtualizer/{LayoutInfo,GridLayout}.test
// (all), plus the virtualized ListBox / GridList / Table / Menu cases of react-aria-components/test
// (Virtualizer + ListLayout / TableLayout, rowHeight 25, 100 x 100 viewport) translated to engine-level checks.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import {
  GridLayout,
  LayoutInfo,
  ListLayout,
  Rect,
  Size,
  TableLayout,
  VirtualizerEngine,
  WaterfallLayout,
  calculateColumnSizes,
  createCollection,
  createTableCollection,
  createVirtualizerState,
  loaderNode,
  type Collection,
  type GridLayoutOptions,
  type Layout,
  type Node,
  type ReusableView,
} from "../virtualizer/engine.ts";
import { initialWindow, projectViews, type VirtualView, type VirtualizerModel } from "../virtualizer/behaviour.ts";
import { signal } from "@rivetjs/reactivity";

type AnyLayout = Layout<Node<any>, any>;

/** An engine with a recording delegate (the RAC Virtualizer + useVirtualizerState loop, synchronous). */
function engine(layout: AnyLayout, collection: Collection<Node<any>>, width = 100, height = 100, layoutOptions?: unknown) {
  let context: object = layoutOptions ? { layoutOptions } : {};
  let rect = new Rect(0, 0, width, height);
  let persisted: Set<any> | null = null;
  let views: ReusableView<Node<any>, unknown>[] = [];
  const v = new VirtualizerEngine<Node<any>, unknown>({
    collection,
    layout,
    delegate: {
      setVisibleRect: (r) => {
        rect = r;
        run();
      },
      renderView: (_type, content) => content,
      invalidate: (ctx) => {
        context = layoutOptions ? { ...ctx, layoutOptions } : ctx;
        run();
      },
    },
  });
  let coll = collection;
  const run = () =>
    (views = v.render({ layout, collection: coll, persistedKeys: persisted, visibleRect: rect, size: new Size(rect.width, rect.height), invalidationContext: context, isScrolling: false, layoutOptions }));
  run();
  const flat = (list: ReusableView<Node<any>, unknown>[], out: ReusableView<Node<any>, unknown>[] = []) => {
    for (const view of list) (out.push(view), flat([...view.children], out));
    return out;
  };
  return {
    v,
    keys: (type?: string) =>
      flat(views)
        .filter((view) => !type || view.layoutInfo!.type === type)
        .map((view) => view.layoutInfo!.key),
    views: () => flat(views),
    scrollTo(y: number, x = rect.x) {
      rect = new Rect(x, y, rect.width, rect.height);
      run();
    },
    persist(keys: any[]) {
      persisted = new Set(keys);
      run();
    },
    setCollection(c: Collection<Node<any>>) {
      coll = c;
      run();
    },
  };
}

const range = (n: number, from = 0) => Array.from({ length: n }, (_, i) => i + from);
const items50 = range(50).map((i) => ({ id: i, name: "Item " + i }));

describe("LayoutInfo", () => {
  test("should return a copy of the current LayoutInfo after calling copy()", () => {
    const layoutInfo = new LayoutInfo("loader", "key", new Rect(10, 10, 10, 10));
    layoutInfo.parentKey = "parent key";
    layoutInfo.estimatedSize = true;
    layoutInfo.isSticky = true;
    layoutInfo.opacity = 3;
    layoutInfo.transform = "scale3d(0.8, 0.8, 0.8)";
    layoutInfo.zIndex = 5;
    layoutInfo.allowOverflow = true;
    assert.equal(layoutInfo.zIndex, 5);
    const copy = layoutInfo.copy();
    assert.deepEqual(copy, layoutInfo);
    assert.notEqual(copy.rect, layoutInfo.rect);
  });
});

describe("Rect / Size / Point", () => {
  test("intersection, union, containment, corners", () => {
    const a = new Rect(0, 0, 10, 10),
      b = new Rect(5, 5, 10, 10);
    assert.ok(a.intersects(b));
    assert.deepEqual(a.intersection(b), new Rect(5, 5, 5, 5));
    assert.deepEqual(a.union(b), new Rect(0, 0, 15, 15));
    assert.ok(a.union(b).containsRect(a));
    assert.equal(b.getCornerInRect(a), "topLeft");
    assert.equal(new Rect(20, 20, 1, 1).getCornerInRect(a), null);
    assert.deepEqual(a.intersection(new Rect(50, 50, 1, 1)), new Rect(0, 0, 0, 0));
    assert.ok(!a.intersects(new Rect(0, 0, 0, 10)), "zero-area rects never intersect");
    assert.ok(a.pointEquals(new Rect(0, 0, 3, 3)) && a.sizeEquals(new Size(10, 10)));
    assert.equal(new Size(-5, 3).width, 0, "sizes clamp at 0");
    assert.equal(a.bottomRight.x, 10);
  });
});

/** GridLayout set up like react-stately/test/virtualizer/GridLayout.test.ts (mock virtualizer). */
function setupGridLayout(options: GridLayoutOptions = {}, itemCount = 4, viewportWidth = 400) {
  const layout = new GridLayout<unknown>();
  const collection = createCollection(range(itemCount).map((i) => ({ key: `item-${i}` })));
  (layout as any).virtualizer = { collection, visibleRect: new Rect(0, 0, viewportWidth, 600), size: new Size(viewportWidth, 600), isPersistedKey: () => false };
  layout.update({
    layoutOptions: { minItemSize: new Size(100, 100), maxItemSize: new Size(100, 100), minSpace: new Size(10, 10), ...options },
    sizeChanged: true,
    offsetChanged: false,
    layoutOptionsChanged: true,
  });
  return layout;
}

describe("GridLayout getDropTargetFromPoint", () => {
  const isValidDropTarget = () => true;
  test('returns "before" when dropping to the left of an item in LTR', () => {
    const layout = setupGridLayout({ direction: "ltr" });
    const li = layout.getLayoutInfo("item-1")!;
    assert.deepEqual(layout.getDropTargetFromPoint(li.rect.x + 2, li.rect.y + li.rect.height / 2, isValidDropTarget), { type: "item", key: "item-1", dropPosition: "before" });
  });
  test('returns "after" when dropping to the right of an item in LTR', () => {
    const layout = setupGridLayout({ direction: "ltr" });
    const li = layout.getLayoutInfo("item-0")!;
    assert.deepEqual(layout.getDropTargetFromPoint(li.rect.maxX - 2, li.rect.y + li.rect.height / 2, isValidDropTarget), { type: "item", key: "item-0", dropPosition: "after" });
  });
  test('returns "before" when dropping to the right of an item in RTL', () => {
    const layout = setupGridLayout({ direction: "rtl" });
    const li = layout.getLayoutInfo("item-1")!;
    const visualX = layout.getContentSize().width - li.rect.x - 2;
    assert.deepEqual(layout.getDropTargetFromPoint(visualX, li.rect.y + li.rect.height / 2, isValidDropTarget), { type: "item", key: "item-1", dropPosition: "before" });
  });
  test('returns "after" when dropping to the left of an item in RTL', () => {
    const layout = setupGridLayout({ direction: "rtl" });
    const li = layout.getLayoutInfo("item-0")!;
    const visualX = layout.getContentSize().width - li.rect.maxX + 2;
    assert.deepEqual(layout.getDropTargetFromPoint(visualX, li.rect.y + li.rect.height / 2, isValidDropTarget), { type: "item", key: "item-0", dropPosition: "after" });
  });
  test("returns root drop target for empty layout", () => {
    assert.deepEqual(setupGridLayout({}, 0).getDropTargetFromPoint(50, 50, isValidDropTarget), { type: "root" });
  });
  test("single column layout is unaffected by direction", () => {
    const ltr = setupGridLayout({ direction: "ltr" }, 4, 120);
    const rtl = setupGridLayout({ direction: "rtl" }, 4, 120);
    const y = ltr.getLayoutInfo("item-1")!.rect.y + 2;
    assert.deepEqual(ltr.getDropTargetFromPoint(60, y, isValidDropTarget), rtl.getDropTargetFromPoint(60, y, isValidDropTarget));
  });
  test("not accepted on the item: before / after by the midpoint", () => {
    const layout = setupGridLayout({});
    const li = layout.getLayoutInfo("item-1")!;
    const onlyEdges = (t: any) => t.type === "item" && t.dropPosition !== "on";
    assert.equal((layout.getDropTargetFromPoint(li.rect.x + 30, li.rect.y + 5, onlyEdges) as any).dropPosition, "before");
    assert.equal((layout.getDropTargetFromPoint(li.rect.maxX - 30, li.rect.y + 5, onlyEdges) as any).dropPosition, "after");
  });
});

describe("GridLayout", () => {
  test("columns from min item size + space; rows of equal height; drop indicator between columns", () => {
    const layout = new GridLayout<unknown>();
    const e = engine(layout, createCollection(range(10).map((i) => ({ key: i }))), 400, 300, { minItemSize: { width: 100, height: 80 }, minSpace: { width: 10, height: 10 }, preserveAspectRatio: true });
    // floor(400 / 110) = 3 columns.
    assert.equal(layout.getLayoutInfo(2)!.rect.y, layout.getLayoutInfo(0)!.rect.y);
    assert.ok(layout.getLayoutInfo(3)!.rect.y > layout.getLayoutInfo(0)!.rect.y);
    assert.equal(layout.getLayoutInfo(0)!.estimatedSize, false, "preserveAspectRatio: sizes are exact");
    // 4 rows: 10 + 4 * (h + 10).
    const h = layout.getLayoutInfo(0)!.rect.height;
    assert.equal(layout.getContentSize().height, 10 + 4 * (h + 10));
    const indicator = layout.getDropTargetLayoutInfo({ type: "item", key: 1, dropPosition: "before" });
    assert.equal(indicator.rect.width, 2);
    assert.equal(indicator.key, "1:before");
    assert.ok(e.keys().length > 0);
  });
  test("maxColumns, variable row heights from measured items, loader sentinel always visible", () => {
    const layout = new GridLayout<unknown>();
    const collection = createCollection(range(6).map((i) => ({ key: i })), {}, [loaderNode("loader", true)]);
    const e = engine(layout, collection, 1000, 200, { minItemSize: { width: 100, height: 100 }, maxColumns: 2 });
    assert.equal(layout.getLayoutInfo(1)!.rect.y, layout.getLayoutInfo(0)!.rect.y);
    assert.ok(layout.getLayoutInfo(2)!.rect.y > layout.getLayoutInfo(0)!.rect.y, "2 columns at most");
    assert.ok(e.keys().includes("loader"), "loader is never virtualized out");
    assert.equal(layout.getLayoutInfo("loader")!.rect.height, 48);
    assert.ok(layout.getLayoutInfo(0)!.estimatedSize);
    const estimated = layout.getLayoutInfo(1)!.rect.height;
    e.v.updateItemSize(0, new Size(482, estimated + 100));
    assert.equal(layout.getLayoutInfo(0)!.rect.height, estimated + 100);
    assert.equal(layout.getLayoutInfo(1)!.rect.height, estimated + 100, "row height = tallest item");
    assert.ok(layout.getLayoutInfo(2)!.rect.y > estimated + 100);
  });
});

describe("ListLayout (virtualized ListBox / GridList / Menu)", () => {
  test("rowHeight 25, 100 x 100: 7 rows, scrollTop 200 renders 7…14, End persists the last key", () => {
    const e = engine(new ListLayout({ rowHeight: 25 }), createCollection(items50), 100, 100, { rowHeight: 25 });
    assert.deepEqual(e.keys(), range(7));
    e.scrollTo(200);
    assert.deepEqual(e.keys(), range(8, 7));
    e.persist([49]);
    assert.deepEqual(e.keys(), [...range(8, 7), 49]);
    assert.equal(e.v.contentSize.height, 50 * 25);
  });

  test("loader sentinel rendered when virtualized; reserves loaderHeight only while loading", () => {
    const layout = new ListLayout<unknown>();
    const e = engine(layout, createCollection(items50, {}, [loaderNode("loader", true)]), 100, 100, { rowHeight: 25, loaderHeight: 30 });
    assert.deepEqual(e.keys(), [...range(7), "loader"]);
    assert.deepEqual(layout.getLayoutInfo("loader")!.rect, new Rect(0, 1250, 100, 30));
    e.setCollection(createCollection(items50, {}, [loaderNode("loader", false)]));
    assert.equal(layout.getLayoutInfo("loader")!.rect.height, 0);
    assert.equal(layout.getLayoutInfo("loader")!.rect.y, 1250);
    // Empty: loader at 0.
    e.setCollection(createCollection([], {}, [loaderNode("loader", false)]));
    assert.equal(layout.getLayoutInfo("loader")!.rect.y, 0);
    e.setCollection(createCollection([], {}, [loaderNode("loader", true)]));
    assert.equal(layout.getLayoutInfo("loader")!.rect.height, 30, "isLoading renders the loader even when empty");
  });

  test("estimated row heights: measured sizes move later rows and grow the content", () => {
    const layout = new ListLayout<unknown>({ estimatedRowHeight: 20 });
    const e = engine(layout, createCollection(items50), 100, 100);
    assert.ok(layout.getLayoutInfo(0)!.estimatedSize);
    assert.equal(e.v.contentSize.height, 1000);
    e.v.updateItemSize(0, new Size(100, 60));
    assert.equal(layout.getLayoutInfo(0)!.rect.height, 60);
    assert.equal(layout.getLayoutInfo(0)!.estimatedSize, false);
    assert.equal(layout.getLayoutInfo(1)!.rect.y, 60);
    assert.equal(e.v.contentSize.height, 1040);
    assert.equal(layout.updateItemSize(0, new Size(100, 60)), false, "same size: no invalidation");
    assert.equal(layout.updateItemSize("missing", new Size(1, 1)), false);
  });

  test("gap and padding", () => {
    const layout = new ListLayout<unknown>({ rowHeight: 20, gap: 4, padding: 8 });
    engine(layout, createCollection(range(5).map((i) => ({ key: i }))), 100, 100);
    assert.deepEqual(layout.getLayoutInfo(0)!.rect, new Rect(8, 8, 84, 20));
    assert.equal(layout.getLayoutInfo(1)!.rect.y, 32);
    assert.equal(layout.getContentSize().height, 8 + 5 * 20 + 4 * 4 + 8);
  });

  test("horizontal orientation", () => {
    const layout = new ListLayout<unknown>({ orientation: "horizontal", rowSize: 50 });
    const e = engine(layout, createCollection(range(20).map((i) => ({ key: i }))), 200, 40);
    assert.deepEqual(layout.getLayoutInfo(1)!.rect, new Rect(50, 0, 50, 40));
    assert.equal(e.v.contentSize.width, 1000);
    assert.deepEqual(e.keys(), range(7), "200px + overscan 66px, snapped to 300px: rows 0…6 (6 touches the edge)");
    e.scrollTo(0, 500);
    assert.ok(e.keys().includes(12) && !e.keys().includes(0));
  });

  test("sections with headers: nested views, header heights, section heights", () => {
    const layout = new ListLayout<unknown>({ rowHeight: 20, headingHeight: 30 });
    const data = [
      { key: "s1", type: "section", children: [{ key: "h1", type: "header" }, ...range(3).map((i) => ({ key: "a" + i }))] },
      { key: "s2", type: "section", children: [{ key: "h2", type: "header" }, ...range(3).map((i) => ({ key: "b" + i }))] },
    ];
    const e = engine(layout, createCollection(data), 100, 400);
    assert.deepEqual(e.keys("section"), ["s1", "s2"]);
    assert.equal(layout.getLayoutInfo("h1")!.rect.height, 30);
    assert.equal(layout.getLayoutInfo("s1")!.rect.height, 90);
    assert.equal(layout.getLayoutInfo("s2")!.rect.y, 90);
    assert.equal(layout.getLayoutInfo("a0")!.parentKey, "s1");
    const s1 = e.views().find((v) => v.layoutInfo!.key === "s1")!;
    assert.deepEqual([...s1.children].map((v) => v.layoutInfo!.key), ["h1", "a0", "a1", "a2"]);
  });

  test("drop targets: before / on / after by distance to the edges, root when empty", () => {
    const layout = new ListLayout<unknown>({ rowHeight: 40 });
    engine(layout, createCollection(range(10).map((i) => ({ key: i }))), 100, 200);
    const all = () => true;
    assert.deepEqual(layout.getDropTargetFromPoint(10, 45, all), { type: "item", key: 1, dropPosition: "before" });
    assert.deepEqual(layout.getDropTargetFromPoint(10, 60, all), { type: "item", key: 1, dropPosition: "on" });
    assert.deepEqual(layout.getDropTargetFromPoint(10, 75, all), { type: "item", key: 1, dropPosition: "after" });
    const noOn = (t: any) => t.dropPosition !== "on";
    assert.deepEqual(layout.getDropTargetFromPoint(10, 55, noOn), { type: "item", key: 1, dropPosition: "before" });
    assert.deepEqual(layout.getDropTargetFromPoint(10, 65, noOn), { type: "item", key: 1, dropPosition: "after" });
    const before = layout.getDropTargetLayoutInfo({ type: "item", key: 1, dropPosition: "before" });
    assert.deepEqual(before.rect, new Rect(0, 39, 100, 2));
    const after = layout.getDropTargetLayoutInfo({ type: "item", key: 1, dropPosition: "after" });
    assert.deepEqual(after.rect, new Rect(0, 79, 100, 2));
    const empty = new ListLayout<unknown>({ rowHeight: 40 });
    engine(empty, createCollection([]), 100, 200);
    assert.deepEqual(empty.getDropTargetFromPoint(10, 10, all), { type: "root" });
  });

  test("layout options invalidate only on relevant changes", () => {
    const layout = new ListLayout<unknown>();
    assert.equal(layout.shouldInvalidateLayoutOptions({ rowHeight: 20 }, { rowSize: 20 }), false, "deprecated alias");
    assert.equal(layout.shouldInvalidateLayoutOptions({ rowHeight: 20 }, { rowHeight: 30 }), true);
    assert.equal(layout.shouldInvalidateLayoutOptions({ gap: 1 }, { gap: 1 }), false);
  });

  test("view reuse: removed views are recycled for new keys of the same type (FIFO), keys of kept items stay", () => {
    const e = engine(new ListLayout({ rowHeight: 25 }), createCollection(items50), 100, 100);
    const before = new Map(e.views().map((v) => [v.layoutInfo!.key, v]));
    e.scrollTo(50);
    const after = new Map(e.views().map((v) => [v.layoutInfo!.key, v]));
    for (const key of [2, 3, 4, 5, 6]) assert.equal(after.get(key), before.get(key), "kept key keeps its view");
    const recycled = [...after.values()].filter((v) => ![...before.values()].includes(v)).length;
    assert.ok([...after.keys()].includes(8));
    assert.ok(recycled < after.size, "new keys reuse views of removed keys");
    assert.ok([...after.values()].some((v) => before.get(0) === v || before.get(1) === v), "removed views went to the reuse queue");
  });

  test("scroll offset is constrained when the content shrinks", () => {
    let set: Rect | null = null;
    const layout = new ListLayout<unknown>({ rowHeight: 25 });
    const v = new VirtualizerEngine<Node<any>, unknown>({ collection: createCollection(items50), layout, delegate: { setVisibleRect: (r) => (set = r), renderView: (_t, c) => c, invalidate() {} } });
    const opts = (collection: Collection<Node<any>>, y: number) => ({ layout, collection, visibleRect: new Rect(0, y, 100, 100), size: new Size(100, 100), invalidationContext: {}, isScrolling: false });
    v.render(opts(createCollection(items50), 1000));
    v.render(opts(createCollection(items50.slice(0, 10)), 1000));
    assert.deepEqual(set, new Rect(0, 150, 100, 100));
  });
});

describe("TableLayout (virtualized Table)", () => {
  const columns = [{ key: "foo", label: "Foo", isRowHeader: true }, { key: "bar", label: "Bar" }];
  const rows = range(50).map((i) => ({ id: i, foo: "Foo " + i, bar: "Bar " + i }));
  test("rowHeight 25, 100 x 100: header row + 6 rows; scrollTop 200; End persists row 49", () => {
    const layout = new TableLayout<unknown>({ rowHeight: 25 });
    const e = engine(layout, createTableCollection(columns, rows) as any, 100, 100, { rowHeight: 25 });
    assert.deepEqual(e.keys("headerrow"), ["headerrow"]);
    assert.deepEqual(e.keys("row"), range(6));
    assert.deepEqual(e.keys("column"), ["foo", "bar"]);
    e.scrollTo(200);
    assert.deepEqual(e.keys("row"), range(7, 7));
    e.persist([49]);
    assert.deepEqual(e.keys("row"), [...range(7, 7), 49]);
    assert.ok(layout.getLayoutInfo("header")!.isSticky);
    // 1fr columns, default min width 75.
    assert.equal(layout.getLayoutInfo("foo")!.rect.width, 75);
    assert.equal(layout.getLayoutInfo("0:bar")!.rect.x, 75);
  });
  test("loader row: always rendered, top 1250 within the body, height only while loading", () => {
    const layout = new TableLayout<unknown>();
    const e = engine(layout, createTableCollection(columns, rows, { loader: true }) as any, 100, 100, { rowHeight: 25, loaderHeight: 30 });
    assert.ok(e.keys().includes("loader"));
    const body = layout.getLayoutInfo("body")!.rect,
      loader = layout.getLayoutInfo("loader")!.rect;
    assert.equal(loader.y - body.y, 1250);
    assert.equal(loader.height, 30);
    e.setCollection(createTableCollection(columns, rows, { loader: false }) as any);
    assert.equal(layout.getLayoutInfo("loader")!.rect.height, 0);
  });
  test("footer: three row groups; sticky row-header column persists cells out of view", () => {
    const layout = new TableLayout<unknown>();
    const wide = [{ key: "a", isRowHeader: true, width: 300 }, { key: "b", width: 300 }, { key: "c", width: 300 }];
    const e = engine(layout, createTableCollection(wide, rows.slice(0, 7), { footer: [{ id: "total" } as any] }) as any, 200, 1000, { rowHeight: 25 });
    assert.deepEqual(e.keys("rowgroup"), ["body", "footer"]);
    assert.deepEqual(e.keys("header"), ["header"]);
    assert.equal(e.keys("row").length, 8);
    assert.equal(layout.getContentSize().width, 900);
    e.scrollTo(0, 650);
    assert.ok(e.keys("cell").includes("0:c"));
    assert.ok(e.keys("cell").includes("0:a"), "row header cell stays for labeling");
    assert.ok(!e.keys("cell").includes("0:b"));
  });
  test("drop target rows", () => {
    const layout = new TableLayout<unknown>({ rowHeight: 40 });
    engine(layout, createTableCollection(columns, rows) as any, 100, 400);
    assert.deepEqual(layout.getDropTargetFromPoint(10, 40 + 60, () => true), { type: "item", key: 1, dropPosition: "on" });
    assert.equal(layout.getDropTargetLayoutInfo({ type: "item", key: 1, dropPosition: "before" }).parentKey, "body");
  });
});

describe("TableColumnLayout", () => {
  test("flex algorithm: static px / %, fr shares, min / max violations, whole pixels", () => {
    assert.deepEqual(calculateColumnSizes(400, [{ key: "a", width: 100 }, { key: "b" }, { key: "c", width: "2fr" }], new Map()), [100, 100, 200]);
    assert.deepEqual(calculateColumnSizes(400, [{ key: "a", width: "25%" }, { key: "b" }], new Map()), [100, 300]);
    assert.deepEqual(calculateColumnSizes(300, [{ key: "a", maxWidth: 50 }, { key: "b" }], new Map()), [50, 250]);
    assert.deepEqual(calculateColumnSizes(300, [{ key: "a", minWidth: 200 }, { key: "b" }], new Map()), [200, 100]);
    assert.deepEqual(calculateColumnSizes(100, [{ key: "a" }, { key: "b" }, { key: "c" }], new Map()), [33, 34, 33]);
    assert.deepEqual(calculateColumnSizes(100.5, [{ key: "a" }, { key: "b" }], new Map()), [50, 50.5]);
    assert.deepEqual(calculateColumnSizes(400, [{ key: "a" }, { key: "b" }], new Map([["a", 300]])), [300, 100]);
  });
});

describe("WaterfallLayout", () => {
  test("shortest column placement, measured heights, spatial key range, on-only drop targets", () => {
    const layout = new WaterfallLayout<object>();
    const e = engine(layout, createCollection(range(6).map((i) => ({ key: i }))), 440, 1000, { minItemSize: new Size(200, 100), minSpace: new Size(10, 10) });
    assert.notEqual(layout.getLayoutInfo(0)!.rect.x, layout.getLayoutInfo(1)!.rect.x, "two columns");
    e.v.updateItemSize(0, new Size(200, 300));
    // Items keep their column while resizing; the column stacks the measured height.
    assert.equal(layout.getLayoutInfo(2)!.rect.x, layout.getLayoutInfo(0)!.rect.x);
    assert.equal(layout.getLayoutInfo(2)!.rect.y, 10 + 300 + 10);
    // A new item goes to the shortest column.
    e.setCollection(createCollection(range(7).map((i) => ({ key: i }))));
    assert.equal(layout.getLayoutInfo(6)!.rect.x, layout.getLayoutInfo(1)!.rect.x);
    assert.deepEqual(layout.getKeyRange(1, 3).sort(), [1, 3]);
    assert.deepEqual(layout.getDropTargetFromPoint(layout.getLayoutInfo(1)!.rect.x + 5, 20), { type: "item", key: 1, dropPosition: "on" });
    assert.equal(layout.getKeyRightOf(0), 1);
    assert.equal(layout.getKeyLeftOf(1), 0);
  });
});

describe("createVirtualizerState (useVirtualizerState)", () => {
  test("renders on visible rect / size / collection changes; measured sizes re-render; onVisibleRectChange after constraining", () => {
    const items = signal(items50);
    const rects: Rect[] = [];
    const state = createVirtualizerState<Node<any>, unknown>({
      layout: new ListLayout({ estimatedRowHeight: 25 }),
      collection: () => createCollection(items()),
      renderView: (_type, content) => content,
      onVisibleRectChange: (rect) => rects.push(rect),
    });
    assert.equal(state.visibleViews().length, 0, "empty rect: nothing rendered");
    state.setVisibleRect(new Rect(0, 0, 100, 100));
    assert.equal(state.visibleViews().length, 7);
    assert.equal(state.contentSize().height, 1250);
    state.virtualizer.updateItemSize(0, new Size(100, 50));
    assert.equal(state.contentSize().height, 1275);
    state.setVisibleRect(new Rect(0, 1100, 100, 100));
    items.set(items50.slice(0, 10));
    assert.ok(rects.length >= 1, "scroll offset clamped through onVisibleRectChange");
    assert.equal(rects.at(-1)!.y, 175);
    state.startScrolling();
    assert.equal(state.isScrolling(), true);
    state.endScrolling();
    state.dispose();
  });
});

describe("component window (server)", () => {
  const model = (count: number, extra: Partial<VirtualizerModel<number, any>> = {}): VirtualizerModel<number, any> => ({
    id: "v",
    items: range(count),
    layout: () => new ListLayout<number>(),
    layoutOptions: { rowHeight: 30 },
    collection: {},
    initialSize: { width: 300, height: 300 },
    loadMoreOffset: 1,
    shouldObserveItemSize: false,
    persistedKeys: [],
    focusedKey: signal<string | number | null>(null),
    views: signal<VirtualView<number>[]>([]),
    contentSize: signal({ width: 0, height: 0 }),
    isScrolling: signal(false),
    ...extra,
  });
  test("first window at initialSize, JSON-serializable views with absolute styles", () => {
    const { views, contentSize } = initialWindow(model(10000));
    assert.deepEqual(contentSize, { width: 300, height: 300000 });
    // 300px + 100px overscan, snapped to 420px of 30px rows → 0…14.
    assert.deepEqual(views.map((v) => v.key), range(15));
    assert.deepEqual(JSON.parse(JSON.stringify(views)), views);
    assert.deepEqual(views[1]!.style, { position: "absolute", overflow: "visible", contain: "size layout style", top: "30px", "inset-inline-start": "0px", width: "300px", height: "30px" });
    const rtl = initialWindow(model(3, { dir: "rtl" }));
    assert.equal(rtl.views[0]!.style.right, "0px");
    const persisted = initialWindow(model(100, { persistedKeys: [99] }));
    assert.equal(persisted.views.at(-1)!.key, 99);
  });
  test("projection keeps unchanged view objects (resumed rows stay adopted)", () => {
    const m = model(100);
    const first = initialWindow(m).views;
    const layout = new ListLayout<number>({ rowHeight: 30 });
    const v = new VirtualizerEngine<Node<number>, unknown>({ collection: createCollection(range(100)), layout, delegate: { setVisibleRect() {}, renderView: (_t, c) => c, invalidate() {} } });
    const views = v.render({ layout, collection: createCollection(range(100)), visibleRect: new Rect(0, 60, 300, 300), size: new Size(300, 300), invalidationContext: {}, isScrolling: false });
    const next = projectViews(views, undefined, new Map(first.map((view) => [view.key, view])));
    assert.equal(next.find((view) => view.key === 5), first.find((view) => view.key === 5));
    assert.ok(next.some((view) => view.key === 14));
  });
});
