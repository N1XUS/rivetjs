// Ported from @react-stately/selection (SelectionManager.ts), Apache-2.0, © Adobe.
//
// Rivet: construct per use from a collection + the serializable `MultipleSelectionState` (inside a
// handler, or in a binding: reads are tracked through the state signals). Never capture an instance
// in a resumable closure; capture the state and rebuild the manager.
import { untrack } from "@rivetjs/reactivity";
import { compareNodeOrder, getChildNodes, getFirstItem } from "../collections/nodes.ts";
import type {
  Collection,
  DisabledBehavior,
  FocusStrategy,
  Key,
  LayoutDelegate,
  Node,
  Selection,
  SelectionBehavior,
  SelectionMode,
} from "../collections/types.ts";
import { SelectionSet, setFocused, setFocusedKey, setSelectedKeys, setSelectionBehavior, readSelection, type MultipleSelectionState } from "./state.ts";
import { ALL_SELECTED, IN_SELECTION, isSelectionEmpty, selectionOf } from "./keyed.ts";

/** Pointer type of the interaction that triggered a selection (react-aria `PointerType`, `../interactions/utils.ts`). */
export type { PointerType } from "../interactions/utils.ts";
import type { PointerType } from "../interactions/utils.ts";

/** The event shape `select` reads (press / long press / pointer events). */
export interface SelectionEvent {
  pointerType?: PointerType | string | undefined;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export interface SelectionManagerOptions {
  allowsCellSelection?: boolean | undefined;
  layoutDelegate?: LayoutDelegate | undefined;
  fullCollection?: Collection<Node<unknown>> | undefined;
}

/** The read / update interface of a collection's multiple selection (react-stately `MultipleSelectionManager`). */
export interface MultipleSelectionManager {
  readonly selectionMode: SelectionMode;
  readonly selectionBehavior: SelectionBehavior;
  readonly disallowEmptySelection?: boolean;
  readonly selectedKeys: Set<Key>;
  readonly isEmpty: boolean;
  readonly isSelectAll: boolean;
  readonly firstSelectedKey: Key | null;
  readonly lastSelectedKey: Key | null;
  readonly disabledKeys: Set<Key>;
  readonly disabledBehavior: DisabledBehavior;
  readonly isFocused: boolean;
  readonly focusedKey: Key | null;
  readonly childFocusStrategy: FocusStrategy | null;
  setFocused(isFocused: boolean): void;
  setFocusedKey(key: Key | null, child?: FocusStrategy): void;
  isSelected(key: Key): boolean;
  isSelectionEqual(selection: Set<Key>): boolean;
  extendSelection(toKey: Key): void;
  toggleSelection(key: Key): void;
  replaceSelection(key: Key): void;
  setSelectedKeys(keys: Iterable<Key>): void;
  selectAll(): void;
  clearSelection(): void;
  toggleSelectAll(): void;
  select(key: Key, e?: SelectionEvent): void;
  canSelectItem(key: Key): boolean;
  isDisabled(key: Key): boolean;
  setSelectionBehavior(selectionBehavior: SelectionBehavior): void;
  isLink(key: Key): boolean;
  getItemProps(key: Key): any;
  collection: Collection<Node<unknown>>;
}

/** An interface for reading and updating multiple selection state. */
export class SelectionManager implements MultipleSelectionManager {
  collection: Collection<Node<unknown>>;
  private state: MultipleSelectionState;
  private allowsCellSelection: boolean;
  private _isSelectAll: boolean | null;
  // The selection `_isSelectAll` was computed for (managers may be reused across selection changes).
  private _isSelectAllOf: Selection | null;
  private layoutDelegate: LayoutDelegate | null;
  private fullCollection: Collection<Node<unknown>> | null;

  constructor(collection: Collection<Node<unknown>>, state: MultipleSelectionState, options?: SelectionManagerOptions) {
    this.collection = collection;
    this.state = state;
    this.allowsCellSelection = options?.allowsCellSelection ?? false;
    this._isSelectAll = null;
    this._isSelectAllOf = null;
    this.layoutDelegate = options?.layoutDelegate || null;
    this.fullCollection = options?.fullCollection || null;
  }

  /** The underlying serializable state. */
  get selectionState(): MultipleSelectionState {
    return this.state;
  }

  get selectionMode(): SelectionMode {
    return this.state.selectionMode;
  }

  get disallowEmptySelection(): boolean {
    return this.state.disallowEmptySelection;
  }

  get selectionBehavior(): SelectionBehavior {
    return this.state.selectionBehavior();
  }

  setSelectionBehavior(selectionBehavior: SelectionBehavior): void {
    setSelectionBehavior(this.state, selectionBehavior);
  }

  get isFocused(): boolean {
    return this.state.isFocused();
  }

