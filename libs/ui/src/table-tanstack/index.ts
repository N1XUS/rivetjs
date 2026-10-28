// TanStack Table (v9, `@tanstack/table-core`, MIT, © Tanner Linsley) on Rivet signals: the framework adapter
// (`createTable` ≈ `@tanstack/react-table` `useTable` / `@tanstack/solid-table` `createTable`, `flexRender` /
// `FlexRender`). Optional peer: `@tanstack/table-core` is resolved only by apps that import this subpath.
//
// - Reactivity bindings (`rivetReactivity`): every table-core atom is a Rivet signal (writable) or computed
//   (readonly), so `table.getRowModel()`, `table.atoms.<slice>.get()`, `table.getPageCount()`, … read inside a
//   binding / computed / effect track exactly the state, options and data they depend on. No render phase, no
//   subscription wiring: a sort re-runs the row bindings that read the sorted model, nothing else.
// - Live inputs: `data` / `columns` take a value or an accessor (`() => rows()`): the options object keeps them as
//   getters (`mergeOptions` merges property descriptors), so table-core's memos see a new array when the accessor's
//   sources change.
// - State: `state.<slice>` takes a plain value (controlled, change through `on<Slice>Change`), an accessor (controlled,
//   read live), a Rivet `Signal` (two-way: the table writes it, no change handler needed) or a TanStack atom
//   (`{ get, set }`, e.g. `sortingAtom(sortDescriptor)`). Signals / atoms become the slice's external atom.
// - Resumable pages: keep the state you want to survive in signals of the component (keyed like any `signal(…)` in a
//   `.tsx` component) and pass them in `state`; the table instance itself is rebuilt by the component's adopt run in
//   the browser (it holds functions and is never serialized).
import { batch, computed, createRoot, effect, getOwner, onCleanup, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { constructTable } from "@tanstack/table-core";
import type { CellData, RowData, SortingState, Table, TableFeatures, TableOptions, TableState } from "@tanstack/table-core";
import type { FlexRenderProps } from "@tanstack/table-core/flex-render";
import type { TableAtomOptions, TableReactivityBindings } from "@tanstack/table-core/reactivity";
import type { SortDescriptor } from "@rivetjs/cdk/collections/types";

export * from "@tanstack/table-core";

/** A TanStack Store atom shape (`@tanstack/store` `Atom`): what table-core reads and writes. */
export interface TableAtom<T> {
  get(): T;
  set(value: T | ((previous: T) => T)): void;
  subscribe(observer: ((value: T) => void) | { next?: (value: T) => void }): { unsubscribe(): void };
}

type Getter<T> = () => T;

const isSignal = (value: unknown): value is Signal<unknown> => typeof value === "function" && typeof (value as Signal<unknown>).set === "function";
const isAtom = (value: unknown): value is TableAtom<unknown> =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as TableAtom<unknown>).get === "function" &&
  typeof (value as TableAtom<unknown>).set === "function";

/** `subscribe` of an atom over a getter: a root effect calling the observer on every change after the current value. */
function subscribeTo<T>(get: Getter<T>, observer: ((value: T) => void) | { next?: (value: T) => void }): { unsubscribe(): void } {
  const next = typeof observer === "function" ? observer : (value: T) => observer.next?.(value);
  let first = true;
  const root = createRoot((dispose) => {
    effect(() => {
      const value = get();
      if (first) first = false;
      else untrack(() => next(value));
    });
    return dispose;
  });
  return { unsubscribe: root.dispose };
}

/** A TanStack atom over a Rivet signal: reads track, writes go to the signal (updater functions get the untracked value). */
export function signalAtom<T>(sig: Signal<T>): TableAtom<T> {
  return {
    get: () => sig(),
    set: (value) => sig.set(typeof value === "function" ? (value as (previous: T) => T)(untrack(sig)) : value),
    subscribe: (observer) => subscribeTo(sig, observer),
  };
}

function readonlyAtom<T>(get: Getter<T>): TableAtom<T> {
  return {
    get,
    set: () => {
      throw new TypeError("[rivet:ui] table-tanstack: readonly atom");
    },
    subscribe: (observer) => subscribeTo(get, observer),
  };
}

