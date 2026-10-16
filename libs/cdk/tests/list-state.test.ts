// useListState / useSingleSelectListState (react-stately list), Apache-2.0, © Adobe: state-level
// behaviour of the Rivet port (collection derivation, single-select backing, focus reset).
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { Item } from "@rivetjs/cdk/collections/builder";
import type { Key } from "@rivetjs/cdk/collections/types";
import { createListState, createSingleSelectListState, filteredListCollection, listCollection, listSelectionManager, resetFocusedKey, selectedItem, setSelectedKey } from "../collections/list-state.ts";

const fruit = [
  { id: "apple", name: "Apple" },
  { id: "banana", name: "Banana" },
  { id: "cherry", name: "Cherry" },
];

describe("useListState (react-stately)", () => {
  it("builds a ListCollection from items + renderer; default selection mode none", () => {
    const state = createListState({ items: fruit, children: (item: (typeof fruit)[number]) => Item({ children: item.name }) });
    const collection = listCollection(state);
    assert.deepEqual([...collection.getKeys()], ["apple", "banana", "cherry"]);
    assert.equal(collection.getItem("banana")!.textValue, "Banana");
    assert.equal(listSelectionManager(state).selectionMode, "none");
    assert.equal(listCollection(state), collection, "cached per items array");
  });

  it("static children; disabledKeys; multiple selection", () => {
    const state = createListState<object>({ selectionMode: "multiple", disabledKeys: ["b"], children: [Item({ key: "a", children: "A" }), Item({ key: "b", children: "B" }), Item({ key: "c", children: "C" })] });
    const m = listSelectionManager(state);
    m.selectAll();
    assert.deepEqual([...listSelectionManager(state).selectedKeys], ["a", "c"]);
    assert.equal(m.isDisabled("b"), true);
  });

  it("accessor items rebuild the collection", () => {
    const items = signal(fruit.slice(0, 2));
    const state = createListState({ items, children: (item: (typeof fruit)[number]) => Item({ children: item.name }) });
    assert.equal(listCollection(state).size, 2);
    items.set(fruit);
    assert.equal(listCollection(state).size, 3);
  });

  it("resets the focused key to a neighbour when the focused item is removed", () => {
    const items = signal(fruit);
    const state = createListState({ items, selectionMode: "single", children: (item: (typeof fruit)[number]) => Item({ children: item.name }) });
    const before = listCollection(state);
    listSelectionManager(state).setFocusedKey("banana");
    items.set([fruit[0]!, fruit[2]!]);
    resetFocusedKey(state, before);
    assert.notEqual(listSelectionManager(state).focusedKey, "banana");
    assert.ok(["apple", "cherry"].includes(String(listSelectionManager(state).focusedKey)));
  });

  it("filter prop filters nodes; UNSTABLE_useFilteredListState falls back when the collection cannot filter", () => {
    const state = createListState({ items: fruit, filter: (nodes) => [...nodes].filter((n) => n.textValue.startsWith("C")), children: (item: (typeof fruit)[number]) => Item({ children: item.name }) });
    assert.deepEqual([...listCollection(state).getKeys()], ["cherry"]);
    // ListCollection has no filter(): the state collection is returned as is (upstream behaviour).
    assert.equal(filteredListCollection(state, () => false), listCollection(state));
  });
});

describe("useSingleSelectListState (react-stately)", () => {
  it("selectedKey backing, onSelectionChange, disallowEmptySelection", () => {
    const changes: (Key | null)[] = [];
    const state = createSingleSelectListState({ items: fruit, defaultSelectedKey: "apple", onSelectionChange: (k: Key | null) => void changes.push(k), children: (item: (typeof fruit)[number]) => Item({ children: item.name }) });
    assert.equal(state.selectedKey(), "apple");
    assert.equal(selectedItem(state)!.key, "apple");
    listSelectionManager(state).select("cherry");
    assert.equal(state.selectedKey(), "cherry");
    listSelectionManager(state).select("cherry");
    assert.equal(state.selectedKey(), "cherry", "disallowEmptySelection");
    setSelectedKey(state, "banana");
    assert.equal(state.selectedKey(), "banana");
    // Re-selecting the selected key still reports it (allowDuplicateSelectionEvents).
    assert.deepEqual(changes, ["cherry", "cherry", "banana"]);
  });

  it("controlled selectedKey only reports", () => {
    const changes: (Key | null)[] = [];
    const state = createSingleSelectListState({ items: fruit, selectedKey: "apple", onSelectionChange: (k: Key | null) => void changes.push(k), children: (item: (typeof fruit)[number]) => Item({ children: item.name }) });
    listSelectionManager(state).select("banana");
    assert.equal(state.selectedKey(), "apple");
    assert.deepEqual(changes, ["banana"]);
  });
});
