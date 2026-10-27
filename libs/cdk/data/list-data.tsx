// Ported from @react-stately/data (useListData.ts), Apache-2.0, © Adobe.
//
// Rivet:
// - `useListData` → `createListData` (wave-2 decision 7; docs map the RAC name). Call it once in a
//   component body (or module scope for shared data); it returns a plain object of signals +
//   arrow functions, so a resumed page shares it between handlers and bindings.
// - Reactive members: `items` is a computed accessor (`list.items()`, filtered by `filterText`),
//   `selectedKeys` is a two-way `Signal<Selection>` (pass it straight to a collection's
//   `selectedKeys`; `setSelectedKeys` writes the same signal), `filterText` an accessor. React's
//   `{...state}` snapshot is `listDataState(list)`.
// - `.tsx` without JSX: resume-compiled so the arrow functions of the returned object are R2 symbols
//   (a `.ts` module's closures would not serialize). `filter` / `getKey` options must be inline
//   arrows or local functions (they are captured).
import { batch, computed, signal, untrack, type Signal } from "@rivetjs/reactivity";
import type { Key, Selection } from "../collections/types.ts";

export interface ListOptions<T> {
  /** Initial items in the list. */
  initialItems?: T[] | undefined;
  /** The keys for the initially selected items. */
  initialSelectedKeys?: "all" | Iterable<Key> | undefined;
  /** The initial text to filter the list by. */
  initialFilterText?: string | undefined;
  /** A function that returns a unique key for an item object. Default `item.id ?? item.key`. */
  getKey?: ((item: T) => Key) | undefined;
  /** A function that returns whether a item matches the current filter text. */
  filter?: ((item: T, filterText: string) => boolean) | undefined;
}

/** The list operations shared by `createListData` and `createAsyncList` (react-stately `createListActions` result). */
export interface ListActions<T> {
  /** Sets the selected keys. */
  setSelectedKeys(keys: Selection): void;
  /** Adds the given keys to the current selected keys. */
  addKeysToSelection(keys: Selection): void;
  /** Removes the given keys from the current selected keys. */
  removeKeysFromSelection(keys: Selection): void;
  /** Sets the filter text. */
  setFilterText(filterText: string): void;
  /** Inserts items into the list at the given index. */
  insert(index: number, ...values: T[]): void;
  /** Inserts items into the list before the item at the given key. */
  insertBefore(key: Key, ...values: T[]): void;
  /** Inserts items into the list after the item at the given key. */
  insertAfter(key: Key, ...values: T[]): void;
  /** Appends items to the list. */
  append(...values: T[]): void;
  /** Prepends items to the list. */
  prepend(...values: T[]): void;
  /** Removes items from the list by their keys. */
  remove(...keys: Key[]): void;
  /** Removes all items from the list that are currently in the set of selected items. */
  removeSelectedItems(): void;
  /** Moves an item within the list. */
  move(key: Key, toIndex: number): void;
  /** Moves one or more items before a given key. */
  moveBefore(key: Key, keys: Iterable<Key>): void;
  /** Moves one or more items after a given key. */
  moveAfter(key: Key, keys: Iterable<Key>): void;
  /** Updates an item in the list (new value, or a function of the previous value). */
  update(key: Key, newValue: T | ((prev: T) => T)): void;
}

export interface ListData<T> extends ListActions<T> {
  /** The items in the list (filtered by `filterText` when a `filter` is given). Reads state. */
  readonly items: () => T[];
  /** The keys of the currently selected items in the list (two-way signal). */
  readonly selectedKeys: Signal<Selection>;
  /** The current filter text. Reads state. */
  readonly filterText: () => string;
  /** Gets an item from the (unfiltered) list by key. */
  getItem(key: Key): T | undefined;
}

/** The plain state react-stately's list reducer works on. */
export interface ListState<T> {
  items: T[];
  selectedKeys: Selection;
  filterText: string;
}

/** The signals behind a list (`createListActions` reads and writes them). */
export interface ListStore<T> {
  readonly rawItems: Signal<T[]>;
  readonly selectedKeys: Signal<Selection>;
  readonly filterTextSignal: Signal<string>;
}

export interface CreateListOptions<T, C> extends ListOptions<T> {
  /** The pagination cursor (async lists): read when the last item is removed. */
  cursor?: (() => C | undefined) | undefined;
}

/** Snapshot of the list state (react-stately's `state`; reads the signals). */
export function listStoreState<T>(store: ListStore<T>): ListState<T> {
  return { items: store.rawItems(), selectedKeys: store.selectedKeys(), filterText: store.filterTextSignal() };
}

