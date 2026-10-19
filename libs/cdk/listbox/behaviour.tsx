// Ported from react-aria listbox (packages/react-aria/src/listbox/useListBox.ts, useOption.ts,
// useListBoxSection.ts, utils.ts), Apache-2.0, © Adobe.
// Rivet:
// - Names (no `use*` exports): useListBox → `listBoxProps(props, state)`, useOption → `optionProps(props, state, data)`,
//   useListBoxSection → `listBoxSectionProps(props)`; the hooks' handlers are free functions
//   `listBox<Event>(event, props, state)` wired on the listbox element (one delegated handler set for all options:
//   `closestItem` finds the option and its key; the per-option `useSelectableItem` / `useHover` handlers run from
//   there). `.tsx`: closures created here may be captured by resumed bindings.
// - `listData` (a WeakMap keyed by state upstream) is a plain serializable `ListData` object that ListBox provides
//   through `ListBoxDataContext`; it also carries the signals the delegated handlers write (hovered / pressed key,
//   focus-visible, root focus) so render props and `data-*` bindings stay reactive without per-option handlers.
// - The collection a handler acts on is rebuilt per event: `props.collection()` (a built collection: Select,
//   ComboBox, virtualizers) or the rendered options (`listCollection(state, root)`: DOM-as-collection).
// - `useFocusWithin` → the `focusin` / `focusout` branches; `useLabel` → `labelProps` + `aria-labelledby`.
// - Option actions: the item's own `onAction` is dispatched to the option element as `rv-item-action` (non-bubbling;
//   ListBoxItem listens with `on:rv-item-action` only when it has one, and marks itself `data-rv-action`), then the
//   list's `onAction(key)`, then the bubbling `react-aria-item-action` (useSelectableItem).
// - Option hover callbacks: `rv-hover-start` / `rv-hover-end` events on the option element (same scheme).
// - Items marked `data-rv-long-press` (a long press interaction, `@rivetjs/cdk/morph/item`) select on press up.
// Deviation: no drag and drop (C8).
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import type { Collection, FocusStrategy, Key, KeyboardDelegate, Node, Orientation, SelectionBehavior } from "../collections/types.ts";
import { listCollection, listSelectionManager, type ListState } from "../collections/list-state.ts";
import { getItemCount } from "../collections/nodes.ts";
import { SelectionManager } from "../selection/manager.ts";
import { isFocusedKey } from "../selection/keyed.ts";
import {
  selectableCollectionAutoFocus,
  selectableCollectionBlur,
  selectableCollectionClearVirtualFocus,
  selectableCollectionFocus,
  selectableCollectionKeyDown,
  selectableCollectionKeyDownCapture,
  selectableCollectionMouseDown,
  selectableCollectionVirtualFocus,
  type AriaSelectableCollectionOptions,
  type LinkBehavior,
} from "../selection/selectable-collection.ts";
import { selectableListOptions } from "../selection/selectable-list.ts";
import {
  closestItem,
  selectableItemClick,
  selectableItemDoubleClick,
  selectableItemDragStart,
  selectableItemFocus,
  selectableItemKeyDown,
  selectableItemKeyUp,
  selectableItemPointerCancel,
  selectableItemPointerDown,
  selectableItemPointerUp,
  selectableItemStates,
  type SelectableItemOptions,
} from "../selection/selectable-item.ts";
import { ListKeyboardDelegate, searchCollator } from "../selection/list-keyboard-delegate.ts";
import { isFocusVisible } from "../interactions/focus-visible.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { setDataAttr } from "../utils/data-attrs.tsx";
import { direction as elementDirection } from "../bidi/index.ts";
import type { Router } from "../utils/links.tsx";

export type { LinkBehavior };

