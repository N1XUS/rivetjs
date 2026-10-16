// Tabs state (react-stately useTabListState) in Node: default selection, disabled keys, focus follows
// selection while unfocused, the SelectionManager lens, TabsKeyboardDelegate.
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal, untrack } from "@rivetjs/reactivity";
import { createTabListState, effectiveFocusedKey, findDefaultSelectedKey, selectTab, setTabFocusedKey, tabsSelectionState } from "../state/tabs.ts";
import { TabsKeyboardDelegate } from "../tabs/keyboard-delegate.ts";
import { buildNodes, ListCollection, type Key } from "../_adapters/collection.ts";
import { SelectionManager } from "../_adapters/grid-selection.ts";

const items = [
  { key: "a", label: "A" },
  { key: "b", label: "B" },
  { key: "c", label: "C", isDisabled: true },
  { key: "d", label: "D" },
];
const tabs = () => items.map((item) => ({ id: item.key, isDisabled: item.isDisabled }));

test("default selection: first non-disabled tab; all disabled → first; defaultSelectedKey wins", () => {
  assert.equal(untrack(createTabListState({ tabs }).selectedKey), "a");
  assert.equal(untrack(createTabListState({ tabs, disabledKeys: ["a", "b"] }).selectedKey), "d");
  assert.equal(
    findDefaultSelectedKey(
      tabs().map((t) => ({ ...t, isDisabled: true })),
      new Set(),
    ),
    "a",
  );
  assert.equal(findDefaultSelectedKey(tabs(), new Set(), true), "a", "whole list disabled → first tab");
  assert.equal(untrack(createTabListState({ tabs, defaultSelectedKey: "b" }).selectedKey), "b");
  assert.equal(untrack(createTabListState({ tabs, defaultSelectedKey: "zzz" }).selectedKey), "a", "missing key falls back");
  assert.equal(untrack(createTabListState({ defaultSelectedKey: "zzz" }).selectedKey), "zzz", "without tabs the given key is kept");
  const controlled = signal<Key | null>("d");
  assert.equal(createTabListState({ tabs, selectedKey: controlled }).selectedKey, controlled, "controlled signal is used as is");
  const empty = signal<Key | null>(null);
  createTabListState({ tabs, selectedKey: empty });
  assert.equal(untrack(empty), "a", "a two-way signal holding null gets the default");
});

test("plain controlled selectedKey: never written, onSelectionChange still fires", () => {
  const changes: Key[] = [];
  const state = createTabListState({ tabs, selectedKey: "b", onSelectionChange: (k) => changes.push(k), keyboardActivation: "manual" });
  assert.equal(state.controlled, true);
  assert.equal(state.keyboardActivation, "manual");
  selectTab(state, "d");
  assert.equal(untrack(state.selectedKey), "b");
  assert.deepEqual(changes, ["d"]);
});

test("selection lens: SelectionManager replace / no empty selection / onSelectionChange on every select", () => {
  const changes: Key[] = [];
  const state = createTabListState({ tabs, onSelectionChange: (k) => changes.push(k) });
  const manager = new SelectionManager(new ListCollection(buildNodes(items)), tabsSelectionState(state));
  manager.select("b");
  assert.equal(untrack(state.selectedKey), "b");
  manager.select("b");
  assert.equal(untrack(state.selectedKey), "b", "disallowEmptySelection");
  manager.select("c");
  assert.equal(untrack(state.selectedKey), "b", "disabled tab is not selectable");
  assert.deepEqual(changes, ["b", "b"], "duplicate selection events are allowed (useSingleSelectListState)");
  assert.equal(untrack(state.focusedKey), "b");
});

test("focus follows selection while the tablist is unfocused; a manual focus move is kept", () => {
  const state = createTabListState({ tabs, keyboardActivation: "manual" });
  state.isFocused.set(true);
  setTabFocusedKey(state, "b"); // manual: focus moved without selecting
  state.isFocused.set(false);
  assert.equal(
    untrack(() => effectiveFocusedKey(state)),
    "b",
  );
  state.selectedKey.set("d"); // changed from outside
  assert.equal(
    untrack(() => effectiveFocusedKey(state)),
    "d",
  );
  selectTab(state, "a");
  assert.equal(
    untrack(() => effectiveFocusedKey(state)),
    "a",
  );
});

test("TabsKeyboardDelegate: wraps, skips disabled, direction flip, vertical only for up/down", () => {
  const collection = new ListCollection(buildNodes(items));
  const h = new TabsKeyboardDelegate(collection, "ltr", "horizontal");
  assert.equal(h.getKeyRightOf("b"), "d");
  assert.equal(h.getKeyRightOf("d"), "a");
  assert.equal(h.getKeyLeftOf("a"), "d");
  assert.equal(h.getKeyBelow("a"), null);
  const rtl = new TabsKeyboardDelegate(collection, "rtl", "horizontal");
  assert.equal(rtl.getKeyLeftOf("a"), "b");
  const v = new TabsKeyboardDelegate(collection, "ltr", "vertical", new Set(["d"]));
  assert.equal(v.getKeyBelow("b"), "a");
  assert.equal(v.getLastKey(), "b");
  assert.equal(v.getKeyRightOf("a"), "b", "left/right also move in vertical tabs");
});
