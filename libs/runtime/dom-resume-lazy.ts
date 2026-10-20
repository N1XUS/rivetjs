// Lazy collection rows in the browser (LAZY-ROWS T5, spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md
// §3.4): the resume runtime's half of state `L`. Only builds with `rivet({ resume: { lazyRows: true } })` contain it:
// `dom-resume.ts` creates it under the build-time constant `LAZY_ROWS` (`lazy-rows.ts`, which the compiler plugin
// replaces with `true` for those builds), so every other build drops this module and the adopt-run hooks of the DOM
// runtime (0 bytes; LAZY-T5B).
//
// Row k of a lazy For is plain server markup between the marker pair of id m = forId + 1 + k. It materialises — its row
// function runs in adopt mode over those nodes (`dom-adopt.ts` `_adoptRow`) — on the first event inside it (the lazy
// add-on / `q` give the loader a synthetic `["L", [], chunks]` capture entry per event type the rows handle), when a
// signal the rows read changes (a wake: every row of the For; flag 8 = the reads did not encode: at idle), and on
// `_materialise(node)` (cdk focus / `aria-activedescendant` targets). A re-created For region keys the rows like adopted
// server rows: kept rows stay as they are (inert or materialised), rows it keeps materialise later through its row
// function. State: 0 inert, 1 materialised, 2 dead (dropped, or its region died).
import { _dispose, _setRegionStateHook, effect, memberKeys, provide, runWithOwner, untrack } from "@rivetjs/reactivity";
import { _adoption, _delegateBelow } from "./dom-v2.ts";
import { _adoptRow, _region, _regionHost, _ABSENT_STATE } from "./dom-adopt.ts";
import { _inIdScope, _rowIdPrefix } from "./id.ts";
import { _keyAt, _placeholderContext } from "./resume-format.ts";
import { DEV } from "#dev";
import type { Owner, Signal } from "@rivetjs/reactivity";
import type { ForRow } from "./dom-v2.ts";
import type { AdoptedBranch, AdoptedRow, AdoptedState, LazyHost, RowPlanCache } from "./dom-adopt.ts";
import type { LazyRowsEntry, LoaderApi, RegionLocals, RegionProviders, ResumeState, SymbolRef } from "./resume-format.ts";

interface Markers {
  start: Comment;
  end: Comment | null;
}
/** What the lazy rows need of one `createResume` instance (its closure state; getters for what `start` assigns). */
export interface LazyContext {
  readonly state: ResumeState;
  readonly doc: Document;
  readonly api: LoaderApi;
  readonly root: Owner | null;
  /** Whether table entry `ref` was decoded already. */
  decoded(ref: number): boolean;
  get(ref: number): unknown;
  markers(): Map<number, Markers>;
  ready(chunks: number[]): boolean;
  report(ref: SymbolRef, error: unknown): void;
  isDead(region: number | undefined): boolean;
  ownerOf(region: number | undefined): Owner | null;
  /** Region id → parent region id. */
  parents: Map<number, number>;
  named(ref: SymbolRef): string;
  idle(fn: () => void): unknown;
  /** Run `fn` outside the cold replay's listener recording (the replay's `replayed` cleared, as `drain` does). */
  unrecorded(fn: () => void): void;
}
/** The hooks `dom-resume.ts` calls (each behind `LAZY_ROWS`). */
export interface LazyRows {
  /** Register the lazy row records of the state / a streamed patch (`start`, `patch`). */
  register(): void;
  /** A signal was armed (decoded): rows reading it wake on its first change. */
  arm(ref: number, source: Signal<unknown>): void;
  /** Re-create a lazy For's region (`activate`): true when `node` is one (its rows keyed by the re-created For). */
  region(
    node: number,
    range: Markers,
    read: () => unknown,
    kept: (AdoptedBranch | undefined)[] | null,
    state: AdoptedState | null,
    provided: <T>(fn: () => T) => T,
    log: ((took: boolean) => void) | null,
  ): boolean;
  /** `q`: an element directly in an inert lazy row → the row's id, with its synthetic entries. */
  id(x: Element): string | undefined;
  /** `ResumeInstance.L`. */
  L(event: Event, m: number, next: Element | null): void;
  /** Cold events → their path at dispatch (`cold`): a lazy row's delegated handlers run over it in the replay. */
  paths: WeakMap<Event, EventTarget[]>;
}