/** Data a listbox shares with its options (react-aria `listData`). Plain data + signals + resumable functions. */
export interface ListData {
  id: string;
  shouldSelectOnPressUp?: boolean | undefined;
  shouldFocusOnHover?: boolean | undefined;
  /** May be an accessor (Autocomplete): read at event time / in bindings. */
  shouldUseVirtualFocus?: MaybeAccessor<boolean | undefined>;
  isVirtualized?: boolean | undefined;
  onAction?: ((key: Key) => void) | undefined;
  linkBehavior: LinkBehavior;
  /** useListBox listData `UNSTABLE_itemBehavior` ("action": items with an action never select). */
  UNSTABLE_itemBehavior?: "action" | undefined;
  /** Rivet: the option under a mouse pointer (`data-hovered`). */
  hoveredKey: Signal<Key | null>;
  /** Rivet: the pressed option (`data-pressed`). */
  pressedKey: Signal<Key | null>;
  /** Rivet: whether focus is keyboard-visible (useFocusRing's `isFocusVisible`). */
  focusVisible: Signal<boolean>;
  /** Rivet: whether the listbox element itself has focus (root useFocusRing). */
  isFocused: Signal<boolean>;
  /** The router link options open through (react-aria `useRouter()`, `RouterContext`). */
  router?: Router | undefined;
  /** Rivet (RAC SelectableCollectionContext `filter`): live options hide themselves when it rejects them. */
  filter?: ((textValue: string, node: Node<unknown>) => boolean) | undefined;
}

/** react-aria `getItemId`: the option element id. */
export function getItemId(listId: string, itemKey: Key): string {
  return `${listId}-option-${typeof itemKey === "string" ? itemKey.replace(/\s*/g, "") : "" + itemKey}`;
}

/** react-aria `AriaListBoxOptions` (labeling, selection behaviour, focus and keyboard options). */
export interface AriaListBoxOptions {
  id?: string | undefined;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-details"?: string | undefined;
  /** Whether the listbox (or the first / last option) receives focus on mount (may be an accessor). */
  autoFocus?: MaybeAccessor<boolean | FocusStrategy | undefined>;
  /** Whether focus wraps around at the ends. */
  shouldFocusWrap?: boolean | undefined;
  /** Whether Escape clears the selection. @default "clearSelection" */
  escapeKeyBehavior?: "clearSelection" | "none" | undefined;
  /** How multiple selection behaves. @default "toggle" */
  selectionBehavior?: SelectionBehavior | undefined;
  /** Select on press up instead of press down. */
  shouldSelectOnPressUp?: boolean | undefined;
  /** Whether options receive focus on hover. */
  shouldFocusOnHover?: boolean | undefined;
  /** Handler that is called when a user performs an action on an option. */
  onAction?: ((key: Key) => void) | undefined;
  /** Whether the listbox uses virtual focus (aria-activedescendant); may be an accessor. */
  shouldUseVirtualFocus?: MaybeAccessor<boolean | undefined>;
  /** Whether typeahead is disabled (may be an accessor). */
  disallowTypeAhead?: MaybeAccessor<boolean | undefined>;
  /** The behavior of links in the collection. */
  linkBehavior?: LinkBehavior | undefined;
  /** @private RAC: items with an action are actions only (ComboBox). */
  UNSTABLE_itemBehavior?: "action" | undefined;
  /** The primary orientation of the options. @default "vertical" */
  orientation?: Orientation | undefined;
  /** Layout of the options. @default "stack" */
  layout?: "stack" | "grid" | undefined;
  /** Whether the options are contained in a virtual scroller. */
  isVirtualized?: boolean | undefined;
  /** An optional keyboard delegate (default: a ListKeyboardDelegate over the collection). */
  keyboardDelegate?: KeyboardDelegate | undefined;
  /** Focus events of the listbox (useFocusWithin). */
  onFocus?: ((e: FocusEvent) => void) | undefined;
  onBlur?: ((e: FocusEvent) => void) | undefined;
  onFocusChange?: ((isFocused: boolean) => void) | undefined;
}

/** What the delegated handlers read: the options + the shared list data + the collection accessor. */
export interface ListBoxBehaviourProps extends AriaListBoxOptions {
  data: ListData;
  /** A built collection (Select / ComboBox / filtered); default: the rendered options. */
  collection?: (() => Collection<Node<unknown>>) | null | undefined;
}

