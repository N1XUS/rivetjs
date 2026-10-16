// Ported from React Stately (react-stately test/combobox/useComboBoxState.test.js), Apache-2.0, © Adobe.
// Rivet: `renderHook` + `act` → the state factory + free functions (every action runs the update
// loop); `rerender` with new items → write the items signal + `comboUpdate(state)`. A plain
// `inputValue` / `selectedKey` is controlled (never written), as upstream.
import { describe, it, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { Item } from "@rivetjs/cdk/collections/builder";
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import {
  closeCombo,
  comboBoxSelectionState,
  comboDisplayedCollection,
  comboSelectionChange,
  createComboBoxCore,
  comboSelectedKey,
  comboSelectionManager,
  comboUpdate,
  commitCombo,
  createComboBoxState,
  openCombo,
  revertCombo,
  setComboFocused,
  setComboFocusedKey,
  setComboInputValue,
  toggleCombo,
  type ComboBoxStateProps,
} from "../state/combobox.ts";

type Row = { id: string | number; name: string };
const render = (item: Row) => Item({ children: item.name });

function spy<A extends unknown[]>() {
  const calls: A[] = [];
  const fn = (...args: A) => void calls.push(args);
  return Object.assign(fn, { calls });
}

describe("useComboBoxState tests", () => {
  describe("open state", () => {
    let onOpenChange: ReturnType<typeof spy<[boolean, string | undefined]>>;
    let defaultProps: ComboBoxStateProps<Row>;
    beforeEach(() => {
      onOpenChange = spy();
      defaultProps = { items: [{ id: 1, name: "one" }], children: render, onOpenChange };
    });

    it("should be closed by default", () => {
      const state = createComboBoxState(defaultProps);
      assert.equal(state.isOpen(), false);
      openCombo(state);
      assert.equal(state.isOpen(), true);
      assert.deepEqual(onOpenChange.calls.at(-1), [true, undefined]);
      closeCombo(state);
      assert.equal(state.isOpen(), false);
      assert.deepEqual(onOpenChange.calls.at(-1), [false, undefined]);
    });

    it("onOpenChange should return the reason that open was called", () => {
      const state = createComboBoxState(defaultProps);
      openCombo(state, undefined, "focus");
      assert.equal(state.isOpen(), true);
      assert.deepEqual(onOpenChange.calls.at(-1), [true, "focus"]);
      closeCombo(state);
      assert.equal(state.isOpen(), false);
      assert.deepEqual(onOpenChange.calls.at(-1), [false, undefined]);
      openCombo(state, undefined, "input");
      assert.equal(state.isOpen(), true);
      assert.deepEqual(onOpenChange.calls.at(-1), [true, "input"]);
      closeCombo(state);
      openCombo(state, undefined, "manual");
      assert.equal(state.isOpen(), true);
      assert.deepEqual(onOpenChange.calls.at(-1), [true, "manual"]);
    });

    it("onOpenChange should return the reason that toggle was called when opening", () => {
      const state = createComboBoxState(defaultProps);
      toggleCombo(state, undefined, "focus");
      assert.equal(state.isOpen(), true);
      assert.deepEqual(onOpenChange.calls.at(-1), [true, "focus"]);
      toggleCombo(state, undefined, "focus");
      assert.equal(state.isOpen(), false);
      assert.deepEqual(onOpenChange.calls.at(-1), [false, undefined]);
      toggleCombo(state, undefined, "input");
      assert.equal(state.isOpen(), true);
      assert.deepEqual(onOpenChange.calls.at(-1), [true, "input"]);
      closeCombo(state);
      toggleCombo(state, undefined, "manual");
      assert.equal(state.isOpen(), true);
      assert.deepEqual(onOpenChange.calls.at(-1), [true, "manual"]);
    });
  });

  describe("values", () => {
    let onInputChange: ReturnType<typeof spy<[string]>>;
    let defaultProps: ComboBoxStateProps<Row>;
    beforeEach(() => {
      onInputChange = spy();
      defaultProps = { items: [{ id: 1, name: "one" }], children: render, onInputChange };
    });

    it("can have a default value", () => {
      const state = createComboBoxState({ ...defaultProps, defaultInputValue: "hello" });
      assert.equal(state.inputValue(), "hello");
    });

    it("fires an event when the value is changed and updates if uncontrolled", () => {
      const state = createComboBoxState({ ...defaultProps, defaultInputValue: "hello" });
      assert.equal(state.inputValue(), "hello");
      assert.equal(onInputChange.calls.length, 0);
      setComboInputValue(state, "hellow");
      assert.equal(state.inputValue(), "hellow");
      assert.deepEqual(onInputChange.calls.at(-1), ["hellow"]);
    });

    it("does not change selection on close", () => {
      const state = createComboBoxState(defaultProps);
      openCombo(state);
      setComboFocusedKey(state, 1);
      closeCombo(state);
      assert.notEqual(comboSelectedKey(state), 1);
    });

    it("starts blank if no (default) value", () => {
      const state = createComboBoxState(defaultProps);
      assert.equal(state.inputValue(), "");
      assert.equal(onInputChange.calls.length, 0);
      setComboInputValue(state, "h");
      assert.equal(state.inputValue(), "h");
      assert.deepEqual(onInputChange.calls.at(-1), ["h"]);
    });

    it("can be controlled", () => {
      const state = createComboBoxState({ ...defaultProps, inputValue: "hello" });
      assert.equal(state.inputValue(), "hello");
      assert.equal(onInputChange.calls.length, 0);
      setComboInputValue(state, "hellow");
      assert.equal(state.inputValue(), "hello");
      assert.deepEqual(onInputChange.calls.at(-1), ["hellow"]);
    });

    it("Rivet: a Signal inputValue is two-way", () => {
      const input = signal("hello");
      const state = createComboBoxState({ ...defaultProps, inputValue: input });
      setComboInputValue(state, "hellow");
      assert.equal(input(), "hellow");
      assert.deepEqual(onInputChange.calls.at(-1), ["hellow"]);
    });
  });

  describe("collection", () => {
    let onSelectionChange: ReturnType<typeof spy<[string | number | null]>>;
    let defaultProps: ComboBoxStateProps<Row>;
    beforeEach(() => {
      onSelectionChange = spy();
      defaultProps = {
        items: [
          { id: "0", name: "one" },
          { id: "1", name: "onomatopoeia" },
        ],
        children: render,
        onSelectionChange,
      };
    });

    it("support selectedKey", () => {
      const state = createComboBoxState({ ...defaultProps, selectedKey: "0" });
      const m = () => comboSelectionManager(state);
      assert.equal(m().selectionMode, "single");
      assert.ok(m().selectedKeys.has("0"));
      assert.ok(!m().selectedKeys.has("1"));
      m().replaceSelection("1");
      assert.ok(m().selectedKeys.has("0"));
      assert.ok(!m().selectedKeys.has("1"));
      assert.deepEqual(onSelectionChange.calls.at(-1), ["1"]);
    });

    it("support defaultSelectedKey", () => {
      const state = createComboBoxState({ ...defaultProps, defaultSelectedKey: "0" });
      const m = () => comboSelectionManager(state);
      assert.equal(m().selectionMode, "single");
      assert.ok(m().selectedKeys.has("0"));
      assert.ok(!m().selectedKeys.has("1"));
      m().replaceSelection("1");
      assert.ok(m().selectedKeys.has("1"));
      assert.ok(!m().selectedKeys.has("0"));
      assert.deepEqual(onSelectionChange.calls.at(-1), ["1"]);
    });

    it("supports default no selection", () => {
      const state = createComboBoxState(defaultProps);
      const m = () => comboSelectionManager(state);
      assert.equal(m().selectionMode, "single");
      assert.equal(m().selectedKeys.size, 0);
      m().replaceSelection("1");
      assert.ok(m().selectedKeys.has("1"));
      assert.ok(!m().selectedKeys.has("0"));
      assert.deepEqual(onSelectionChange.calls.at(-1), ["1"]);
    });

    it("does not fire onSelectionChange on blur when fully controlled values are already synced", () => {
      const state = createComboBoxState({ ...defaultProps, selectedKey: "1", inputValue: "onomatopoeia" });
      setComboFocused(state, false);
      assert.equal(onSelectionChange.calls.length, 0);
    });

    it("fires onSelectionChange on blur when fully controlled inputValue is out of sync", () => {
      const state = createComboBoxState({ ...defaultProps, selectedKey: "1", inputValue: "onom" });
      setComboFocused(state, false);
      assert.equal(onSelectionChange.calls.length, 1);
      assert.deepEqual(onSelectionChange.calls[0], ["1"]);
    });

    it("won't update the returned collection if the combobox is closed (uncontrolled items)", () => {
      const filter = createFilter({ sensitivity: "base" }, "en-US");
      const state = createComboBoxState({
        ...defaultProps,
        items: null,
        defaultItems: [
          { id: "0", name: "one" },
          { id: "1", name: "onomatopoeia" },
        ],
        defaultInputValue: "",
        defaultFilter: filter.contains,
      });
      const collection = () => comboDisplayedCollection(state);
      assert.equal(collection().size, 2);
      assert.equal(state.inputValue(), "");

      openCombo(state);
      setComboInputValue(state, "onom");
      assert.equal(state.inputValue(), "onom");
      assert.equal(collection().size, 1);
      assert.equal(collection().getItem("1")!.rendered, "onomatopoeia");

      // The input value updates, but the returned collection still only contains onomatopoeia
      setComboFocused(state, false);
      assert.equal(collection().size, 1);
      assert.equal(state.inputValue(), "");
      assert.equal(collection().getItem("1")!.rendered, "onomatopoeia");

      // Subsequent calls that would close the menu don't update the tracked lastCollection
      commitCombo(state);
      assert.equal(collection().size, 1);
      assert.equal(state.inputValue(), "");
      assert.equal(collection().getItem("1")!.rendered, "onomatopoeia");

      closeCombo(state);
      assert.equal(collection().size, 1);
      assert.equal(state.inputValue(), "");

      revertCombo(state);
      assert.equal(collection().size, 1);
      assert.equal(state.inputValue(), "");
      assert.equal(collection().getItem("1")!.rendered, "onomatopoeia");

      openCombo(state);
      assert.equal(collection().size, 2);
    });

    it("won't update the returned collection if the combobox is closed (controlled items)", () => {
      const initial: Row[] = [
        { id: "0", name: "one" },
        { id: "1", name: "onomatopoeia" },
      ];
      const items = signal<readonly Row[]>(initial);
      const state = createComboBoxState({ ...defaultProps, items });
      const collection = () => comboDisplayedCollection(state);
      assert.equal(collection().size, 2);

      openCombo(state);
      items.set([{ id: "1", name: "onomatopoeia" }]);
      comboUpdate(state);
      // Returned collection reflects the items provided by the user since the combobox is open
      assert.equal(collection().size, 1);
      assert.equal(collection().getItem("1")!.rendered, "onomatopoeia");

      setComboFocused(state, false);
      // Returned collection reflects the old items provided by the user when the combobox is closed
      assert.equal(collection().size, 1);
      assert.equal(collection().getItem("1")!.rendered, "onomatopoeia");
      items.set(initial);
      comboUpdate(state);
      assert.equal(collection().size, 1);
      assert.equal(collection().getItem("1")!.rendered, "onomatopoeia");

      // Subsequent calls that would close the menu don't update the tracked lastCollection
      commitCombo(state);
      assert.equal(collection().size, 1);
      assert.equal(state.inputValue(), "");
      closeCombo(state);
      assert.equal(collection().size, 1);
      revertCombo(state);
      assert.equal(collection().size, 1);
      assert.equal(collection().getItem("1")!.rendered, "onomatopoeia");

      // When the combobox is opened again, the returned collection of items updates
      openCombo(state);
      assert.equal(collection().size, 2);
    });
  });

  describe("controlled items (async loading)", () => {
    it("should re-open the menu when controlled items go from empty to non-empty", () => {
      const onOpenChange = spy<[boolean, string | undefined]>();
      const items = signal<readonly Row[]>([{ id: 1, name: "Luke Skywalker" }]);
      const state = createComboBoxState({ items, children: render, onOpenChange });

      setComboFocused(state, true);
      openCombo(state, null, "input");
      assert.equal(state.isOpen(), true);

      // Simulate async load returning empty results (e.g. user typed "luka")
      items.set([]);
      comboUpdate(state);
      // Menu closes on empty collection
      assert.equal(state.isOpen(), false);

      // Simulate async load returning results again (e.g. user backspaced to "luk")
      items.set([{ id: 1, name: "Luke Skywalker" }]);
      comboUpdate(state);
      assert.equal(state.isOpen(), true);
      assert.equal(comboDisplayedCollection(state).size, 1);
      assert.deepEqual(onOpenChange.calls.at(-1), [true, "input"]);
    });

    it("should not re-open after user dismisses with Escape (revert)", () => {
      const onOpenChange = spy<[boolean, string | undefined]>();
      const items = signal<readonly Row[]>([{ id: 1, name: "Luke Skywalker" }]);
      const state = createComboBoxState({ items, children: render, onOpenChange });

      setComboFocused(state, true);
      openCombo(state, null, "input");
      assert.equal(state.isOpen(), true);

      items.set([]);
      comboUpdate(state);
      assert.equal(state.isOpen(), false);

      // User presses Escape (revert) while menu is closed
      revertCombo(state);

      // Async returns items — menu should NOT re-open because user explicitly dismissed
      items.set([{ id: 1, name: "Luke Skywalker" }]);
      comboUpdate(state);
      assert.equal(state.isOpen(), false);
    });

    it("should still close the menu when uncontrolled items are empty", () => {
      const onOpenChange = spy<[boolean, string | undefined]>();
      const contains = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase());
      const state = createComboBoxState({ defaultItems: [{ id: 1, name: "Luke Skywalker" }], children: render, onOpenChange, defaultFilter: contains });

      setComboFocused(state, true);
      openCombo(state, null, "input");
      assert.equal(state.isOpen(), true);

      // Type something that filters to zero results
      setComboInputValue(state, "zzz");
      // Menu should close because items are uncontrolled and filtered to empty
      assert.equal(state.isOpen(), false);
    });
  });
});