/** Applies a reducer step to the store: writes back the fields that changed (one batch). */
export function dispatchList<T>(store: ListStore<T>, updater: (state: ListState<T>) => ListState<T>): void {
  batch(() => {
    const state = untrack(() => listStoreState(store));
    const next = updater(state);
    if (next === state) return;
    if (next.items !== state.items) store.rawItems.set(next.items);
    if (next.selectedKeys !== state.selectedKeys) store.selectedKeys.set(next.selectedKeys);
    if (next.filterText !== state.filterText) store.filterTextSignal.set(next.filterText);
  });
}

/** The list operations over a dispatch function (react-stately `createListActions`). */
export function createListActions<T, C>(opts: CreateListOptions<T, C>, dispatch: (updater: (state: ListState<T>) => ListState<T>) => void): ListActions<T> {
  const { cursor } = opts;
  const getKey = opts.getKey!;
  return {
    setSelectedKeys: (selectedKeys: Selection) => dispatch((state) => ({ ...state, selectedKeys })),
    addKeysToSelection: (selectedKeys: Selection) =>
      dispatch((state) => {
        if (state.selectedKeys === "all") return state;
        if (selectedKeys === "all") return { ...state, selectedKeys: "all" };
        return { ...state, selectedKeys: new Set([...state.selectedKeys, ...selectedKeys]) };
      }),
    removeKeysFromSelection: (selectedKeys: Selection) =>
      dispatch((state) => {
        if (selectedKeys === "all") return { ...state, selectedKeys: new Set() };
        const selection: Set<Key> = state.selectedKeys === "all" ? new Set(state.items.map(getKey)) : new Set(state.selectedKeys);
        for (const key of selectedKeys) selection.delete(key);
        return { ...state, selectedKeys: selection };
      }),
    setFilterText: (filterText: string) => dispatch((state) => ({ ...state, filterText })),
    insert: (index: number, ...values: T[]) => dispatch((state) => insert(state, index, ...values)),
    insertBefore: (key: Key, ...values: T[]) =>
      dispatch((state) => {
        let index = state.items.findIndex((item) => getKey(item) === key);
        if (index === -1) {
          if (state.items.length === 0) index = 0;
          else return state;
        }
        return insert(state, index, ...values);
      }),
    insertAfter: (key: Key, ...values: T[]) =>
      dispatch((state) => {
        let index = state.items.findIndex((item) => getKey(item) === key);
        if (index === -1) {
          if (state.items.length === 0) index = 0;
          else return state;
        }
        return insert(state, index + 1, ...values);
      }),
    prepend: (...values: T[]) => dispatch((state) => insert(state, 0, ...values)),
    append: (...values: T[]) => dispatch((state) => insert(state, state.items.length, ...values)),
    remove: (...keys: Key[]) =>
      dispatch((state) => {
        const keySet = new Set(keys);
        const items = state.items.filter((item) => !keySet.has(getKey(item)));
        let selection: Selection = "all";
        if (state.selectedKeys !== "all") {
          selection = new Set(state.selectedKeys);
          for (const key of keys) selection.delete(key);
        }
        if ((cursor ? cursor() : undefined) == null && items.length === 0) selection = new Set();
        return { ...state, items, selectedKeys: selection };
      }),
    removeSelectedItems: () =>
      dispatch((state) => {
        if (state.selectedKeys === "all") return { ...state, items: [], selectedKeys: new Set() };
        const selectedKeys = state.selectedKeys;
        const items = state.items.filter((item) => !selectedKeys.has(getKey(item)));
        return { ...state, items, selectedKeys: new Set() };
      }),
    move: (key: Key, toIndex: number) =>
      dispatch((state) => {
        const index = state.items.findIndex((item) => getKey(item) === key);
        if (index === -1) return state;
        const copy = state.items.slice();
        const [item] = copy.splice(index, 1);
        copy.splice(toIndex, 0, item);
        return { ...state, items: copy };
      }),
    moveBefore: (key: Key, keys: Iterable<Key>) =>
      dispatch((state) => {
        const toIndex = state.items.findIndex((item) => getKey(item) === key);
        if (toIndex === -1) return state;
        // Find indices of keys to move. Sort them so that the order in the list is retained.
        const keyArray = Array.isArray(keys) ? keys : [...keys];
        const indices = keyArray.map((k) => state.items.findIndex((item) => getKey(item) === k)).sort((a, b) => a - b);
        return move(state, indices, toIndex);
      }),
    moveAfter: (key: Key, keys: Iterable<Key>) =>
      dispatch((state) => {
        const toIndex = state.items.findIndex((item) => getKey(item) === key);
        if (toIndex === -1) return state;
        const keyArray = Array.isArray(keys) ? keys : [...keys];
        const indices = keyArray.map((k) => state.items.findIndex((item) => getKey(item) === k)).sort((a, b) => a - b);
        return move(state, indices, toIndex + 1);
      }),
    update: (key: Key, newValue: T | ((prev: T) => T)) =>
      dispatch((state) => {
        const index = state.items.findIndex((item) => getKey(item) === key);
        if (index === -1) return state;
        const updatedValue = typeof newValue === "function" ? (newValue as (prev: T) => T)(state.items[index]) : newValue;
        return { ...state, items: [...state.items.slice(0, index), updatedValue, ...state.items.slice(index + 1)] };
      }),
  };
}

