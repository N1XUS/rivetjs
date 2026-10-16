// Rivet-authored unit tests of `@rivetjs/cdk/data-grid/state` (pipeline, selection, layout, virtual window, reorder).
import { describe, expect, it } from "vitest";
import {
  columnCssWidths,
  compareValues,
  collatorFor,
  dataGridRows,
  expandableKeys,
  isKeySelected,
  nextSortDescriptor,
  pinnedOffsets,
  rangeSelection,
  reorderItems,
  scrollTopFor,
  selectAllState,
  selectionSize,
  tableWidthPx,
  toggleExpandedKey,
  toggleKeySelection,
  virtualWindow,
  clampColumnWidth,
  type DataGridColumnBase,
} from "../data-grid/state.ts";

interface Item {
  id: string;
  name: string;
  n: number | null;
  kids?: Item[];
}
const items: Item[] = [
  { id: "a", name: "item 10", n: 3 },
  { id: "b", name: "Item 2", n: null },
  { id: "c", name: "item 1", n: 1 },
];
const cols: DataGridColumnBase<Item>[] = [
  { id: "name", accessorKey: "name" },
  { id: "n", accessorKey: "n" },
];
const id = (x: Item) => x.id;

describe("pipeline", () => {
  it("keeps data order without a sort", () => {
    expect(dataGridRows({ data: items, columns: cols, getRowId: id }).rows.map((r) => r.key)).toEqual(["a", "b", "c"]);
  });
  it("sorts locale + numeric aware, nulls last, stable", () => {
    const asc = dataGridRows({ data: items, columns: cols, getRowId: id, sort: { column: "name", direction: "ascending" } });
    expect(asc.rows.map((r) => r.item.name)).toEqual(["item 1", "Item 2", "item 10"]);
    const byN = dataGridRows({ data: items, columns: cols, getRowId: id, sort: { column: "n", direction: "ascending" } });
    expect(byN.rows.map((r) => r.key)).toEqual(["c", "a", "b"]);
    const desc = dataGridRows({ data: items, columns: cols, getRowId: id, sort: { column: "n", direction: "descending" } });
    expect(desc.rows.map((r) => r.key)).toEqual(["b", "a", "c"]);
    const same = [1, 2, 3].map((i) => ({ id: String(i), name: "x", n: 0 }));
    expect(dataGridRows({ data: same, columns: cols, getRowId: id, sort: { column: "name", direction: "descending" } }).rows.map((r) => r.key)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });
  it("uses the column sortFn", () => {
    const c: DataGridColumnBase<Item>[] = [{ id: "len", sortFn: (a, b) => a.name.length - b.name.length }];
    expect(dataGridRows({ data: items, columns: c, getRowId: id, sort: { column: "len", direction: "ascending" } }).rows.map((r) => r.key)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
  it("filters, keeping ancestors of matching descendants", () => {
    const tree: Item[] = [
      { id: "p", name: "parent", n: 0, kids: [{ id: "k", name: "needle", n: 0 }] },
      { id: "q", name: "other", n: 0 },
    ];
    const r = dataGridRows({
      data: tree,
      columns: cols,
      getRowId: id,
      getChildren: (x) => x.kids,
      expandedKeys: "all",
      filter: (x) => x.name.includes("needle"),
    });
    expect(r.rows.map((x) => [x.key, x.depth, x.parentKey])).toEqual([
      ["p", 0, null],
      ["k", 1, "p"],
    ]);
  });
  it("flattens expanded rows with depth, posinset / setsize, index", () => {
    const tree: Item[] = [
      {
        id: "p",
        name: "b",
        n: 0,
        kids: [
          { id: "k2", name: "z", n: 0 },
          { id: "k1", name: "a", n: 0 },
        ],
      },
      { id: "q", name: "a", n: 0 },
    ];
    const collapsed = dataGridRows({ data: tree, columns: cols, getRowId: id, getChildren: (x) => x.kids });
    expect(collapsed.rows.map((r) => r.key)).toEqual(["p", "q"]);
    expect(collapsed.rows[0]!.hasChildren).toBe(true);
    const open = dataGridRows({
      data: tree,
      columns: cols,
      getRowId: id,
      getChildren: (x) => x.kids,
      expandedKeys: ["p"],
      sort: { column: "name", direction: "ascending" },
    });
    expect(open.rows.map((r) => r.key)).toEqual(["q", "p", "k1", "k2"]);
    expect(open.rows.map((r) => [r.posInSet, r.setSize, r.index])).toEqual([
      [1, 2, 0],
      [2, 2, 1],
      [1, 2, 2],
      [2, 2, 3],
    ]);
    expect([...expandableKeys(tree, id, (x) => x.kids)]).toEqual(["p"]);
    expect([...toggleExpandedKey(new Set(["p"]), "p")]).toEqual([]);
    expect([...toggleExpandedKey("all", "p", () => ["p", "x"])]).toEqual(["x"]);
  });
  it("paginates after sorting and clamps the page", () => {
    const data = Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `n${i}`, n: 25 - i }));
    const r = dataGridRows({ data, columns: cols, getRowId: id, sort: { column: "n", direction: "ascending" }, pageSize: 10, page: 3 });
    expect(r.total).toBe(25);
    expect(r.pageCount).toBe(3);
    expect(r.rows.map((x) => x.key)).toEqual(["4", "3", "2", "1", "0"]);
    expect(dataGridRows({ data, columns: cols, getRowId: id, pageSize: 10, page: 99 }).rows[0]!.key).toBe("20");
  });
  it("compareValues orders mixed types sensibly", () => {
    const c = collatorFor("en-US");
    expect(compareValues(2, 10, c)).toBeLessThan(0);
    expect(compareValues("a2", "a10", c)).toBeLessThan(0);
    expect(compareValues(new Date(1), new Date(2), c)).toBeLessThan(0);
    expect(compareValues(undefined, 1, c)).toBeGreaterThan(0);
    expect(compareValues(true, false, c)).toBeGreaterThan(0);
  });
  it("nextSortDescriptor: new column ascending, same column flips", () => {
    expect(nextSortDescriptor(null, "a")).toEqual({ column: "a", direction: "ascending" });
    expect(nextSortDescriptor({ column: "a", direction: "ascending" }, "a")).toEqual({ column: "a", direction: "descending" });
    expect(nextSortDescriptor({ column: "a", direction: "descending" }, "a")).toEqual({ column: "a", direction: "ascending" });
    expect(nextSortDescriptor({ column: "a", direction: "descending" }, "b")).toEqual({ column: "b", direction: "ascending" });
  });
});

describe("selection", () => {
  const keys = () => ["a", "b", "c"];
  it("toggles in multiple / single mode and out of all", () => {
    expect([...(toggleKeySelection(new Set(), "a", "multiple", keys) as Set<string>)]).toEqual(["a"]);
    expect([...(toggleKeySelection(new Set(["a"]), "b", "single", keys) as Set<string>)]).toEqual(["b"]);
    expect([...(toggleKeySelection(new Set(["a"]), "a", "single", keys) as Set<string>)]).toEqual([]);
    expect([...(toggleKeySelection("all", "b", "multiple", keys, new Set(["c"])) as Set<string>)]).toEqual(["a"]);
    expect(toggleKeySelection(new Set(), "a", "none", keys)).toEqual(new Set());
    expect(toggleKeySelection(new Set(), "c", "multiple", keys, new Set(["c"]))).toEqual(new Set());
  });
  it("ranges skip disabled keys", () => {
    expect([...rangeSelection(["a", "b", "c", "d"], "d", "a", new Set(["b"]))]).toEqual(["a", "c", "d"]);
  });
  it("select-all state and size", () => {
    expect(selectAllState(new Set(), keys())).toBe("none");
    expect(selectAllState(new Set(["a"]), keys())).toBe("some");
    expect(selectAllState(new Set(["a", "b"]), keys(), new Set(["c"]))).toBe("all");
    expect(selectAllState("all", keys())).toBe("all");
    expect(selectionSize("all", 10, new Set(["x"]))).toBe(9);
    expect(isKeySelected("all", "c", new Set(["c"]))).toBe(false);
  });
});

describe("layout", () => {
  it("col widths: px, %, fr and implicit 1fr", () => {
    const c: DataGridColumnBase<Item>[] = [{ id: "a", width: 100 }, { id: "b", width: "20%" }, { id: "c", width: "2fr" }, { id: "d" }];
    expect(columnCssWidths(c)).toEqual(["100px", "20%", "calc((100% - 100px - 20%) * 0.6666666666666666)", "calc((100% - 100px - 20%) * 0.3333333333333333)"]);
    expect(
      columnCssWidths(
        c,
        new Map([
          ["c", 50],
          ["d", 50],
        ]),
      ),
    ).toEqual(["100px", "20%", "50px", "50px"]);
    expect(tableWidthPx([{ id: "a", width: 10 }, { id: "b" }])).toBeNull();
    expect(tableWidthPx([{ id: "a", width: 10 }, { id: "b" }], new Map([["b", 5]]))).toBe(15);
  });
  it("pinned offsets accumulate per side and mark the edge", () => {
    const c: DataGridColumnBase<Item>[] = [
      { id: "s1", width: 40, pinned: "start" },
      { id: "s2", width: 100, pinned: "start" },
      { id: "m", width: 300 },
      { id: "e1", width: 80, pinned: "end" },
      { id: "e2", width: 60, pinned: "end" },
    ];
    const p = pinnedOffsets(c);
    expect(p.get("s1")).toEqual({ side: "start", offset: 0, edge: false });
    expect(p.get("s2")).toEqual({ side: "start", offset: 40, edge: true });
    expect(p.get("e2")).toEqual({ side: "end", offset: 0, edge: false });
    expect(p.get("e1")).toEqual({ side: "end", offset: 60, edge: true });
    expect(p.has("m")).toBe(false);
    expect(pinnedOffsets(c, new Map([["s1", 50]])).get("s2")!.offset).toBe(50);
  });
  it("clamps widths", () => {
    expect(clampColumnWidth({ id: "a" }, 10)).toBe(40);
    expect(clampColumnWidth({ id: "a", minWidth: 100, maxWidth: 200 }, 500)).toBe(200);
  });
});

describe("virtual window", () => {
  it("covers the viewport plus overscan", () => {
    expect(virtualWindow(0, 400, 40, 10_000, 5)).toEqual({ start: 0, end: 16 });
    expect(virtualWindow(4000, 400, 40, 10_000, 5)).toEqual({ start: 95, end: 116 });
    expect(virtualWindow(399_000, 400, 40, 10_000, 5)).toEqual({ start: 9970, end: 9991 });
    expect(virtualWindow(0, 400, 40, 0, 5)).toEqual({ start: 0, end: 0 });
  });
  it("scrollTopFor reveals a row under a sticky header", () => {
    expect(scrollTopFor(10, 40, 36, 0, 436)).toBe(40);
    expect(scrollTopFor(0, 40, 36, 400, 436)).toBe(0);
    expect(scrollTopFor(5, 40, 36, 100, 436)).toBe(100);
  });
});

describe("reorder", () => {
  it("moves keys before / after a target, keeping their order", () => {
    const data = ["a", "b", "c", "d", "e"].map((x) => ({ id: x, name: x, n: 0 }));
    const order = (r: Item[]) => r.map((x) => x.id).join("");
    expect(order(reorderItems(data, id, new Set(["a"]), "c", "after"))).toBe("bcade");
    expect(order(reorderItems(data, id, new Set(["e", "b"]), "a", "before"))).toBe("beacd");
    expect(order(reorderItems(data, id, new Set(["a"]), "a", "after"))).toBe("abcde");
  });
});
