// Ported from react-spectrum (react-stately: selection/SelectionManager, selection/useMultipleSelectionState,
// list/ListCollection, collections/getChildNodes; react-aria: selection/ListKeyboardDelegate,
// selection/DOMLayoutDelegate, selection/utils), Apache-2.0, © Adobe.
//
// LOCAL ADAPTER for the `cdk-collections` branch (selection manager, keyboard delegate). Same names
// and semantics as the originals; swap the imports to `@rivetjs/cdk/collections` once that branch
// publishes its API and delete this file.
//
// Rivet shape: the selection state is plain signals + JSON (resumable); `SelectionManager` and
// `ListKeyboardDelegate` are built on demand inside handlers over a `Collection`. Two collections
// implement the same interface: `ListCollection` (data items, server render) and `domCollection`
// (the rendered DOM, inside handlers: "DOM as collection", no item model in resume state).
// `SelectionManager`, `GroupSelectionManager` and `domCollection` live in the leaf `selection-manager.ts`
// (BIG-UI-2): pages that only render a list state / keyboard delegate (Select, ComboBox) do not ship them.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { isMac } from "@rivetjs/cdk/platform";

// Shared types: ONE definition in `../collections/types.ts` (@react-types/shared).
import type { Direction, DisabledBehavior, FocusStrategy, Key, Orientation, Selection, SelectionBehavior, SelectionMode } from "../collections/types.ts";
import { ALL_SELECTED, IN_SELECTION, isSelectionEmpty, selectionOf } from "../selection/keyed.ts";

export type { Direction, DisabledBehavior, FocusStrategy, Key, Orientation, Selection, SelectionBehavior, SelectionMode };

/** Collection node (react-types `Node`). */
export interface Node {
  readonly type: "item" | "section" | "header" | "separator" | "loader";
  readonly key: Key;
  index: number;
  readonly level: number;
  readonly parentKey: Key | null;
  readonly textValue: string;
  readonly hasChildNodes: boolean;
  readonly childNodes: Iterable<Node>;
  /** Item props the behaviours read: `isDisabled`, `href`, `target`, `rel`, `download`, … */
  readonly props: NodeProps;
  prevKey?: Key | undefined;
  nextKey?: Key | undefined;
}

export interface NodeProps {
  isDisabled?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  download?: string | boolean;
  [name: string]: unknown;
}

/** react-types `Collection`. */
export interface Collection {
  readonly size: number;
  getKeys(): Iterable<Key>;
  getItem(key: Key): Node | null;
  getKeyBefore(key: Key): Key | null;
  getKeyAfter(key: Key): Key | null;
  getFirstKey(): Key | null;
  getLastKey(): Key | null;
  getChildren(key: Key): Iterable<Node>;
  [Symbol.iterator](): IterableIterator<Node>;
}

// ---------------------------------------------------------------------------------------------
// ListCollection (react-stately list/ListCollection)
// ---------------------------------------------------------------------------------------------

export class ListCollection implements Collection {
  private keyMap = new Map<Key, Node>();
  private iterable: Iterable<Node>;
  private firstKey: Key | null = null;
  private lastKey: Key | null = null;
  private _size: number;

  constructor(nodes: Iterable<Node>) {
    this.iterable = nodes;
    const visit = (node: Node) => {
      this.keyMap.set(node.key, node);
      if (node.childNodes && node.type === "section") for (const child of node.childNodes) visit(child);
    };
    for (const node of nodes) visit(node);
    let last: Node | null = null,
      index = 0,
      size = 0;
    for (const [key, node] of this.keyMap) {
      if (last) {
        last.nextKey = key;
        node.prevKey = last.key;
      } else {
        this.firstKey = key;
        node.prevKey = undefined;
      }
      if (node.type === "item") node.index = index++;
      // Only sections and items count, so loaders / separators don't change the empty state.
      if (node.type === "section" || node.type === "item") size++;
      last = node;
      last.nextKey = undefined;
    }
    this._size = size;
    this.lastKey = last?.key ?? null;
  }

