// Server half of lazy rows (LAZY-ROWS T4, spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.1; browser
// half `dom-resume-lazy.ts`): the per-For record (`LazyFor`), the env switch, read / keyed-read / `_regionState` helpers and
// the `L` entry encoder. Holds no module state of `server-resume.ts`: the hooks that switch the recorder (`_onForLazy`,
// `inLazy`, `lazyRowValue`, `lazyRow`) stay there, so the recorder's own `let`s are never written across modules.
import { DEV } from "#dev";
import type { KeyedRead, Signal } from "@rivetjs/reactivity";
import { _keyAt } from "./resume-format.ts";
import type { LazyRowsEntry, RegionLocals, TableEntry } from "./resume-format.ts";

/** What `encodeLazy` needs of the page encoder (`createEncoder`). */
export interface LazyEncoder {
  ref: (value: unknown) => number;
  table: readonly TableEntry[];
}
export interface LazyFor<S = unknown, R = unknown> {
  forId: number;
  /** The scope the For rendered in (its region: `regionOf` at encode time). */
  scope: S | null;
  symbol: string;
  rowFn: object;
  items: readonly unknown[];
  /** Key path (`$lazy[1]`) or the `by` function (flag 2). */
  by: unknown;
  flags: number;
  /** Signals the rows' renders read (a Set: deduplicated in first-read order, O(1) per read). */
  reads: Set<Signal<unknown>>;
  /** Keyed selector reads (T6, `_trackReads` keyed hook): per (signal, kind) the rows and the key each read, flat
   * `[k, key, …]` — those rows wake when their key's result may change, not on every change of the signal (entry [12]). */
  keyed: { signal: Signal<unknown>; kind: 0 | 1; rows: unknown[] }[] | null;
  /** The `_trackReads` keyed hook of this For (records into `keyed` for the rendering row). */
  hook: KeyedRead;
  /** Per row: its `_regionState` values and nested counts (`RegionLocals` shape), creation order. */
  locals: ({ l: unknown[]; n: number[] } | undefined)[] | null;
  recorder: R;
  /** The row rendering now (`_regionState` slots; slot content the traversal renders later). */
  row: number;
  /** The rows were written (recorded as an entry): a reason found now is `late`. */
  done: boolean;
  /** Why the For cannot be lazy (first reason found while its rows render). */
  reason: string | null;
  /** A reason found in the traversal, after the rows were written: the entry is dropped (rows stay inert). */
  late: string | null;
  /** Handler / model sites the rows hold: the page resumes (`recorder.used`). */
  sites: number;
  /** Their event types, added to the page (`data-events`) only when the For stays lazy (a fallback page = the `off` page). */
  events: Set<string>;
  /** Every event type a row handles (entry [9]: a row materialises on one), the page's types included. */
  types: Set<string>;
  /** Identified providers around the For (`[token id, value, …]`, non-default values; entry [10]). */
  providers: unknown[] | null;
  /** Rows holding a client effect / `clientEvent` listener (entry [11]: materialised at idle, so they run as on any page). */
  effects: number[] | null;
}

/** `RIVET_LAZY_ROWS=on` (server env) and a build whose manifest has `lazyRows`: lazy row records for `$lazy` Fors. Read
 * once per render. Dev: the variable on with a build that did not opt in warns once (the rows stay recorded). */
let lazyHinted = false;
export function lazyRowsOn(manifest: { lazyRows?: boolean } | undefined): boolean {
  if ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.RIVET_LAZY_ROWS !== "on") return false;
  if (manifest?.lazyRows) return true;
  if (DEV && !lazyHinted) {
    lazyHinted = true;
    console.warn(
      "Rivet resume: RIVET_LAZY_ROWS=on is ignored: this build's browser runtime cannot materialise lazy rows (the resume manifest has no lazyRows). Build with rivet({ resume: { lazyRows: true } }) / rivetRouter({ resume: { lazyRows: true } }); rows stay recorded. docs: docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.1",
    );
  }
  return false;
}

// Dev: one warning per row symbol and reason (`DEV` folds the body away in production).
const lazyWarned = new Set<string>();
export function lazyWarn(symbol: string, forId: number, reason: string, inert?: boolean): void {
  if (!DEV || lazyWarned.has(symbol + "\n" + reason)) return;
  lazyWarned.add(symbol + "\n" + reason);
  console.warn(
    "Rivet resume: <For>" +
      (forId >= 0 ? " r" + forId : "") +
      " (row " +
      symbol +
      ") " +
      (inert
        ? "wrote lazy rows the browser cannot materialise (" + reason + ", found after the rows were written): they stay inert"
        : "records its rows instead of lazy rows: " + reason) +
      ". docs: docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.3",
  );
}

// A keyed selector read in the rendering row (`_trackReads` keyed hook): the row wakes on its key only. Keys travel inline
// in the entry: only JSON scalars (else the signal is a plain read of the row).
export function lazyKeyed(lazy: LazyFor, signal: Signal<unknown>, kind: 0 | 1, key: unknown): boolean {
  if (!(typeof key === "string" || (typeof key === "number" && Number.isFinite(key)) || typeof key === "boolean" || key === null)) return false;
  const list = (lazy.keyed ??= []);
  let record = list.find((r) => r.signal === signal && r.kind === kind);
  if (record === undefined) list.push((record = { signal, kind, rows: [] }));
  const rows = record.rows;
  for (let i = rows.length - 2; i >= 0 && rows[i] === lazy.row; i -= 2) if (rows[i + 1] === key) return true;
  rows.push(lazy.row, key);
  return true;
}
// Whether keyed rows `[k, key, …]` are every row once, reading its own key (`_keyAt` of its item, a key path `by`).
export function ownKeys(lazy: LazyFor, rows: unknown[]): boolean {
  const items = lazy.items;
  if (typeof lazy.by !== "string" || rows.length !== 2 * items.length) return false;
  for (let k = 0; k < items.length; k++) if (rows[2 * k] !== k || rows[2 * k + 1] !== _keyAt(items[k], lazy.by)) return false;
  return true;
}
export const addReads = (lazy: LazyFor, signals: readonly Signal<unknown>[]): void => {
  for (let i = 0; i < signals.length; i++) lazy.reads.add(signals[i]!);
};

