// Keyed selection reads (`selection/keyed.ts`, Rivet): SelectionManager / adapter / list-state item reads return
// the upstream values, but a binding re-runs only when its own key's selection / focus changes.
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { createRoot, effect, signal } from "@rivetjs/reactivity";
import { CollectionBuilder, Item } from "../collections/builder.ts";
import { ListCollection } from "../collections/list.ts";
import type { Key, Selection } from "../collections/types.ts";
import { SelectionManager } from "../selection/manager.ts";
import { createMultipleSelectionState, setFocusedKey, setFocused } from "../selection/state.ts";
import { hasFocusedKey, isFocusedKey } from "../selection/keyed.ts";
import { createMultipleSelectionState as createAdapterState, isKeySelected } from "../_adapters/collections.ts";

const KEYS = ["a", "b", "c", "d", "e"];
const list = () => new ListCollection(new CollectionBuilder<object>().build({ children: KEYS.map((k) => Item({ key: k, children: k })) }));

/** One effect per key reading `read(key)`; returns run counts and the last values. */
function track<T>(read: (key: Key) => T) {
  const runs: Record<string, number> = {};
  const values: Record<string, T> = {};
  const root = createRoot((dispose) => {
    for (const k of KEYS)
      effect(() => {
        runs[k] = (runs[k] ?? 0) + 1;
        values[k] = read(k);
      });
    return dispose;
  });
  return { runs, values, dispose: root.value };
}

describe("keyed selection reads", () => {
  it("SelectionManager.isSelected re-runs only the changed keys, values match the selection", () => {
    const selected = signal<Selection>(new Set(["b"]));
    const state = createMultipleSelectionState({ selectionMode: "multiple", selectedKeys: selected, disabledKeys: ["e"] });
    const manager = new SelectionManager(list(), state);
    const t = track((k) => manager.isSelected(k));
    assert.deepEqual(t.values, { a: false, b: true, c: false, d: false, e: false });
    selected.set(new Set(["c"]));
    assert.deepEqual(t.runs, { a: 1, b: 2, c: 2, d: 1, e: 1 });
    assert.deepEqual(t.values, { a: false, b: false, c: true, d: false, e: false });
    // "all": every key re-evaluates; a disabled key is not selected (canSelectItem).
    selected.set("all");
    assert.deepEqual(t.values, { a: true, b: true, c: true, d: true, e: false });
    selected.set(new Set(["a", "e"]));
    // An explicitly listed disabled key reads as selected (upstream `keys.has`).
    assert.deepEqual(t.values, { a: true, b: false, c: false, d: false, e: true });
    t.dispose();
  });

  it("isEmpty re-runs only when emptiness flips", () => {
    const selected = signal<Selection>(new Set());
    const manager = new SelectionManager(list(), createMultipleSelectionState({ selectionMode: "multiple", selectedKeys: selected }));
    let runs = 0,
      empty = true;
    const root = createRoot((dispose) => (effect(() => void (runs++, (empty = manager.isEmpty))), dispose));
    selected.set(new Set(["a"]));
    assert.equal(empty, false);
    selected.set(new Set(["a", "b"]));
    selected.set(new Set(["c"]));
    assert.equal(runs, 2);
    selected.set(new Set());
    assert.equal(empty, true);
    assert.equal(runs, 3);
    root.value();
  });

  it("single-key backing (selectedKey) and focus are keyed", () => {
    const key = signal<Key | null>("a");
    const state = createMultipleSelectionState({ selectionMode: "single", selectedKey: key });
    const manager = new SelectionManager(list(), state);
    const selectedRuns = track((k) => manager.isSelected(k));
    key.set("d");
    assert.deepEqual(selectedRuns.runs, { a: 2, b: 1, c: 1, d: 2, e: 1 });
    assert.equal(selectedRuns.values.d, true);
    const focused = track((k) => isFocusedKey(state, k) && state.isFocused());
    setFocused(state, true);
    setFocusedKey(state, "b");
    setFocusedKey(state, "c");
    assert.deepEqual(focused.runs, { a: 1, b: 3, c: 2, d: 1, e: 1 });
    assert.deepEqual(focused.values, { a: false, b: false, c: true, d: false, e: false });
    selectedRuns.dispose();
    focused.dispose();
  });

  it("adapter isKeySelected is keyed too", () => {
    const selected = signal<Selection>(new Set(["a"]));
    const state = createAdapterState({ selectionMode: "multiple", selectedKeys: selected });
    const t = track((k) => isKeySelected(state, k));
    selected.set(new Set(["a", "e"]));
    assert.deepEqual(t.runs, { a: 1, b: 1, c: 1, d: 1, e: 2 });
    assert.equal(t.values.e, true);
    t.dispose();
  });
  it("hasFocusedKey re-runs only when a focused key appears / disappears", () => {
    const state = createMultipleSelectionState({ selectionMode: "multiple" });
    let runs = 0,
      has = false;
    const root = createRoot((dispose) => (effect(() => void (runs++, (has = hasFocusedKey(state)))), dispose));
    setFocusedKey(state, "a");
    assert.equal(has, true);
    setFocusedKey(state, "b");
    setFocusedKey(state, "c");
    assert.equal(runs, 2);
    setFocusedKey(state, null);
    assert.equal(has, false);
    assert.equal(runs, 3);
    root.value();
  });
});
