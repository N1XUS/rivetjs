// Browser fixture: react-aria's selection `List` story (stories/selection/List.tsx) on the Rivet
// ports — useListState internals (builder + ListCollection + multiple selection state),
// useSelectableList on the <ul>, useSelectableItem on each <li>. Bundled by esbuild for Playwright.
import { effect } from "@rivetjs/reactivity";
import { CollectionBuilder, Item } from "../../collections/builder.ts";
import { ListCollection } from "../../collections/list.ts";
import type { FocusStrategy, Key, Selection, SelectionBehavior, SelectionMode } from "../../collections/types.ts";
import { createMultipleSelectionState } from "../../selection/state.ts";
import { SelectionManager } from "../../selection/manager.ts";
import { useCollectionId } from "../../selection/utils.ts";
import { collectionTabIndex, selectableCollectionAutoFocus } from "../../selection/selectable-collection.ts";
import {
  selectableListBlur,
  selectableListFocus,
  selectableListKeyDown,
  selectableListKeyDownCapture,
  selectableListMouseDown,
  selectableListOptions,
  type AriaSelectableListOptions,
} from "../../selection/selectable-list.ts";
import {
  selectableItemClick,
  selectableItemDoubleClick,
  selectableItemFocus,
  selectableItemKeyDown,
  selectableItemKeyUp,
  selectableItemPointerDown,
  selectableItemPointerUp,
  type SelectableItemOptions,
} from "../../selection/selectable-item.ts";

export interface ListProps {
  items: { key?: Key; label: string }[];
  selectionMode?: SelectionMode;
  selectionBehavior?: SelectionBehavior;
  defaultSelectedKeys?: Key[];
  disabledKeys?: Key[];
  autoFocus?: boolean | FocusStrategy;
  shouldFocusWrap?: boolean;
  selectOnFocus?: boolean;
  orientation?: "vertical" | "horizontal";
  label?: string;
  onAction?: boolean;
}

let lists = 0;

export function mountList(container: HTMLElement, props: ListProps) {
  const changes: Selection[] = [];
  const actions: Key[] = [];
  const state = createMultipleSelectionState({
    selectionMode: props.selectionMode,
    selectionBehavior: props.selectionBehavior,
    defaultSelectedKeys: props.defaultSelectedKeys,
    disabledKeys: props.disabledKeys,
    onSelectionChange: (keys) => void changes.push(keys === "all" ? "all" : new Set(keys)),
  });
  const collection = new ListCollection(
    new CollectionBuilder<object>().build({ children: props.items.map((item) => Item({ key: item.key, children: item.label })) }),
  );
  const manager = () => new SelectionManager(collection, state);
  const id = useCollectionId(collection, "list" + ++lists);

  const ul = document.createElement("ul");
  ul.setAttribute("role", "listbox");
  ul.setAttribute("aria-label", props.label ?? "test listbox");
  ul.dataset.collection = id;
  container.appendChild(ul);

  const listOptions = (): AriaSelectableListOptions => ({
    selectionManager: manager(),
    collection,
    disabledKeys: state.disabledKeys,
    selectOnFocus: props.selectOnFocus ?? true,
    shouldFocusWrap: props.shouldFocusWrap,
    autoFocus: props.autoFocus,
    orientation: props.orientation,
    ref: ul,
  });
  ul.addEventListener("keydown", (e) => selectableListKeyDownCapture(listOptions(), e), true);
  ul.addEventListener("keydown", (e) => selectableListKeyDown(listOptions(), e));
  ul.addEventListener("focusin", (e) => selectableListFocus(listOptions(), e));
  ul.addEventListener("focusout", (e) => selectableListBlur(listOptions(), e));
  ul.addEventListener("mousedown", (e) => selectableListMouseDown(listOptions(), e));
  effect(() => {
    const t = collectionTabIndex(manager());
    if (t == null) ul.removeAttribute("tabindex");
    else ul.tabIndex = t;
  });

  for (const node of collection) {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.textContent = String(node.rendered);
    li.dataset.collection = id;
    li.dataset.key = String(node.key);
    if (typeof node.key === "number") li.dataset.keyType = "number";
    ul.appendChild(li);
    const itemOptions = (): SelectableItemOptions => ({
      selectionManager: manager(),
      key: node.key,
      ref: li,
      onAction: props.onAction ? () => void actions.push(node.key) : undefined,
    });
    li.addEventListener("keydown", (e) => selectableItemKeyDown(itemOptions(), e));
    li.addEventListener("keyup", (e) => selectableItemKeyUp(itemOptions(), e));
    li.addEventListener("pointerdown", (e) => selectableItemPointerDown(itemOptions(), e));
    li.addEventListener("pointerup", (e) => selectableItemPointerUp(itemOptions(), e));
    li.addEventListener("click", (e) => selectableItemClick(itemOptions(), e));
    li.addEventListener("dblclick", (e) => selectableItemDoubleClick(itemOptions(), e));
    li.addEventListener("focus", (e) => selectableItemFocus(itemOptions(), e));
    effect(() => {
      const m = manager();
      if (m.isSelected(node.key)) li.setAttribute("aria-selected", "true");
      else li.removeAttribute("aria-selected");
      if (m.isDisabled(node.key)) {
        li.removeAttribute("tabindex");
        li.setAttribute("aria-disabled", "true");
      } else li.tabIndex = m.focusedKey === node.key ? 0 : -1;
    });
  }
  if (props.autoFocus) selectableCollectionAutoFocus(selectableListOptions(listOptions()));
  return { changes, actions, state };
}

(globalThis as { mountList?: typeof mountList }).mountList = mountList;
