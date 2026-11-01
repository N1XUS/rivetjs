// Rivet: tree controls over very large trees (Angular CDK spreads node lists into `select(...)` /
// `push(...)` call arguments: a few hundred thousand nodes threw RangeError).
import { describe, expect, it } from "vitest";
import { FlatTreeControl, NestedTreeControl } from "../tree/control.ts";

const N = 300_000;

describe("tree controls with 300k nodes", () => {
  it("FlatTreeControl expandAll / expandDescendants / collapseDescendants", () => {
    const nodes = [{ level: 0 }, ...Array.from({ length: N }, () => ({ level: 1 }))];
    const control = new FlatTreeControl<{ level: number }>(
      (node) => node.level,
      () => true,
    );
    control.dataNodes = nodes;
    control.expandAll();
    expect(control.expansionModel.selected.length).toBe(N + 1);
    control.collapseDescendants(nodes[0]!);
    expect(control.expansionModel.selected.length).toBe(0);
    control.expandDescendants(nodes[0]!);
    expect(control.expansionModel.selected.length).toBe(N + 1);
  });

  it("NestedTreeControl expandAll / expandDescendants", () => {
    type T = { children: T[] };
    const root: T = { children: Array.from({ length: N }, () => ({ children: [] })) };
    const control = new NestedTreeControl<T>((node) => node.children);
    control.dataNodes = [root];
    control.expandAll();
    expect(control.expansionModel.selected.length).toBe(N + 1);
    control.collapseAll();
    control.expandDescendants(root);
    expect(control.expansionModel.selected.length).toBe(N + 1);
  });
});