interface LazyRow {
  f: LazyFor;
  k: number;
  m: number;
  state: 0 | 1 | 2;
  owner: Owner | null;
  /** The re-created For's row keeping it (its item / index sources and owner). */
  row: ForRow | null;
  loading: boolean;
}
/** Keyed reads of one selector source (entry [12]): the rows by the key they read. */
interface KeyedWake {
  f: LazyFor;
  kind: number;
  byKey: Map<unknown, LazyRow[]>;
  rows: LazyRow[];
}
interface LazyFor {
  e: LazyRowsEntry;
  rows: LazyRow[];
  /** The re-created For's row function and item reader. */
  host: Parameters<LazyHost> | null;
  woken: boolean;
  state: Map<number, RegionLocals> | null;
  /** Row plan (T6): rows of the same structure adopt without a probe run. */
  plan: RowPlanCache;
}

/** @internal The lazy rows of one resume runtime (`createResume`, `LAZY_ROWS` builds only). */
export function _lazyRows(c: LazyContext): LazyRows {
  const { get, markers, parents } = c;
  const lazyRows = new Map<number, LazyRow>(),
    lazyOf = new Map<number, LazyFor[]>(), // region id → its lazy Fors (server order), until the region re-creates
    wakes = new Map<number, LazyFor[]>(), // signal ref → lazy Fors whose rows read it
    keyedWakes = new Map<number, KeyedWake[]>(); // signal ref → keyed reads of it (T6)
  let lazySeen = 0,
    lazyEnds: WeakMap<Node, number> | null = null;
  const provideList = <T>(providers: RegionProviders, fn: () => T, i = 0): T =>
    i === providers.length
      ? fn()
      : provide(
          _placeholderContext(typeof providers[i] === "number" ? (c.state.t[providers[i] as number] as string) : (providers[i] as string)),
          get(providers[i + 1] as number),
          () => provideList(providers, fn, i + 2),
        );
  function register(): void {
    const state = c.state,
      list = state.L;
    if (!list) return;
    for (; lazySeen < list.length; lazySeen++) {
      const e = list[lazySeen]!,
        held = state.t[e[3]] as { j?: unknown[] } | unknown[] | null,
        count = (Array.isArray(held) ? held : (held?.j ?? (get(e[3]) as unknown[]))).length,
        f: LazyFor = { e, rows: [], host: null, woken: false, state: null, plan: {} };
      for (let k = 0; k < count; k++) {
        const row: LazyRow = { f, k, m: e[0] + 1 + k, state: 0, owner: null, row: null, loading: false };
        lazyRows.set(row.m, row);
        f.rows.push(row);
      }
      if (Array.isArray(e[8])) {
        f.state = new Map();
        for (let i = 0; i < e[8].length; i += 2) f.state.set(e[8][i] as number, e[8][i + 1] as RegionLocals);
      }
      (lazyOf.get(e[1]) ?? lazyOf.set(e[1], []).get(e[1])!).push(f);
      if (e[7])
        for (const ref of e[7])
          if (c.decoded(ref)) armWake(get(ref) as Signal<unknown>, [f]);
          else (wakes.get(ref) ?? wakes.set(ref, []).get(ref)!).push(f);
      const keyed = e[12];
      if (keyed)
        for (let i = 0; i < keyed.length; i += 3) {
          const ref = keyed[i] as number,
            list = keyed[i + 2] as unknown[] | 1,
            w: KeyedWake = { f, kind: keyed[i + 1] as number, byKey: new Map(), rows: [] },
            add = (row: LazyRow | undefined, key: unknown) => {
              if (!row) return;
              w.rows.push(row);
              (w.byKey.get(key) ?? w.byKey.set(key, []).get(key)!).push(row);
            };
          if (list === 1) {
            // Every row reads its own key (key path `by`).
            const items = get(e[3]) as unknown[];
            for (const row of f.rows) add(row, _keyAt(items[row.k], e[4] as string));
          } else for (let j = 0; j < list.length; j += 2) add(f.rows[list[j] as number], list[j + 1]);
          if (c.decoded(ref)) armKeyed(get(ref) as Signal<unknown>, [w]);
          else (keyedWakes.get(ref) ?? keyedWakes.set(ref, []).get(ref)!).push(w);
        }
      if (e[5] & 8) c.idle(() => wake(f));
      // Rows with client effects / listeners: materialised at idle, as a recorded effect runs (`effects` [11]).
      const effects = e[11];
      if (effects) c.idle(() => effects.forEach((k) => materialise(f.rows[k]!)));
    }
    lazyEnds = null;
    _adoption.materialise = (node) => {
      const row = rowOf(node);
      return !!row && materialise(row);
    };
  }
  // A read signal's first change wakes its Fors.
  function armWake(source: Signal<unknown>, fors: LazyFor[]): void {
    runWithOwner(c.root, () => {
      let first = true;
      effect(() => {
        source();
        if (first) return void (first = false);
        untrack(() => fors.forEach(wake));
      });
    });
  }
  // Keyed reads (T6): a change materialises only the rows whose key may have flipped — the previous and next value
  // (kind 0) or `memberKeys` of the two (kind 1; null: every row of the read).
  function armKeyed(source: Signal<unknown>, list: KeyedWake[]): void {
    runWithOwner(c.root, () => {
      let first = true,
        previous: unknown;
      effect(() => {
        const next = source();
        if (first) return void ((first = false), (previous = next));
        const before = previous;
        previous = next;
        untrack(() => {
          for (const w of list) {
            if (w.f.woken) continue;
            const keys = w.kind === 0 ? [next, before] : memberKeys(next, before);
            if (keys === null) for (const row of w.rows) materialise(row, true);
            else for (const key of keys) w.byKey.get(key)?.forEach((row) => materialise(row, true));
          }
        });
      });
    });
  }
  function wake(f: LazyFor): void {
    if (f.woken) return;
    f.woken = true;
    for (const row of f.rows) materialise(row, true);
  }
  // The lazy row whose markers enclose `node` directly (its next comment sibling is the row's end marker), from `node` up.
  const endId = (node: Node): number | undefined => {
    // (`q` also sees the window / document of an event path: no siblings.)
    let end = node.nextSibling;
    while (end != null && end.nodeType !== 8) end = end.nextSibling;
    if (end == null || (end as Comment).data !== "]") return;
    if (lazyEnds === null) {
      lazyEnds = new WeakMap();
      for (const id of lazyRows.keys()) {
        const marks = markers().get(id);
        if (marks?.end) lazyEnds.set(marks.end, id);
      }
    }
    return lazyEnds.get(end);
  };
  const rowOf = (node: Node | null): LazyRow | undefined => {
    for (let n = node; n !== null && n.nodeType !== 9; n = n.parentNode) {
      const id = endId(n),
        row = id === undefined ? undefined : lazyRows.get(id);
      if (row) return row;
    }
  };
  // Row k's providers, id scope and `_regionState` values around one run of its row function (probe or adopt).
  const enterRow =
    (row: LazyRow, outer: boolean) =>
    <T>(fn: () => T): T => {
      const e = row.f.e,
        locals = row.f.state?.get(row.k),
        values = locals ? locals.l.map((ref) => (ref === null ? _ABSENT_STATE : get(ref))) : null,
        nested = locals?.n;
      let next = 0;
      type Hook = <V>(create: () => V) => V;
      const previous: Hook | null | undefined =
        values === null
          ? undefined
          : (_setRegionStateHook(<V>(create: () => V): V => {
              if (next < values.length) {
                const i = next++,
                  value = values[i];
                if (value !== _ABSENT_STATE) return (nested && (next += nested[i]!), value) as V;
              }
              return previous ? previous(create) : create();
            }) as Hook | null);
      try {
        const run = () => _inIdScope({ prefix: _rowIdPrefix(e[0], row.k), n: 0 }, fn);
        // Before its region re-creates, a row runs under the server's providers (after: the re-created For's own).
        return outer && Array.isArray(e[10]) ? provideList(e[10], run) : run();
      } finally {
        if (values !== null) _setRegionStateHook(previous!);
      }
    };
  // Materialise a row now (true: it is materialised) — or once its chunk loaded (false meanwhile).
  function materialise(row: LazyRow, woken = false): boolean {
    if (row.state) return row.state === 1;
    const f = row.f,
      e = f.e;
    if (row.row === null && c.isDead(e[1])) return ((row.state = 2), false);
    if (!c.ready(e[6])) {
      if (!row.loading) {
        row.loading = true;
        c.api.ensure(e[6]).then(
          () => ((row.loading = false), materialise(row, woken)),
          (error: unknown) => c.report("lazy row " + row.m, error),
        );
      }
      return false;
    }
    const marks = markers().get(row.m);
    if (!marks?.end) {
      if (DEV) console.warn("Rivet resume: " + DEV.hint("missing lazy row r" + row.m, "drift"));
      return ((row.state = 2), false);
    }
    row.state = 1;
    try {
      const kept = row.row,
        host = f.host;
      let rowFn: () => unknown, parent: Owner | null;
      if (kept !== null && host !== null) {
        rowFn = () => host[0](host[1].bind(kept) as () => unknown, kept.index as unknown as () => number);
        parent = kept.owner;
      } else {
        const fn = get(e[2]) as (item: () => unknown, index: () => number) => unknown,
          item = (get(e[3]) as unknown[])[row.k],
          k = row.k;
        rowFn = () =>
          fn(
            () => item,
            () => k,
          );
        // Under the For region's parent: a materialised row outlives the region's re-creation (the For keeps it).
        parent = c.ownerOf(parents.get(e[1]));
      }
      const verify =
        DEV && !woken
          ? (first: string) => {
              if (DEV)
                console.warn(
                  "Rivet resume: " +
                    DEV.hint(
                      "lazy row " +
                        row.k +
                        " (r" +
                        row.m +
                        ") of <For> r" +
                        e[0] +
                        " (" +
                        c.named((c.state.t[e[2]] as { f?: SymbolRef } | null)?.f as SymbolRef) +
                        "): server " +
                        first,
                      "lazy",
                    ),
                );
            }
          : null;
      row.owner = _adoptRow(parent, enterRow(row, kept === null), rowFn, marks.start, marks.end, verify, f.plan);
    } catch (error) {
      c.report("lazy row " + row.m, error);
    }
    return true;
  }
  // A row the re-created For dropped (or never took): its materialised content dies with it.
  const lazyDrop = (row: LazyRow): void => {
    row.state = 2;
    _dispose(row.owner);
    row.owner = null;
  };
  const paths = new WeakMap<Event, EventTarget[]>();
  return {
    register,
    paths,
    arm(ref, source) {
      // Lazy rows reading it (entry [7]): its first change materialises every row of those Fors (a wake).
      const fors = wakes.get(ref),
        keyed = keyedWakes.get(ref);
      if (fors) (wakes.delete(ref), armWake(source, fors));
      if (keyed) (keyedWakes.delete(ref), armKeyed(source, keyed));
    },
    region(node, range, read, kept, state, provided, log) {
      // A lazy For's region: the re-created For keys its server rows (inert ones stay inert, materialised ones keep their
      // bindings); rows it keeps materialise later through its row function (`LazyHost`). One `_region` adopts one list:
      // the region's first lazy For keys its rows, a further one's rows are re-created.
      const fors = lazyOf.get(node);
      if (!fors) return false;
      const [f, ...rest] = fors;
      lazyOf.delete(node);
      for (const g of rest) for (const r of g.rows) lazyDrop(r);
      const items = get(f!.e[3]) as unknown[],
        adopted: AdoptedRow[] = [];
      for (const r of f!.rows) {
        const marks = r.state === 2 ? undefined : markers().get(r.m);
        if (!marks?.end) continue;
        adopted.push({
          item: items[r.k],
          index: r.k,
          flags: f!.e[5] & 1,
          start: marks.start,
          end: marks.end,
          dispose: () => lazyDrop(r),
          own: (row) => void (r.row = row),
        });
      }
      const host: LazyHost = (children, read) => void (f!.host = [children, read]);
      const took = provided(() => (_regionHost(host), _region(range.start, range.end!, read, adopted, kept, state)));
      if (!took) for (const row of adopted) row.dispose();
      log?.(took);
      return true;
    },
    id(x) {
      if (!lazyRows.size) return;
      const id = endId(x),
        row = id === undefined ? undefined : lazyRows.get(id);
      if (!row || row.state) return;
      const h = (c.state.e[id!] ??= {});
      for (const type of (row.f.e[9] || "").split(" ")) if (type) h[type + "!"] ??= ["L", [], row.f.e[6]];
      return "" + id;
    },
    // A lazy row's synthetic entry on the event's path (`deliver`): materialise the row. A live event then reaches its
    // handlers natively (they attached inside the loader's capture listener); a cold replay (dispatch over) runs its
    // delegated ones over the recorded path, up to `next` (the next target's element), and its direct listeners through
    // `late` (attached as the loader's `drain` would: seen by this event).
    L(event, m, next) {
      const row = lazyRows.get(m);
      if (!row) return;
      c.unrecorded(() => void materialise(row));
      const path = paths.get(event);
      if (event.eventPhase !== 0 || !path || row.state !== 1 || !event.bubbles) return;
      Object.defineProperty(event, "composedPath", { configurable: true, value: () => path });
      try {
        _delegateBelow(event, next ?? c.doc);
      } finally {
        delete (event as { composedPath?: unknown }).composedPath;
      }
    },
  };
}
