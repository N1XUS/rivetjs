// Rivet public imperative adapters: DOM collections and React Aria selection handler bags.
import { afterEach, beforeEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";
import { domItems, keyOf, itemText, isDisabledItem } from "@rivetjs/cdk/collections";
import { CollectionBuilder, Item } from "@rivetjs/cdk/collections/builder";
import { ListCollection } from "@rivetjs/cdk/collections/list";
import { createMultipleSelectionState, getSelection } from "@rivetjs/cdk/selection/state";
import { SelectionManager } from "@rivetjs/cdk/selection/manager";
import { useSelectableList } from "@rivetjs/cdk/selection/selectable-list";
import { useSelectableCollection, selectableCollectionUpdated, selectableCollectionVirtualFocus } from "@rivetjs/cdk/selection/selectable-collection";
import { useTypeSelect, typeSelectSearch, resetTypeSelect } from "@rivetjs/cdk/selection/type-select";

const dom = installDom();
beforeEach(() => dom.reset());
afterEach(() => vi.useRealTimers());

test("DOM items skip hidden ancestors but preserve order and explicit text/disabled metadata", () => {
  document.body.innerHTML = `<div id="list"><button data-key="a"> Apple </button><div hidden><button data-key="b">Banana</button></div><button data-key="c" hidden>Cherry</button><button data-key="d" aria-disabled="true" data-text="Date fruit">Date</button><button data-key="e" disabled>Fig</button></div>`;
  const items = domItems(document.querySelector("#list")!, "button");
  assert.deepEqual(items.map(keyOf), ["a", "d", "e"]);
  assert.deepEqual(items.map(itemText), ["Apple", "Date fruit", "Fig"]);
  assert.deepEqual(items.map(isDisabledItem), [false, true, true]);
  assert.equal(keyOf(document.createElement("div")), null);
});

function setup() {
  const collection = new ListCollection(
    new CollectionBuilder<object>().build({ children: ["Apple", "Apricot", "Banana"].map((label) => Item({ key: label, children: label })) }),
  );
  const state = createMultipleSelectionState({ selectionMode: "single" });
  const selectionManager = new SelectionManager(collection, state);
  const ref = document.createElement("div");
  document.body.append(ref);
  return { collection, state, selectionManager, ref, disabledKeys: new Set<string>(), shouldUseVirtualFocus: true };
}

test("useSelectableList wires keyboard navigation, disabled skipping and selection", () => {
  const options = setup();
  options.disabledKeys.add("Apricot");
  options.selectionManager.setFocused(true);
  options.selectionManager.setFocusedKey("Apple");
  const { listProps } = useSelectableList({ ...options, selectOnFocus: true });
  options.ref.addEventListener("keydown", listProps.onKeyDown);
  options.ref.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  assert.equal(options.selectionManager.focusedKey, "Banana");
  assert.deepEqual([...getSelection(options.state)!], ["Banana"]);
  assert.equal(listProps.tabIndex, undefined);
});

test("useSelectableCollection wires blur and suppresses scrollbar mousedown", () => {
  const options = setup();
  const { collectionProps } = useSelectableCollection({ ...options, keyboardDelegate: {}, collectionId: "fruit" });
  assert.equal(collectionProps["data-collection"], "fruit");
  options.selectionManager.setFocused(true);
  options.ref.addEventListener("focusout", collectionProps.onFocusOut);
  options.ref.dispatchEvent(new FocusEvent("focusout", { relatedTarget: document.body }));
  assert.equal(options.selectionManager.isFocused, false);
  options.ref.addEventListener("mousedown", collectionProps.onMouseDown);
  const event = new MouseEvent("mousedown", { cancelable: true });
  options.ref.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
});

test("pending virtual focus resolves to the first newly available item once", () => {
  const options = { ...setup(), keyboardDelegate: { getFirstKey: () => "Banana" } };
  const event = new CustomEvent("virtualfocus", { detail: { focusStrategy: "first" as const } });
  selectableCollectionVirtualFocus(options, event);
  selectableCollectionUpdated(options);
  assert.equal(options.selectionManager.focusedKey, "Banana");
  options.selectionManager.setFocusedKey("Apple");
  selectableCollectionUpdated(options);
  assert.equal(options.selectionManager.focusedKey, "Apple");
});

test("type-select adapter exposes its search, expires the buffer and ignores modified keys", () => {
  vi.useFakeTimers();
  const owner = {};
  let focusedKey: string | null = null;
  const changed: string[] = [];
  const { typeSelectProps } = useTypeSelect(owner, {
    keyboardDelegate: { getKeyForSearch: (search) => ["Apple", "Apricot"].find((label) => label.toLowerCase().startsWith(search.toLowerCase())) ?? null },
    selectionManager: {
      get focusedKey() {
        return focusedKey;
      },
      setFocusedKey(key) {
        focusedKey = String(key);
      },
    },
    onTypeSelect: (key) => changed.push(String(key)),
  });
  typeSelectProps.onKeyDown!(new KeyboardEvent("keydown", { key: "a", cancelable: true }));
  typeSelectProps.onKeyDown!(new KeyboardEvent("keydown", { key: "p", cancelable: true }));
  assert.equal(typeSelectSearch(owner), "ap");
  assert.equal(focusedKey, "Apple");
  typeSelectProps.onKeyDown!(new KeyboardEvent("keydown", { key: "r", ctrlKey: true }));
  assert.equal(typeSelectSearch(owner), "ap");
  assert.equal(changed.length, 2);
  vi.advanceTimersByTime(1000);
  assert.equal(typeSelectSearch(owner), "");
  resetTypeSelect(owner);
  assert.deepEqual(useTypeSelect({}, { keyboardDelegate: {}, selectionManager: { focusedKey: null, setFocusedKey() {} } }).typeSelectProps, {});
});
