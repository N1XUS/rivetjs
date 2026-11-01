// `_adapters` SelectionManager copies: `setFocusedKey` writes the child focus strategy and the key in one batch,
// strategy first (react-stately `useMultipleSelectionState.setFocusedKey`; `selection/state.ts` does the same).
import { describe, expect, it } from "vitest";
import { createRoot, effect } from "@rivetjs/reactivity";
import { ListCollection, buildNodes, createMultipleSelectionState } from "../_adapters/collections.ts";
import { SelectionManager } from "../_adapters/selection-manager.ts";
import * as grid from "../_adapters/grid-selection.ts";

const observe = (state: { focusedKey: () => unknown; childFocusStrategy: () => unknown }) => {
  const seen: string[] = [];
  const root = createRoot(() => effect(() => void seen.push(`${String(state.focusedKey())}/${String(state.childFocusStrategy())}`)));
  return { seen, dispose: () => root.dispose() };
};

describe("_adapters setFocusedKey", () => {
  it("menu / select SelectionManager: no (new key, old strategy) intermediate", () => {
    const state = createMultipleSelectionState({ selectionMode: "single" });
    const collection = new ListCollection(buildNodes([{ key: "a" }, { key: "b" }] as never));
    const manager = new SelectionManager(collection, state);
    manager.setFocusedKey("a", "first");
    const { seen, dispose } = observe(state);
    manager.setFocusedKey("b", "last");
    dispose();
    expect(seen).toEqual(["a/first", "b/last"]);
  });

  it("grid-selection setFocusedKey: no (new key, old strategy) intermediate", () => {
    const state = grid.createMultipleSelectionState({});
    grid.setFocusedKey(state, "a", "first");
    const { seen, dispose } = observe(state);
    grid.setFocusedKey(state, "b", "last");
    dispose();
    expect(seen).toEqual(["a/first", "b/last"]);
  });
});
