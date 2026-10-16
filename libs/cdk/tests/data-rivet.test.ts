// Rivet cases for @rivetjs/cdk/data (beyond the ported react-stately suites): reactive members,
// two-way selection signals, render-snapshot semantics of createAsyncList.
import { describe, expect, it, vi } from "vitest";
import { effect, createRoot } from "@rivetjs/reactivity";
import { createAsyncList, createListData, createTreeData } from "../data/index.tsx";

describe("@rivetjs/cdk/data (Rivet)", () => {
  it("createListData: items() is reactive and filtered; selectedKeys is a two-way signal", () => {
    const list = createListData({
      initialItems: [
        { id: "a", name: "Apple" },
        { id: "b", name: "Banana" },
      ],
      filter: (item, text) => item.name.toLowerCase().includes(text.toLowerCase()),
    });
    const seen: string[][] = [];
    const { dispose } = createRoot((d) => {
      effect(() => void seen.push(list.items().map((i) => i.id)));
      return d;
    });
    list.setFilterText("ban");
    list.append({ id: "c", name: "Blackberry" });
    list.setFilterText("");
    expect(seen).toEqual([["a", "b"], ["b"], ["b"], ["a", "b", "c"]]);
    // A collection writing the signal directly is the same as setSelectedKeys.
    list.selectedKeys.set(new Set(["a"]));
    list.removeSelectedItems();
    expect(list.items().map((i) => i.id)).toEqual(["b", "c"]);
    expect(list.selectedKeys()).toEqual(new Set());
    expect(list.getItem("c")?.name).toBe("Blackberry");
    dispose();
  });

  it("createTreeData: items() / getItem track the tree signal", () => {
    const tree = createTreeData({ initialItems: [{ id: 1, children: [{ id: 2 }] }] as any[] });
    const sizes: number[] = [];
    const { dispose } = createRoot((d) => {
      effect(() => void sizes.push(tree.items()[0].children!.length));
      return d;
    });
    tree.append(1, { id: 3 });
    expect(sizes).toEqual([1, 2]);
    expect(tree.getItem(3)?.parentKey).toBe(1);
    tree.selectedKeys.set(new Set([2, 3]));
    tree.removeSelectedItems();
    expect(tree.items()[0].children).toEqual([]);
    dispose();
  });

  it("createAsyncList: calls in one task see the state the task started with; the next task sees the update", async () => {
    let resolve!: (v: { items: number[]; cursor: number }) => void;
    const load = vi.fn(() => new Promise<{ items: number[]; cursor: number }>((r) => (resolve = r)));
    const list = createAsyncList<number, number>({ load, getKey: (n) => n });
    expect(list.loadingState()).toBe("loading");
    resolve({ items: [1, 2], cursor: 3 });
    await new Promise((r) => setTimeout(r));
    expect(list.items()).toEqual([1, 2]);
    list.loadMore();
    expect(list.loadingState()).toBe("loadingMore");
    list.loadMore(); // same task: upstream also starts (and aborts) a duplicate
    expect(load).toHaveBeenCalledTimes(3);
    await Promise.resolve();
    list.loadMore(); // next task: guarded by the loadingMore state
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("createAsyncList under an owner defers the initial load to a client effect (after mount)", async () => {
    const load = vi.fn(async () => ({ items: ["x"] }));
    const { value: list, dispose } = createRoot((d) => ({ value: createAsyncList({ load, getKey: (s: string) => s }), dispose: d })).value as any;
    expect(load).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r));
    expect(load).toHaveBeenCalledTimes(1);
    expect(list.items()).toEqual(["x"]);
    dispose();
  });
});