/** react-aria useListBox's `linkBehavior` default: "action" with replace, "override" otherwise (toggle cannot be "action"). */
export function listBoxLinkBehavior(selectionBehavior: SelectionBehavior | undefined, linkBehavior?: LinkBehavior): LinkBehavior {
  const behavior = selectionBehavior || "toggle";
  let link = linkBehavior || (behavior === "replace" ? "action" : "override");
  if (behavior === "toggle" && link === "action") link = "override";
  return link;
}

/** Creates the shared list data (react-aria `listData.set(state, …)`). */
export function createListData(props: AriaListBoxOptions, id: string, filter?: ListData["filter"], router?: Router): ListData {
  return {
    router,
    id,
    shouldSelectOnPressUp: props.shouldSelectOnPressUp,
    shouldFocusOnHover: props.shouldFocusOnHover,
    shouldUseVirtualFocus: props.shouldUseVirtualFocus,
    isVirtualized: props.isVirtualized,
    onAction: props.onAction,
    linkBehavior: listBoxLinkBehavior(props.selectionBehavior, props.linkBehavior),
    UNSTABLE_itemBehavior: props.UNSTABLE_itemBehavior,
    hoveredKey: signal<Key | null>(null),
    pressedKey: signal<Key | null>(null),
    focusVisible: signal(false),
    isFocused: signal(false),
    filter,
  };
}

/**
 * react-aria `useListBox` attributes (`listBoxProps` without handlers: wire `listBox<Event>` on the element) and
 * `labelProps` (for a visible label element: `<span id>`). `tabIndex` and `aria-multiselectable` are accessors.
 */
export function listBoxProps(
  props: AriaListBoxOptions & { label?: unknown },
  state: ListState,
  data: ListData,
): { listBoxProps: Record<string, unknown>; labelProps: Record<string, unknown> } {
  const id = data.id;
  // Closures below capture only these (a resumed binding must not capture the props object).
  const virtualFocus = props.shouldUseVirtualFocus;
  const selectionState = state.selectionState;
  const labelId = props.label != null ? id + "-label" : undefined;
  const labelledBy = [props["aria-labelledby"], labelId].filter(Boolean).join(" ") || undefined;
  return {
    labelProps: labelId ? { id: labelId } : {},
    listBoxProps: {
      id,
      role: "listbox",
      "data-collection": id,
      "aria-label": props["aria-label"],
      "aria-labelledby": labelledBy,
      "aria-describedby": props["aria-describedby"],
      "aria-details": props["aria-details"],
      "aria-orientation": props.orientation || "vertical",
      "aria-multiselectable": selectionState.selectionMode === "multiple" ? "true" : undefined,
      tabIndex: () => (read(virtualFocus) ? undefined : selectionState.focusedKey() == null ? 0 : -1),
    },
  };
}

/** react-aria `useListBoxSection`: props for the section's `<section>` (groupProps) and its heading. */
export function listBoxSectionProps(props: { heading?: string | undefined; "aria-label"?: string | undefined }): {
  itemProps: Record<string, unknown>;
  headingProps: Record<string, unknown>;
  groupProps: Record<string, unknown>;
} {
  const heading = props.heading;
  return {
    itemProps: { role: "presentation" },
    headingProps: heading
      ? {
          // Technically, listbox cannot contain headings according to ARIA. We hide the heading from assistive
          // technology, using role="presentation", and only use it as a visual label for the nested group.
          id: heading,
          role: "presentation",
          // Prevent DOM focus from moving on mouse down when using virtual focus.
          onMouseDown: (e: MouseEvent) => e.preventDefault(),
        }
      : {},
    groupProps: { role: "group", "aria-label": props["aria-label"], "aria-labelledby": heading || undefined },
  };
}

// One manager per (selection state, key, disabled): option bindings read it several times per run (F5 step a).
// Module-level (never captured by a resumable closure); the state object (and its maps) is dropped with the list.
const nodeManagers = new WeakMap<object, [Map<Key, SelectionManager>, Map<Key, SelectionManager>]>();

