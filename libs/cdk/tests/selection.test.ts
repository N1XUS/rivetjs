// Selection state / SelectionManager / ListKeyboardDelegate / typeahead (react-stately selection,
// react-aria selection) and the useTreeState keyboard test (react-stately test/tree), Apache-2.0,
// © Adobe. Behaviour cases follow the upstream implementation; DOM-level cases live in
// selectable-collection.browser.test.ts.
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { CollectionBuilder, Item, Section } from "../collections/builder.ts";
import { ListCollection } from "../collections/list.ts";
import type { Key, Selection } from "../collections/types.ts";
import { SelectionManager } from "../selection/manager.ts";
import { SelectionSet, createMultipleSelectionState, setSelectedKeys, type MultipleSelectionStateProps } from "../selection/state.ts";
import { ListKeyboardDelegate } from "../selection/list-keyboard-delegate.ts";
import { resetTypeSelect, typeSelectKeyDown, typeSelectKeyDownCapture } from "../selection/type-select.ts";
import { createTreeState, toggleTreeKey, treeCollection, treeSelectionManager } from "../collections/tree-state.ts";

const LABELS = ["Aardvark", "Bear", "Cat", "Dog", "Eagle"];
const list = (sections = false) =>
  new ListCollection(
    new CollectionBuilder<object>().build({
      children: sections
        ? [Section({ key: "s1", title: "S1", children: [Item({ key: "a", children: "a" }), Item({ key: "b", children: "b" })] }), Section({ key: "s2", title: "S2", children: [Item({ key: "c", children: "c" })] })]
        : LABELS.map((label) => Item({ key: label, children: label })),
    }),
  );

const setup = (props: MultipleSelectionStateProps = {}, sections = false) => {
  const changes: Selection[] = [];
  const collection = list(sections);
  const state = createMultipleSelectionState({ selectionMode: "multiple", ...props, onSelectionChange: (keys) => (changes.push(keys), props.onSelectionChange?.(keys)) });
  const manager = () => new SelectionManager(collection, state);
  return { state, collection, manager, changes };
};
const keys = (m: SelectionManager) => [...m.selectedKeys];

describe("useMultipleSelectionState (react-stately)", () => {
  it("defaults: none, toggle, empty, focus null", () => {
    const state = createMultipleSelectionState({});
    assert.equal(state.selectionMode, "none");
    assert.equal(state.selectionBehavior(), "toggle");
    assert.equal(state.focusedKey(), null);
    const s = state.selectedKeys();
    assert.ok(s !== "all" && s.size === 0);
  });

  it("uncontrolled defaultSelectedKeys + onSelectionChange", () => {
    const { manager, changes } = setup({ defaultSelectedKeys: ["Bear"] });
    assert.deepEqual(keys(manager()), ["Bear"]);
    manager().toggleSelection("Cat");
    assert.deepEqual(keys(manager()), ["Bear", "Cat"]);
    assert.equal(changes.length, 1);
  });

  it("controlled selectedKeys (plain value): onSelectionChange fires, state does not change", () => {
    const { manager, changes } = setup({ selectedKeys: ["Bear"] });
    manager().toggleSelection("Cat");
    assert.deepEqual(keys(manager()), ["Bear"]);
    assert.deepEqual([...(changes[0] as Set<Key>)], ["Bear", "Cat"]);
  });

  it("two-way selectedKeys signal is written", () => {
    const selected = signal<Selection>(new Set<Key>(["Dog"]));
    const { manager } = setup({ selectedKeys: selected });
    manager().replaceSelection("Eagle");
    assert.deepEqual([...(selected() as Set<Key>)], ["Eagle"]);
  });

  it("same selection does not fire onSelectionChange unless allowDuplicateSelectionEvents", () => {
    const a = setup({ defaultSelectedKeys: ["Cat"] });
    a.manager().replaceSelection("Cat");
    assert.equal(a.changes.length, 0);
    const b = setup({ defaultSelectedKeys: ["Cat"], allowDuplicateSelectionEvents: true });
    b.manager().replaceSelection("Cat");
    assert.equal(b.changes.length, 1);
  });

  it("selectionBehavior replace resets to replace when the selection empties", () => {
    const { manager, state } = setup({ selectionBehavior: "replace", defaultSelectedKeys: ["Cat"] });
    manager().setSelectionBehavior("toggle");
    assert.equal(state.selectionBehavior(), "toggle");
    setSelectedKeys(state, new SelectionSet());
    assert.equal(state.selectionBehavior(), "replace");
  });
});

