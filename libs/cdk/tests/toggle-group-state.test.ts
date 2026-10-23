// Tests for state/toggle-group.ts (react-stately `useToggleGroupState` port; upstream has no state suite —
// cases follow the selection rules of react-aria-components test/ToggleButtonGroup.test.js and the
// `toggleKey` branches of useToggleGroupState.ts). Rivet additions: two-way Signal `selectedKeys`, resume-table round trip, live `isDisabled` getter.
import { describe, expect, it, jest } from "@rivetjs/testing/jest";
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { createToggleGroupState, isGroupDisabled, isKeySelected, selectedKeysOf, setSelected, setSelectedKeys, toggleKey } from "../state/toggle-group.ts";
import type { Key } from "../collections/types.ts";

const keys = (state: ReturnType<typeof createToggleGroupState>) => [...untrack(() => selectedKeysOf(state))];

describe("createToggleGroupState", () => {
  it("defaults: single selection, enabled, empty", () => {
    const state = createToggleGroupState();
    expect(state.selectionMode).toBe("single");
    expect(state.isDisabled).toBe(false);
    expect(keys(state)).toEqual([]);
  });

  it("uncontrolled single selection replaces the key and allows deselecting", () => {
    const onSelectionChange = jest.fn();
    const state = createToggleGroupState({ onSelectionChange });
    toggleKey(state, "bar");
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["bar"]));
    expect(keys(state)).toEqual(["bar"]);
    toggleKey(state, "foo");
    expect(keys(state)).toEqual(["foo"]);
    toggleKey(state, "foo");
    expect(keys(state)).toEqual([]);
    expect(onSelectionChange).toHaveBeenCalledTimes(3);
  });

  it("single + disallowEmptySelection keeps the selected key", () => {
    const onSelectionChange = jest.fn();
    const state = createToggleGroupState({ defaultSelectedKeys: ["foo"], disallowEmptySelection: true, onSelectionChange });
    toggleKey(state, "foo");
    expect(keys(state)).toEqual(["foo"]);
    // useControlledState: a fresh Set is never Object.is the current one → onChange still fires.
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });

  it("uncontrolled multiple selection adds and removes keys", () => {
    const onSelectionChange = jest.fn();
    const state = createToggleGroupState({ selectionMode: "multiple", onSelectionChange });
    toggleKey(state, "bar");
    toggleKey(state, "foo");
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["bar", "foo"]));
    expect(keys(state)).toEqual(["bar", "foo"]);
    toggleKey(state, "bar");
    expect(keys(state)).toEqual(["foo"]);
  });

  it("multiple + disallowEmptySelection keeps the last key", () => {
    const state = createToggleGroupState({ selectionMode: "multiple", defaultSelectedKeys: ["foo"], disallowEmptySelection: true });
    toggleKey(state, "foo");
    expect(keys(state)).toEqual(["foo"]);
    toggleKey(state, "bar");
    toggleKey(state, "foo");
    expect(keys(state)).toEqual(["bar"]);
  });

  it("controlled (plain) selectedKeys only reports changes", () => {
    const onSelectionChange = jest.fn();
    const state = createToggleGroupState({ selectionMode: "multiple", selectedKeys: ["foo"], onSelectionChange });
    toggleKey(state, "bar");
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["foo", "bar"]));
    expect(keys(state)).toEqual(["foo"]);
    expect(state.controlled).toBe(true);
  });

  it("controlled empty single selection stays empty", () => {
    const onSelectionChange = jest.fn();
    const state = createToggleGroupState({ selectedKeys: [], onSelectionChange });
    toggleKey(state, "bar");
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["bar"]));
    expect(isKeySelected(state, "bar")).toBe(false);
  });

  it("two-way Signal selectedKeys is written on change", () => {
    const selected: Signal<Iterable<Key>> = signal<Iterable<Key>>(new Set(["foo"]));
    const state = createToggleGroupState({ selectionMode: "multiple", selectedKeys: selected });
    expect(isKeySelected(state, "foo")).toBe(true);
    toggleKey(state, "bar");
    expect([...untrack(selected)]).toEqual(["foo", "bar"]);
    selected.set(["baz"]);
    expect(keys(state)).toEqual(["baz"]);
  });

  it("setSelected toggles only when the value differs", () => {
    const onSelectionChange = jest.fn();
    const state = createToggleGroupState({ selectionMode: "multiple", onSelectionChange });
    setSelected(state, "a", false);
    expect(onSelectionChange).not.toHaveBeenCalled();
    setSelected(state, "a", true);
    setSelected(state, "a", true);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(keys(state)).toEqual(["a"]);
  });

  it("setSelectedKeys replaces the selection", () => {
    const state = createToggleGroupState({ selectionMode: "multiple", defaultSelectedKeys: ["a"] });
    setSelectedKeys(state, new Set(["b", "c"]));
    expect(keys(state)).toEqual(["b", "c"]);
  });

  it("isGroupDisabled reads the live source (live props); state.isDisabled is the value at creation", () => {
    const disabled = signal(false);
    const live = {
      get isDisabled() {
        return disabled();
      },
    };
    const state = createToggleGroupState(live, live);
    expect(isGroupDisabled(state)).toBe(false);
    disabled.set(true);
    expect(isGroupDisabled(state)).toBe(true);
    expect(state.isDisabled).toBe(false);
    expect(isGroupDisabled(createToggleGroupState({ isDisabled: true }))).toBe(true);
  });

  describe("selectedKey (Rivet extension)", () => {
    it("defaultSelectedKey seeds the uncontrolled selection", () => {
      const state = createToggleGroupState({ defaultSelectedKey: "b" });
      expect(keys(state)).toEqual(["b"]);
      toggleKey(state, "c");
      expect(keys(state)).toEqual(["c"]);
    });

    it("a plain selectedKey is controlled: only onSelectionChange reports", () => {
      const onSelectionChange = jest.fn();
      const state = createToggleGroupState({ selectedKey: "a", onSelectionChange });
      expect(keys(state)).toEqual(["a"]);
      toggleKey(state, "b");
      expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["b"]));
      expect(keys(state)).toEqual(["a"]);
      expect(keys(createToggleGroupState({ selectedKey: null }))).toEqual([]);
    });

    it("a Signal<Key | null> is two-way: written with the new key, null when emptied", () => {
      const key: Signal<Key | null> = signal<Key | null>("a");
      const state = createToggleGroupState({ selectedKey: key });
      expect(keys(state)).toEqual(["a"]);
      toggleKey(state, "b");
      expect(key()).toBe("b");
      expect(keys(state)).toEqual(["b"]);
      toggleKey(state, "b");
      expect(key()).toBe(null);
      expect(keys(state)).toEqual([]);
      key.set(3);
      expect(isKeySelected(state, 3)).toBe(true);
    });

    it("disallowEmptySelection keeps the signal key; selectedKeys wins over selectedKey", () => {
      const key = signal<Key | null>("a");
      const state = createToggleGroupState({ selectedKey: key, disallowEmptySelection: true });
      toggleKey(state, "a");
      expect(key()).toBe("a");
      const both = createToggleGroupState({ selectedKeys: ["x"], selectedKey: "y" });
      expect(keys(both)).toEqual(["x"]);
    });
  });
});