describe("useComboBoxState: Rivet", () => {
  it("serializable core: JSON-safe state fields (no class instances)", () => {
    const state = createComboBoxState({ defaultItems: [{ id: "a", name: "Alpha" }], children: render, defaultSelectedKey: "a" });
    assert.equal(state.inputValue(), "Alpha", "SSR input value from the selected item's textValue");
    for (const [key, value] of Object.entries(state)) {
      if (key === "selectionState" || key === "children" || key === "defaultItems" || key === "validation") continue;
      if (value && typeof value === "object") assert.ok(Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value), key);
    }
  });

  it("multiple: selection toggles, menu stays open, input text kept", () => {
    const state = createComboBoxState<Row, "multiple">({
      selectionMode: "multiple",
      defaultItems: [
        { id: "a", name: "Alpha" },
        { id: "b", name: "Beta" },
      ],
      children: render,
      filterLocale: "en-US",
    });
    setComboFocused(state, true);
    setComboInputValue(state, "a");
    assert.equal(state.isOpen(), true);
    comboSelectionManager(state).toggleSelection("a");
    assert.deepEqual(state.value(), ["a"]);
    assert.equal(state.isOpen(), true, "multiple stays open");
    comboSelectionManager(state).toggleSelection("b");
    assert.deepEqual(state.value(), ["a", "b"]);
    revertCombo(state);
    assert.deepEqual(state.value(), ["a", "b"], "Escape keeps the selection");
  });

  it("core and { ...core, selectionState } views share one instance (frozen collection after close)", () => {
    const core = createComboBoxCore<Row>({
      defaultItems: [
        { id: "a", name: "Alpha" },
        { id: "b", name: "Beta" },
      ],
      children: render,
      filterLocale: "en-US",
    });
    const view = { ...core, selectionState: comboBoxSelectionState(core, { onSelectionChange: (keys) => comboSelectionChange(core, keys) }) };
    setComboFocused(view, true);
    setComboInputValue(view, "al");
    assert.equal(core.isOpen(), true);
    assert.equal(comboDisplayedCollection(core).size, 1);
    closeCombo(view);
    assert.equal(core.isOpen(), false);
    assert.equal(core.inputValue(), "");
    // While closing, the menu keeps showing what it showed (the core reads the view's frozen collection).
    assert.equal(comboDisplayedCollection(core).size, 1);
  });
});