// `_regionState` in a lazy row: its value is kept per row (state `[k, RegionLocals]`), the slot before the ones its
// `create()` records (`n`), as a site's locals.
export function lazyLocal<T>(lazy: LazyFor, create: () => T): T {
  const locals = ((lazy.locals ??= [])[lazy.row] ??= { l: [], n: [] });
  const i = locals.l.push(undefined) - 1;
  locals.n.push(0);
  const value = create();
  locals.l[i] = value;
  locals.n[i] = locals.l.length - i - 1;
  return value;
}

/**
 * The `L` entries of one segment (`encodeRecords`; `LazyRowsEntry`): one per lazy For. One that does not encode (or found a
 * fallback reason in the traversal) is left out: its rows stay inert markup (re-created with their region).
 */
export function encodeLazy<S>(
  encoder: LazyEncoder,
  lazies: readonly LazyFor<S>[],
  regionOf: (scope: S | null) => number,
  needs: (symbol: string, refs: number[]) => number[],
): LazyRowsEntry[] {
  const L: LazyRowsEntry[] = [];
  for (const lazy of lazies) {
    if (lazy.late !== null) {
      lazyWarn(lazy.symbol, lazy.forId, lazy.late, true);
      continue;
    }
    try {
      const rowFn = encoder.ref(lazy.rowFn),
        items = encoder.ref(lazy.items),
        by = typeof lazy.by === "string" ? lazy.by : encoder.ref(lazy.by),
        refs = typeof by === "number" ? [rowFn, items, by] : [rowFn, items];
      let flags = lazy.flags,
        reads: number[] | 0 = 0;
      // A row's own `_regionState` values (its local signals) wake nothing: only the row's own code (materialised by then)
      // can write them (T5).
      const own = new Set<unknown>();
      for (const locals of lazy.locals ?? []) for (const value of locals?.l ?? []) own.add(value);
      const shared = [...lazy.reads].filter((read) => !own.has(read));
      if (shared.length)
        try {
          reads = shared.map(encoder.ref);
        } catch {
          flags |= 8;
        }
      // Keyed reads (T6) of signals no row reads plainly: `[signal ref, kind, [k, key, …] | 1], …` flat; 1 = every row reads
      // its own key, the key path of `by` (the browser derives it: no per-row bytes).
      const keyed: unknown[] = [];
      for (const record of lazy.keyed ?? [])
        if (!own.has(record.signal) && !lazy.reads.has(record.signal))
          try {
            keyed.push(encoder.ref(record.signal), record.kind, ownKeys(lazy, record.rows) ? 1 : record.rows);
          } catch {
            flags |= 8;
          }
      const entry: LazyRowsEntry = [lazy.forId, regionOf(lazy.scope), rowFn, items, by, flags, []];
      let state: (number | RegionLocals)[] | 0 = 0;
      if (lazy.locals) {
        state = [];
        lazy.locals.forEach((locals, k) => {
          if (locals === undefined) return;
          const l = locals.l.map((value) => {
            try {
              const ref = encoder.ref(value);
              refs.push(ref);
              return ref;
            } catch {
              return null; // not serializable: the row's re-run creates it afresh
            }
          });
          (state as (number | RegionLocals)[]).push(k, locals.n.some((n) => n > 0) ? { l, n: locals.n } : { l });
        });
        flags |= 4;
      }
      entry[5] = flags;
      // Identified providers around the For at [10] (unserializable values omitted: the row sees the default).
      const providers: (string | number)[] = [];
      for (let i = 0; i < (lazy.providers?.length ?? 0); i += 2)
        try {
          const ref = encoder.ref(lazy.providers![i + 1]);
          providers.push(lazy.providers![i] as string, ref);
          refs.push(ref);
        } catch {
          /* not serializable */
        }
      const types = [...lazy.types].join(" ");
      // Trailing slots only as far as needed (0 / "" = none).
      // The row count at [13] when the items entry does not show it (an `i` child of a tree, a DOM-backed `D` tree): the
      // lazy add-on's row range.
      const shown = encoder.table[items] as TableEntry;
      const count = Array.isArray(shown) || (shown !== null && typeof shown === "object" && "j" in shown) ? 0 : lazy.items.length;
      const tail: unknown[] = [reads, state, types, providers.length ? providers : 0, lazy.effects ?? 0, keyed.length ? keyed : 0, count];
      while (tail.length && (tail[tail.length - 1] === 0 || tail[tail.length - 1] === "")) tail.pop();
      (entry as unknown[]).push(...tail);
      entry[6] = needs(lazy.symbol, refs);
      L.push(entry);
    } catch (error) {
      lazyWarn(lazy.symbol, lazy.forId, "its row function, items or `by` did not encode (" + String((error as Error)?.message ?? error) + ")", true);
    }
  }
  return L;
}