const equalsOf = <T>(options: TableAtomOptions<T> | undefined) => (options?.compare ? { equals: options.compare } : undefined);

/** table-core reactivity bindings on `@rivetjs/reactivity` (writable atom = signal, readonly atom = computed). */
export function rivetReactivity(): TableReactivityBindings {
  return {
    createOptionsStore: true,
    wrapExternalAtoms: false,
    addSubscription: (subscription) => {
      if (getOwner()) onCleanup(() => subscription.unsubscribe());
    },
    batch: (fn) => batch(fn),
    // table-core defers auto resets (`autoResetPageIndex` after a sort / data change) out of the current read.
    schedule: (fn) => queueMicrotask(fn),
    untrack,
    createWritableAtom: (value, options) => signalAtom(signal(value, equalsOf(options))) as never,
    createReadonlyAtom: (fn, options) => readonlyAtom(computed(fn, equalsOf(options))) as never,
  };
}

/** A state slice given to `createTable`: plain value, accessor, Rivet `Signal` (two-way) or TanStack atom. */
export type LiveSlice<T> = T | Signal<T> | (() => T) | TableAtom<T>;

/** `createTable` options: TanStack `TableOptions` with live `data` / `columns` and Rivet state slices. */
export type CreateTableOptions<TFeatures extends TableFeatures, TData extends RowData> = Omit<TableOptions<TFeatures, TData>, "data" | "columns" | "state"> & {
  /** The rows: an array or an accessor (live: table-core reprocesses when the accessor's value changes). */
  readonly data: ReadonlyArray<TData> | (() => ReadonlyArray<TData>);
  /** The column definitions: an array or an accessor. */
  readonly columns: TableOptions<TFeatures, TData>["columns"] | (() => TableOptions<TFeatures, TData>["columns"]);
  /** Controlled state slices (value / accessor / Signal / atom per slice). */
  readonly state?: { readonly [K in keyof TableState<TFeatures>]?: LiveSlice<TableState<TFeatures>[K]> };
};

/**
 * Merge two option objects keeping property descriptors: live `data` / `columns` / `state` getters of `base` survive a
 * `next` that carries their current value as a plain property (`table.setOptions((prev) => ({ ...prev, … }))` spreads
 * the getters into values); a different value replaces the getter.
 */
function mergeDescriptors<T extends object>(base: T, next: Partial<T>): T {
  const descriptors: PropertyDescriptorMap = { ...Object.getOwnPropertyDescriptors(base) };
  const incoming = Object.getOwnPropertyDescriptors(next);
  for (const key of Object.keys(incoming)) {
    const was = descriptors[key];
    const now = incoming[key]!;
    if (was?.get && !now.get && untrack(was.get) === now.value) continue;
    descriptors[key] = now;
  }
  return Object.defineProperties({}, descriptors) as T;
}

/**
 * Create a TanStack table whose state lives in Rivet signals (`@tanstack/table-core` `constructTable` with
 * `rivetReactivity()`). Every read of the instance (`getRowModel()`, `getHeaderGroups()`, `atoms.<slice>.get()`,
 * `getCanNextPage()`, …) tracks in bindings / computeds; feature setters (`setSorting`, `nextPage`, …) write the
 * owning signal. Call it in the component body.
 */