  *[Symbol.iterator](): IterableIterator<Node> {
    yield* this.iterable;
  }
  get size(): number {
    return this._size;
  }
  getKeys(): IterableIterator<Key> {
    return this.keyMap.keys();
  }
  getKeyBefore(key: Key): Key | null {
    return this.keyMap.get(key)?.prevKey ?? null;
  }
  getKeyAfter(key: Key): Key | null {
    return this.keyMap.get(key)?.nextKey ?? null;
  }
  getFirstKey(): Key | null {
    return this.firstKey;
  }
  getLastKey(): Key | null {
    return this.lastKey;
  }
  getItem(key: Key): Node | null {
    return this.keyMap.get(key) ?? null;
  }
  at(idx: number): Node | null {
    const keys = [...this.getKeys()];
    return this.getItem(keys[idx]!);
  }
  getChildren(key: Key): Iterable<Node> {
    return this.keyMap.get(key)?.childNodes || [];
  }
}

// ---------------------------------------------------------------------------------------------
// DOM collection: the rendered items of a collection root, as a `Collection`.
// ---------------------------------------------------------------------------------------------

/** Attribute marking a collection root (value: its id); items belong to their nearest root. */
export const COLLECTION_ATTR = "data-collection";

/** `data-key` (+ `data-key-type="number"`) encoding: ONE implementation in `../collections/dom.ts`. */
export { domKey, keyAttrs } from "../collections/dom.ts";
import { cssEscape } from "../utils/dom-core.ts";

/** @internal A collection node (DOM / data collections). */
export function makeNode(type: Node["type"], key: Key, parentKey: Key | null, textValue: string, props: NodeProps, childNodes: Node[]): Node {
  return { type, key, index: 0, level: parentKey == null ? 0 : 1, parentKey, textValue, hasChildNodes: type === "section", childNodes, props };
}

// ---------------------------------------------------------------------------------------------
// Data items → nodes (server render, `ListCollection`).
// ---------------------------------------------------------------------------------------------

/** A data-driven item (RAC `<ListBoxItem>` / `<MenuItem>` props as data). */
export interface CollectionItem {
  /** RAC `id`. */
  readonly key: Key;
  /** Visible label (default render) and, unless `textValue` is set, the typeahead / filter text. */
  readonly label: string;
  /** RAC `textValue`: typeahead / filter / announced text when `label` is not plain text. */
  readonly textValue?: string;
  /** RAC `isDisabled`. */
  readonly disabled?: boolean;
  /** Link items: rendered as `<a href>`. */
  readonly href?: string;
  readonly target?: string;
  readonly rel?: string;
  readonly download?: string | boolean;
  /** Secondary text (RAC `<Text slot="description">`). */
  readonly description?: string;
  /** RAC `aria-label` of the item. */
  readonly "aria-label"?: string;
}

/** A section (RAC `<ListBoxSection>` / `<MenuSection>` with a `<Header>`). */
export interface CollectionSection<I extends CollectionItem = CollectionItem> {
  readonly key: Key;
  /** Header text (RAC `<Header>`); without it, give the group an `aria-label`. */
  readonly title?: string;
  readonly "aria-label"?: string;
  readonly children: readonly I[];
}

export type CollectionEntry<I extends CollectionItem = CollectionItem> = I | CollectionSection<I>;

export const isSection = <I extends CollectionItem>(entry: CollectionEntry<I>): entry is CollectionSection<I> =>
  Array.isArray((entry as CollectionSection<I>).children);

/** Text of an item for typeahead / filtering. */
export const textOf = (item: CollectionItem): string => item.textValue ?? item.label;

