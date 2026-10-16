// SelectionManager / collections (local adapters of the cdk-collections port; ListKeyboardDelegate is
// covered by tests/selection.test.ts on the faithful `selection/list-keyboard-delegate.ts`),
// over data collections in Node. Cases follow react-stately SelectionManager semantics.
import { test } from "vitest";
import assert from "node:assert/strict";
import { untrack, signal } from "@rivetjs/reactivity";
import { buildNodes, ListCollection, TreeCollection, compareNodeOrder, type Key, type SelectionValue } from "../_adapters/collection.ts";
import { createMultipleSelectionState, SelectionManager, isKeySelected } from "../_adapters/grid-selection.ts";

const items = [
  { key: "a", label: "Apple" },
  { key: "b", label: "Banana" },
  { key: "c", label: "Cherry", isDisabled: true },
  { key: "d", label: "Date" },
  { key: "e", label: "Elderberry" },
];
const list = () => new ListCollection(buildNodes(items));
const keys = (m: SelectionManager) => [...m.selectedKeys].sort();

test("single selection: replace, toggle off unless disallowEmptySelection", () => {
  const state = createMultipleSelectionState({ selectionMode: "single" });
  const m = new SelectionManager(list(), state);
  m.select("a");
  assert.deepEqual(keys(m), ["a"]);
  m.select("b");
  assert.deepEqual(keys(m), ["b"]);
  m.select("b");
  assert.deepEqual(keys(m), [], "selecting the selected key again clears it");
  const strict = new SelectionManager(
    list(),
    createMultipleSelectionState({ selectionMode: "single", disallowEmptySelection: true, defaultSelectedKeys: ["a"] }),
  );
  strict.select("a");
  assert.deepEqual(keys(strict), ["a"]);
});

test("multiple toggle / replace behaviours, disabled items, extend ranges from the anchor", () => {
  const state = createMultipleSelectionState({ selectionMode: "multiple" });
  const m = new SelectionManager(list(), state);
  m.select("a");
  m.select("b");
  assert.deepEqual(keys(m), ["a", "b"], "toggle behaviour adds");
  m.toggleSelection("c");
  assert.deepEqual(keys(m), ["a", "b"], "disabled item is not selectable");
  m.extendSelection("e");
  assert.deepEqual(keys(m), ["a", "b", "d", "e"], "range from anchor b skips disabled c");
  m.extendSelection("d");
  assert.deepEqual(keys(m), ["a", "b", "d"], "shrinking the range removes keys past the new end");
  assert.equal(untrack(state.anchorKey), "b");
  assert.equal(untrack(state.currentKey), "d");

  const replace = new SelectionManager(list(), createMultipleSelectionState({ selectionMode: "multiple", selectionBehavior: "replace" }));
  replace.select("a");
  replace.select("b");
  assert.deepEqual(keys(replace), ["b"], "replace behaviour replaces with a mouse");
  replace.select("d", { pointerType: "touch" });
  assert.deepEqual(keys(replace), ["b", "d"], "touch toggles even with replace behaviour");
});

test("select all: 'all' value, isSelectAll, toggleSelectAll, disabled keys excluded, extend from all", () => {
  const changes: SelectionValue[] = [];
  const state = createMultipleSelectionState({ selectionMode: "multiple", disabledKeys: ["e"], onSelectionChange: (k) => changes.push(k) });
  const m = new SelectionManager(list(), state);
  m.selectAll();
  assert.equal(untrack(state.selectedKeys), "all");
  assert.equal(m.isSelectAll, true);
  assert.deepEqual(keys(m), ["a", "b", "d"], "'all' materializes to selectable keys");
  assert.equal(m.isSelected("e"), false);
  assert.equal(isKeySelected(state, "a"), true);
  assert.equal(isKeySelected(state, "e"), false);
  m.extendSelection("b");
  assert.deepEqual(keys(m), ["b"], "extending from 'all' selects only the target");
  m.toggleSelectAll();
  assert.equal(untrack(state.selectedKeys), "all");
  m.toggleSelectAll();
  assert.deepEqual(keys(m), []);
  assert.equal(changes.length, 4);
});

test("duplicate selection events suppressed unless allowDuplicateSelectionEvents; controlled signal is written", () => {
  const selected = signal<SelectionValue>(new Set<Key>(["a"]));
  let calls = 0;
  const state = createMultipleSelectionState({ selectionMode: "single", selectedKeys: selected, onSelectionChange: () => calls++ });
  const m = new SelectionManager(list(), state);
  m.replaceSelection("a");
  assert.equal(calls, 0);
  m.replaceSelection("b");
  assert.equal(calls, 1);
  assert.deepEqual([...(selected() as Set<Key>)], ["b"]);
  const dup = new SelectionManager(
    list(),
    createMultipleSelectionState({ selectionMode: "single", allowDuplicateSelectionEvents: true, onSelectionChange: () => calls++ }),
  );
  dup.replaceSelection("a");
  dup.replaceSelection("a");
  assert.equal(calls, 3);
});

test("number keys: state keys and string DOM keys are the same item", () => {
  const numeric = new ListCollection(
    buildNodes([
      { key: 1, label: "One" },
      { key: 2, label: "Two" },
    ]),
  );
  const state = createMultipleSelectionState({ selectionMode: "multiple", defaultSelectedKeys: [1] });
  const m = new SelectionManager(numeric, state);
  assert.equal(m.isSelected(1), true);
  assert.equal(m.isSelected("1"), true);
  m.toggleSelection(2);
  assert.deepEqual([...m.selectedKeys].sort(), [1, 2]);
});

test("replace behaviour resets after long-press toggle mode once the selection empties", () => {
  const state = createMultipleSelectionState({ selectionMode: "multiple", selectionBehavior: "replace" });
  const m = new SelectionManager(list(), state);
  m.setSelectionBehavior("toggle");
  m.toggleSelection("a");
  assert.equal(m.selectionBehavior, "toggle");
  m.toggleSelection("a");
  assert.equal(m.selectionBehavior, "replace");
});

test("TreeCollection: only expanded children are in key order; compareNodeOrder across levels", () => {
  const nodes = buildNodes([
    {
      key: "docs",
      label: "Documents",
      children: [
        { key: "a1", label: "A1" },
        { key: "a2", label: "A2", children: [{ key: "deep", label: "Deep" }] },
      ],
    },
    { key: "photos", label: "Photos" },
  ]);
  const collapsed = new TreeCollection(nodes);
  assert.deepEqual([...collapsed.getKeys()], ["docs", "photos"]);
  const expanded = new TreeCollection(nodes, { expandedKeys: new Set<Key>(["docs", "a2"]) });
  assert.deepEqual([...expanded.getKeys()], ["docs", "a1", "a2", "deep", "photos"]);
  assert.equal(expanded.getItem("deep")!.level, 2);
  assert.equal(expanded.getItem("deep")!.parentKey, "a2");
  assert.ok(compareNodeOrder(expanded, expanded.getItem("deep")!, expanded.getItem("photos")!) < 0);
  assert.ok(compareNodeOrder(expanded, expanded.getItem("docs")!, expanded.getItem("deep")!) < 0);
});