export function createTable<TFeatures extends TableFeatures, TData extends RowData>(options: CreateTableOptions<TFeatures, TData>): Table<TFeatures, TData> {
  const { data, columns, state, atoms, ...rest } = options as CreateTableOptions<TFeatures, TData> & { atoms?: Record<string, TableAtom<unknown>> };
  const live: Record<string, PropertyDescriptor> = {
    data:
      typeof data === "function"
        ? { get: data as Getter<unknown>, enumerable: true, configurable: true }
        : { value: data, enumerable: true, configurable: true, writable: true },
    columns:
      typeof columns === "function"
        ? { get: columns as Getter<unknown>, enumerable: true, configurable: true }
        : { value: columns, enumerable: true, configurable: true, writable: true },
  };
  const external: Record<string, TableAtom<unknown>> = { ...atoms };
  let controlled: Record<string, PropertyDescriptor> | undefined;
  if (state)
    for (const key of Object.keys(state)) {
      const slice = (state as Record<string, unknown>)[key];
      if (isSignal(slice)) external[key] = signalAtom(slice);
      else if (isAtom(slice)) external[key] = slice;
      else
        (controlled ??= {})[key] =
          typeof slice === "function"
            ? { get: slice as Getter<unknown>, enumerable: true, configurable: true }
            : { value: slice, enumerable: true, configurable: true, writable: true };
    }
  if (controlled) live.state = { value: Object.defineProperties({}, controlled), enumerable: true, configurable: true, writable: true };
  const input = Object.defineProperties(
    {
      ...rest,
      atoms: external,
      features: { coreReactivityFeature: rivetReactivity(), ...rest.features },
      mergeOptions: mergeDescriptors,
    },
    live,
  ) as unknown as TableOptions<TFeatures, TData>;
  return untrack(() => {
    const table = constructTable(input);
    // `constructTable` spreads the options (getters read once): put the live descriptors back on the options atom.
    const store = (table as unknown as { optionsStore: TableAtom<object> }).optionsStore;
    store.set(() => mergeDescriptors(store.get(), input));
    return table;
  });
}

/**
 * Render a column def template (`columnDef.header` / `cell` / `footer`): a function is called with the context
 * (untracked, like a component; it may return JSX), any other value is returned as is.
 */
export function flexRender<TProps extends object>(comp: unknown, props: TProps): any {
  if (comp == null) return null;
  return typeof comp === "function" ? untrack(() => (comp as (props: TProps) => unknown)(props)) : comp;
}

/** `<FlexRender cell={cell} />` / `header={header}` / `footer={footer}`: `flexRender` of that part's template. */
export function FlexRender<TFeatures extends TableFeatures, TData extends RowData, TValue extends CellData = CellData>(
  props: FlexRenderProps<TFeatures, TData, TValue>,
): any {
  if ("cell" in props && props.cell) {
    const cell = props.cell as typeof props.cell & { getIsAggregated?(): boolean; getIsPlaceholder?(): boolean };
    const def = cell.column.columnDef as unknown as Record<string, unknown>;
    if (cell.getIsAggregated?.()) return flexRender(def.aggregatedCell ?? def.cell, cell.getContext());
    if (cell.getIsPlaceholder?.()) return null;
    return flexRender(def.cell, cell.getContext());
  }
  if ("header" in props && props.header) return flexRender(props.header.column.columnDef.header, props.header.getContext());
  if ("footer" in props && props.footer) return flexRender(props.footer.column.columnDef.footer, props.footer.getContext());
  return null;
}

/** TanStack sorting → the cdk / ui Table `sortDescriptor` (first sort entry; none → null). */
export function toSortDescriptor(sorting: SortingState | null | undefined): SortDescriptor | null {
  const first = sorting?.[0];
  return first ? { column: first.id, direction: first.desc ? "descending" : "ascending" } : null;
}

/** The cdk / ui Table `sortDescriptor` → TanStack sorting (one entry; null → none). */
export function toSorting(descriptor: SortDescriptor | null | undefined): SortingState {
  return descriptor ? [{ id: String(descriptor.column), desc: descriptor.direction === "descending" }] : [];
}

/**
 * The `sorting` slice as an atom over a ui `Table` `sortDescriptor` signal: pass the same signal to
 * `<Table.Content sortDescriptor={…}>` (two-way) and `sortingAtom(it)` to `createTable({ state: { sorting } })`.
 * A header press writes the descriptor, `table.setSorting(…)` writes it back (first entry).
 */
export function sortingAtom(descriptor: Signal<SortDescriptor | null>): TableAtom<SortingState> {
  const get = () => toSorting(descriptor());
  return {
    get,
    set: (value) => descriptor.set(toSortDescriptor(typeof value === "function" ? value(untrack(get)) : value)),
    subscribe: (observer) => subscribeTo(get, observer),
  };
}