describe("SelectionManager (react-stately)", () => {
  it("toggle vs replace via select()", () => {
    const toggle = setup();
    toggle.manager().select("Bear");
    toggle.manager().select("Dog");
    assert.deepEqual(keys(toggle.manager()), ["Bear", "Dog"]);
    const replace = setup({ selectionBehavior: "replace" });
    replace.manager().select("Bear");
    replace.manager().select("Dog");
    assert.deepEqual(keys(replace.manager()), ["Dog"]);
    // Touch / virtual pointers always toggle.
    replace.manager().select("Eagle", { pointerType: "touch" });
    assert.deepEqual(keys(replace.manager()), ["Dog", "Eagle"]);
  });

  it("single mode: select replaces, selecting the selected key deselects unless disallowEmptySelection", () => {
    const a = setup({ selectionMode: "single" });
    a.manager().select("Bear");
    a.manager().select("Cat");
    assert.deepEqual(keys(a.manager()), ["Cat"]);
    a.manager().select("Cat");
    assert.deepEqual(keys(a.manager()), []);
    const b = setup({ selectionMode: "single", disallowEmptySelection: true, defaultSelectedKeys: ["Cat"] });
    b.manager().select("Cat");
    assert.deepEqual(keys(b.manager()), ["Cat"]);
    b.manager().clearSelection();
    assert.deepEqual(keys(b.manager()), ["Cat"]);
  });

  it("mode none ignores every selection call", () => {
    const { manager } = setup({ selectionMode: "none" });
    manager().select("Bear");
    manager().extendSelection("Dog");
    manager().selectAll();
    assert.equal(manager().isEmpty, true);
  });

  it("extendSelection: anchor range, shrinking and growing", () => {
    const { manager, state } = setup();
    manager().replaceSelection("Bear");
    manager().extendSelection("Dog");
    assert.deepEqual(keys(manager()), ["Bear", "Cat", "Dog"]);
    assert.equal(state.anchorKey(), "Bear");
    assert.equal(state.currentKey(), "Dog");
    manager().extendSelection("Cat");
    assert.deepEqual(keys(manager()), ["Bear", "Cat"]);
    manager().extendSelection("Aardvark");
    assert.deepEqual(keys(manager()).sort(), ["Aardvark", "Bear"]);
  });

  it("extendSelection skips disabled keys; from 'all' selects only the target", () => {
    const { manager } = setup({ disabledKeys: ["Cat"] });
    manager().replaceSelection("Bear");
    manager().extendSelection("Dog");
    assert.deepEqual(keys(manager()), ["Bear", "Dog"]);
    manager().selectAll();
    manager().extendSelection("Eagle");
    assert.deepEqual(keys(manager()), ["Eagle"]);
  });

  it("disabledKeys / disabledBehavior", () => {
    const all = setup({ disabledKeys: ["Cat"] });
    assert.equal(all.manager().isDisabled("Cat"), true);
    assert.equal(all.manager().canSelectItem("Cat"), false);
    all.manager().toggleSelection("Cat");
    assert.equal(all.manager().isEmpty, true);
    const sel = setup({ disabledKeys: ["Cat"], disabledBehavior: "selection" });
    assert.equal(sel.manager().isDisabled("Cat"), false);
    assert.equal(sel.manager().canSelectItem("Cat"), false);
  });

  it("selectAll stores 'all'; isSelected / isSelectAll / first+last / toggleSelectAll / toggle out of all", () => {
    const { manager, state } = setup({ disabledKeys: ["Eagle"] });
    manager().selectAll();
    assert.equal(state.selectedKeys(), "all");
    assert.equal(manager().isSelectAll, true);
    assert.equal(manager().isSelected("Bear"), true);
    assert.equal(manager().isSelected("Eagle"), false);
    assert.deepEqual(keys(manager()), ["Aardvark", "Bear", "Cat", "Dog"]);
    assert.equal(manager().firstSelectedKey, "Aardvark");
    assert.equal(manager().lastSelectedKey, "Dog");
    manager().toggleSelection("Bear");
    assert.deepEqual(keys(manager()), ["Aardvark", "Cat", "Dog"]);
    manager().toggleSelectAll();
    assert.equal(manager().isSelectAll, true);
    manager().toggleSelectAll();
    assert.equal(manager().isEmpty, true);
  });

  it("sections: getKey maps to items; selectAll keys descend into sections", () => {
    const { manager } = setup({}, true);
    manager().selectAll();
    assert.deepEqual(keys(manager()), ["a", "b", "c"]);
    manager().clearSelection();
    manager().replaceSelection("a");
    manager().extendSelection("c");
    assert.deepEqual(keys(manager()), ["a", "b", "c"]);
  });

  it("setSelectedKeys keeps only the first key in single mode; isSelectionEqual", () => {
    const { manager } = setup({ selectionMode: "single" });
    manager().setSelectedKeys(["Dog", "Eagle"]);
    assert.deepEqual(keys(manager()), ["Dog"]);
    assert.equal(manager().isSelectionEqual(new Set(["Dog"])), true);
    assert.equal(manager().isSelectionEqual(new Set(["Eagle"])), false);
  });

  it("focus state: setFocused / setFocusedKey + childFocusStrategy", () => {
    const { manager, state } = setup();
    manager().setFocused(true);
    manager().setFocusedKey("Cat", "last");
    assert.equal(state.isFocused(), true);
    assert.equal(manager().focusedKey, "Cat");
    assert.equal(manager().childFocusStrategy, "last");
  });
});