  setFocused(isFocused: boolean): void {
    setFocused(this.state, isFocused);
  }

  get focusedKey(): Key | null {
    return this.state.focusedKey();
  }

  get childFocusStrategy(): FocusStrategy | null {
    return this.state.childFocusStrategy();
  }

  setFocusedKey(key: Key | null, childFocusStrategy?: FocusStrategy): void {
    if (key == null || this.collection.getItem(key)) setFocusedKey(this.state, key, childFocusStrategy);
  }

  get selectedKeys(): Set<Key> {
    const keys = readSelection(this.state);
    return keys === "all" ? new Set(this.getSelectAllKeys()) : keys;
  }

  /** The raw selection value: "all" or a set of keys. */
  get rawSelection(): Selection {
    return readSelection(this.state);
  }

  isSelected(key: Key): boolean {
    if (this.state.selectionMode === "none") return false;
    const mappedKey = this.getKey(key);
    if (mappedKey == null) return false;
    // Keyed read (`keyed.ts`): a binding re-runs only when this key's membership changes.
    const selected = selectionOf(this.state, mappedKey);
    return selected === ALL_SELECTED ? this.canSelectItem(mappedKey) : selected === IN_SELECTION;
  }

  get isEmpty(): boolean {
    // Keyed read: bindings re-run only when emptiness flips.
    return isSelectionEmpty(this.state);
  }

  get isSelectAll(): boolean {
    if (this.isEmpty) return false;
    const selectedKeys = readSelection(this.state);
    if (selectedKeys === "all") return true;
    if (this._isSelectAll != null && this._isSelectAllOf === selectedKeys) return this._isSelectAll;
    const allKeys = this.getSelectAllKeys();
    this._isSelectAllOf = selectedKeys;
    this._isSelectAll = allKeys.every((k) => selectedKeys.has(k));
    return this._isSelectAll;
  }

  get firstSelectedKey(): Key | null {
    let first: Node<unknown> | null = null;
    const keys = readSelection(this.state);
    for (const key of keys === "all" ? this.getSelectAllKeys() : keys) {
      const item = this.collection.getItem(key);
      if (!first || (item && compareNodeOrder(this.collection, item, first) < 0)) first = item;
    }
    return first?.key ?? null;
  }