/** Nodes of data entries (sections with their items), for `ListCollection`. */
export function buildNodes(entries: readonly CollectionEntry[]): Node[] {
  let topIndex = 0;
  const itemNode = (item: CollectionItem, parentKey: Key | null, index: number): Node => {
    const props: NodeProps = { isDisabled: !!item.disabled };
    if (item.href) Object.assign(props, { href: item.href, target: item.target, rel: item.rel, download: item.download });
    const node = makeNode("item", item.key, parentKey, textOf(item), props, []);
    node.index = index;
    return node;
  };
  return entries.map((entry) => {
    if (isSection(entry)) {
      const children = entry.children.map((item, i) => itemNode(item, entry.key, i));
      const node = makeNode("section", entry.key, null, entry.title ?? entry["aria-label"] ?? "", {}, children);
      node.index = topIndex++;
      return node;
    }
    return itemNode(entry, null, topIndex++);
  });
}

/** Every item of `entries` (sections flattened). */
export function flatItems<I extends CollectionItem>(entries: readonly CollectionEntry<I>[]): I[] {
  const out: I[] = [];
  for (const entry of entries)
    if (isSection(entry)) out.push(...entry.children);
    else out.push(entry);
  return out;
}

// ---------------------------------------------------------------------------------------------
// getChildNodes helpers (react-stately collections/getChildNodes)
// ---------------------------------------------------------------------------------------------

export function getChildNodes(node: Node, collection: Collection): Iterable<Node> {
  return typeof collection.getChildren === "function" ? collection.getChildren(node.key) : node.childNodes;
}

export function getFirstItem<T>(iterable: Iterable<T>): T | undefined {
  for (const item of iterable) return item;
  return undefined;
}

export function getItemCount(collection: Collection): number {
  let count = 0;
  for (const key of collection.getKeys()) if (collection.getItem(key)?.type === "item") count++;
  return count;
}

export function compareNodeOrder(collection: Collection, a: Node, b: Node): number {
  if (a.parentKey === b.parentKey) return a.index - b.index;
  const aAncestors = [...getAncestors(collection, a), a];
  const bAncestors = [...getAncestors(collection, b), b];
  const firstNonMatching = aAncestors.slice(0, bAncestors.length).findIndex((x, i) => x !== bAncestors[i]);
  if (firstNonMatching !== -1) return aAncestors[firstNonMatching]!.index - bAncestors[firstNonMatching]!.index;
  if (aAncestors.findIndex((node) => node === b) >= 0) return 1;
  if (bAncestors.findIndex((node) => node === a) >= 0) return -1;
  return -1;
}

function getAncestors(collection: Collection, node: Node): Node[] {
  const parents: Node[] = [];
  let current: Node | null = node;
  while (current?.parentKey != null) {
    current = collection.getItem(current.parentKey);
    if (current) parents.unshift(current);
  }
  return parents;
}

// ---------------------------------------------------------------------------------------------
// Multiple selection state (react-stately useMultipleSelectionState) — signals + JSON.
// ---------------------------------------------------------------------------------------------

export interface MultipleSelectionState {
  readonly selectionMode: SelectionMode;
  readonly disallowEmptySelection: boolean;
  /** Current behaviour (long press on touch switches `replace` → `toggle`). */
  readonly selectionBehavior: Signal<SelectionBehavior>;
  /** The `selectionBehavior` prop. */
  readonly selectionBehaviorProp: SelectionBehavior;
  readonly allowDuplicateSelectionEvents: boolean;
  /** Multiple storage: the selection. Absent when `selectedKey` stores a single key. */
  readonly selectedKeys?: Signal<Selection>;
  /** Single storage (Select / ComboBox): the selected key. */
  readonly selectedKey?: Signal<Key | null>;
  /** Range anchor / current key of the selection (react-stately `Selection.anchorKey` / `currentKey`). */
  readonly anchorKey: Signal<Key | null>;
  readonly currentKey: Signal<Key | null>;
  readonly disabledKeys: Set<Key>;
  readonly disabledBehavior: DisabledBehavior;
  readonly isFocused: Signal<boolean>;
  readonly focusedKey: Signal<Key | null>;
  readonly childFocusStrategy: Signal<FocusStrategy | null>;
  /** Called with the new selection (RAC `onSelectionChange`). */
  readonly onSelectionChange?: ((keys: Selection) => void) | undefined;
}