/**
 * A selection manager reading only one option (option bindings: no collection walk per binding). Takes plain data
 * (a resumable binding must not capture the node instance). Memoized per selection state, key and `isDisabled`.
 */
export function nodeSelectionManager(state: ListState, key: Key, isDisabled?: boolean): SelectionManager {
  const selectionState = state.selectionState;
  let maps = nodeManagers.get(selectionState);
  if (maps === undefined) nodeManagers.set(selectionState, (maps = [new Map(), new Map()]));
  const byKey = maps[isDisabled ? 1 : 0];
  let manager = byKey.get(key);
  if (manager === undefined)
    byKey.set(key, (manager = new SelectionManager(new OneNodeCollection(key, !!isDisabled) as unknown as Collection<Node<unknown>>, selectionState)));
  return manager;
}

/** The one-option collection of `nodeSelectionManager` (prototype methods: no closures per option). */
class OneNodeCollection {
  readonly node: Node<unknown>;
  readonly size = 1;
  constructor(key: Key, isDisabled: boolean) {
    this.node = { key, type: "item", props: isDisabled ? { isDisabled } : {}, childNodes: [] } as unknown as Node<unknown>;
  }
  getItem(key: Key): Node<unknown> | null {
    return key === this.node.key ? this.node : null;
  }
  getKeys(): Key[] {
    return [this.node.key];
  }
  getFirstKey(): Key {
    return this.node.key;
  }
  getLastKey(): Key {
    return this.node.key;
  }
  getKeyBefore(): null {
    return null;
  }
  getKeyAfter(): null {
    return null;
  }
  at(): Node<unknown> {
    return this.node;
  }
  getChildren(): Node<unknown>[] {
    return [];
  }
  *[Symbol.iterator](): IterableIterator<Node<unknown>> {
    yield this.node;
  }
}

const noAction = (): void => {};

/** react-aria `useOption` attributes and states (accessors: read inside bindings). */
export function optionProps(
  props: {
    key: Key;
    isDisabled?: boolean | undefined;
    /** The item's `isDisabled` prop (an accessor stays live: read at use, live props P5). */
    itemIsDisabled?: boolean | (() => boolean | undefined) | undefined;
    hasAction?: boolean | undefined;
    "aria-label"?: string | undefined;
    labelId?: () => string | undefined;
    descriptionId?: () => string | undefined;
  },
  state: ListState,
  data: ListData,
): {
  optionProps: Record<string, unknown>;
  isSelected: () => boolean;
  isDisabled: () => boolean;
  isFocused: () => boolean;
  isFocusVisible: () => boolean;
  isPressed: () => boolean;
  isHovered: () => boolean;
  allowsSelection: () => boolean;
  hasAction: () => boolean;
} {
  // `isDisabled`: useOption's own option (overrides the manager); `itemIsDisabled`: the item node's `isDisabled`
  // prop (RAC ListBoxItem), read by SelectionManager.isDisabled so `disabledBehavior="selection"` applies.
  const { key, isDisabled, itemIsDisabled } = props;
  const hasOwnAction = !!props.hasAction;
  const options = (): SelectableItemOptions => ({
    selectionManager: nodeSelectionManager(state, key, read(itemIsDisabled)),
    key,
    isDisabled,
    shouldUseVirtualFocus: read(data.shouldUseVirtualFocus),
    shouldSelectOnPressUp: data.shouldSelectOnPressUp,
    linkBehavior: data.linkBehavior,
    UNSTABLE_itemBehavior: data.UNSTABLE_itemBehavior,
    onAction: data.onAction || hasOwnAction ? noAction : undefined,
  });
  const states = () => selectableItemStates(options());
  const isFocused = () => states().isFocused;
  const id = getItemId(data.id, key);
  const attrs: Record<string, unknown> = {
    id,
    role: "option",
    "data-key": String(key),
    "data-key-type": typeof key === "number" ? "number" : undefined,
    "data-collection": data.id,
    "aria-label": props["aria-label"],
    "aria-labelledby": props.labelId,
    "aria-describedby": props.descriptionId,
    "aria-disabled": () => (states().isDisabled ? "true" : undefined),
    "aria-selected": () => (state.selectionState.selectionMode === "none" ? undefined : states().isSelected ? "true" : "false"),
    tabIndex: () => (read(data.shouldUseVirtualFocus) || states().isDisabled ? undefined : isFocusedKey(state.selectionState, key) ? 0 : -1),
  };
  if (data.isVirtualized)
    // useOption: a virtualized list renders a window of its options; their position comes from the collection.
    // (Object-literal arrows: resumable closures.)
    Object.assign(attrs, {
      "aria-posinset": () => optionPosInSet(state, key),
      "aria-setsize": () => optionSetSize(state),
    });
  return {
    optionProps: attrs,
    isSelected: () => states().isSelected,
    isDisabled: () => states().isDisabled,
    isFocused,
    isFocusVisible: () => isFocused() && data.focusVisible(),
    isPressed: () => data.pressedKey() === key,
    isHovered: () => data.hoveredKey() === key,
    allowsSelection: () => states().allowsSelection,
    hasAction: () => states().hasAction,
  };
}

