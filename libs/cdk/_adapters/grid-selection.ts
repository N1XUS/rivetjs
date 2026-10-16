// Multiple selection: serializable state (react-stately useMultipleSelectionState) and the transient
// SelectionManager that reads/updates it against a collection. Ported from react-spectrum
// (Apache-2.0, © Adobe): packages/react-stately/src/selection/{Selection,useMultipleSelectionState,
// SelectionManager}.ts.
//
// LOCAL ADAPTER (aria-grid-tree): stands in for the cdk-collections branch until its API is published.
//
// Rivet idioms / deviations:
// - State is a plain object of signals + JSON (resumable). React's `Selection extends Set` carried
//   `anchorKey` / `currentKey` on the set; here they are separate signals (class instances do not
//   serialize). `Selection` remains as the transient value the manager builds.
// - `selectedKeys` controlled = a caller `Signal<SelectionValue>` (two-way); `onSelectionChange`
//   (R2 symbol) fires on every committed change like React's controlled callback.
// - The manager is created per event (`new SelectionManager(collection, state)`); in bindings use
//   `isKeySelected(state, key)` (no collection needed).
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import {
  compareNodeOrder,
  getChildNodes,
  getFirstItem,
  type Collection,
  type DisabledBehavior,
  type FocusStrategy,
  type Key,
  type LayoutDelegate,
  type Node,
  type SelectionBehavior,
  type SelectionMode,
  type SelectionValue,
} from "./collection.ts";

/** Transient selection value: a key set with the range anchor and the current (range end) key. */
export class Selection extends Set<Key> {
  anchorKey: Key | null;
  currentKey: Key | null;
  constructor(keys?: Iterable<Key> | Selection, anchorKey?: Key | null, currentKey?: Key | null) {
    super(keys);
    if (keys instanceof Selection) {
      this.anchorKey = anchorKey ?? keys.anchorKey;
      this.currentKey = currentKey ?? keys.currentKey;
    } else {
      this.anchorKey = anchorKey ?? null;
      this.currentKey = currentKey ?? null;
    }
  }
}

export interface MultipleSelectionStateProps {
  selectionMode?: SelectionMode;
  /** Two-way selected keys; or `defaultSelectedKeys`. */
  selectedKeys?: Signal<SelectionValue>;
  defaultSelectedKeys?: "all" | Iterable<Key>;
  onSelectionChange?: (keys: SelectionValue) => void;
  disallowEmptySelection?: boolean;
  /** @default "toggle" */
  selectionBehavior?: SelectionBehavior;
  allowDuplicateSelectionEvents?: boolean;
  disabledKeys?: Iterable<Key>;
  /** @default "all" */
  disabledBehavior?: DisabledBehavior;
}

/** Serializable selection + focus state (signals + JSON). */
export interface MultipleSelectionState {
  readonly selectionMode: SelectionMode;
  readonly disallowEmptySelection: boolean;
  /** The `selectionBehavior` prop (long press on touch switches the live behaviour to toggle). */
  readonly selectionBehaviorProp: SelectionBehavior;
  readonly selectionBehavior: Signal<SelectionBehavior>;
  readonly selectedKeys: Signal<SelectionValue>;
  readonly anchorKey: Signal<Key | null>;
  readonly currentKey: Signal<Key | null>;
  readonly disabledKeys: Set<Key>;
  readonly disabledBehavior: DisabledBehavior;
  readonly allowDuplicateSelectionEvents: boolean;
  readonly isFocused: Signal<boolean>;
  readonly focusedKey: Signal<Key | null>;
  readonly childFocusStrategy: Signal<FocusStrategy | null>;
  readonly onSelectionChange?: ((keys: SelectionValue) => void) | undefined;
}

const toSelection = (value: "all" | Iterable<Key> | null | undefined): SelectionValue | undefined =>
  value == null ? undefined : value === "all" ? "all" : new Set(value);

export function createMultipleSelectionState(props: MultipleSelectionStateProps = {}): MultipleSelectionState {
  const behaviour = props.selectionBehavior ?? "toggle";
  return {
    selectionMode: props.selectionMode ?? "none",
    disallowEmptySelection: props.disallowEmptySelection ?? false,
    selectionBehaviorProp: behaviour,
    selectionBehavior: signal(behaviour),
    selectedKeys: props.selectedKeys ?? signal<SelectionValue>(toSelection(props.defaultSelectedKeys) ?? new Set()),
    anchorKey: signal<Key | null>(null),
    currentKey: signal<Key | null>(null),
    disabledKeys: new Set(props.disabledKeys ?? []),
    disabledBehavior: props.disabledBehavior ?? "all",
    allowDuplicateSelectionEvents: props.allowDuplicateSelectionEvents ?? false,
    isFocused: signal(false),
    focusedKey: signal<Key | null>(null),
    childFocusStrategy: signal<FocusStrategy | null>(null),
    onSelectionChange: props.onSelectionChange,
  };
}