export interface MultipleSelectionStateProps {
  selectionMode?: SelectionMode;
  disallowEmptySelection?: boolean;
  selectionBehavior?: SelectionBehavior;
  allowDuplicateSelectionEvents?: boolean;
  /** Two-way selection (RAC controlled `selectedKeys`). */
  selectedKeys?: Signal<Selection>;
  /** Initial selection (RAC `defaultSelectedKeys`). */
  defaultSelectedKeys?: "all" | Iterable<Key>;
  onSelectionChange?: (keys: Selection) => void;
  disabledKeys?: Iterable<Key>;
  disabledBehavior?: DisabledBehavior;
}

/** Selection + focus state. `selectedKey` (a single-key signal) replaces the key-set storage. */
export function createMultipleSelectionState(props: MultipleSelectionStateProps & { selectedKey?: Signal<Key | null> }): MultipleSelectionState {
  const behavior = props.selectionBehavior ?? "toggle";
  const def = props.defaultSelectedKeys;
  return {
    selectionMode: props.selectionMode ?? "none",
    disallowEmptySelection: props.disallowEmptySelection ?? false,
    selectionBehavior: signal(behavior),
    selectionBehaviorProp: behavior,
    allowDuplicateSelectionEvents: props.allowDuplicateSelectionEvents ?? false,
    ...(props.selectedKey
      ? { selectedKey: props.selectedKey }
      : { selectedKeys: props.selectedKeys ?? signal<Selection>(def === "all" ? "all" : new Set(def ?? [])) }),
    anchorKey: signal<Key | null>(null),
    currentKey: signal<Key | null>(null),
    disabledKeys: new Set(props.disabledKeys ?? []),
    disabledBehavior: props.disabledBehavior ?? "all",
    isFocused: signal(false),
    focusedKey: signal<Key | null>(null),
    childFocusStrategy: signal<FocusStrategy | null>(null),
    ...(props.onSelectionChange ? { onSelectionChange: props.onSelectionChange } : {}),
  };
}

/** Current selection (reads the signal: tracked inside bindings). */
export function readSelection(state: MultipleSelectionState): Selection {
  if (state.selectedKey) {
    const key = state.selectedKey();
    return key == null ? new Set() : new Set([key]);
  }
  return state.selectedKeys!();
}

const equalSets = (a: Set<Key>, b: Set<Key>) => a.size === b.size && [...a].every((k) => b.has(k));

/** Write the selection (react-stately `setSelectedKeys`: skips equal sets unless duplicates are allowed). */
export function writeSelection(state: MultipleSelectionState, keys: Selection, anchorKey?: Key | null, currentKey?: Key | null): void {
  const current = untrack(() => readSelection(state));
  if (anchorKey !== undefined) state.anchorKey.set(anchorKey);
  if (currentKey !== undefined) state.currentKey.set(currentKey);
  const same = keys === current || (keys !== "all" && current !== "all" && equalSets(keys, current));
  if (!state.allowDuplicateSelectionEvents && same) return;
  if (state.selectedKey) state.selectedKey.set(keys === "all" ? null : (keys.values().next().value ?? null));
  // A read-only accessor (live controlled `selectedKeys`) is never written: `onSelectionChange` reports.
  else if (typeof state.selectedKeys!.set === "function") state.selectedKeys!.set(keys);
  // Long press on touch entered `toggle`; an empty selection returns to the `replace` prop.
  if (state.selectionBehaviorProp === "replace" && untrack(state.selectionBehavior) === "toggle" && keys !== "all" && keys.size === 0)
    state.selectionBehavior.set("replace");
  state.onSelectionChange?.(keys);
}