/** The built collection of a list state (a virtualized ListBox renders from it). */
function builtOf(state: ListState): Collection<Node<unknown>> | undefined {
  const c = state.collection as Collection<Node<unknown>> | (() => Collection<Node<unknown>>) | undefined;
  return typeof c === "function" ? c() : c;
}
const optionPosInSet = (state: ListState, key: Key): number | undefined => {
  const index = builtOf(state)?.getItem(key)?.index;
  return index == null ? undefined : index + 1;
};
const optionSetSize = (state: ListState): number | undefined => {
  const c = builtOf(state);
  return c ? getItemCount(c) : undefined;
};

// ---------------------------------------------------------------------------------------------
// Delegated handlers (on the listbox element)
// ---------------------------------------------------------------------------------------------

type Ev<E extends Event = Event> = E & { currentTarget: EventTarget | null };

function rootOf(e: Event): HTMLElement {
  return e.currentTarget as HTMLElement;
}

function collectionFor(props: ListBoxBehaviourProps, state: ListState, root: HTMLElement): Collection<Node<unknown>> {
  return (props.collection ? props.collection() : listCollection(state, root)) as Collection<Node<unknown>>;
}

/** react-aria useSelectableList options for this listbox (per event: manager + keyboard delegate over the current collection). */
export function listBoxCollectionOptions(props: ListBoxBehaviourProps, state: ListState, root: HTMLElement): AriaSelectableCollectionOptions {
  const collection = collectionFor(props, state, root);
  const selectionManager = listSelectionManager(state, collection);
  const keyboardDelegate =
    props.keyboardDelegate ||
    new ListKeyboardDelegate({
      collection,
      ref: root,
      collator: searchCollator(),
      disabledKeys: selectionManager.disabledKeys,
      disabledBehavior: selectionManager.disabledBehavior,
      layout: props.layout || "stack",
      orientation: props.orientation || "vertical",
      direction: elementDirection(root),
      layoutDelegate: state.layoutDelegate,
    });
  return selectableListOptions({
    selectionManager,
    collection,
    disabledKeys: selectionManager.disabledKeys,
    keyboardDelegate,
    ref: root,
    autoFocus: untrack(() => read(props.autoFocus)),
    shouldFocusWrap: props.shouldFocusWrap,
    escapeKeyBehavior: props.escapeKeyBehavior,
    disallowTypeAhead: untrack(() => read(props.disallowTypeAhead)),
    shouldUseVirtualFocus: untrack(() => read(props.shouldUseVirtualFocus)),
    isVirtualized: props.isVirtualized,
    linkBehavior: props.data.linkBehavior,
    orientation: props.orientation,
  });
}