describe("ListKeyboardDelegate (react-aria)", () => {
  const delegate = (disabled: Key[] = [], sections = false) => new ListKeyboardDelegate({ collection: list(sections), disabledKeys: new Set(disabled), ref: null, collator: new Intl.Collator("en", { usage: "search", sensitivity: "base" }) });

  it("below / above skip disabled; first / last", () => {
    const d = delegate(["Bear", "Eagle"]);
    assert.equal(d.getKeyBelow("Aardvark"), "Cat");
    assert.equal(d.getKeyAbove("Cat"), "Aardvark");
    assert.equal(d.getKeyBelow("Dog"), null);
    assert.equal(d.getFirstKey(), "Aardvark");
    assert.equal(d.getLastKey(), "Dog");
  });

  it("skips section headers", () => {
    const d = delegate([], true);
    assert.equal(d.getFirstKey(), "a");
    assert.equal(d.getKeyBelow("b"), "c");
    assert.equal(d.getKeyAbove("c"), "b");
  });

  it("vertical stack has no left/right; getKeyForSearch is prefix + collator based", () => {
    const d = delegate();
    assert.equal(d.getKeyLeftOf, undefined);
    assert.equal(d.getKeyRightOf, undefined);
    assert.equal(d.getKeyForSearch("c"), "Cat");
    assert.equal(d.getKeyForSearch("D"), "Dog");
    assert.equal(d.getKeyForSearch("zz"), null);
  });

  it("horizontal: left/right follow direction", () => {
    const ltr = new ListKeyboardDelegate({ collection: list(), ref: null, orientation: "horizontal", direction: "ltr" });
    assert.equal(ltr.getKeyRightOf!("Bear"), "Cat");
    assert.equal(ltr.getKeyLeftOf!("Bear"), "Aardvark");
    const rtl = new ListKeyboardDelegate({ collection: list(), ref: null, orientation: "horizontal", direction: "rtl" });
    assert.equal(rtl.getKeyRightOf!("Bear"), "Aardvark");
  });
});

