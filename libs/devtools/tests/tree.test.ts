// Components tree view state (ui/store.ts): flattening with collapse / filter, windowing, keyed selection,
// per-id DOM update counts and the performance-reason index (no per-row scans).
import { beforeAll, test, vi } from "vitest";
import assert from "node:assert/strict";
import { effect } from "@rivetjs/reactivity";
import type { TreeNode } from "../protocol.ts";

type Store = typeof import("../ui/store.ts");
let store: Store;
beforeAll(async () => {
  vi.stubGlobal("location", { hash: "" });
  vi.stubGlobal("addEventListener", () => {});
  store = await import("../ui/store.ts");
});

const node = (id: number, name: string, children: TreeNode[] = []): TreeNode => ({ id, name, kind: "component", updates: 0, children });
const sample = () => [node(1, "App", [node(2, "Header"), node(3, "List", [node(4, "Item"), node(5, "Item")]), node(6, "Footer")])];
const names = (rows: { node: TreeNode; depth: number }[]) => rows.map((r) => "  ".repeat(r.depth) + r.node.name);

test("flattenTree: document order with depths; collapsed subtrees hidden", () => {
  assert.deepEqual(names(store.flattenTree(sample(), new Set(), "")), ["App", "  Header", "  List", "    Item", "    Item", "  Footer"]);
  const rows = store.flattenTree(sample(), new Set([3]), "");
  assert.deepEqual(names(rows), ["App", "  Header", "  List", "  Footer"]);
  assert.deepEqual(
    rows.map((r) => [r.parent, r.open]),
    [
      [true, true],
      [false, false],
      [true, false],
      [false, false],
    ],
  );
});

test("flattenTree: a filter keeps matches and their ancestors (collapse ignored, no toggles)", () => {
  const rows = store.flattenTree(sample(), new Set([1, 3]), "item");
  assert.deepEqual(names(rows), ["App", "  List", "    Item", "    Item"]);
  assert.ok(rows.every((r) => !r.parent));
  assert.deepEqual(names(store.flattenTree(sample(), new Set(), "FOOT")), ["App", "  Footer"]);
  assert.deepEqual(store.flattenTree(sample(), new Set(), "nothing"), []);
});

test("windowRange: all rows up to WINDOW, else the viewport plus overscan", () => {
  assert.deepEqual(store.windowRange(store.WINDOW, 10_000, 400), { start: 0, end: store.WINDOW });
  const total = 10_000;
  const at = store.windowRange(total, 100 * store.ROW, 400);
  assert.deepEqual(at, { start: 100 - store.OVERSCAN, end: 100 - store.OVERSCAN + 400 / store.ROW + 2 * store.OVERSCAN });
  assert.deepEqual(store.windowRange(total, total * store.ROW, 400).end, total);
  assert.equal(store.windowRange(total, 0, 400).start, 0);
});

test("treeRows / toggleCollapsed / treeFilter drive the visible rows", () => {
  store.tree.set(sample());
  assert.equal(store.treeRows().length, 6);
  store.toggleCollapsed(3);
  assert.equal(store.treeRows().length, 4);
  store.toggleCollapsed(3);
  store.treeFilter.set("header");
  assert.deepEqual(names(store.treeRows()), ["App", "  Header"]);
  store.treeFilter.set("");
});

test("keyed selection: a change re-runs only the old and the new row", () => {
  const runs = new Map<number, number>();
  for (let id = 1; id <= 100; id++) effect(() => void (store.isSelected(id), runs.set(id, (runs.get(id) ?? 0) + 1)));
  store.selected.set(7);
  store.selected.set(42);
  const rerun = [...runs].filter(([, n]) => n > 1).map(([id]) => id);
  assert.deepEqual(rerun, [7, 42]);
  assert.equal(store.isSelected(42), true);
  assert.equal(store.isSelected(7), false);
});

test("countOf: per-id count signals; the perf reason index", () => {
  assert.equal(store.countOf(9), undefined);
  let reads = 0;
  effect(() => void (store.countOf(9), reads++));
  store.perfInfo.set({
    rows: [
      { comp: { id: 9, name: "X" }, reasons: ["frequent runs"] },
      { comp: { id: 8, name: "Y" }, reasons: [] },
    ],
  } as never);
  assert.deepEqual(store.perfReasons().get(9), ["frequent runs"]);
  assert.equal(store.perfReasons().has(8), false, "rows without reasons are not indexed");
  assert.equal(reads, 1, "unrelated changes do not re-run a row's count");
});