function itemOptions(props: ListBoxBehaviourProps, collection: AriaSelectableCollectionOptions, element: HTMLElement, key: Key): SelectableItemOptions {
  const { data } = props;
  const hasOwnAction = element.hasAttribute("data-rv-action");
  const listAction = data.onAction;
  const node = collection.selectionManager.collection.getItem(key);
  // The option's press callbacks / onClick (react-aria collectionItemProps): ListBoxItem listens for
  // `rv-item-press` when it has any (`data-rv-press`).
  const press = element.hasAttribute("data-rv-press");
  const fire = (detail: unknown) => element.dispatchEvent(new CustomEvent("rv-item-press", { detail }));
  const nodeProps = (node?.props ?? {}) as Record<string, unknown>;
  const itemProps = {
    href: element.getAttribute("href") ?? (nodeProps.href as string | undefined),
    routerOptions: nodeProps.routerOptions as Record<string, unknown> | undefined,
    ...(press
      ? {
          onPressStart: (ev: unknown) => fire(ev),
          onPressUp: (ev: unknown) => fire(ev),
          onPressEnd: (ev: unknown) => fire(ev),
          onPress: (ev: unknown) => fire(ev),
          onClick: (ev: MouseEvent) => fire({ type: "click", event: ev }),
        }
      : {}),
  };
  return {
    router: data.router,
    itemProps,
    selectionManager: collection.selectionManager,
    key,
    ref: element,
    id: getItemId(data.id, key),
    // Rivet: an item with a long press interaction (`data-rv-long-press`, cdk `itemMorphProps`) selects on press up, so
    // the long press can cancel the press before it selects (mouse presses select on press down otherwise).
    shouldSelectOnPressUp: data.shouldSelectOnPressUp || element.hasAttribute("data-rv-long-press"),
    allowsDifferentPressOrigin: data.shouldSelectOnPressUp && data.shouldFocusOnHover,
    isVirtualized: data.isVirtualized,
    shouldUseVirtualFocus: untrack(() => read(data.shouldUseVirtualFocus)),
    isDisabled: !!(node?.props as { isDisabled?: boolean } | undefined)?.isDisabled || undefined,
    // useOption: chain(item.props.onAction, listOnAction(key)).
    onAction:
      hasOwnAction || listAction
        ? () => {
            if (hasOwnAction) element.dispatchEvent(new CustomEvent("rv-item-action"));
            listAction?.(key);
          }
        : undefined,
    linkBehavior: data.linkBehavior,
    UNSTABLE_itemBehavior: data.UNSTABLE_itemBehavior,
  };
}

function item(e: Event): { element: HTMLElement; key: Key } | null {
  const root = rootOf(e);
  const found = closestItem(root, e.target, '[role="option"][data-key]');
  return found && found.element.getAttribute("data-collection") === root.getAttribute("data-collection") ? found : null;
}

function setPressed(props: ListBoxBehaviourProps, root: Element, element: HTMLElement | null, key: Key | null): void {
  const { data } = props;
  const prev = untrack(data.pressedKey);
  if (prev === key) return;
  data.pressedKey.set(key);
  if (prev != null) {
    const old = root.querySelector(`[data-pressed][data-collection="${data.id}"]`);
    if (old) setDataAttr(old, "data-pressed", false);
  }
  if (element && key != null) setDataAttr(element, "data-pressed", true);
}

/** keydown (capture) on the listbox element: typeahead Space (useTypeSelect). */
export function listBoxKeyDownCapture(e: Ev<KeyboardEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  selectableCollectionKeyDownCapture(listBoxCollectionOptions(props, state, rootOf(e)), e);
}

/** keydown on the listbox element: option Space / Enter press (useSelectableItem), then navigation (useSelectableCollection). */
export function listBoxKeyDown(e: Ev<KeyboardEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  const root = rootOf(e);
  const options = listBoxCollectionOptions(props, state, root);
  props.data.focusVisible.set(true);
  const found = item(e);
  if (found && !e.defaultPrevented) {
    const before = untrack(() => props.data.pressedKey());
    selectableItemKeyDown(itemOptions(props, options, found.element, found.key), e);
    if ((e.key === " " || e.key === "Enter") && before == null && !e.repeat && e.defaultPrevented) setPressed(props, rootOf(e), found.element, found.key);
  }
  selectableCollectionKeyDown(options, e);
}