describe("useTypeSelect (react-aria)", () => {
  const key = (k: string) => {
    const e = { key: k, ctrlKey: false, metaKey: false, altKey: false, currentTarget: null, target: null, prevented: false, stopped: false } as any;
    e.preventDefault = () => (e.prevented = true);
    e.stopPropagation = () => (e.stopped = true);
    return e;
  };

  it("focuses the matching item, accumulates the search, Space continues an active search", () => {
    const { manager, collection } = setup();
    const owner = {};
    const options = { keyboardDelegate: new ListKeyboardDelegate({ collection, ref: null, collator: new Intl.Collator("en", { usage: "search", sensitivity: "base" }) }), selectionManager: manager() };
    const typed: Key[] = [];
    const opts = { ...options, onTypeSelect: (k: Key) => void typed.push(k) };
    assert.equal(typeSelectKeyDown(owner, opts, key(" ")), false, "space alone is not a search");
    const e = key("d");
    assert.equal(typeSelectKeyDown(owner, opts, e), true);
    assert.equal(manager().focusedKey, "Dog");
    assert.ok(e.prevented && e.stopped);
    const space = key(" ");
    assert.equal(typeSelectKeyDownCapture(owner, { ...opts, selectionManager: manager() }, space), true);
    assert.ok(space.prevented);
    assert.equal(typeSelectKeyDown(owner, { ...opts, selectionManager: manager() }, key("x")), false, "no match resets");
    assert.equal(typeSelectKeyDown(owner, { ...opts, selectionManager: manager() }, key("b")), true);
    assert.equal(manager().focusedKey, "Bear");
    assert.deepEqual(typed, ["Dog", "Bear"]);
    resetTypeSelect(owner);
  });

  it("modifier keys never search", () => {
    const { manager, collection } = setup();
    const e = { ...key("c"), ctrlKey: true };
    assert.equal(typeSelectKeyDown({}, { keyboardDelegate: new ListKeyboardDelegate({ collection, ref: null, collator: new Intl.Collator("en", { usage: "search", sensitivity: "base" }) }), selectionManager: manager() }, e), false);
  });
});

describe("useTreeState (react-stately)", () => {
  // TreeExample from stories/tree/useTreeState.stories.tsx.
  const tree = () =>
    createTreeState<object>({
      children: [
        Item({
          key: "1",
          title: "Animals",
          children: [Item({ children: "Aardvark" }), Item({ title: "Bear", children: [Item({ children: "Black Bear" }), Item({ children: "Brown Bear" })] }), Item({ children: "Kangaroo" }), Item({ children: "Snake" })],
        }),
        Item({ key: "2", title: "Fruits", children: [Item({ children: "Apple" }), Item({ children: "Orange" }), Item({ title: "Kiwi", children: [Item({ children: "Golden Kiwi" }), Item({ children: "Fuzzy Kiwi" })] })] }),
      ],
    });
  /** Visible tree items in document order (the rendered treeitems). */
  const visible = (state: ReturnType<typeof tree>) => {
    const collection = treeCollection(state);
    const out: string[] = [];
    for (let key = collection.getFirstKey(); key != null; key = collection.getKeyAfter(key)) out.push(String(collection.getItem(key)!.textValue));
    return out;
  };

  it("should be keyboard navigable", () => {
    const state = tree();
    const delegate = () => new ListKeyboardDelegate({ collection: treeCollection(state), disabledKeys: state.disabledKeys, ref: null });
    // Tab: focus the first item.
    treeSelectionManager(state).setFocusedKey(delegate().getFirstKey());
    assert.equal(visible(state).length, 2);
    assert.equal(treeSelectionManager(state).focusedKey, "1");
    // At Animals, expand (press -> toggleKey).
    toggleTreeKey(state, treeSelectionManager(state).focusedKey!);
    assert.deepEqual(visible(state), ["Animals", "Aardvark", "Bear", "Kangaroo", "Snake", "Fruits"]);
    // Move to Aardvark, then Bear.
    const m = () => treeSelectionManager(state);
    m().setFocusedKey(delegate().getKeyBelow(m().focusedKey!));
    assert.equal(treeCollection(state).getItem(m().focusedKey!)!.textValue, "Aardvark");
    m().setFocusedKey(delegate().getKeyBelow(m().focusedKey!));
    toggleTreeKey(state, m().focusedKey!);
    assert.equal(visible(state).length, 8);
    assert.equal(visible(state).indexOf(String(treeCollection(state).getItem(m().focusedKey!)!.textValue)), 2);
    // Move to Black Bear.
    m().setFocusedKey(delegate().getKeyBelow(m().focusedKey!));
    assert.equal(treeCollection(state).getItem(m().focusedKey!)!.textValue, "Black Bear");
  });

  it("controlled expandedKeys reports onExpandedChange only", () => {
    const changes: Set<Key>[] = [];
    const state = createTreeState<object>({ children: [Item({ key: "x", title: "X", children: [Item({ key: "y", children: "Y" })] })], expandedKeys: [], onExpandedChange: (k) => void changes.push(k) });
    toggleTreeKey(state, "x");
    assert.equal(state.expandedKeys().size, 0);
    assert.deepEqual([...changes[0]!], ["x"]);
  });
});