function equalSets(a: SelectionValue, b: SelectionValue): boolean {
  if (a === "all" || b === "all") return a === b;
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

/** Commit `keys` (react-stately `setSelectedKeys` incl. the duplicate-event guard). */
export function setSelectedKeys(state: MultipleSelectionState, keys: Selection | "all"): void {
  const current = untrack(state.selectedKeys);
  if (keys !== "all") {
    state.anchorKey.set(keys.anchorKey);
    state.currentKey.set(keys.currentKey);
  }
  if (!state.allowDuplicateSelectionEvents && equalSets(keys, current)) return;
  const value: SelectionValue = keys === "all" ? "all" : new Set(keys);
  state.selectedKeys.set(value);
  // `selectionBehavior="replace"` that switched to toggle (touch long press) resets once empty.
  if (state.selectionBehaviorProp === "replace" && value !== "all" && value.size === 0) state.selectionBehavior.set("replace");
  state.onSelectionChange?.(value);
}

/** Focus setters (react-stately FocusState). */
export function setFocusedKey(state: MultipleSelectionState, key: Key | null, childFocusStrategy: FocusStrategy = "first"): void {
  state.focusedKey.set(key);
  state.childFocusStrategy.set(childFocusStrategy);
}

/**
 * Whether `key` is selected, for render bindings (reads `selectedKeys`). `itemDisabled`: the item is
 * disabled (an `"all"` selection does not include it).
 */
export function isKeySelected(state: MultipleSelectionState, key: Key, itemDisabled = false): boolean {
  if (state.selectionMode === "none") return false;
  const keys = state.selectedKeys();
  if (keys === "all") return !itemDisabled && !hasKey(state.disabledKeys, key);
  return hasKey(keys, key);
}

/** Whether the item is disabled for interaction (react-stately `isDisabled`), from state + item flags. */
export function isKeyDisabled(state: MultipleSelectionState, key: Key, itemDisabled = false, itemDisabledBehavior?: DisabledBehavior): boolean {
  return state.disabledBehavior === "all" && (hasKey(state.disabledKeys, key) || itemDisabled) && itemDisabledBehavior !== "selection";
}

/** Keys compare as strings: DOM keys are attribute strings, data keys may be numbers. */
export function hasKey(set: ReadonlySet<Key>, key: Key): boolean {
  if (set.has(key)) return true;
  const text = String(key);
  for (const k of set) if (String(k) === text) return true;
  return false;
}

interface SelectionManagerOptions {
  allowsCellSelection?: boolean;
  layoutDelegate?: LayoutDelegate;
  fullCollection?: Collection<Node>;
}

/** react-stately SelectionManager over a collection + the serializable state. Create per event. */
export class SelectionManager {
  collection: Collection<Node>;
  private state: MultipleSelectionState;
  private allowsCellSelection: boolean;
  private _isSelectAll: boolean | null = null;
  private layoutDelegate: LayoutDelegate | null;
  private fullCollection: Collection<Node> | null;

  constructor(collection: Collection<Node>, state: MultipleSelectionState, options?: SelectionManagerOptions) {
    this.collection = collection;
    this.state = state;
    this.allowsCellSelection = options?.allowsCellSelection ?? false;
    this.layoutDelegate = options?.layoutDelegate || null;
    this.fullCollection = options?.fullCollection || null;
  }

  private get keys(): SelectionValue {
    return untrack(this.state.selectedKeys);
  }

  get selectionMode(): SelectionMode {
    return this.state.selectionMode;
  }
  get disallowEmptySelection(): boolean {
    return this.state.disallowEmptySelection;
  }
  get selectionBehavior(): SelectionBehavior {
    return untrack(this.state.selectionBehavior);
  }
  setSelectionBehavior(selectionBehavior: SelectionBehavior): void {
    this.state.selectionBehavior.set(selectionBehavior);
  }
  get isFocused(): boolean {
    return untrack(this.state.isFocused);
  }
  setFocused(isFocused: boolean): void {
    this.state.isFocused.set(isFocused);
  }
  get focusedKey(): Key | null {
    return untrack(this.state.focusedKey);
  }
  get childFocusStrategy(): FocusStrategy | null {
    return untrack(this.state.childFocusStrategy);
  }
  setFocusedKey(key: Key | null, childFocusStrategy?: FocusStrategy): void {
    if (key == null || this.collection.getItem(key)) setFocusedKey(this.state, key, childFocusStrategy);
  }

  get selectedKeys(): Set<Key> {
    const keys = this.keys;
    return keys === "all" ? new Set(this.getSelectAllKeys()) : this.normalized(keys);
  }

  /** Raw selection: `"all"` or the key set. */
  get rawSelection(): SelectionValue {
    return this.keys;
  }

  /** The state's keys mapped onto the collection's key identity (string DOM keys vs number data keys). */
  private normalized(keys: Set<Key>): Set<Key> {
    const out = new Set<Key>();
    for (const key of keys) out.add(this.collectionKey(key));
    return out;
  }

  private collectionKey(key: Key): Key {
    if (this.collection.getItem(key)) return key;
    const alt = typeof key === "number" ? String(key) : Number(key);
    return typeof alt === "number" && Number.isNaN(alt) ? key : this.collection.getItem(alt) ? alt : key;
  }

  private has(keys: Set<Key>, key: Key): boolean {
    return hasKey(keys, key);
  }

  isSelected(key: Key): boolean {
    if (this.state.selectionMode === "none") return false;
    const mapped = this.getKey(key);
    if (mapped == null) return false;
    const keys = this.keys;
    return keys === "all" ? this.canSelectItem(mapped) : this.has(keys, mapped);
  }

  get isEmpty(): boolean {
    const keys = this.keys;
    return keys !== "all" && keys.size === 0;
  }

  get isSelectAll(): boolean {
    if (this.isEmpty) return false;
    const keys = this.keys;
    if (keys === "all") return true;
    if (this._isSelectAll != null) return this._isSelectAll;
    const all = this.getSelectAllKeys();
    this._isSelectAll = all.every((k) => this.has(keys, k));
    return this._isSelectAll;
  }

  get firstSelectedKey(): Key | null {
    let first: Node | null = null;
    const keys = this.keys;
    if (keys === "all") return this.getSelectAllKeys()[0] ?? null;
    for (const key of keys) {
      const item = this.collection.getItem(this.collectionKey(key));
      if (!first || (item && compareNodeOrder(this.collection, item, first) < 0)) first = item;
    }
    return first?.key ?? null;
  }

  get lastSelectedKey(): Key | null {
    let last: Node | null = null;
    const keys = this.keys;
    if (keys === "all") {
      const all = this.getSelectAllKeys();
      return all[all.length - 1] ?? null;
    }
    for (const key of keys) {
      const item = this.collection.getItem(this.collectionKey(key));
      if (!last || (item && compareNodeOrder(this.collection, item, last) > 0)) last = item;
    }
    return last?.key ?? null;
  }

  get disabledKeys(): Set<Key> {
    return this.state.disabledKeys;
  }
  get disabledBehavior(): DisabledBehavior {
    return this.state.disabledBehavior;
  }

  extendSelection(toKey: Key): void {
    if (this.selectionMode === "none") return;
    if (this.selectionMode === "single") {
      this.replaceSelection(toKey);
      return;
    }
    const mappedToKey = this.getKey(toKey);
    if (mappedToKey == null) return;
    let selection: Selection;
    const keys = this.keys;
    if (keys === "all") selection = new Selection([mappedToKey], mappedToKey, mappedToKey);
    else {
      const current = new Selection(this.normalized(keys), untrack(this.state.anchorKey), untrack(this.state.currentKey));
      const anchorKey = current.anchorKey != null ? this.collectionKey(current.anchorKey) : mappedToKey;
      selection = new Selection(current, anchorKey, mappedToKey);
      for (const key of this.getKeyRange(anchorKey, current.currentKey != null ? this.collectionKey(current.currentKey) : mappedToKey)) selection.delete(key);
      for (const key of this.getKeyRange(mappedToKey, anchorKey)) if (this.canSelectItem(key)) selection.add(key);
    }
    setSelectedKeys(this.state, selection);
  }

  private getKeyRange(from: Key, to: Key): Key[] {
    const fromItem = this.collection.getItem(from),
      toItem = this.collection.getItem(to);
    if (fromItem && toItem) {
      if (compareNodeOrder(this.collection, fromItem, toItem) <= 0) return this.getKeyRangeInternal(from, to);
      return this.getKeyRangeInternal(to, from);
    }
    return [];
  }

  private getKeyRangeInternal(from: Key, to: Key): Key[] {
    if (this.layoutDelegate?.getKeyRange) return this.layoutDelegate.getKeyRange(from, to);
    const keys: Key[] = [];
    let key: Key | null = from;
    while (key != null) {
      const item = this.collection.getItem(key);
      if (item && (item.type === "item" || (item.type === "cell" && this.allowsCellSelection))) keys.push(key);
      if (key === to) return keys;
      key = this.collection.getKeyAfter(key);
    }
    return [];
  }

  private getKey(key: Key): Key | null {
    key = this.collectionKey(key);
    let item = this.collection.getItem(key);
    if (!item) return key;
    if (item.type === "cell" && this.allowsCellSelection) return key;
    while (item && item.type !== "item" && item.parentKey != null) item = this.collection.getItem(item.parentKey);
    if (!item || item.type !== "item") return null;
    return item.key;
  }

  toggleSelection(key: Key): void {
    if (this.selectionMode === "none") return;
    if (this.selectionMode === "single" && !this.isSelected(key)) {
      this.replaceSelection(key);
      return;
    }
    const mappedKey = this.getKey(key);
    if (mappedKey == null) return;
    const raw = this.keys;
    const keys = new Selection(raw === "all" ? this.getSelectAllKeys() : this.normalized(raw), untrack(this.state.anchorKey), untrack(this.state.currentKey));
    if (keys.has(mappedKey)) keys.delete(mappedKey);
    else if (this.canSelectItem(mappedKey)) {
      keys.add(mappedKey);
      keys.anchorKey = mappedKey;
      keys.currentKey = mappedKey;
    }
    if (this.disallowEmptySelection && keys.size === 0) return;
    setSelectedKeys(this.state, keys);
  }

  replaceSelection(key: Key): void {
    if (this.selectionMode === "none") return;
    const mappedKey = this.getKey(key);
    if (mappedKey == null) return;
    const selection = this.canSelectItem(mappedKey) ? new Selection([mappedKey], mappedKey, mappedKey) : new Selection();
    setSelectedKeys(this.state, selection);
  }

  setSelectedKeys(keys: Iterable<Key>): void {
    if (this.selectionMode === "none") return;
    const selection = new Selection();
    for (const key of keys) {
      const mappedKey = this.getKey(key);
      if (mappedKey != null) {
        selection.add(mappedKey);
        if (this.selectionMode === "single") break;
      }
    }
    setSelectedKeys(this.state, selection);
  }

  private getSelectAllKeys(): Key[] {
    const collection = this.fullCollection ?? this.collection;
    const keys: Key[] = [];
    const addKeys = (key: Key | null) => {
      while (key != null) {
        if (this.canSelectItemIn(key, collection)) {
          const item = collection.getItem(key);
          if (item?.type === "item") keys.push(key);
          if (item?.hasChildNodes && (this.allowsCellSelection || item.type !== "item")) addKeys(getFirstItem(getChildNodes(item, collection))?.key ?? null);
        }
        key = collection.getKeyAfter(key);
      }
    };
    addKeys(collection.getFirstKey());
    return keys;
  }

  selectAll(): void {
    if (!this.isSelectAll && this.selectionMode === "multiple") setSelectedKeys(this.state, "all");
  }

  clearSelection(): void {
    const keys = this.keys;
    if (!this.disallowEmptySelection && (keys === "all" || keys.size > 0)) setSelectedKeys(this.state, new Selection());
  }

  toggleSelectAll(): void {
    if (this.isSelectAll) this.clearSelection();
    else this.selectAll();
  }

  select(key: Key, e?: { pointerType?: string }): void {
    if (this.selectionMode === "none") return;
    if (this.selectionMode === "single") {
      if (this.isSelected(key) && !this.disallowEmptySelection) this.toggleSelection(key);
      else this.replaceSelection(key);
    } else if (this.selectionBehavior === "toggle" || (e && (e.pointerType === "touch" || e.pointerType === "virtual"))) this.toggleSelection(key);
    else this.replaceSelection(key);
  }

  isSelectionEqual(selection: Set<Key>): boolean {
    if (selection === this.keys) return true;
    const selected = this.selectedKeys;
    if (selection.size !== selected.size) return false;
    for (const key of selection) if (!this.has(selected, key)) return false;
    for (const key of selected) if (!this.has(selection, key)) return false;
    return true;
  }

  canSelectItem(key: Key): boolean {
    return this.canSelectItemIn(key, this.collection);
  }

  private canSelectItemIn(key: Key, collection: Collection<Node>): boolean {
    if (this.state.selectionMode === "none" || hasKey(this.state.disabledKeys, key)) return false;
    const item = collection.getItem(key);
    if (!item || item.props?.isDisabled || (item.type === "cell" && !this.allowsCellSelection)) return false;
    return true;
  }

  isDisabled(key: Key): boolean {
    const item = this.collection.getItem(key);
    return this.state.disabledBehavior === "all" && (hasKey(this.state.disabledKeys, key) || !!item?.props?.isDisabled) && item?.props?.disabledBehavior !== "selection";
  }

  isLink(key: Key): boolean {
    return !!this.collection.getItem(key)?.props?.href;
  }

  getItemProps(key: Key): Node["props"] {
    return this.collection.getItem(key)?.props;
  }

  withCollection(collection: Collection<Node>): SelectionManager {
    return new SelectionManager(collection, this.state, {
      allowsCellSelection: this.allowsCellSelection,
      layoutDelegate: this.layoutDelegate || undefined,
      fullCollection: this.fullCollection ?? this.collection,
    });
  }
}