// ---------------------------------------------------------------------------------------------
// Render-time accessors (server + bindings): read signals, need no collection.
// ---------------------------------------------------------------------------------------------

/** Whether `key` is selected (binding accessor). `disabled`: the item's own disabled flag. */
export function isKeySelected(state: MultipleSelectionState, key: Key, disabled = false): boolean {
  if (state.selectionMode === "none") return false;
  // Keyed read (`selection/keyed.ts`): a binding re-runs only when this key's membership changes.
  const selected = selectionOf(state, key);
  return selected === ALL_SELECTED ? !disabled && !state.disabledKeys.has(key) : selected === IN_SELECTION;
}

/** Whether `key` is disabled for every interaction (react-stately `SelectionManager.isDisabled`). */
export const isKeyDisabled = (state: MultipleSelectionState, key: Key, disabled = false): boolean =>
  state.disabledBehavior === "all" && (disabled || state.disabledKeys.has(key));

// ---------------------------------------------------------------------------------------------
// Layout + keyboard delegates (react-aria selection/DOMLayoutDelegate, ListKeyboardDelegate)
// ---------------------------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutDelegate {
  getItemRect(key: Key): Rect | null;
  getVisibleRect(): Rect;
  getContentSize(): { width: number; height: number };
  getKeyRange?(from: Key, to: Key): Key[];
  getKeyRightOf?(key: Key): Key | null;
  getKeyLeftOf?(key: Key): Key | null;
}

export interface KeyboardDelegate {
  getKeyBelow?(key: Key): Key | null;
  getKeyAbove?(key: Key): Key | null;
  getKeyLeftOf?(key: Key): Key | null;
  getKeyRightOf?(key: Key): Key | null;
  getKeyPageBelow?(key: Key): Key | null;
  getKeyPageAbove?(key: Key): Key | null;
  getFirstKey?(key?: Key | null, global?: boolean): Key | null;
  getLastKey?(key?: Key | null, global?: boolean): Key | null;
  getKeyForSearch?(search: string, fromKey?: Key | null): Key | null;
}

/** Element of `key` inside the collection `root` (react-aria `getItemElement`). */
export function getItemElement(root: Element | null | undefined, key: Key): HTMLElement | null {
  if (!root) return null;
  const selector = `[data-key="${cssEscape(String(key))}"]`;
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    const owner = el.parentElement?.closest(`[${COLLECTION_ATTR}]`);
    if (!owner || owner === root || owner.getAttribute(COLLECTION_ATTR) === root.getAttribute(COLLECTION_ATTR)) return el;
  }
  return null;
}

export class DOMLayoutDelegate implements LayoutDelegate {
  private root: HTMLElement | null;
  constructor(root: HTMLElement | null) {
    this.root = root;
  }
  getItemRect(key: Key): Rect | null {
    const container = this.root;
    if (!container) return null;
    const item = key != null ? getItemElement(container, key) : null;
    if (!item) return null;
    const containerRect = container.getBoundingClientRect(),
      itemRect = item.getBoundingClientRect();
    return {
      x: itemRect.left - containerRect.left - container.clientLeft + container.scrollLeft,
      y: itemRect.top - containerRect.top - container.clientTop + container.scrollTop,
      width: itemRect.width,
      height: itemRect.height,
    };
  }
  getContentSize() {
    return { width: this.root?.scrollWidth ?? 0, height: this.root?.scrollHeight ?? 0 };
  }
  getVisibleRect(): Rect {
    const c = this.root;
    return { x: c?.scrollLeft ?? 0, y: c?.scrollTop ?? 0, width: c?.clientWidth ?? 0, height: c?.clientHeight ?? 0 };
  }
}