/** keyup on the listbox element: option keyboard press end. */
export function listBoxKeyUp(e: Ev<KeyboardEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  const found = item(e);
  if (!found) return;
  if (e.key === " " || e.key === "Enter") setPressed(props, rootOf(e), null, null);
  selectableItemKeyUp(itemOptions(props, listBoxCollectionOptions(props, state, rootOf(e)), found.element, found.key), e);
}

/** pointerdown on the listbox element: option press start. */
export function listBoxPointerDown(e: Ev<PointerEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  props.data.focusVisible.set(false);
  const found = item(e);
  if (!found) return;
  const options = itemOptions(props, listBoxCollectionOptions(props, state, rootOf(e)), found.element, found.key);
  selectableItemPointerDown(options, e);
  const states = selectableItemStates(options);
  if (!states.isDisabled && (states.allowsSelection || states.hasAction) && (e.button === 0 || e.pointerType !== "mouse"))
    setPressed(props, rootOf(e), found.element, found.key);
}

/** pointerup on the listbox element: option press up. */
export function listBoxPointerUp(e: Ev<PointerEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  setPressed(props, rootOf(e), null, null);
  const found = item(e);
  if (!found) return;
  selectableItemPointerUp(itemOptions(props, listBoxCollectionOptions(props, state, rootOf(e)), found.element, found.key), e);
}

/** pointercancel on the listbox element. */
export function listBoxPointerCancel(e: Ev<PointerEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  setPressed(props, rootOf(e), null, null);
  const found = item(e);
  if (found) selectableItemPointerCancel(itemOptions(props, listBoxCollectionOptions(props, state, rootOf(e)), found.element, found.key), e);
}

/** click on the listbox element: the option press (pointer and virtual clicks). */
export function listBoxClick(e: Ev<MouseEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  const found = item(e);
  setPressed(props, rootOf(e), null, null);
  if (found) selectableItemClick(itemOptions(props, listBoxCollectionOptions(props, state, rootOf(e)), found.element, found.key), e);
}

/** dblclick on the listbox element: secondary action with `selectionBehavior="replace"`. */
export function listBoxDoubleClick(e: Ev<MouseEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  const found = item(e);
  if (found) selectableItemDoubleClick(itemOptions(props, listBoxCollectionOptions(props, state, rootOf(e)), found.element, found.key), e);
}

/** dragstart on the listbox element. */
export function listBoxDragStart(e: Ev<DragEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  const found = item(e);
  if (found) selectableItemDragStart(itemOptions(props, listBoxCollectionOptions(props, state, rootOf(e)), found.element, found.key), e);
}

/** mousedown on the listbox element (scrollbar clicks do not focus). */
export function listBoxMouseDown(e: Ev<MouseEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  selectableCollectionMouseDown(listBoxCollectionOptions(props, state, rootOf(e)), e);
}

/** focusin on the listbox element: option focus (useSelectableItem), collection focus, focus-within, root focus ring. */
export function listBoxFocusIn(e: Ev<FocusEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  const root = rootOf(e);
  const options = listBoxCollectionOptions(props, state, root);
  const wasFocused = untrack(() => state.selectionState.isFocused());
  props.data.focusVisible.set(isFocusVisible());
  const found = item(e);
  if (found && e.target === found.element) selectableItemFocus(itemOptions(props, options, found.element, found.key), e);
  selectableCollectionFocus(options, e);
  if (e.target === root) {
    props.data.isFocused.set(true);
  }
  // useFocusWithin: only when focus enters from outside.
  const from = e.relatedTarget as globalThis.Node | null;
  if (!wasFocused || !from || !root.contains(from)) {
    if (!from || !root.contains(from)) {
      props.onFocus?.(e);
      props.onFocusChange?.(true);
    }
  }
}

/** focusout on the listbox element. */
export function listBoxFocusOut(e: Ev<FocusEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  const root = rootOf(e);
  selectableCollectionBlur(listBoxCollectionOptions(props, state, root), e);
  if (e.target === root) {
    props.data.isFocused.set(false);
  }
  const to = e.relatedTarget as globalThis.Node | null;
  if (!to || !root.contains(to)) {
    props.onBlur?.(e);
    props.onFocusChange?.(false);
  }
}