function insert<T>(state: ListState<T>, index: number, ...values: T[]): ListState<T> {
  return { ...state, items: [...state.items.slice(0, index), ...values, ...state.items.slice(index)] };
}

function move<T>(state: ListState<T>, indices: number[], toIndex: number): ListState<T> {
  // Bulk moves of distinct, present indices are a stable partition. Keep the upstream
  // splice algorithm for small moves and its duplicate / missing-key edge cases.
  if (indices.length > 16 && indices.every((index, i) => index >= 0 && (i === 0 || index > indices[i - 1]))) {
    const copy = state.items.slice();
    const moved: T[] = [];
    let next = 0;
    let kept = 0;
    let target = toIndex;
    for (let i = 0; i < copy.length; i++) {
      if (i === indices[next]) {
        moved.push(copy[i]);
        next++;
        if (i < toIndex) target--;
      } else {
        if (i in copy) copy[kept] = copy[i];
        else delete copy[kept];
        kept++;
      }
    }
    copy.length = kept;
    // One gap for the moved items; preserve holes and avoid a spread-argument limit.
    for (let i = kept - 1; i >= target; i--) {
      if (i in copy) copy[i + moved.length] = copy[i];
      else delete copy[i + moved.length];
    }
    copy.length = kept + moved.length;
    for (let i = 0; i < moved.length; i++) copy[target + i] = moved[i];
    return { ...state, items: copy };
  }
  // Shift the target down by the number of items being moved from before the target.
  toIndex -= indices.filter((index) => index < toIndex).length;
  const moves = indices.map((from) => ({ from, to: toIndex++ }));
  // Shift later from indices down if they have a larger index.
  for (let i = 0; i < moves.length; i++) {
    const a = moves[i].from;
    for (let j = i; j < moves.length; j++) {
      const b = moves[j].from;
      if (b > a) moves[j].from--;
    }
  }
  // Interleave the moves so they can be applied one by one rather than all at once.
  for (let i = 0; i < moves.length; i++) {
    const a = moves[i];
    for (let j = moves.length - 1; j > i; j--) {
      const b = moves[j];
      if (b.from < a.to) a.to++;
      else b.from++;
    }
  }
  const copy = state.items.slice();
  for (const m of moves) {
    const [item] = copy.splice(m.from, 1);
    copy.splice(m.to, 0, item);
  }
  return { ...state, items: copy };
}

/** Default item key: `item.id ?? item.key` (react-stately). */
export const defaultGetKey = (item: any): Key => item.id ?? item.key;

/**
 * Manages state for an immutable list data structure, and provides convenience methods to update
 * the data over time (react-stately `useListData`).
 */
export function createListData<T>(options: ListOptions<T> = {}): ListData<T> {
  const { initialItems = [], initialSelectedKeys, filter, initialFilterText = "" } = options;
  // Resumable: a module-level default is not a serializable capture; the fallback is an object-literal arrow (a resume symbol).
  const userKey = options.getKey;
  const keys = { get: (item: T): Key => (userKey ? userKey(item) : defaultGetKey(item)) };
  const getKey = keys.get;
  // Store both items and filteredItems so we can go back to the unfiltered list.
  const store: ListStore<T> = {
    rawItems: signal<T[]>(initialItems),
    selectedKeys: signal<Selection>(initialSelectedKeys === "all" ? "all" : new Set(initialSelectedKeys || [])),
    filterTextSignal: signal(initialFilterText),
  };
  const items = computed(() => {
    const all = store.rawItems();
    if (!filter) return all;
    const text = store.filterTextSignal();
    return all.filter((item) => filter(item, text));
  });
  // Resumable: an arrow only passed as an argument is not a resume symbol, so it lives in an object literal
  // (whose arrow properties are) — the actions capture it.
  const io = { dispatch: (updater: (state: ListState<T>) => ListState<T>) => dispatchList(store, updater) };
  return {
    items,
    selectedKeys: store.selectedKeys,
    filterText: store.filterTextSignal,
    ...createListActions({ getKey }, io.dispatch),
    getItem: (key: Key) => store.rawItems().find((item) => getKey(item) === key),
  };
}

/** react-stately's `{...state}` snapshot of a list (items filtered). Reads state. */
export function listDataState<T>(list: ListData<T>): ListState<T> {
  return { items: list.items(), selectedKeys: list.selectedKeys(), filterText: list.filterText() };
}