  get lastSelectedKey(): Key | null {
    let last: Node<unknown> | null = null;
    const keys = readSelection(this.state);
    for (const key of keys === "all" ? this.getSelectAllKeys() : keys) {
      const item = this.collection.getItem(key);
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

  /** Extends the selection to the given key. */
  extendSelection(toKey: Key): void {
    if (this.selectionMode === "none") return;
    if (this.selectionMode === "single") {
      this.replaceSelection(toKey);
      return;
    }
    const mappedToKey = this.getKey(toKey);
    if (mappedToKey == null) return;

    let selection: SelectionSet;
    const raw = untrack(() => readSelection(this.state));
    // Only select the one key if coming from a select all.
    if (raw === "all") selection = new SelectionSet([mappedToKey], mappedToKey, mappedToKey);
    else {
      const anchorKey = untrack(this.state.anchorKey) ?? mappedToKey;
      const currentKey = untrack(this.state.currentKey);
      selection = new SelectionSet(raw, anchorKey, mappedToKey);
      for (const key of this.getKeyRange(anchorKey, currentKey ?? mappedToKey)) selection.delete(key);
      for (const key of this.getKeyRange(mappedToKey, anchorKey)) if (this.canSelectItem(key)) selection.add(key);
    }
    setSelectedKeys(this.state, selection);
  }

  private getKeyRange(from: Key, to: Key): Key[] {
    const fromItem = this.collection.getItem(from);
    const toItem = this.collection.getItem(to);
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
    let item = this.collection.getItem(key);
    // ¯\_(ツ)_/¯
    if (!item) return key;
    // If cell selection is allowed, just return the key.
    if (item.type === "cell" && this.allowsCellSelection) return key;
    // Find a parent item to select.
    while (item && item.type !== "item" && item.parentKey != null) item = this.collection.getItem(item.parentKey);
    if (!item || item.type !== "item") return null;
    return item.key;
  }

  /** Toggles whether the given key is selected. */
  toggleSelection(key: Key): void {
    if (this.selectionMode === "none") return;
    if (this.selectionMode === "single" && !this.isSelected(key)) {
      this.replaceSelection(key);
      return;
    }
    const mappedKey = this.getKey(key);
    if (mappedKey == null) return;
    const raw = untrack(() => readSelection(this.state));
    const keys = new SelectionSet(raw === "all" ? this.getSelectAllKeys() : raw, untrack(this.state.anchorKey), untrack(this.state.currentKey));
    if (keys.has(mappedKey)) {
      keys.delete(mappedKey);
      // TODO (upstream): move anchor to last selected key...
    } else if (this.canSelectItem(mappedKey)) {
      keys.add(mappedKey);
      keys.anchorKey = mappedKey;
      keys.currentKey = mappedKey;
    }
    if (this.disallowEmptySelection && keys.size === 0) return;
    setSelectedKeys(this.state, keys);
  }

  /** Replaces the selection with only the given key. */
  replaceSelection(key: Key): void {
    if (this.selectionMode === "none") return;
    const mappedKey = this.getKey(key);
    if (mappedKey == null) return;
    const selection = this.canSelectItem(mappedKey) ? new SelectionSet([mappedKey], mappedKey, mappedKey) : new SelectionSet();
    setSelectedKeys(this.state, selection);
  }

  /** Replaces the selection with the given keys. */
  setSelectedKeys(keys: Iterable<Key>): void {
    if (this.selectionMode === "none") return;
    const selection = new SelectionSet();
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
    // Use the full (unfiltered) collection when available so that materializing the "all" selection
    // includes items that are currently filtered out.
    const collection = this.fullCollection ?? this.collection;
    const keys: Key[] = [];
    const addKeys = (key: Key | null) => {
      while (key != null) {
        if (this.canSelectItemIn(key, collection)) {
          const item = collection.getItem(key);
          if (item?.type === "item") keys.push(key);
          // Add child keys. If cell selection is allowed, then include item children too.
          if (item?.hasChildNodes && (this.allowsCellSelection || item.type !== "item")) addKeys(getFirstItem(getChildNodes(item, collection))?.key ?? null);
        }
        key = collection.getKeyAfter(key);
      }
    };
    addKeys(collection.getFirstKey());
    return keys;
  }

  /** Selects all items in the collection. */
  selectAll(): void {
    if (!this.isSelectAll && this.selectionMode === "multiple") setSelectedKeys(this.state, "all");
  }

  /** Removes all keys from the selection. */
  clearSelection(): void {
    const raw = untrack(() => readSelection(this.state));
    if (!this.disallowEmptySelection && (raw === "all" || raw.size > 0)) setSelectedKeys(this.state, new SelectionSet());
  }

  /** Toggles between select all and an empty selection. */
  toggleSelectAll(): void {
    if (this.isSelectAll) this.clearSelection();
    else this.selectAll();
  }

  /** Toggles, replaces or extends selection depending on the event and the selection mode. */
  select(key: Key, e?: SelectionEvent): void {
    if (this.selectionMode === "none") return;
    if (this.selectionMode === "single") {
      if (this.isSelected(key) && !this.disallowEmptySelection) this.toggleSelection(key);
      else this.replaceSelection(key);
    } else if (this.selectionBehavior === "toggle" || (e && (e.pointerType === "touch" || e.pointerType === "virtual"))) {
      // Touch or virtual (VO): toggle, otherwise multi selection is impossible without modifier keys.
      this.toggleSelection(key);
    } else this.replaceSelection(key);
  }

  /** Returns whether the current selection is equal to the given selection. */
  isSelectionEqual(selection: Set<Key>): boolean {
    if (selection === readSelection(this.state)) return true;
    const selectedKeys = this.selectedKeys;
    if (selection.size !== selectedKeys.size) return false;
    for (const key of selection) if (!selectedKeys.has(key)) return false;
    for (const key of selectedKeys) if (!selection.has(key)) return false;
    return true;
  }

  canSelectItem(key: Key): boolean {
    return this.canSelectItemIn(key, this.collection);
  }

  private canSelectItemIn(key: Key, collection: Collection<Node<unknown>>): boolean {
    if (this.state.selectionMode === "none" || this.state.disabledKeys.has(key)) return false;
    const item = collection.getItem(key);
    if (!item || item?.props?.isDisabled || (item.type === "cell" && !this.allowsCellSelection)) return false;
    return true;
  }

  isDisabled(key: Key): boolean {
    const item = this.collection.getItem(key);
    return (
      this.state.disabledBehavior === "all" && (this.state.disabledKeys.has(key) || !!item?.props?.isDisabled) && item?.props?.disabledBehavior !== "selection"
    );
  }

  isLink(key: Key): boolean {
    return !!this.collection.getItem(key)?.props?.href;
  }

  getItemProps(key: Key): any {
    return this.collection.getItem(key)?.props;
  }

  withCollection(collection: Collection<Node<unknown>>): SelectionManager {
    return new SelectionManager(collection, this.state, {
      allowsCellSelection: this.allowsCellSelection,
      layoutDelegate: this.layoutDelegate || undefined,
      fullCollection: this.fullCollection ?? this.collection,
    });
  }
}