/** `react-aria-focus` (virtual focus from an Autocomplete input). */
export function listBoxVirtualFocus(e: Ev<CustomEvent<{ focusStrategy?: FocusStrategy }>>, props: ListBoxBehaviourProps, state: ListState): void {
  selectableCollectionVirtualFocus(listBoxCollectionOptions(props, state, rootOf(e)), e);
}

/** `react-aria-clear-focus` (virtual focus cleared by an Autocomplete input). */
export function listBoxClearVirtualFocus(e: Ev<CustomEvent<{ clearFocusKey?: boolean }>>, props: ListBoxBehaviourProps, state: ListState): void {
  selectableCollectionClearVirtualFocus(listBoxCollectionOptions(props, state, rootOf(e)), e);
}

function hoverable(props: ListBoxBehaviourProps, state: ListState, root: HTMLElement, element: HTMLElement, key: Key): boolean {
  const states = selectableItemStates(itemOptions(props, listBoxCollectionOptions(props, state, root), element, key));
  // RAC ListBoxItem useHover: disabled when the option neither selects nor acts (drag and drop: C8).
  return states.allowsSelection || states.hasAction;
}

function hoverEnd(props: ListBoxBehaviourProps, root: HTMLElement): void {
  const { data } = props;
  const prev = untrack(data.hoveredKey);
  if (prev == null) return;
  data.hoveredKey.set(null);
  const el = root.querySelector<HTMLElement>(`[data-hovered][data-collection="${data.id}"]`);
  if (el) {
    setDataAttr(el, "data-hovered", false);
    el.dispatchEvent(new CustomEvent("rv-hover-end", { detail: { pointerType: "mouse" } }));
  }
}

/** pointerover on the listbox element: option hover start (useHover; `shouldFocusOnHover` focuses it). */
export function listBoxPointerOver(e: Ev<PointerEvent>, props: ListBoxBehaviourProps, state: ListState): void {
  if (e.pointerType === "touch") return;
  const root = rootOf(e);
  const found = item(e);
  const { data } = props;
  if (found && untrack(data.hoveredKey) === found.key) return;
  hoverEnd(props, root);
  if (!found) return;
  if (hoverable(props, state, root, found.element, found.key)) {
    data.hoveredKey.set(found.key);
    setDataAttr(found.element, "data-hovered", true);
    found.element.dispatchEvent(new CustomEvent("rv-hover-start", { detail: { pointerType: e.pointerType } }));
  }
  // useOption: focus the option on hover (unless keyboard focus is visible).
  if (data.shouldFocusOnHover && !isFocusVisible()) {
    const manager = listSelectionManager(state, collectionFor(props, state, root));
    if (!manager.isDisabled(found.key)) {
      manager.setFocused(true);
      manager.setFocusedKey(found.key);
      if (!untrack(() => read(data.shouldUseVirtualFocus)) && found.element.ownerDocument.activeElement !== found.element)
        found.element.focus({ preventScroll: true });
    }
  }
}

/** pointerout on the listbox element: option hover end when the pointer leaves it. */
export function listBoxPointerOut(e: Ev<PointerEvent>, props: ListBoxBehaviourProps, _state: ListState): void {
  const root = rootOf(e);
  const to = e.relatedTarget as globalThis.Node | null;
  const hovered = untrack(props.data.hoveredKey);
  if (hovered == null) return;
  const el = root.querySelector<HTMLElement>(`[data-hovered][data-collection="${props.data.id}"]`);
  if (el && to && el.contains(to)) return;
  hoverEnd(props, root);
}

/** Auto focus once the listbox element is connected (react-aria useSelectableCollection's mount effect). */
export function listBoxAutoFocus(root: HTMLElement, props: ListBoxBehaviourProps, state: ListState): void {
  selectableCollectionAutoFocus(listBoxCollectionOptions(props, state, root));
}
