// Ported from @react-stately/data (useAsyncList.ts), Apache-2.0, © Adobe.
//
// Rivet:
// - `useAsyncList` → `createAsyncList` (wave-2 decision 7). Returns a plain object of signals +
//   arrow functions (resumable; `.tsx` so the arrows are R2 symbols). Reactive members are
//   accessors: `items()`, `isLoading()`, `loadingState()`, `error()`, `sortDescriptor()`,
//   `filterText()`; `selectedKeys` is a two-way `Signal<Selection>`.
// - The reducer state is one signal (`data`); the in-flight AbortController lives outside it, in a
//   browser-only WeakMap keyed by that signal (controllers do not serialize).
// - React's mount effect (initial `loading` fetch) is a `clientEffect` when called under an owner
//   (component body: runs once in the browser after mount, also on a resumed page), else it runs
//   at once (no owner = no mount to wait for). A server render shows the initial `loading` state, as react-aria's SSR does.
// - `load` / `sort` / `getKey` options must be inline arrows or local functions (captured).
// - react-stately's methods read the reducer state of the current render (a closure): calls made
//   in one synchronous task (one event handler) all see the state as it was when the task started.
//   Rivet keeps that: `rendered()` snapshots the state on first read and drops the snapshot in a
//   microtask, so e.g. three `loadMore()` calls in one handler each start (and the reducer aborts
//   the duplicates), as upstream.
import { batch, computed, getOwner, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { Key, LoadingState, Selection, SortDescriptor } from "../collections/types.ts";
import { createListActions, type ListActions, type ListState } from "./list-data.tsx";

export interface AsyncListOptions<T, C> {
  /** The keys for the initially selected items. */
  initialSelectedKeys?: "all" | Iterable<Key> | undefined;
  /** The initial sort descriptor. */
  initialSortDescriptor?: SortDescriptor | undefined;
  /** The initial filter text. */
  initialFilterText?: string | undefined;
  /** A function that returns a unique key for an item object. Default `item.id || item.key`. */
  getKey?: ((item: T) => Key) | undefined;
  /** A function that loads the data for the items in the list. */
  load: AsyncListLoadFunction<T, C>;
  /** An optional function that performs sorting. If not provided, `sortDescriptor` is passed to `load`. */
  sort?: AsyncListLoadFunction<T, C, AsyncListLoadOptions<T, C> & { sortDescriptor: SortDescriptor }> | undefined;
}

export type AsyncListLoadFunction<T, C, S extends AsyncListLoadOptions<T, C> = AsyncListLoadOptions<T, C>> = (
  state: S,
) => AsyncListStateUpdate<T, C> | Promise<AsyncListStateUpdate<T, C>>;

export interface AsyncListLoadOptions<T, C> {
  /** The items currently in the list. */
  items: T[];
  /** The keys of the currently selected items in the list. */
  selectedKeys: Selection;
  /** The current sort descriptor for the list. */
  sortDescriptor?: SortDescriptor | undefined;
  /** An abort signal used to notify the load function that the request has been aborted. */
  signal: AbortSignal;
  /** The pagination cursor returned from the last page load. */
  cursor?: C | undefined;
  /** The current filter text used to perform server side filtering. */
  filterText?: string | undefined;
  /** The current loading state of the list. */
  loadingState?: LoadingState | undefined;
}

export interface AsyncListStateUpdate<T, C> {
  /** The new items to append to the list. */
  items: Iterable<T>;
  /** The keys to add to the selection. */
  selectedKeys?: Iterable<Key> | "all" | undefined;
  /** The sort descriptor to set. */
  sortDescriptor?: SortDescriptor | undefined;
  /** The pagination cursor to be used for the next page load. */
  cursor?: C | undefined;
  /** The updated filter text for the list. */
  filterText?: string | undefined;
}

interface AsyncListState<T, C> extends ListState<T> {
  state: LoadingState;
  sortDescriptor?: SortDescriptor | undefined;
  error?: Error | undefined;
  /** Rivet: id of the in-flight request (the AbortController itself lives in `controllers`). */
  request?: number | undefined;
  cursor?: C | undefined;
}

type ActionType = "success" | "error" | "loading" | "loadingMore" | "sorting" | "update" | "filtering";
interface Action<T, C> {
  type: ActionType;
  items?: Iterable<T> | undefined;
  selectedKeys?: Iterable<Key> | "all" | undefined;
  sortDescriptor?: SortDescriptor | undefined;
  error?: Error | undefined;
  /** Rivet: request id standing for react-stately's `abortController`. */
  request?: number | undefined;
  updater?: ((state: ListState<T>) => ListState<T>) | undefined;
  cursor?: C | undefined;
  filterText?: string | undefined;
}

export interface AsyncListData<T> extends ListActions<T> {
  /** The items in the list. Reads state. */
  readonly items: () => T[];
  /** The keys of the currently selected items in the list (two-way signal). */
  readonly selectedKeys: Signal<Selection>;
  /** The current filter text. Reads state. */
  readonly filterText: () => string;
  /** Gets an item from the list by key. */
  getItem(key: Key): T | undefined;
  /** Whether data is currently being loaded. Reads state. */
  readonly isLoading: () => boolean;
  /** If loading data failed, then this contains the error that occurred. Reads state. */
  readonly error: () => Error | undefined;
  /** The current sort descriptor for the list. Reads state. */
  readonly sortDescriptor: () => SortDescriptor | undefined;
  /** The current loading state for the list. Reads state. */
  readonly loadingState: () => LoadingState;
  /** Reloads the data in the list. */
  reload(): void;
  /** Loads the next page of data in the list. */
  loadMore(): void;
  /** Triggers sorting for the list. */
  sort(descriptor: SortDescriptor): void;
}

// In-flight AbortControllers per list (browser-only, never serialized).
const controllers = new WeakMap<object, Map<number, AbortController>>();
// A const holder, not a `let`: resume chunks import module bindings read-only (an imported `let` cannot be incremented).
const requests = { next: 0 };

function abortRequest(owner: object, request: number | undefined, reason?: unknown): void {
  if (request == null) return;
  controllers.get(owner)?.get(request)?.abort(reason);
}

function reducer<T, C>(owner: object, data: AsyncListState<T, C>, action: Action<T, C>): AsyncListState<T, C> {
  let selectedKeys: Selection | Iterable<Key>;
  switch (data.state) {
    case "idle":
    case "error":
      switch (action.type) {
        case "loading":
        case "loadingMore":
        case "sorting":
        case "filtering":
          return {
            ...data,
            filterText: action.filterText ?? data.filterText,
            state: action.type,
            // Reset items to an empty list if loading, but not when sorting.
            items: action.type === "loading" ? [] : data.items,
            sortDescriptor: action.sortDescriptor ?? data.sortDescriptor,
            request: action.request,
          };
        case "update":
          return { ...data, ...action.updater?.(data) };
        case "success":
        case "error":
          return data;
        default:
          throw new Error(`Invalid action "${action.type}" in state "${data.state}"`);
      }
    case "loading":
    case "sorting":
    case "filtering":
      switch (action.type) {
        case "success":
          // Ignore if there is a newer request in state: multiple requests were going at once and we
          // only take the latest result.
          if (action.request !== data.request) return data;
          selectedKeys = action.selectedKeys ?? data.selectedKeys;
          return {
            ...data,
            filterText: action.filterText ?? data.filterText,
            state: "idle",
            items: [...(action.items ?? [])],
            selectedKeys: selectedKeys === "all" ? "all" : new Set(selectedKeys),
            sortDescriptor: action.sortDescriptor ?? data.sortDescriptor,
            request: undefined,
            cursor: action.cursor,
          };
        case "error":
          if (action.request !== data.request) return data;
          return { ...data, state: "error", error: action.error, request: undefined };
        case "loading":
        case "loadingMore":
        case "sorting":
        case "filtering":
          // Already loading, and another load was triggered at the same time: abort the previous
          // load and start a new one.
          abortRequest(owner, data.request, "aborting current load and starting new one");
          return {
            ...data,
            filterText: action.filterText ?? data.filterText,
            state: action.type,
            // Reset items to an empty list if loading, but not when sorting.
            items: action.type === "loading" ? [] : data.items,
            request: action.request,
          };
        case "update":
          // An update happened while loading (e.g. selection changed): update without aborting.
          return { ...data, ...action.updater?.(data) };
        default:
          throw new Error(`Invalid action "${action.type}" in state "${data.state}"`);
      }
    case "loadingMore":
      switch (action.type) {
        case "success":
          selectedKeys = data.selectedKeys === "all" || action.selectedKeys === "all" ? "all" : new Set([...data.selectedKeys, ...(action.selectedKeys ?? [])]);
          // Append the new items.
          return {
            ...data,
            state: "idle",
            items: [...data.items, ...(action.items ?? [])],
            selectedKeys: selectedKeys as Selection,
            sortDescriptor: action.sortDescriptor ?? data.sortDescriptor,
            request: undefined,
            cursor: action.cursor,
          };
        case "error":
          if (action.request !== data.request) return data;
          return { ...data, state: "error", error: action.error };
        case "loading":
        case "sorting":
        case "filtering":
          // Already loading more, and another load was triggered: abort the load more, start anew.
          abortRequest(owner, data.request);
          return {
            ...data,
            filterText: action.filterText ?? data.filterText,
            state: action.type,
            // Reset items to an empty list if loading, but not when sorting.
            items: action.type === "loading" ? [] : data.items,
            request: action.request,
          };
        case "loadingMore":
          // A duplicate load more (the cursor has not been updated): abort the new one and keep
          // the current request.
          abortRequest(owner, action.request);
          return data;
        case "update":
          return { ...data, ...action.updater?.(data) };
        default:
          throw new Error(`Invalid action "${action.type}" in state "${data.state}"`);
      }
    default:
      throw new Error(`Invalid state "${data.state}"`);
  }
}

const defaultAsyncKey = (item: any): Key => item.id || item.key;

/**
 * Manages state for an immutable async loaded list data structure, and provides convenience methods
 * to update the data over time. Manages loading and error states, pagination, and sorting
 * (react-stately `useAsyncList`).
 */
export function createAsyncList<T, C = string>(options: AsyncListOptions<T, C>): AsyncListData<T> {
  const { load, sort, initialSelectedKeys, initialSortDescriptor, initialFilterText = "" } = options;
  // Resumable: a module-level default is not a serializable capture; the fallback is an object-literal arrow (a resume symbol).
  const userKey = options.getKey;
  const keys = { get: (item: T): Key => (userKey ? userKey(item) : defaultAsyncKey(item)) };
  const getKey = keys.get;
  const data = signal<AsyncListState<T, C>>({
    state: "idle",
    error: undefined,
    items: [],
    selectedKeys: initialSelectedKeys === "all" ? "all" : new Set(initialSelectedKeys),
    sortDescriptor: initialSortDescriptor,
    filterText: initialFilterText,
  });
  // `selectedKeys` is its own signal (two-way, like createListData); the reducer state mirrors it.
  const selectedKeys = signal<Selection>(untrack(data).selectedKeys);
  const read = (): AsyncListState<T, C> => ({ ...untrack(data), selectedKeys: untrack(selectedKeys) });
  // The "current render" state (see header): one snapshot per synchronous task.
  let snapshot: AsyncListState<T, C> | undefined;
  const rendered = (): AsyncListState<T, C> => {
    if (!snapshot) {
      snapshot = read();
      queueMicrotask(() => (snapshot = undefined));
    }
    return snapshot;
  };
  const dispatch = (action: Action<T, C>) =>
    batch(() => {
      const prev = read();
      const next = reducer(data, prev, action);
      if (next === prev) return;
      data.set(next);
      if (next.selectedKeys !== prev.selectedKeys) selectedKeys.set(next.selectedKeys);
    });

  const dispatchFetch = async (action: Action<T, C>, fn: AsyncListLoadFunction<T, C>): Promise<void> => {
    const abortController = new AbortController();
    const request = ++requests.next;
    let map = controllers.get(data);
    if (!map) controllers.set(data, (map = new Map()));
    map.set(request, abortController);
    const current = rendered();
    try {
      dispatch({ ...action, request });
      const previousFilterText = action.filterText ?? current.filterText;
      const response = await fn({
        items: current.items.slice(),
        selectedKeys: current.selectedKeys,
        sortDescriptor: action.sortDescriptor ?? current.sortDescriptor,
        signal: abortController.signal,
        cursor: action.type === "loadingMore" ? current.cursor : undefined,
        filterText: previousFilterText,
        loadingState: current.state,
      });
      const filterText = response.filterText ?? previousFilterText;
      dispatch({ type: "success", ...response, request });
      // Fetch a new filtered list if filterText was updated by the `load` response rather than
      // setFilterText — only when not aborted (another filter action may have started meanwhile).
      if (filterText && filterText !== previousFilterText && !abortController.signal.aborted) void dispatchFetch({ type: "filtering", filterText }, load);
    } catch (e) {
      dispatch({ type: "error", error: e as Error, request });
    } finally {
      map.delete(request);
    }
  };

  // Resumable: the actions' dispatch is an object-literal arrow (a bare argument arrow is not a resume symbol).
  const io = { update: (fn: (state: ListState<T>) => ListState<T>) => dispatch({ type: "update", updater: fn }) };
  const isLoading = computed(() => {
    const state = data().state;
    return state === "loading" || state === "loadingMore" || state === "sorting" || state === "filtering";
  });
  const initial = () => void dispatchFetch({ type: "loading" }, load);
  if (getOwner()) clientEffect(() => untrack(initial));
  else initial();

  return {
    items: () => data().items,
    selectedKeys,
    sortDescriptor: () => data().sortDescriptor,
    isLoading,
    loadingState: () => data().state,
    error: () => data().error,
    filterText: () => data().filterText,
    getItem: (key: Key) => data().items.find((item) => getKey(item) === key),
    reload: () => void dispatchFetch({ type: "loading" }, load),
    loadMore: () => {
      const current = rendered();
      // Ignore if already loading more or if performing server side filtering.
      if (current.state === "loading" || current.state === "loadingMore" || current.state === "filtering" || current.cursor == null) return;
      void dispatchFetch({ type: "loadingMore" }, load);
    },
    sort: (sortDescriptor: SortDescriptor) => void dispatchFetch({ type: "sorting", sortDescriptor }, (sort || load) as AsyncListLoadFunction<T, C>),
    ...createListActions<T, C>({ ...options, getKey, cursor: () => untrack(data).cursor }, io.update),
    setFilterText: (filterText: string) => void dispatchFetch({ type: "filtering", filterText }, load),
  };
}