/** Whether `node` scrolls (react-aria `isScrollable`). */
export function isScrollable(node: Element | null, checkForOverflow?: boolean): boolean {
  if (!node) return false;
  const style = window.getComputedStyle(node);
  let scrollable = /(auto|scroll)/.test(style.overflow + style.overflowX + style.overflowY);
  if (scrollable && checkForOverflow) scrollable = node.scrollHeight !== node.clientHeight || node.scrollWidth !== node.clientWidth;
  return scrollable;
}

interface ListKeyboardDelegateOptions {
  collection: Collection;
  ref: HTMLElement | null;
  collator?: Intl.Collator;
  layout?: "stack" | "grid";
  orientation?: Orientation;
  direction?: Direction;
  disabledKeys?: Set<Key>;
  disabledBehavior?: DisabledBehavior;
  layoutDelegate?: LayoutDelegate;
}

export class ListKeyboardDelegate implements KeyboardDelegate {
  private collection: Collection;
  private disabledKeys: Set<Key>;
  private disabledBehavior: DisabledBehavior;
  private ref: HTMLElement | null;
  private collator: Intl.Collator | undefined;
  private layout: "stack" | "grid";
  private orientation: Orientation;
  private direction: Direction | undefined;
  private layoutDelegate: LayoutDelegate;
  getKeyRightOf?: (key: Key, options?: { includeDisabled?: boolean }) => Key | null;
  getKeyLeftOf?: (key: Key, options?: { includeDisabled?: boolean }) => Key | null;

  constructor(opts: ListKeyboardDelegateOptions) {
    this.collection = opts.collection;
    this.ref = opts.ref;
    this.collator = opts.collator;
    this.disabledKeys = opts.disabledKeys || new Set();
    this.disabledBehavior = opts.disabledBehavior || "all";
    this.orientation = opts.orientation || "vertical";
    this.direction = opts.direction;
    this.layout = opts.layout || "stack";
    this.layoutDelegate = opts.layoutDelegate || new DOMLayoutDelegate(opts.ref);
    // A vertical stack has no left / right movement.
    if (!(this.layout === "stack" && this.orientation === "vertical")) {
      this.getKeyRightOf = (key, options) => this.keyRightOf(key, options);
      this.getKeyLeftOf = (key, options) => this.keyLeftOf(key, options);
    }
  }

  private isDisabled(item: Node): boolean {
    return this.disabledBehavior === "all" && (!!item.props?.isDisabled || this.disabledKeys.has(item.key)) && item.props?.disabledBehavior !== "selection";
  }

  private findNextNonDisabled(key: Key | null, getNext: (key: Key) => Key | null, includeDisabled = false): Key | null {
    let nextKey = key;
    while (nextKey != null) {
      const item = this.collection.getItem(nextKey);
      if (item?.type === "item" && (includeDisabled || !this.isDisabled(item))) return nextKey;
      nextKey = getNext(nextKey);
    }
    return null;
  }

  getNextKey(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    return this.findNextNonDisabled(this.collection.getKeyAfter(key), (k) => this.collection.getKeyAfter(k), options?.includeDisabled);
  }

  getPreviousKey(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    return this.findNextNonDisabled(this.collection.getKeyBefore(key), (k) => this.collection.getKeyBefore(k), options?.includeDisabled);
  }

  private findKey(key: Key, nextKey: (key: Key) => Key | null, shouldSkip: (prevRect: Rect, itemRect: Rect) => boolean): Key | null {
    let tempKey: Key | null = key;
    let itemRect = this.layoutDelegate.getItemRect(tempKey);
    if (!itemRect || tempKey == null) return null;
    const prevRect = itemRect;
    do {
      tempKey = nextKey(tempKey);
      if (tempKey == null) break;
      itemRect = this.layoutDelegate.getItemRect(tempKey);
    } while (itemRect && shouldSkip(prevRect, itemRect) && tempKey != null);
    return tempKey;
  }

  private isSameRow = (prevRect: Rect, itemRect: Rect) => prevRect.y === itemRect.y || prevRect.x !== itemRect.x;
  private isSameColumn = (prevRect: Rect, itemRect: Rect) => prevRect.x === itemRect.x || prevRect.y !== itemRect.y;

  // Whether the next item sits above the current one (column-reverse layouts).
  private isReversed(key: Key): boolean {
    const nextKey = this.getNextKey(key);
    const currentEl = getItemElement(this.ref, key);
    if (nextKey != null) {
      const nextEl = getItemElement(this.ref, nextKey);
      if (!currentEl || !nextEl) return false;
      return currentEl.getBoundingClientRect().top > nextEl.getBoundingClientRect().top;
    }
    const prevKey = this.getPreviousKey(key);
    if (prevKey != null) {
      const prevEl = getItemElement(this.ref, prevKey);
      if (!currentEl || !prevEl) return false;
      return prevEl.getBoundingClientRect().top > currentEl.getBoundingClientRect().top;
    }
    return false;
  }

  getKeyBelow(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    if (this.layout === "grid" && this.orientation === "vertical") return this.findKey(key, (k) => this.getNextKey(k, options), this.isSameRow);
    if (this.orientation === "vertical") return this.isReversed(key) ? this.getPreviousKey(key, options) : this.getNextKey(key, options);
    return this.getNextKey(key, options);
  }

  getKeyAbove(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    if (this.layout === "grid" && this.orientation === "vertical") return this.findKey(key, (k) => this.getPreviousKey(k, options), this.isSameRow);
    if (this.orientation === "vertical") return this.isReversed(key) ? this.getNextKey(key, options) : this.getPreviousKey(key, options);
    return this.getPreviousKey(key, options);
  }

  private getNextColumn(key: Key, right: boolean, options?: { includeDisabled?: boolean }): Key | null {
    return right ? this.getPreviousKey(key, options) : this.getNextKey(key, options);
  }

  private keyRightOf(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    const method = this.direction === "ltr" ? "getKeyRightOf" : "getKeyLeftOf";
    const layoutMethod = this.layoutDelegate[method];
    if (layoutMethod) {
      const next = layoutMethod.call(this.layoutDelegate, key);
      return this.findNextNonDisabled(next, (k) => layoutMethod.call(this.layoutDelegate, k), options?.includeDisabled);
    }
    if (this.layout === "grid") {
      if (this.orientation === "vertical") return this.getNextColumn(key, this.direction === "rtl", options);
      return this.findKey(key, (k) => this.getNextColumn(k, this.direction === "rtl", options), this.isSameColumn);
    }
    if (this.orientation === "horizontal") return this.getNextColumn(key, this.direction === "rtl", options);
    return null;
  }

  private keyLeftOf(key: Key, options?: { includeDisabled?: boolean }): Key | null {
    const method = this.direction === "ltr" ? "getKeyLeftOf" : "getKeyRightOf";
    const layoutMethod = this.layoutDelegate[method];
    if (layoutMethod) {
      const next = layoutMethod.call(this.layoutDelegate, key);
      return this.findNextNonDisabled(next, (k) => layoutMethod.call(this.layoutDelegate, k), options?.includeDisabled);
    }
    if (this.layout === "grid") {
      if (this.orientation === "vertical") return this.getNextColumn(key, this.direction === "ltr", options);
      return this.findKey(key, (k) => this.getNextColumn(k, this.direction === "ltr", options), this.isSameColumn);
    }
    if (this.orientation === "horizontal") return this.getNextColumn(key, this.direction === "ltr", options);
    return null;
  }

  getFirstKey(): Key | null {
    return this.findNextNonDisabled(this.collection.getFirstKey(), (k) => this.collection.getKeyAfter(k));
  }

  getLastKey(): Key | null {
    return this.findNextNonDisabled(this.collection.getLastKey(), (k) => this.collection.getKeyBefore(k));
  }

  getKeyPageAbove(key: Key): Key | null {
    const menu = this.ref;
    let itemRect = this.layoutDelegate.getItemRect(key);
    if (!itemRect) return null;
    const reversed = this.isReversed(key);
    if (menu && !isScrollable(menu)) return this.getFirstKey();
    let nextKey: Key | null = key;
    if (this.orientation === "horizontal") {
      const pageX = Math.max(0, itemRect.x + itemRect.width - this.layoutDelegate.getVisibleRect().width);
      while (itemRect && itemRect.x > pageX && nextKey != null) {
        nextKey = this.getKeyAbove(nextKey);
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey);
      }
    } else {
      const visibleRect = this.layoutDelegate.getVisibleRect();
      const pageY = reversed ? itemRect.y - visibleRect.height : Math.max(0, itemRect.y + itemRect.height - visibleRect.height);
      while (itemRect && itemRect.y > pageY && nextKey != null) {
        nextKey = this.getKeyAbove(nextKey);
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey);
      }
    }
    return nextKey ?? (reversed ? this.getLastKey() : this.getFirstKey());
  }

  getKeyPageBelow(key: Key): Key | null {
    const menu = this.ref;
    let itemRect = this.layoutDelegate.getItemRect(key);
    if (!itemRect) return null;
    const reversed = this.isReversed(key);
    if (menu && !isScrollable(menu)) return this.getLastKey();
    let nextKey: Key | null = key;
    if (this.orientation === "horizontal") {
      const pageX = Math.min(this.layoutDelegate.getContentSize().width, itemRect.x - itemRect.width + this.layoutDelegate.getVisibleRect().width);
      while (itemRect && itemRect.x < pageX && nextKey != null) {
        nextKey = this.getKeyBelow(nextKey);
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey);
      }
    } else {
      const pageY = Math.min(this.layoutDelegate.getContentSize().height, itemRect.y - itemRect.height + this.layoutDelegate.getVisibleRect().height);
      while (itemRect && itemRect.y < pageY && nextKey != null) {
        nextKey = this.getKeyBelow(nextKey);
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey);
      }
    }
    return nextKey ?? (reversed ? this.getFirstKey() : this.getLastKey());
  }

  getKeyForSearch(search: string, fromKey?: Key | null): Key | null {
    if (!this.collator) return null;
    const collection = this.collection;
    let key = fromKey ?? this.getFirstKey();
    while (key != null) {
      const item = collection.getItem(key);
      if (!item) return null;
      const substring = item.textValue.slice(0, search.length);
      if (item.textValue && this.collator.compare(substring, search) === 0) return key;
      key = this.getNextKey(key);
    }
    return null;
  }
}

let searchCollator: Intl.Collator | undefined;
/**
 * `useCollator({ usage: "search", sensitivity: "base" })`. The `Intl.Collator` is made on the first `compare` /
 * `resolvedOptions` (typeahead), as `searchCollator` (`selection/list-keyboard-delegate.ts`): its collation data costs
 * ~3.5 ms at 1× (~13 ms at 4× CPU) on first use, which a menu / select open would otherwise pay inside its press.
 */
export const getSearchCollator = (): Intl.Collator => {
  if (!searchCollator) {
    let real: Intl.Collator | undefined;
    const made = (): Intl.Collator => (real ??= new Intl.Collator(undefined, { usage: "search", sensitivity: "base" }));
    searchCollator = { compare: (x: string, y: string) => made().compare(x, y), resolvedOptions: () => made().resolvedOptions() } as Intl.Collator;
  }
  return searchCollator;
};

/** react-aria `isNonContiguousSelectionModifier`: Alt on Apple platforms, Ctrl elsewhere. */
export const isNonContiguousSelectionModifier = (e: { altKey: boolean; ctrlKey: boolean }): boolean => (isMac() ? e.altKey : e.ctrlKey);
