// Server resume recorder. Resume-compiled components call the `_r*` ABI while they evaluate; the
// recorder (scoped to one render through AsyncLocalStorage) assigns element/text ids, records
// which signals each binding read, and appends one state script plus the inline loader. Pages
// that never reach a resumable slot get no ids, markers, state or loader.
import { AsyncLocalStorage } from "node:async_hooks";
import { DEV } from "#dev";
import {
  computed,
  createRoot,
  getOwner,
  runWithOwner,
  untrack,
  useContext,
  _detach,
  _trackReads,
  _inspect,
  _observeProvide,
  _setRegionStateHook,
  _wrapEffects,
} from "@rivetjs/reactivity";
import {
  attribute,
  COMPILED,
  compiledTemplate,
  MARK_CHAIN,
  MARK_KEEP,
  MARK_RESET,
  template,
  TEMPLATE,
  _attributeName,
  _attributeRecord,
  _markFragments,
} from "./template.ts";
import { resolveSpreadContent, spreadAttributes } from "./server-spread.ts";
import { _onForward } from "./props.ts";
import { escapeAttribute } from "./escape.ts";
import { renderToWriter, renderToString, _list, _listPlan, _variantOf } from "./server.ts";
import {
  createEncoder,
  escapeJSON,
  revive,
  RESUME_VERSION,
  serialize,
  symbolOf,
  typeName,
  _CLASSES,
  _contextById,
  _isContextToken,
  _registeredId,
  _setUnrecorded,
} from "./resume-format.ts";
import type { ClassHooks, ClassRegistry } from "./resume-format.ts";
import { EXPAND, EXPAND_DOM, LAZY, LOADER, LOADER_KEYS, REPEAT, ROWS, STREAM } from "./resume-loader.min.ts";
import { rowPaths } from "./server-resume-paths.ts";
import { addReads, encodeLazy, lazyKeyed, lazyLocal, lazyRowsOn, lazyWarn } from "./server-resume-lazy.ts";
import type { LazyFor as LazyRecord } from "./server-resume-lazy.ts";
import { domServer } from "./dom-data-server.ts";
import { DOM_DATA } from "./dom-data.ts";
import type { DomRegistry, DomSlot } from "./server-dom-data.ts";
import type { RowPaths } from "./server-resume-paths.ts";
import { CONSTANT, _onForRow, _onForRows, _onForLazy, _onPortal, _onBranch, _onForEach, _scopedRecord } from "./server-structural.ts";
import { _inIdScope, _rowIdPrefix } from "./id.ts";
const noop = (): void => {};
/**
 * Derived model (M2 lane A, R1): `./server-derived.ts` installs these on import (the compiled derived module imports its
 * `_rB` / `_rSig` ABI from `@rivetjs/runtime/server-derived`), so pages of the serialized model carry none of it.
 */
export interface DerivedHooks {
  create(): DerivedRender;
  run<T>(ctx: DerivedRender, fn: () => T): T;
  tail(ctx: DerivedRender): ServerValue;
  patch(ctx: DerivedRender, marker: number): string;
}
let derivedHooks: DerivedHooks | null = null;
/** Installed by `server-derived.ts` on import. */
export function _setDerived(hooks: DerivedHooks): void {
  derivedHooks = hooks;
}
import { ROUTER, _hrefs } from "./server-router.ts";
import { _onClientOnly, _onAsync, _onAsyncContent } from "./server-async.ts";
import { _onSuspense, _SUSPENSE } from "./server-suspense-slot.ts";
import { _onResource } from "./server-resource-slot.ts";
import { _onSlot } from "./slot.ts";
import { _onErrorBoundary } from "./server-boundary.ts";
import type { DerivedRender } from "./server-derived.ts";
import type { BoundaryFallback } from "./server-boundary.ts";
import type { Context, Disposer, EqualsOptions, KeyedRead, Owner, Signal } from "@rivetjs/reactivity";
import { _storePaths } from "@rivetjs/reactivity/store";
import type { ListPlan, ServerValue, ServerWriter } from "./server.ts";
import type { AsyncStream } from "./server-async.ts";
import type { ConstantGetter } from "./server-structural.ts";
import type { AttributeNamespace } from "./template.ts";
import type {
  AsyncEntry,
  BindingEntry,
  BranchSpec,
  ClientEventEntry,
  CompactRows,
  EffectEntry,
  EntryRecord,
  PackedBindings,
  Special,
  HandlerEntry,
  Literal,
  ModelEntry,
  PreloadEntry,
  RegionLocals,
  ResumeState,
  RowPathsEntry,
  RowTemplate,
  StatePatch,
  SymbolList,
  SymbolRef,
  TableEntry,
  TemplateBinding,
  BindingName,
} from "./resume-format.ts";

/** Build output that maps symbol ids to chunk URLs. */
export interface ResumeManifest {
  hash?: string;
  /** URL of the resume entry module whose default export is `createResume(...)`. */
  runtime: string;
  symbols: Record<string, string>;
  /**
   * URL of the `@rivetjs/runtime/resume-builtins` chunk (RegExp / URLSearchParams / binary / error decoders): listed in
   * the `needs` of every entry reaching such a value, so other pages never load it. Omitted: the app loads it itself.
   */
  builtins?: string;
  /**
   * URL of the `@rivetjs/runtime/resume-loader-module` chunk (scheduled / low-priority prefetch, idle evaluation of
   * prefetched modules): state script `data-ld`. Omitted: the inline loader only hints on intent and loads on interaction.
   */
  loader?: string;
  /** Dev only: capture names per symbol id (compiler dev server, Function Bridge Q6), for capture errors. */
  captures?: Record<string, readonly string[]>;
  /**
   * The build's browser runtime materialises lazy collection rows (`rivet({ resume: { lazyRows: true } })`, LAZY-T5B):
   * with `RIVET_LAZY_ROWS=on` in the server env, `$lazy` Fors write lazy row records (state `L`). Absent: never.
   */
  lazyRows?: boolean;
  /**
   * The build's browser runtime reads DOM-backed loader data (`rivet({ resume: { domData: true } })`, DOM-DATA): plain
   * JSON trees whose strings the page rendered as an element's whole text encode as `D` entries (read back from the DOM).
   * Absent: never.
   */
  domData?: boolean;
  /**
   * Resume model of the build (`rivet({ resume: { model: "derived" } })`, M2 C3): `"derived"` — `runtime` default-exports
   * the `@rivetjs/runtime/dom-derived` instance, `symbols` maps boundary names (`<module>#<Name>`) to the chunk exporting
   * the component, and servers render with `renderDerived` / `derivedToString` (`@rivetjs/runtime/server-derived`; the
   * router picks it from this field). Absent: serialized.
   */
  model?: "derived";
}
/** Options of resumable server rendering: manifest, CSP nonce, locale variant. */
export interface ResumableOptions {
  signal?: AbortSignal;
  manifest: ResumeManifest;
  /** CSP nonce for the inline loader (and stream) scripts. */
  nonce?: string;
  /** Locale variant index for compiled i18n templates (default 0); see RenderOptions. */
  variant?: number;
  /**
   * Preload planner. `background`: byte budget (minified, manifest `sizes`) of the static closures of `visible` chunks
   * that are also prefetched in the background at idle, in plan order; chunks past it wait for the viewport. Default
   * 1 MiB (`BACKGROUND_DEFAULT`); `0` turns background prefetch off (embedded frames, pages with many demos).
   * `lean`: nothing loads before an interaction — no scheduled prefetch (eager / idle / visible / background, as the
   * loader does under Save-Data) and no fetch-ahead of a lazy router's chunks; handlers load on intent / interaction.
   * `ahead`: fetch-ahead (`data-fo`: low-priority modulepreloads after `load`, the web fonts and an idle slice; fetched,
   * never evaluated) on two kinds of page: bridge D-lean pages (`DeferredState`) keep the fetch-ahead of the runtime +
   * lazy router chunks, so the first link click does not wait for the runtime; on `resume.chunks: "route"` builds
   * (manifest `fetchAhead`) every page also fetches its own handler chunks + their static closures, so the first
   * interaction downloads nothing. Ignored with `lean` and on every other page. The router sets it while the app has
   * document prefetch on (`rivetRouter({ prefetch })`).
   */
  preload?: { background?: number; lean?: boolean; ahead?: boolean };
  /**
   * The request's origin: same-origin `URL` values in the state serialize relative to it (the browser resolves them
   * against its location), so a prerendered page's state carries no build-time origin (`http://localhost`).
   */
  origin?: string;
  /**
   * Resume model (plan `docs/design/plans/2026-10-18-derived-client.md` M2). `serialized` (default): the recorder below
   * (records, state table, loader). `derived`: modules compiled with `resume: { model: "derived" }` call only the boundary
   * recorder (`@rivetjs/runtime/server-derived`: `_rB` / `_rBOut` / `_rBEnd` / `_rBAttr` / `_rSig` / `_rSigStore`; a render
   * with `model: "derived"` before that module loaded renders as the plain server target — no boundary, no tail); the tail is one
   * `<script type="rivet/boundaries">` of values (boundary records + keyed state + wake lists), no state table / loader
   * unless a serialized-model record was made too (`.ts` helpers calling `_r*` directly). `For` rows and `Show` /
   * `Switch` branches keep their `<!--rN[-->…<!--]-->` markers; out-of-order streaming is not entered (no site scopes).
   */
  model?: "serialized" | "derived";
}
/** Options of streaming resumable rendering. */
export interface StreamingResumableOptions extends ResumableOptions {
  /**
   * Out-of-order streaming: a pending `Async` with a fallback writes the fallback first; its content
   * streams after the shell, with a state patch. `deadline` (ms from render start, no default) stops
   * waiting: unfinished boundaries continue in the browser (their `load` runs there).
   */
  stream?: { deadline?: number };
}
/** Manifest fields the bundler adds beyond the public contract. */
interface BuildManifest extends Partial<ResumeManifest> {
  /** Lazy imports per chunk URL. */
  lazy?: Record<string, string[]>;
  /** Static import closure per symbol chunk URL and the runtime (fetch-only hints for a lazy router's chunks). */
  deps?: Record<string, string[]>;
  /** `false`: lazy imports prefetch on intent only, never queued at idle. */
  lazyIdle?: boolean;
  /** Chunk group / route sibling chunk URL groups. */
  groups?: string[][];
  /** App preload rules per symbol. */
  preload?: Record<string, Strategy>;
  /** Chunk sizes per URL. */
  sizes?: Record<string, number>;
  /**
   * `resume.chunks: "route"` builds: with `preload.ahead` (document prefetch on), a non-lean page also fetches its own
   * handler chunks + their static closures ahead (`data-fo`: low priority after `load`, fonts and an idle slice; never
   * evaluated), so the first interaction finds its route chunk in the module map.
   */
  fetchAhead?: boolean;
  /** The build wrote `<chunk>.deps.js` (its static import closure) next to each symbol chunk: state script `data-deps`. */
  depsModules?: boolean;
  /** Framework island chunk URL per island key (`@rivetjs/bridge` facades: `<module>#<export>`), for `_rPreload`. */
  islands?: Record<string, string>;
}
type RecorderOptions = Partial<StreamingResumableOptions> & { manifest?: BuildManifest };
type Strategy = "eager" | "idle" | "visible" | "intent" | "interaction";

/** A region scope being evaluated: `id` once it renders as a region, `row` for For rows. */
interface Scope {
  parent: Scope | null;
  id: number | null;
  mount: string | null;
  row?: boolean;
  async?: boolean;
  record?: RowRecord;
  rows?: RowRecord[];
  /** A child binding site (`_rBind`). */
  site?: boolean;
  /** A Show/Switch branch scope (its id is assigned once it is adoptable). */
  branch?: boolean;
  /** Show/Switch slots of a site: how many its read created directly (the browser re-creation's direct
   * `_show` / `_switch` calls, in creation order). */
  shows?: number;
  /** Branch renders in progress that keep this scope as the region (their Shows are not direct). */
  nest?: number;
  /** The adoptable branches of this site's direct Shows/Switches, in slot order. */
  adopts?: BranchRecord[];
  /** Signals the site's direct Shows read (conditions, content of branches rendered plainly), deduplicated; the first
   * Show's own read list until a second one adds to it (no allocation for one Show). */
  inner?: Signal<unknown>[];
  /** A region site claimed by an ErrorBoundary (always a region: reset re-creates it); a branch: not adopted. */
  claimed?: boolean;
  /** An ErrorBoundary's content scope. */
  boundary?: Catch;
  /** `_regionState` values created directly in this site's read (the browser's re-creation adopts them). */
  locals?: unknown[];
  /** Per `locals` slot: how many slots its `create()` recorded after it. */
  nested?: number[];
  /** Identified providers enclosing this region at its site: [token id, value, …] (non-default values only). */
  providers?: unknown[];
  /** Signals the own renders of this site's rows read (`RowRecord.reads`), deduplicated: the browser keeps those rows
   * while every one still holds its server value (RESUME-KEEP-ROWS). */
  rowReads?: Signal<unknown>[];
  /** A row's records directly in its region (elements, then texts), collected by `rowTemplates`. */
  items?: (ElementRecord | TextRecord)[];
  /** A child binding site's row packing (see `pack`); null: off for this site. */
  pack?: Pack | null;
  /** Lists of this site written from a compiled row plan (R-PLAN, `planRows`): row markers added if it renders as a region. */
  plans?: PlannedRows[];
  /** Awaited Async content (rendered in the traversal, after its site's read): a logical scope that only links the
   * content's records to the region the boundary was constructed in. Everything else treats it like the page root. */
  held?: true;
}
/**
 * Rows packed while a site renders (live set): a row equal to the site's reference row (`sameSource`,
 * same flags) and holding nothing else drops its element / text records right away; they are rebuilt
 * from the reference (`expand`) if the list turns out not to be templated after all.
 */
interface Pack {
  /** The site's first row and its records directly in its row region (elements, then texts). */
  ref: RowRecord;
  items: RowSource[];
  /** Packed rows and where their records were in the recorder's element / text lists: flat (row, elements,
   * texts) triples, no tuple per row. */
  packed: (RowRecord | number)[];
}
/** One ErrorBoundary of a resumable render. */
interface Catch {
  fallback: BoundaryFallback;
  /** The claimed region site (null: not resumable, `reset` stays inert). */
  site: Scope | null;
  /** The content scope (an id only in streaming renders, linked to the site's region). */
  content: Scope;
  owner: Owner | null;
  recorder: Recorder;
  failed: boolean;
}
/** A rendered Show/Switch branch the browser can adopt: match index (-1 fallback) and its value. */
interface BranchRecord {
  id: number;
  key: number | null;
  value: unknown;
  valued: boolean;
  /** Its Show/Switch's slot among the site's direct ones. */
  slot: number;
}
/** A rendered For row inside a region. */
interface RowRecord {
  list: object;
  id: number;
  key: unknown;
  item: unknown;
  index: number;
  indexed: boolean;
  /** Its own render (outside the sites inside it) read signals: the browser re-creates it with its region (`_for`). */
  reads: boolean;
  /** The row's item / index getters and row scope; null once packed (rebuilt by `expand`), so they die young. */
  get: ConstantGetter<unknown> | null;
  at: ConstantGetter<number> | null;
  scope: Scope | null;
  /** The row's `<!--rN[-->…<!--]-->` template (unmarked when its list turns out not adoptable; dropped after the site's decision). */
  wrap: { fragments: readonly string[]; slots: ServerValue[] } | undefined;
  /** Its records were dropped (`pack`): equal to the site's reference row. */
  packed: boolean;
}
/** A ref cell: resolves to its element's id once rendered. */
interface Cell {
  [CELL]: true;
  id: number | null;
  /** The element's region scope (set with `id`): its removal on the resumed page resets the ref. */
  region?: Scope | null;
}
type Captures = readonly unknown[];
/** `_rFn` captures: the array, or a thunk the encoder calls once (hoisted declarations: their captures are in TDZ at registration). */
type LateCaptures = Captures | (() => Captures);
const EMPTY_CAPTURES: Captures = Object.freeze([]);
/** What a pending element recorded. */
interface ElementRecord {
  handlers: Record<string, [symbol: string, captures: Captures]> | null;
  bindings: [name: string, symbol: string, captures: Captures, signals: Signal<unknown>[]][] | null;
  model: [kind: "value" | "checked", state: Signal<unknown>] | null;
  refs: Cell[] | null;
  preload?: Strategy;
  nav?: boolean;
  id?: number;
  region?: Scope | null;
  /** Event types whose handler came from a spread (`{...x}` with a resumable `onX` function). */
  spread?: string[];
  /** The For list whose row (outside any region) rendered this element (preload planning). */
  list?: object;
}
type TextRecord = [node: number, symbol: string, captures: Captures, signals: Signal<unknown>[], scope: Scope | null];
type RegionRecord = [node: number, symbol: string, captures: Captures, signals: Signal<unknown>[], scope: Scope];
type EffectRecord = [symbol: string, captures: Captures, when: string | null, scope: Scope | null];
type ClientEventOptions = { when?: string; passive?: boolean; capture?: boolean; once?: boolean; preload?: Strategy; standalone?: boolean; match?: string };
type ClientEventRecord = [symbol: string, captures: Captures, target: unknown, type: string, options: ClientEventOptions | null, scope: Scope | null];
/** A chunk registered with the preload planner by `_rPreload` (framework bridge islands). */
type PreloadRecord = [url: string, strategy: Strategy, ids: readonly number[] | null];
/** A streamed Async boundary: marker A, fallback region F, claimed region M. */
interface Segment {
  A: number;
  F: number;
  M: Scope;
  parent: Segment | null;
  state: "pending" | "ready" | "failed";
  html: string | null;
  view: Recorder | null;
  out: "content" | "continued" | "dropped" | null;
  dispose: Disposer | null;
  /** The boundary root's disposer: disposes a segment dropped before (or without) its `release`. */
  own: Disposer;
  abort: (reason?: unknown) => void;
  disposed?: boolean;
  error?: unknown;
  /** A Suspense segment: the recorder view holding what its (already constructed) content recorded. */
  prepared?: Recorder;
}
/** Persistent per-render encoding state (see encoding). */
interface Encoding {
  manifest: BuildManifest;
  encoder: ReturnType<typeof createEncoder>;
  chunks: string[];
  chunkOf: Map<string, number>;
  /** Symbol id → page symbol index (wire `s`; assigned per written segment, `symbolList`). */
  symbols: Map<string, number>;
  events: Set<string>;
}
/** One recorder's encoded entries (see encodeRecords). */
interface Encoded extends Omit<StatePatch, "boot"> {
  t0: number;
  c: string[];
  s: SymbolList;
  events: string[];
  schedule: PreloadEntry[];
  boot: boolean;
  n?: number[];
  /** Compact row templates (region entries [8] / [9]): the page needs the expand add-on (`EXPAND`). */
  rx?: boolean;
  /** Relocated table entries / repeated handler / binding entries (`compactTable` `{R}`, `repeatEntries`): the page needs the repeat add-on (`REPEAT`). */
  rr?: boolean;
  /** Route chunk builds (manifest `fetchAhead`): page chunk indexes declared intent / interaction (left out of `data-fo`). */
  late?: number[];
}
type Equals = ((a: unknown, b: unknown) => boolean) | null;

const store = new AsyncLocalStorage<Recorder>();
// An effect created during a resumable render re-runs in its own request's async context: a write by
// another, concurrent request (module-level signal) must not record this render's work into that one.
_wrapEffects((fn) => {
  if (store.getStore() === undefined) return fn;
  const snapshot = AsyncLocalStorage.snapshot();
  return () => snapshot(fn);
});
// Hoisted frozen marker fragments around a marker id slot: one encode-cache entry each (byte writers write the
// id through writeInteger), instead of a fresh fragment array per marker. Their MARK brand lets the writer leave
// the id out when it continues the stride of the two marks written before it (`<!--r-->`; docs/resume.md
// "Marker ids"). Region `<!--rN[-->…<!--]-->` (regions, branches, For rows, streamed fallbacks); text
// `<!--rN-->…<!--/-->`. A streamed boundary keeps its id (the stream add-on finds it) and resets the chain after
// its end: the browser replaces its fallback before it reads the markers.
const REGION = /* @__PURE__ */ _markFragments(["<!--r", "[-->", "<!--]-->"], MARK_CHAIN);
const TEXT = /* @__PURE__ */ _markFragments(["<!--r", "-->", "<!--/-->"], MARK_CHAIN);
const BOUNDARY = /* @__PURE__ */ _markFragments(["<!--r", "[-->", "<!--]-->"], MARK_KEEP);
const PAIR = Object.freeze(["", "", ""]);
let RESET: ServerValue | null = null;
const reset = (): ServerValue => (RESET ??= compiledTemplate(_markFragments(["", ""], MARK_RESET), [0]));
// `_rUnrecorded(fn)`: run `fn` outside the recorder (`store.exit` restores it afterwards, also on throw),
// so `_r*` calls inside degrade to plain output and record nothing.
// Unrecorded pass (cdk collection builds): nothing renders into the recorder, but functions the pass
// creates (`_rFn`) keep their recipes, since the items render from those props afterwards. Synchronous.
let unrecordedRender: Recorder | undefined;
_setUnrecorded((fn) => {
  const recorder = store.getStore();
  if (!recorder) {
    // Inside a lazy row (recorder exited already): the pass records nothing into the row either.
    if (lazyRow === null) return fn();
    const lazy = lazyRow;
    lazyRow = null;
    try {
      return fn();
    } finally {
      lazyRow = lazy;
    }
  }
  const previous = unrecordedRender;
  unrecordedRender = recorder;
  try {
    return store.exit(fn);
  } finally {
    unrecordedRender = previous;
  }
});
const CELL: unique symbol = Symbol.for("rivet.ref");
// `render`: the render that registered the recipe (first registration of a render wins; a function
// reused across renders takes the current render's). `live`: a component's live props object (`_rProps`):
// always its recipe (never by value). `fw`: a props object built by `@rivetjs/runtime/props` helpers whose
// getters forward to source props (key → sources): encoded as those forwards (`{k:"props"}` / `{k:"m"}`).
interface FnMeta {
  id: string;
  captures: LateCaptures;
  render: object;
  live?: true;
  fw?: Map<string, readonly object[]>;
}
// Live props recipes (`_rProps`) ride on the props object itself as a private field (return-override stamp: invisible to
// keys / spread / descriptors / proxy traps): no WeakMap insert per component instance (~2× the cost, plus ephemeron
// GC work on 1,000-instance pages). Non-extensible props objects fall back to `fns`.
class Stamped {
  constructor(object: object) {
    return object;
  }
}
class Live extends Stamped {
  #meta: FnMeta;
  constructor(object: object, meta: FnMeta) {
    super(object);
    this.#meta = meta;
  }
  static get(object: object): FnMeta | undefined {
    return #meta in object ? (object as Live).#meta : undefined;
  }
  static set(object: object, meta: FnMeta): void {
    if (#meta in object) (object as Live).#meta = meta;
    else if (Object.isExtensible(object)) new Live(object, meta);
    else fns.set(object, meta);
  }
}
// `_rFn` / props-helper recipes (`fns`) ride on the function / object too (a private field of their own, so a live props
// stamp still wins in `metaOf`): `_rFn` runs per created function and render — a WeakMap insert each (plus ephemeron GC
// work) cost ~3% of a component-heavy resume render. Non-extensible values fall back to a WeakMap.
class Recipe extends Stamped {
  #recipe: FnMeta;
  constructor(object: object, meta: FnMeta) {
    super(object);
    this.#recipe = meta;
  }
  static get(object: object): FnMeta | undefined {
    return #recipe in object ? (object as Recipe).#recipe : frozen.get(object);
  }
  static has(object: object): boolean {
    return #recipe in object || frozen.has(object);
  }
  static set(object: object, meta: FnMeta): void {
    if (#recipe in object) (object as Recipe).#recipe = meta;
    else if (Object.isExtensible(object)) new Recipe(object, meta);
    else frozen.set(object, meta);
  }
}
const frozen = new WeakMap<object, FnMeta>();
const fns = Recipe;
// Function Bridge (Reference, plans T2 + T3): a module-level function / import of a resume module, stamped once per module
// load by the compiler epilogue (`_rMod(() => inc, "src/a.tsx#inc$k3x9q$ref")`). Encodes `{f: id, a: []}` (wire `{f:[sym]}`)
// wherever a render reaches it — objects, arrays, Maps, signals; the browser symbol (`() => (inc)`) returns the module's own
// binding. The epilogue passes a thunk: an import binding may still be in its TDZ while an import cycle evaluates
// (`export const` of a module evaluated after its importer), so stamps queue and `drainRefs` reads them when a render
// starts and before each encode, keeping one that still throws a ReferenceError for the next drain (T3 fix H3).
// Only functions (not signals / computeds) and static data (plain objects / arrays of primitives, functions and such
// data) are referable: an object holding signals or other state goes by value (T3 fix M4).
// `render: MODULE` marks it for every render; a per-render `_rFn` on the same value never replaces it. Import ids are one
// compiler id per imported value (resolved module id + exported name), so every importer stamps the same id. A value
// stamped several times keeps, independent of module evaluation order (lazy routes = request order): an own-module stamp
// (the defining resume module) over any import stamp (flag `imported`), else the smallest id (code-unit order).
const MODULE: object = Object.freeze({});
// Values whose MODULE stamp came from an import (`_rMod(…, 1)`): an own-module stamp replaces it.
const importStamps = new WeakSet<object>();
// Stamps not read yet: [read, id, imported, stamping module (development only)].
const pendingRefs: [() => unknown, string, 1 | undefined, string | undefined][] = [];

/** Function Bridge Reference: the value `read()` returns (a module-level function / static data, or an import when `imported`) is the browser module's own binding `id`. */
export function _rMod(read: () => unknown, id: string, imported?: 1): void {
  pendingRefs.push([read, id, imported, DEV ? DEV.stamper(_rMod) : undefined]);
}
function drainRefs(): void {
  if (pendingRefs.length === 0) return;
  let kept = 0;
  for (const entry of pendingRefs) {
    let value: unknown;
    try {
      value = entry[0]();
    } catch (error) {
      // Still in its TDZ (import cycle): read again at the next drain. Any other error: never referable.
      if (error instanceof ReferenceError) pendingRefs[kept++] = entry;
      continue;
    }
    if (!referable(value, null)) continue;
    // Development (T3, `dev/on.ts` `moduleRef`): importers of one export stamp one value and are all recorded for the id; a
    // new value from any module that stamped the id before is a re-evaluation (dev server edit), not a collision. A new
    // value from a module never seen for the id = two installed copies of a package loaded together (the browser would
    // resume one as the other) — a warning once per id, in any drain. Every value is stamped either way.
    if (DEV) DEV.moduleRef(entry[1], value, entry[3] ?? "");
    stampRef(value as object, entry[1], entry[2]);
  }
  pendingRefs.length = kept;
}
// A function that is not a signal / computed, or static data: a plain object / array whose values are primitives,
// such functions or such data (lucide icon nodes, route tables). `seen` = null at the top (primitives are not referable).
// Accessors make an object non-referable without running them (a getter may read state).
function referable(value: unknown, seen: Set<object> | null): boolean {
  if (typeof value === "function") return _inspect(value) === null;
  if (value === null || typeof value !== "object") return seen !== null;
  if (seen?.has(value)) return true;
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return false;
  (seen ??= new Set()).add(value);
  for (const key of Object.keys(value)) {
    const property = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in property) || !referable(property.value, seen)) return false;
  }
  return true;
}
function stampRef(value: object, id: string, imported: 1 | undefined): void {
  const known = fns.get(value);
  const weak = importStamps.has(value);
  if (known?.render !== MODULE || (imported ? weak && id < known.id : weak || id < known.id)) {
    fns.set(value, { id, captures: EMPTY_CAPTURES, render: MODULE });
    if (imported) importStamps.add(value);
    else importStamps.delete(value);
  }
}
// Recipe of a function / object: a live props stamp first (it wins over a helper's `fw` meta), else `fns`.
const metaOf = (value: object): FnMeta | undefined => Live.get(value) ?? fns.get(value);
// A recipe's captures: a thunk (`_rFn` late captures, Function Bridge T5) is called once, at the recipe's first encode, and
// replaced by its result. Its error fails the render naming the recipe.
function capturesOf(meta: FnMeta): Captures {
  if (typeof meta.captures !== "function") return meta.captures;
  try {
    return (meta.captures = meta.captures());
  } catch (error) {
    throw new TypeError("Cannot resume " + meta.id + ": captures " + ((error as Error | null)?.message ?? String(error)), { cause: error });
  }
}
// A recipe's captures for a render-time record (a spread handler, a symbol child's `_rBind` site): the array, or — late
// captures — a thunk over `capturesOf` (the recorder is flagged; `settleLate` resolves it when the recorder encodes), so a
// hoisted function's captures are not read while still in their TDZ.
function siteCaptures(meta: FnMeta, recorder: Recorder): Captures {
  if (typeof meta.captures !== "function") return meta.captures;
  recorder.late = true;
  return (() => capturesOf(meta)) as unknown as Captures;
}
const settled = (values: Captures): Captures => (typeof values === "function" ? (values as () => Captures)() : values);
// Resolve the late capture thunks `siteCaptures` left in a recorder's records, at its encode (once: interned per recipe).
function settleLate(recorder: Recorder): void {
  recorder.late = false;
  for (const text of recorder.texts) text[2] = settled(text[2]);
  for (const region of recorder.regions) region[2] = settled(region[2]);
  for (const element of recorder.elements) {
    if (element.handlers) for (const type in element.handlers) element.handlers[type]![1] = settled(element.handlers[type]![1]);
    if (element.bindings) for (const binding of element.bindings) binding[2] = settled(binding[2]);
  }
}
// `_rProps` recipe ids whose captures failed to serialize (process-wide): their props go by value.
const unportable = new Set<string>();
// Recipe-const ids (`_rFn` values) whose value did not encode once (process-wide, Q5 / T18): their recipe from then on.
const recipeOnly = new Set<string>();
// A forwarded getter of a `fw` props object while encoding: `{k:"m", a: [key, …sources]}`.
const FORWARD: unique symbol = Symbol("forward");
interface Forward {
  [FORWARD]: true;
  key: string;
  sources: readonly object[];
}
// Live props (LIVE-PROPS P3): getters a props helper forwards (`splitProps(props, …)`) are recorded per render,
// so captured split / merged props keep forwarding to the recipe props object they came from in the browser.
_onForward((target, key, sources) => {
  const recorder = store.getStore() ?? unrecordedRender;
  if (!recorder || typeof key !== "string") return;
  let meta = metaOf(target);
  // A module reference (`_rMod`) stays one: never overwritten by a per-render forward box.
  if (meta?.render === MODULE || (meta?.live && meta.render === recorder.options)) return;
  if (meta === undefined || meta.fw === undefined || meta.render !== recorder.options)
    fns.set(target, (meta = { id: "", captures: EMPTY_CAPTURES, render: recorder.options, fw: new Map() }));
  meta.fw?.set(key, sources);
});
// The sources of a forward box (`{k:"m", a: [key, …sources]}`): each source object itself when it encodes, else narrowed
// to the one key the box reads (RESUME-BUGS #4, 2026-10-09: a cdk CalendarCell view over props holding a CalendarDate
// failed the whole render) — a data value as `{ [key]: value }`, a helper-forwarded getter as that getter's own sources
// (in place: the browser getter takes the last source whose value is not `undefined`, same order), any other getter
// (a live recipe whose captures do not serialize) as the value it returns now. Only the failing path pays.
function forwardSources(
  key: string,
  sources: readonly object[],
  a: number[],
  ref: (value: unknown) => number,
  refs: (values: readonly unknown[]) => number[] | undefined,
): void {
  for (const source of sources) {
    // A getter that reads no signal is a constant (IMPL-EAGER 2026-10-09): its value, so the box does not reach the
    // source's recipe — a parent's live props recipe would make the handler need (and preload) the parent's chunk,
    // e.g. ui ButtonRoot + tailwind-merge on a page whose button props are all static. `undefined` drops the source
    // (the browser getter skips it). Values that do not encode keep the source.
    const getter = Object.getOwnPropertyDescriptor(source, key)?.get;
    if (getter !== undefined) {
      let read: { value: unknown; signals: readonly unknown[] } | undefined;
      try {
        read = _trackReads(() => getter.call(source));
      } catch {
        read = undefined;
      }
      if (read !== undefined && read.signals.length === 0) {
        if (read.value === undefined) continue;
        const narrowed = refs([{ [key]: read.value }]);
        if (narrowed !== undefined) {
          a.push(narrowed[0]!);
          continue;
        }
      }
    }
    const whole = refs([source]);
    if (whole !== undefined) {
      a.push(whole[0]!);
      continue;
    }
    const desc = Object.getOwnPropertyDescriptor(source, key);
    if (desc === undefined) continue;
    if (desc.get === undefined) {
      a.push(ref({ [key]: desc.value }));
      continue;
    }
    const meta = metaOf(source);
    const inner = meta?.live ? undefined : meta?.fw?.get(key);
    if (inner !== undefined) forwardSources(key, inner, a, ref, refs);
    else a.push(ref({ [key]: untrack(() => (source as Record<string, unknown>)[key]) }));
  }
}
const computeds = new WeakMap<object, { id: string; captures: Captures; frame: Frame | null }>();
// Owner context (lane RESUME-CTX 2026-10-09): a captured computed evaluates in the browser under its creation owner,
// which a decoded entry would place at the resume root (cdk collection build passes run item component bodies there,
// reading contexts). Its entry records the identified providers (`resumableContext` tokens with a non-default value)
// enclosing the creation, as one shared list per context frame: [token id, value, …], outermost first. Frames are
// reactivity's immutable context chain (`ctx` of the creation owner, the field `debug.ts` reads too): one walk per frame,
// then a WeakMap hit.
interface Frame {
  token: Context<unknown>;
  value: unknown;
  up: Frame | null;
}
const frameOf = (): Frame | null => (getOwner() as unknown as { ctx: Frame | null } | null)?.ctx ?? null;
const providerLists = new WeakMap<Frame, unknown[] | null>();
function providersOf(frame: Frame | null): unknown[] | null {
  if (frame === null) return null;
  let list = providerLists.get(frame);
  if (list !== undefined) return list;
  const seen = new Set<string>(),
    inner: unknown[] = [];
  for (let at: Frame | null = frame; at !== null; at = at.up) {
    const token = at.token,
      id = token.id;
    // Unregistered tokens: the resume root supplies them (`createResume({ contexts })`); the nearest frame per token wins.
    if (id === undefined || seen.has(id) || _contextById(id) !== token) continue;
    seen.add(id);
    if (at.value !== token.defaultValue) inner.push(at.value, id);
  }
  list = inner.length ? inner.reverse() : null;
  providerLists.set(frame, list);
  return list;
}
// Client-only components mount into their enclosing region at a trigger (a For row's: the list's).
_onClientOnly((when) => {
  const recorder = store.getStore();
  if (!recorder) return lazyReason("a clientOnly component");
  let scope = recorder?.region;
  // A branch hosting client-only code is not adopted: its region re-creates it at the trigger.
  while (scope?.row || scope?.branch || scope?.boundary) {
    if (scope.branch) scope.mount = when;
    scope = scope.parent;
  }
  if (scope && !scope.held) scope.mount ??= when;
});
// Every Show/Switch a site's read creates directly (not inside another branch, a row or a nested site) takes a slot,
// in creation order: the browser's re-creation of the region hands slot i to the i-th `_show` / `_switch` its read
// creates directly. A slot's branch renders as `<!--rN[-->…<!--]-->` when the browser can keep it: the condition read
// signals and the branch itself read none outside its own bindings (no For rows, no client-only code). The browser
// adopts it while the match (and the value, if the branch read it) is unchanged. Otherwise the branch renders plainly
// (re-created like a ternary).
_onBranch((pick, keyed, render) => {
  const recorder = store.getStore();
  // Rows, branches, nested sites and ErrorBoundary content (a lazy `_scoped` output on the browser) are scopes of their
  // own: Shows there are not direct.
  const site = recorder?.region;
  const slot = site?.site && !site.nest ? (site.shows = (site.shows ?? 0) + 1) - 1 : -1;
  if (slot < 0) {
    const [key, value] = pick();
    const get: ConstantGetter<unknown> = () => value;
    get[CONSTANT] = value;
    // Derived model: no branch record; the branch keeps its `<!--rN[-->…<!--]-->` markers (the adopt run's branch anchors).
    if (recorder?.derived && !site) return compiledTemplate(REGION, [recorder.next++, render(key, get)]);
    return render(key, get);
  }
  const { value: picked, signals } = _trackReads(pick);
  // The enclosing scopes depend on the condition.
  for (const read of signals) read();
  const [key, value] = picked;
  const record: BranchRecord = { id: 0, key, value, valued: keyed(key), slot };
  const get: ConstantGetter<unknown> = () => ((record.valued = true), value);
  get[CONSTANT] = value;
  if (!signals.length) return nested(site!, render, key, get);
  addInner(site!, signals);
  const scope: Scope = { parent: site!, id: null, mount: null, branch: true };
  recorder!.region = scope;
  let tracked;
  try {
    tracked = _trackReads(() => render(key, get));
  } finally {
    recorder!.region = site!;
  }
  if (tracked.signals.length || scope.mount !== null || scope.rows || scope.claimed) {
    // Content reads count for the site (re-created on them), but only change this branch: the other slots stay adoptable.
    for (const read of tracked.signals) read();
    addInner(site!, tracked.signals);
    if (scope.rows) (site!.rows ??= []).push(...scope.rows);
    return tracked.value;
  }
  record.id = scope.id = recorder!.next++;
  (site!.adopts ??= []).push(record);
  return compiledTemplate(REGION, [record.id, tracked.value]);
});
// A For directly in a site: its `each` reads only pick rows (adopted by item), never which Shows the read creates directly.
_onForEach((props) => {
  const site = store.getStore()?.region;
  if (!site?.site || site.nest) return props.each;
  const { value, signals } = _trackReads(readEach, props);
  for (const read of signals) read();
  if (signals.length) addInner(site, signals);
  return value;
});
const readEach = (props: { each: unknown }): unknown => {
  const each = props.each;
  return typeof each === "function" ? (each as () => unknown)() : each;
};
// A branch rendered in its site's scope (constant condition): Shows inside it are not direct (the browser creates them in
// the branch's root), and its reads only change this branch.
function nested(site: Scope, render: (index: number, get: () => unknown) => ServerValue, key: number, get: () => unknown): ServerValue {
  site.nest = (site.nest ?? 0) + 1;
  let tracked;
  try {
    tracked = _trackReads(() => render(key, get));
  } finally {
    site.nest--;
  }
  for (const read of tracked.signals) read();
  if (tracked.signals.length) addInner(site, tracked.signals);
  return tracked.value;
}
// Reads only Shows (or For `each` accessors) made: kept out of the site's "steering" reads (`_rBind`).
function addInner(site: Scope, reads: Signal<unknown>[]): void {
  const inner = site.inner;
  if (inner === undefined) return void (site.inner = reads);
  let added: Signal<unknown>[] | null = null;
  for (let i = 0; i < reads.length; i++) if (!inner.includes(reads[i]!) && !added?.includes(reads[i]!)) (added ??= []).push(reads[i]!);
  if (added !== null) site.inner = inner.concat(added);
}
type RowCall = [render: (get: () => unknown, at: () => number) => ServerValue, get: () => unknown, at: () => number];
// Module level (no closure per row: V8 keeps its optimized code across renders).
const renderRow = (call: RowCall): ServerValue => call[0](call[1], call[2]);
// DOM-DATA (`resume: { domData: true }` builds only; `DOM_DATA` folds this away elsewhere): the data object a row
// renders when its `For` iterates keys — cdk built-collection rows name their node's `value` (`@rivetjs/cdk` `#server`
// `domRowItem`, from `renderNodeAt`) through this hook. The first call inside a row wins (its own node renders before
// nested rows, which save and clear it); the row registers it instead of its key (`DomRegistry.lazyRow`).
let rowItem: unknown;
if (DOM_DATA)
  (globalThis as unknown as Record<symbol, (item: unknown) => void>)[Symbol.for("rivet.domRowItem")] = (item) => {
    if (rowItem === undefined && item !== null && typeof item === "object") rowItem = item;
  };
// For rows inside a region render as row regions `<!--rN[-->…<!--]-->`; the browser For adopts them
// by key when its first run keeps the row's item (and index, if the row read it).
const forRow = (list: object, item: unknown, key: unknown, index: number, render: RowCall[0]): ServerValue => {
  const get: ConstantGetter<unknown> = () => item;
  get[CONSTANT] = item;
  const recorder = store.getStore();
  const parent = recorder?.region;
  if (!parent || parent.held) {
    const at: ConstantGetter<number> = () => index;
    at[CONSTANT] = index;
    if (!recorder) return render(get, at);
    // Derived model: no row records; the row keeps its `<!--rN[-->…<!--]-->` markers (the adopt run's row anchors).
    if (recorder.derived && !parent) return compiledTemplate(REGION, [recorder.next++, render(get, at)]);
    // No region: rows are not adoptable, but their elements still count as list rows for preload planning.
    const before = recorder.elements.length;
    const value = render(get, at);
    for (let i = before; i < recorder.elements.length; i++) recorder.elements[i]!.list ??= list;
    return value;
  }
  // Every field up front (one shape, no out-of-object property store): the record outlives the row.
  const record: RowRecord = {
    list,
    id: recorder!.next++,
    key,
    item,
    index,
    indexed: false,
    reads: false,
    get,
    at: null,
    scope: null,
    wrap: undefined,
    packed: false,
  };
  const scope: Scope = { parent, id: record.id, mount: null, row: true, record };
  const at: ConstantGetter<number> = (record.at = () => ((record.indexed = true), index));
  at[CONSTANT] = index;
  record.scope = scope;
  recorder!.region = scope;
  const r = recorder!,
    e0 = r.elements.length,
    t0 = r.texts.length,
    r0 = r.regions.length,
    f0 = r.effects.length,
    c0 = r.clientEvents.length,
    others = r.asyncs.length + r.links.length + r.lists.length;
  let value, outerItem: unknown;
  if (DOM_DATA) ((outerItem = rowItem), (rowItem = undefined));
  try {
    // The row's own reads (a TabPanel deciding to render nothing for an unselected tab): no site inside the row binds
    // them, so the browser cannot keep this server row when the region re-runs (`reads`). Still the region's reads too.
    const tracked = _trackReads(renderRow, [render, get, at] as RowCall);
    value = tracked.value;
    if (tracked.signals.length) {
      record.reads = true;
      readRow(parent, tracked.signals);
    }
  } finally {
    recorder!.region = parent;
    // DOM-DATA: the row's values, anchored at its root element's `data-r` id (packed rows write no row markers).
    if (DOM_DATA) {
      if (r.dom !== null) r.dom.recordedRow(value, rowItem ?? item);
      rowItem = outerItem;
    }
  }
  (parent.rows ??= []).push(record);
  if (parent.site && parent.pack !== null) pack(r, parent, record, e0, t0, r0, f0, c0, others);
  return (record.wrap = compiledTemplate(REGION, [scope.id, value]) as unknown as RowRecord["wrap"]) as unknown as ServerValue;
};
_onForRow(forRow);
_onPortal(() => lazyReason("a Portal"));
// A row's own reads: the region's reads too (re-read into its collector), and the site's row reads (`rowReads`).
function readRow(site: Scope, signals: readonly Signal<unknown>[]): void {
  const list = (site.rowReads ??= []);
  for (const signal of signals) {
    signal();
    if (!list.includes(signal)) list.push(signal);
  }
}
_onForRows((list, items, keys, rows, render) => {
  const recorder = store.getStore();
  const site = recorder?.region;
  // Only a fresh site's first list packs (`pack`): elsewhere every row keeps its records, the plan would save nothing.
  if (!recorder || !site?.site || site.held || site.pack !== undefined || site.rows || recorder.pending !== null) return undefined;
  const [plan, write, env] = rows as RowsProp;
  if (!items.length || !(plan instanceof RowPlan) || !plan.ok || Object.getPrototypeOf(items) !== Array.prototype) return undefined;
  for (let k = 0; k < items.length; k++) if (!(k in items)) return undefined;
  const outer = rowContext;
  try {
    return planRows(recorder, site, list, items, keys, plan, write, env, render);
  } finally {
    rowContext = outer;
  }
});
// ---- LAZY-ROWS T4: lazy row region records (spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.1) ----
// A keyed `<For>` the compiler marked lazy (`$lazy: [flags, key?]`, its `children` a resumable row function) renders its rows
// with recording suppressed — the recorder is exited (`store.exit`, as in `_rUnrecorded`): no ids, handlers, bindings, row
// records or captures inside a row — and records ONE entry for the For (`LazyRowsEntry`, state `L`): its id, row function,
// items, `by`, the rows' signal reads and per-row `_regionState` values. Each row keeps its marker pair (ids consecutive
// after the For's) and renders under the id seed `_rowIdPrefix(forId, index)` (`@rivetjs/runtime/id`), so a re-run of the
// row function for that row (browser materialisation, T5) creates the same markup and ids. Sites a re-run cannot replay
// (client-only code, Async / Suspense, Portal) turn the whole For back to recorded rows (R3): its rows render again
// through the row hooks (dev: a warning naming the For). Client effects / clientEvent listeners inside a row are no reason
// (R6, T5): they run when the row materialises. The entry also lists the event types the rows handle ([9]: the browser
// materialises a row on one) and the identified providers around the For ([10]: re-provided around a materialised row).
// Off unless the build opted in (`rivet({ resume: { lazyRows: true } })`: manifest `lazyRows`, its browser runtime
// materialises the rows) AND the server env has `RIVET_LAZY_ROWS=on` (read per render; LAZY-T5B). The record type, the switch,
// the read / `_regionState` helpers and the `L` encoder (`encodeLazy`) live in `server-resume-lazy.ts`.
/** A lazy For's record in this module (`server-resume-lazy.ts` `LazyFor`, its scope / recorder types bound). */
type LazyFor = LazyRecord<Scope, Recorder>;
let lazyRow: LazyFor | null = null;
// A lazy row is rendering (recorder exited): what a row would record goes to `lazyRow`.
const inLazyRow = (): LazyFor | null => (lazyRow !== null && store.getStore() === undefined ? lazyRow : null);
// A site a row re-run cannot replay: the For falls back (or, found in the traversal, its entry is dropped).
function lazyReason(reason: string): void {
  const lazy = inLazyRow();
  if (lazy === null) return;
  if (lazy.done) lazy.late ??= reason;
  else lazy.reason ??= reason;
}
// A client effect / listener in the rendering lazy row: the row materialises at idle (entry [11]).
function lazyEffect(): void {
  const lazy = inLazyRow();
  if (lazy !== null && !(lazy.effects ??= []).includes(lazy.row)) lazy.effects.push(lazy.row);
}
// A site's read inside a lazy row: its signals are the row's reads (entry `reads`). Component bodies run untracked, so the
// For's own collector sees only reads outside components (cdk rows: none) — every site tracks its own, as a recorded one does.
function lazyRead<T>(lazy: LazyFor, read: () => T): T {
  const tracked = _trackReads(read, undefined, lazy.hook);
  if (tracked.signals.length) addReads(lazy, tracked.signals);
  return tracked.value;
}
// Run `fn` as part of lazy row `row` (slot content the traversal renders after the rows): still unrecorded, same row.
function inLazy<T>(lazy: LazyFor, row: number, fn: () => T): T {
  const outer = lazyRow,
    unrecorded = unrecordedRender,
    at = lazy.row;
  lazyRow = lazy;
  unrecordedRender = lazy.recorder;
  lazy.row = row;
  try {
    const tracked = _trackReads(() => store.exit(fn), undefined, lazy.hook);
    if (tracked.signals.length) addReads(lazy, tracked.signals);
    return tracked.value;
  } finally {
    lazyRow = outer;
    unrecordedRender = unrecorded;
    lazy.row = at;
  }
}
// One lazy row: its marker pair (id forId + 1 + index) around the row rendered under its id seed. The row renders to HTML
// here, inside the row's context (recorder exited, `lazyRow` set, id seed provided): every site of its content — slot
// content too, which the traversal would otherwise render after the For's decision — is seen before the decision, so a
// fallback reason is never found after the rows were written. Pending async content is itself a reason.
function lazyRowValue(lazy: LazyFor, index: number, item: unknown, render: RowCall[0]): ServerValue {
  const get: ConstantGetter<unknown> = () => item,
    at: ConstantGetter<number> = () => index;
  get[CONSTANT] = item;
  at[CONSTANT] = index;
  lazy.row = index;
  const { signal, variant } = lazy.recorder.options,
    dom = lazy.recorder.dom;
  const html = _inIdScope({ prefix: _rowIdPrefix(lazy.forId, index), n: 0 }, () => {
    // DOM-DATA: the row's data object (`rowItem`, cdk collection rows iterate keys), else its item.
    const outerItem = DOM_DATA ? rowItem : undefined;
    if (DOM_DATA) rowItem = undefined;
    const value = render(get, at);
    if (dom !== null) dom.lazyRow(value, lazy.forId + 1 + index, DOM_DATA && rowItem !== undefined ? rowItem : item);
    if (DOM_DATA) rowItem = outerItem;
    return renderToString(_scopedRecord(getOwner(), value, noop), { signal, variant });
  });
  if (typeof html !== "string") {
    html.then(noop, noop);
    lazy.reason ??= "async content";
    return "";
  }
  return compiledTemplate(REGION, [lazy.forId + 1 + index, template([html])]);
}
_onForLazy((_list, items, verdict, children, by, render) => {
  const recorder = store.getStore();
  if (!recorder?.lazyRows || recorder.derived) return undefined;
  const flags = verdict[0] as number,
    key = verdict[1],
    meta = metaOf(children);
  // Before any row renders: the row function and `by` resume by recipe, the items are a plain dense array.
  let reason: string | null = null;
  if (meta === undefined || meta.live || meta.fw) reason = "the row function is not a resumable function";
  else if (flags & 2 ? !metaOf(by as object) : typeof key !== "string") reason = "`by` is neither a key path nor a resumable function";
  else if (Object.getPrototypeOf(items) !== Array.prototype) reason = "`each` is not a plain array";
  else for (let k = 0; k < items.length && reason === null; k++) if (!(k in items)) reason = "`each` has holes";
  const symbol = meta?.id ?? "?";
  if (reason !== null) {
    lazyWarn(symbol, -1, reason);
    return undefined;
  }
  const forId = recorder.next++;
  recorder.next += items.length;
  const lazy: LazyFor = {
    forId,
    scope: recorder.region,
    symbol,
    rowFn: children,
    items,
    by: flags & 2 ? by : key,
    flags: flags & 3,
    reads: new Set(),
    keyed: null,
    hook: null as unknown as KeyedRead,
    locals: null,
    recorder,
    row: 0,
    done: false,
    reason: null,
    late: null,
    sites: 0,
    events: new Set(),
    types: new Set(),
    providers: null,
    effects: null,
  };
  lazy.hook = (signal, kind, key) => lazyKeyed(lazy, signal, kind, key);
  // Providers enclosing the For (as a region site records them): a materialised row reads the server's values.
  for (const token of recorder.tokens.values()) {
    const provided = useContext(token);
    if (provided !== token.defaultValue) (lazy.providers ??= []).push(token.id, provided);
  }
  const rows: ServerValue[] = new Array(items.length);
  const outer = lazyRow,
    unrecorded = unrecordedRender;
  lazyRow = lazy;
  unrecordedRender = recorder;
  try {
    // One read collector for the whole For (a nested `_trackReads` does not forward): the rows' reads are not the enclosing
    // site's (it is not re-created on them); they ship with the entry.
    const tracked = _trackReads(
      () =>
        store.exit(() => {
          for (let k = 0; k < items.length && lazy.reason === null; k++) rows[k] = lazyRowValue(lazy, k, items[k], render);
        }),
      undefined,
      lazy.hook,
    );
    addReads(lazy, tracked.signals);
  } finally {
    lazyRow = outer;
    unrecordedRender = unrecorded;
  }
  if (lazy.reason !== null) {
    // R3: the whole For records its rows (rendered again through the row hooks); its ids were never written.
    recorder.next = forId;
    lazyWarn(symbol, forId, lazy.reason);
    return undefined;
  }
  lazy.done = true;
  for (const type of lazy.events) recorder.events.add(type);
  if (lazy.sites || lazy.reads.size || lazy.keyed) recorder.used = true;
  recorder.lazy.push(lazy);
  return rows as unknown as ServerValue;
});

// ---- R-PLAN: resumable keyed `<For>` rows from a compiled row plan ----
// The compiler (resume server target) passes `$rows: [plan, write, env]` for a keyed `<For>` whose row is one native template
// with only `_rOn` / `_rAttr` / `_rId` resume sites: `plan` (`_rRowPlan`, module level) = the row's list plan + its sites,
// `write(tape, base, row, index, env, site)` (module level) = the row's slot values onto one tape (`site(k)`: the k-th
// site's value), `env` = the outer values the row reads. A row equal to the first one (same site reads, nothing else
// recorded) is packed as `pack` would pack it, without any per-row record, getter or captures; the first row's records
// are built from the plan. A row that differs gets its records (then `pack` decides) and the rest render row by row.
// Output and state equal the row-by-row path's.
type RowsProp = readonly [plan: RowPlan, write: RowWriter, env: Captures];
type RowWriter = (tape: unknown[], base: number, row: () => unknown, index: () => number, env: Captures, site: (k: number) => unknown) => void;
/** One resume site of a row: `_rId` (kind 0), `_rOn` (1), `_rAttr` (2), in slot order. */
interface RowSite {
  kind: 0 | 1 | 2;
  /** The element (0-based among the row's `_rId` sites) it belongs to. */
  element: number;
  /** Handler key (`type` / `type!`) or binding output name. */
  name: string;
  symbol: string;
  read: ((captures: Captures) => unknown) | null;
  /** Capture sources: env index (≥ 0), -1 the row item getter, -2 the row index getter. */
  shape: readonly number[];
  namespace: AttributeNamespace | undefined;
  preload: Strategy | undefined;
  nav: boolean;
}
class RowPlan {
  declare list: ListPlan;
  declare sites: RowSite[];
  /** Ids a row may take: its row id + one per element. */
  declare stride: number;
  /** Per element: its handler and binding site indexes. */
  declare elements: { handlers: number[]; bindings: number[] }[];
  declare events: string[];
  declare ok: boolean;
  /** The list plan inside row region markers (`markPlans`), made on first use. */
  declare region: ListPlan | undefined;
  /** Element paths of the template (`server-resume-paths.ts`; null: ids stay). Rows of such a plan take every id of
   * their stride (element k = row id + 1 + k), so the browser reads ids from the row's marker id. */
  declare paths: RowPaths | null;
  /** The region plan with the `_rId` slots written nothing (rows addressed by path), made on first use. */
  declare pathRegion: ListPlan | undefined;
  /** Tape slots of the `_rId` sites, element order. */
  declare ids: number[];
  /** Path plan whose first `_rId` element is the row root: rows outside row regions keep only the root's `data-r`
   * (written whether used or not) and the browser walks the paths from it. */
  declare anchor: boolean;
  /** The list plan writing only the root's `_rId` slot (`anchor` rows outside row regions), made on first use. */
  declare rootList: ListPlan | undefined;
  /** DOM-DATA: the template (fragments, entries) and its sole-child text slots (`rowTexts`), made on first use. */
  declare source: readonly [fragments: readonly string[], entries: readonly unknown[], sites: readonly number[]];
  declare texts: DomSlot[] | null | undefined;
  constructor(
    list: ListPlan,
    sites: RowSite[],
    stride: number,
    elements: { handlers: number[]; bindings: number[] }[],
    events: string[],
    ok: boolean,
    paths: RowPaths | null,
    ids: number[],
    source: readonly [fragments: readonly string[], entries: readonly unknown[], sites: readonly number[]],
  ) {
    this.list = list;
    this.sites = sites;
    this.stride = stride;
    this.elements = elements;
    this.events = events;
    this.ok = ok;
    this.region = undefined;
    this.paths = paths;
    this.pathRegion = undefined;
    this.ids = ids;
    this.anchor = paths !== null && paths.paths[0]!.endsWith(":");
    this.rootList = undefined;
    this.source = source;
    this.texts = undefined;
  }
}
type RowSiteSpec =
  | readonly [slot: number, kind: 0]
  | readonly [
      slot: number,
      kind: 1,
      type: string,
      symbol: string,
      shape: readonly number[],
      flags?: { preload?: Strategy; nav?: boolean; capture?: 1 | boolean } | null,
    ]
  | readonly [
      slot: number,
      kind: 2,
      name: string,
      symbol: string,
      read: (captures: Captures) => unknown,
      shape: readonly number[],
      namespace?: AttributeNamespace,
    ];
/**
 * Compiler ABI (R-PLAN): a resumable row plan — the row template's list plan (`_listPlan(fragments, entries)`; `_rAttr` /
 * `_rId` slots are attribute entries, `_rOn` slots child entries the row writes null into) and its resume sites in slot
 * order: `[slot, 0]` `_rId`, `[slot, 1, type, symbol, shape, flags?]` `_rOn`, `[slot, 2, name, symbol, read, shape,
 * namespace?]` `_rAttr` (`shape`: per capture an env index, -1 the row item getter, -2 the index getter). A plan the
 * runtime cannot follow (a site after the last `_rId`, a flattened child plan) renders row by row.
 */
export function _rRowPlan(fragments: readonly string[], entries: Parameters<typeof _listPlan>[1], specs: readonly RowSiteSpec[]): RowPlan {
  let ok = entries.every((entry) => entry === null || Array.isArray(entry));
  // Attribute entries take `attribute`'s output names (`className` → `class`, `defaultValue` → `value`; validated).
  const list = _listPlan(
    fragments,
    ok
      ? (entries as readonly (readonly [string, AttributeNamespace] | null)[]).map((entry) =>
          entry === null ? null : ([_attributeName(entry[0], entry[1]), entry[1]] as const),
        )
      : entries,
  );
  const sites: RowSite[] = [],
    elements: { handlers: number[]; bindings: number[] }[] = [],
    events: string[] = [],
    ids: number[] = [];
  let open: number[] = [];
  for (const spec of specs) {
    const site: RowSite = {
      kind: spec[1],
      element: -1,
      name: "",
      symbol: "",
      read: null,
      shape: EMPTY_SHAPE,
      namespace: undefined,
      preload: undefined,
      nav: false,
    };
    if (spec[1] === 0) {
      const element = { handlers: [] as number[], bindings: [] as number[] };
      for (const k of open) {
        sites[k]!.element = elements.length;
        (sites[k]!.kind === 1 ? element.handlers : element.bindings).push(k);
      }
      site.element = elements.length;
      elements.push(element);
      ids.push(spec[0]);
      open = [];
    } else if (spec[1] === 1) {
      const [, , type, symbol, shape, flags] = spec;
      if (!EVENT_TYPE.test(type)) ok = false;
      site.name = flags?.capture ? type + "!" : type;
      site.symbol = symbol;
      site.shape = shape;
      site.preload = flags?.preload || undefined;
      site.nav = !!flags?.nav;
      if (!events.includes(type)) events.push(type);
      open.push(sites.length);
    } else {
      const [, , name, symbol, read, shape, namespace] = spec;
      site.name = _attributeName(name, namespace);
      site.symbol = symbol;
      site.read = read;
      site.shape = shape;
      site.namespace = namespace;
      open.push(sites.length);
    }
    sites.push(site);
  }
  if (open.length) ok = false;
  return new RowPlan(list, sites, elements.length + 1, elements, events, ok, ok && ids.length ? rowPaths(fragments, entries, ids) : null, ids, [
    fragments,
    entries,
    specs.map((spec) => spec[0]),
  ]);
}
const EMPTY_SHAPE: readonly number[] = Object.freeze([]);
/** A list written from a row plan: its holder record (content: the tape rows' list, then rows rendered one by one). */
interface PlannedRows {
  holder: { fragments: readonly string[]; slots: ServerValue[] };
  plan: RowPlan;
  tape: unknown[];
  /** Tape rows: the site's first `count` rows. */
  count: number;
  rest: ServerValue[];
  /** The tape rows are addressed by path (`RowPlan.paths`, every content slot held a primitive): no `data-r`. */
  paths: boolean;
  /** The state `w` entry of root-anchored rows (`RowPlan.anchor`), pushed when written; row regions drop its flag. */
  entry: RowPathsEntry | null;
}
/** The row being written (module level: `rowSite` and the scratch getters need no closure per row or render). */
interface RowContext {
  plan: RowPlan;
  write: RowWriter;
  env: Captures;
  tape: unknown[];
  base: number;
  item: unknown;
  index: number;
  /** Ids: the row's id and the next element id. */
  id: number;
  next: number;
  /** Per site: captures (the first row's own; then the scratch ones, equal for every row) and this row's reads. */
  captures: Captures[];
  signals: Signal<unknown>[][];
  /** Elements recorded so far in this row (handlers, or bindings that read signals): they take ids. */
  recorded: boolean[];
  get: () => unknown;
  at: () => number;
  indexed: boolean;
  /** A tape row's content slot held an object (a template may add elements): the list keeps its `data-r` ids. */
  unsafe: boolean;
  /** Path plan rows: element k takes id + 1 + k (`RowPlan.paths`), whether or not the elements before it took one. */
  structural: boolean;
  /** Root-anchored path plan (`RowPlan.anchor`): the root's id is written even when the root takes nothing. */
  anchor: boolean;
}
let rowContext: RowContext | null = null;
// Test hook: false writes every planned row with its `data-r` ids (the row-by-row path's bytes).
let pathRows = true;
// A list drops its ids only when it drops at least this many (rows × ids each): the rows add-on (~700 B brotli inline)
// costs more than fewer ids save (~1 B brotli per id on the bench pages; ssr-bench `/resume` 100 rows: +470 B br).
let pathMin = 768;
/** Test hook (internal): path-addressed plan rows on / off (and the ids a list must drop) for the rest of the process. */
export function _setRowPaths(enabled: boolean, min = 768): void {
  pathRows = enabled;
  pathMin = min;
}
// Scratch row getters of rows after the first: synchronous reads of the current row (never stored by a packed row).
const scratchGet = (): unknown => rowContext!.item;
const scratchAt = (): number => ((rowContext!.indexed = true), rowContext!.index);
const writeRow = (c: RowContext): void => c.write(c.tape, c.base, c.get, c.at, c.env, rowSite);
/** `site(k)` of a row writer: an `_rId` site's id (null when nothing was recorded on its element: no `data-r`), an `_rAttr`
 * site's value (its reads tracked, as `_rAttr`). */
function rowSite(k: number): unknown {
  const c = rowContext!,
    site = c.plan.sites[k]!;
  if (site.kind === 2) {
    const tracked = _trackReads(site.read!, c.captures[k]!);
    c.signals[k] = tracked.signals;
    if (tracked.signals.length) c.recorded[site.element] = true;
    return tracked.value;
  }
  if (site.kind === 0) {
    const used = c.recorded[site.element] || c.plan.elements[site.element]!.handlers.length;
    // Path plans: every element takes its id (structural: row id + 1 + element), written only when used.
    if (c.structural) return ((c.next = c.id + 2 + site.element), used || (c.anchor && site.element === 0) ? c.next - 1 : null);
    return used ? c.next++ : null;
  }
  return null;
}
const shaped = (shape: readonly number[], env: Captures, get: () => unknown, at: () => number): Captures => {
  const out: unknown[] = new Array(shape.length);
  for (let i = 0; i < shape.length; i++) out[i] = shape[i]! >= 0 ? env[shape[i]!] : shape[i] === -1 ? get : at;
  return out;
};
/** The element records of one written row (the row's sites, its captures and reads), as `_rOn` / `_rAttr` / `_rId` record them. */
function rowElements(plan: RowPlan, c: RowContext, id: number, scope: Scope, captures: Captures[]): ElementRecord[] {
  const out: ElementRecord[] = [];
  let next = id + 1;
  const structural = c.structural;
  for (let j = 0; j < plan.elements.length; j++) {
    const { handlers, bindings } = plan.elements[j]!;
    let recorded: ElementRecord["bindings"] = null;
    for (const k of bindings) if (c.signals[k]!.length) (recorded ??= []).push([plan.sites[k]!.name, plan.sites[k]!.symbol, captures[k]!, c.signals[k]!]);
    if (!handlers.length && !recorded) continue;
    const element: ElementRecord = { handlers: null, bindings: recorded, model: null, refs: null };
    for (const k of handlers) {
      const site = plan.sites[k]!;
      (element.handlers ??= {})[site.name] = [site.symbol, captures[k]!];
      if (site.preload) element.preload = site.preload;
      if (site.nav) element.nav = true;
    }
    element.id = structural ? id + 1 + j : next++;
    element.region = scope;
    out.push(element);
  }
  return out;
}
function planRows(
  r: Recorder,
  site: Scope,
  list: object,
  items: readonly unknown[],
  keys: readonly unknown[],
  plan: RowPlan,
  write: RowWriter,
  env: Captures,
  render: RowCall[0],
): ServerValue {
  const n = items.length,
    width = plan.list.attributes.length,
    stride = plan.stride,
    sites = plan.sites;
  const tape: unknown[] = n * width <= 65536 ? new Array(n * width) : [];
  if (n && sites.length) {
    r.used = true;
    for (const type of plan.events) if (!r.events.has(type)) listen(r, type);
  }
  const c: RowContext = (rowContext = {
    plan,
    write,
    env,
    tape,
    base: 0,
    item: undefined,
    index: 0,
    id: 0,
    next: 0,
    captures: new Array(sites.length),
    signals: new Array(sites.length),
    recorded: new Array(plan.elements.length),
    get: scratchGet,
    at: scratchAt,
    indexed: false,
    unsafe: !pathRows || plan.paths === null,
    structural: pathRows && plan.paths !== null,
    anchor: pathRows && plan.anchor,
  });
  const content = plan.paths?.content ?? NO_SLOTS;
  const rows: RowRecord[] = (site.rows = []);
  let reference: Signal<unknown>[][] | null = null,
    scratch: Scope | null = null,
    k = 0;
  while (k < n) {
    const item = items[k],
      index = k,
      id = r.next,
      end = id + stride;
    r.next = end;
    const record: RowRecord = {
      list,
      id,
      key: keys[k],
      item,
      index,
      indexed: false,
      reads: false,
      get: null,
      at: null,
      scope: null,
      wrap: undefined,
      packed: false,
    };
    const first = k === 0;
    let scope: Scope | null = null;
    if (first) {
      const get: ConstantGetter<unknown> = (record.get = () => item);
      get[CONSTANT] = item;
      const at: ConstantGetter<number> = (record.at = () => ((record.indexed = true), index));
      at[CONSTANT] = index;
      scope = record.scope = { parent: site, id, mount: null, row: true, record };
      c.get = get;
      c.at = at;
      for (let i = 0; i < sites.length; i++) if (sites[i]!.kind) c.captures[i] = shaped(sites[i]!.shape, env, get, at);
    } else if (k === 1) {
      c.get = scratchGet;
      c.at = scratchAt;
      for (let i = 0; i < sites.length; i++) if (sites[i]!.kind) c.captures[i] = shaped(sites[i]!.shape, env, scratchGet, scratchAt);
    }
    c.item = item;
    c.index = index;
    c.base = k * width;
    c.id = id;
    c.next = id + 1;
    c.indexed = false;
    c.recorded.fill(false);
    // Rows after the first render in one scratch scope: only a row that records more than its plan keeps it.
    const region = scope ?? (scratch ??= { parent: site, id, mount: null, row: true, record });
    region.id = id;
    region.record = record;
    r.region = region;
    const e0 = r.elements.length,
      t0 = r.texts.length,
      r0 = r.regions.length,
      f0 = r.effects.length,
      c0 = r.clientEvents.length,
      others = r.asyncs.length + r.links.length + r.lists.length;
    let tracked;
    try {
      tracked = _trackReads(writeRow, c);
    } finally {
      r.region = site;
    }
    k++;
    // A content slot holding an object (a template, an array) may add elements: the list keeps its ids.
    if (!c.unsafe)
      for (let i = 0; i < content.length; i++) {
        const value = tape[c.base + content[i]!];
        if (value !== null && (typeof value === "object" || typeof value === "function")) c.unsafe = true;
      }
    if (c.indexed) record.indexed = true;
    if (tracked.signals.length) {
      record.reads = true;
      readRow(site, tracked.signals);
    }
    rows.push(record);
    // Nothing recorded beyond the plan's sites (no ids taken, no records, no element left open).
    const clean =
      r.next === end &&
      r.pending === null &&
      r.elements.length === e0 &&
      r.texts.length === t0 &&
      r.regions.length === r0 &&
      r.effects.length === f0 &&
      r.clientEvents.length === c0 &&
      r.asyncs.length + r.links.length + r.lists.length === others;
    if (r.next === end) r.next = c.next;
    if (!first && clean && sameReads(c.signals, reference!, sites)) {
      // Equal to the site's reference row: packed (`pack`), its records never made.
      record.packed = true;
      site.pack!.packed.push(record, e0, t0);
      continue;
    }
    // The reference row, or a row that differs: its records, as the row-by-row path records them.
    let captures = c.captures;
    if (!first) {
      const get: ConstantGetter<unknown> = (record.get = () => item);
      get[CONSTANT] = item;
      const at: ConstantGetter<number> = (record.at = () => ((record.indexed = true), index));
      at[CONSTANT] = index;
      record.scope = region;
      captures = new Array(sites.length);
      for (let i = 0; i < sites.length; i++) if (sites[i]!.kind) captures[i] = shaped(sites[i]!.shape, env, get, at);
    }
    r.elements.splice(e0, 0, ...rowElements(plan, c, id, record.scope!, captures));
    if (first && clean) {
      site.pack = { ref: record, items: r.elements.slice(e0), packed: [] };
      reference = c.signals.slice();
      continue;
    }
    pack(r, site, record, e0, t0, r0, f0, c0, others);
    break;
  }
  const count = k,
    rest: ServerValue[] = [];
  // DOM-DATA: the tape rows' sole-child texts, addressed from the row root (id row + 1: `data-r` or path-addressed).
  if (r.dom !== null && count && !c.unsafe && c.structural && c.anchor) r.dom.rows(plan, tape, rows, count, width);
  // Root-anchored rows: only the roots keep their ids (row regions, `markPlans`, drop those too and the entry's flag).
  const entry: RowPathsEntry | null =
    !c.unsafe && plan.anchor && count && count * (plan.ids.length - 1) >= pathMin ? [rows[0]!.id, stride, count, plan.paths!.paths, 1] : null;
  if (entry) r.paths.push(entry);
  const done = _list(NO_ROWS, noRow, entry ? (plan.rootList ??= withoutIds(plan, 1)) : plan.list, noRow) as { tape: unknown[]; rows: number };
  done.tape = tape;
  done.rows = k;
  for (; k < n; k++) rest.push(forRow(list, items[k], keys[k], k, render));
  const holder = compiledTemplate(PLAIN, [
    rest.length ? [done as unknown as ServerValue, ...rest] : (done as unknown as ServerValue),
  ]) as unknown as PlannedRows["holder"];
  (site.plans ??= []).push({ holder, plan, tape, count, rest, paths: !c.unsafe, entry });
  return holder as unknown as ServerValue;
}
const NO_ROWS: readonly unknown[] = Object.freeze([]);
const NO_SLOTS: readonly number[] = Object.freeze([]);
const noRow = (): void => {};
const sameReads = (a: Signal<unknown>[][], b: Signal<unknown>[][], sites: RowSite[]): boolean => {
  for (let i = 0; i < sites.length; i++) if (sites[i]!.kind === 2 && !sameSignals(a[i]!, b[i]!)) return false;
  return true;
};
/** A planned list's site renders as a region: its tape rows become row regions `<!--rN[-->…<!--]-->` (as `forRow` wraps
 * them) — one list over the row plan with the region marker around it (`regionPlan`: marker id = slot 0, MARK_CHAIN, so
 * the writers leave strided ids out as for REGION records) and the row id prepended to each tape row. */
function markPlans(recorder: Recorder, scope: Scope): void {
  const rows = scope.rows!;
  for (const { holder, plan, tape, count, rest, paths, entry } of scope.plans!) {
    // Path-addressed rows (`RowPlan.paths`): the region plan leaves the `_rId` slots out; the state's `w` entry
    // [first row id, stride, rows, paths] lets the browser find them from their row markers.
    const addressed = paths && count > 0 && count * plan.ids.length >= pathMin;
    if (entry) entry.length = 4;
    else if (addressed) recorder.paths.push([rows[0]!.id, plan.stride, count, plan.paths!.paths]);
    const marked = addressed ? (plan.pathRegion ??= regionPlan(withoutIds(plan))) : (plan.region ??= regionPlan(plan.list)),
      width = plan.list.attributes.length,
      out: unknown[] = new Array(count * (width + 1));
    for (let k = 0, o = 0; k < count; k++) {
      out[o++] = rows[k]!.id;
      for (let i = 0, from = k * width; i < width; i++) out[o++] = tape[from + i];
    }
    const list = _list(NO_ROWS, noRow, marked, noRow) as { tape: unknown[]; rows: number };
    list.tape = out;
    list.rows = count;
    holder.slots[0] = (rest.length ? [list, ...rest] : list) as unknown as ServerValue;
  }
  scope.plans = undefined;
}
// The plan's list with its `_rId` slots (after the first `keep`) written nothing (plan slot 0: no bytes on any writer, as a
// flattened child's bounds).
const withoutIds = (plan: RowPlan, keep = 0): ListPlan => ({
  ...plan.list,
  attributes: plan.list.attributes.map((slot, k) => (plan.ids.indexOf(k) >= keep ? 0 : slot)) as ListPlan["attributes"],
  bytes: null,
  fixed: 0,
});
const regionPlan = (list: ListPlan): ListPlan => {
  const fragments = list.fragments.slice(),
    last = fragments.length - 1;
  fragments[0] = "[-->" + fragments[0];
  fragments[last] = fragments[last] + "<!--]-->";
  // `rows`: the list plan's WebAssembly emitter (set by `_listPlan`), which writes the marker ids through `markOut`.
  return {
    fragments: _markFragments(["<!--r", ...fragments], MARK_CHAIN),
    attributes: [null, ...list.attributes],
    bytes: null,
    fixed: 0,
    rows: list.rows,
  };
};
// Awaited (non-streamed) Async content renders in the traversal, after the read that constructed the boundary (the
// Router's route content, say): its records belong to that read's region, so the browser disposes the content's
// resumed state (and what client code created inside, an open overlay) when it re-creates the region. The `held`
// scope behaves like the page root for rows, branches, client-only mounts and streaming (no output change).
_onAsyncContent(() => {
  const recorder = store.getStore();
  if (!recorder) {
    lazyReason("an Async boundary");
    return null;
  }
  const region = recorder?.region;
  if (!region) return null;
  const scope: Scope = { parent: region, id: null, mount: null, async: true, held: true };
  return (fn) => {
    if (store.getStore() !== recorder) return fn();
    const previous = recorder!.region;
    recorder!.region = scope;
    try {
      return fn();
    } finally {
      recorder!.region = previous;
    }
  };
});
// Lazy component children (`_slot`) render where the component places them — often in the traversal, after the read of
// the site they were written in (a Provider's content, a spread's `children`): their records still belong to that
// site's region, so the browser disposes them when it re-creates it (else a removed TextField's label / input bindings
// resumed on the next write of a shared signal: "Missing resumable element"). Called inside that region (or a read
// nested in it: a component's own site) the content keeps the current one. Like awaited Async content, it renders in a
// `held` scope: linked to the region, the page root for rows, branches, client-only mounts and streaming (no output change).
_onSlot((fn) => {
  const recorder = store.getStore();
  const region = recorder?.region;
  if (!region) {
    // Made in a lazy row: when the traversal renders it (recorder back), it still renders as part of that row.
    const lazy = recorder ? null : lazyRow;
    if (lazy === null) return fn;
    const row = lazy.row;
    return () => (store.getStore() === undefined ? fn() : inLazy(lazy, row, fn));
  }
  return () => {
    let r = recorder!.region;
    while (r && r !== region) r = r.parent;
    if (r || store.getStore() !== recorder) return fn();
    const previous = recorder!.region;
    recorder!.region = { parent: region, id: null, mount: null, async: true, held: true };
    try {
      return fn();
    } finally {
      recorder!.region = previous;
    }
  };
});
// Process-wide hook; provide() only calls it for identified tokens, and only a live recorder records.
_observeProvide((token, value) => {
  const recorder = store.getStore();
  if (!recorder) return;
  recorder.tokens.set(token.id!, token as Context<unknown>);
  if (value !== null && (typeof value === "object" || typeof value === "function")) recorder.contexts.set(value, token.id!);
});

// Streaming renders: a pending Async with a fallback claims its enclosing region-site scope (M),
// writes `<!--rA[-->fallback<!--]-->` now and streams its content after the shell.
_onAsync(() => {
  const recorder = store.getStore();
  if (!recorder) {
    lazyReason("an Async boundary");
    return null;
  }
  const scope = recorder?.region;
  // Inside a Suspense, the Suspense streams (or not) for all of its Asyncs.
  if (!recorder?.stream || useContext(_SUSPENSE) || !scope || scope.row || scope.branch || scope.async || scope.id !== null) return null;
  scope.async = true;
  return new Boundary(recorder.stream, scope);
});

// Streaming renders: a Suspense constructs its content in place; when an Async below is pending, it
// claims its enclosing region-site scope (M) like a streamed Async, writes the fallback, and streams
// the content as one segment. What the content recorded moves into the segment's recorder view.
_onSuspense(() => {
  const recorder = store.getStore();
  if (!recorder) {
    lazyReason("a Suspense boundary");
    return null;
  }
  const scope = recorder?.region;
  if (!recorder?.stream || !scope || scope.row || scope.branch || scope.async || scope.id !== null) return null;
  const from = lengths(recorder),
    boundary = new Boundary(recorder.stream, scope);
  return {
    defer(value, fallback, owner, own) {
      scope.async = true;
      const to = lengths(recorder);
      const prepare = (segment: Segment): Recorder => {
        const view = viewOf(recorder.stream!.root, segment);
        LISTS.forEach((key, i) => (view[key] as unknown[]).push(...recorder[key].splice(from[i]!, to[i]! - from[i]!)));
        // Moved late capture records (`siteCaptures`) settle with the segment, not the shell.
        if (recorder.late) view.late = true;
        return view;
      };
      return boundary.defer(
        Promise.resolve(value),
        (content) => content,
        (cause) => Promise.reject(cause),
        fallback,
        owner,
        () => {},
        own,
        prepare,
      );
    },
    release: (dispose) => boundary.release(dispose),
  };
});

// Error boundaries claim their enclosing region-site scope (re-created by `reset` in the browser) and
// evaluate children in a content scope under it. A failure drops what the content recorded (and the
// streamed boundaries it opened); a streamed segment failing inside renders the fallback as a segment.
const resets = new WeakMap<object, Scope>();
const resetOf = (site: Scope | null): (() => void) => {
  const reset = (): void => {};
  if (site) resets.set(reset, site);
  return reset;
};
const LISTS = ["elements", "texts", "regions", "effects", "clientEvents", "asyncs", "links", "lists", "paths", "preloads", "lazy"] as const;
const lengths = (recorder: Recorder): number[] => LISTS.map((key) => recorder[key].length);
// Remove records [from, to) (to the end without `to`); dropped streamed boundaries are never written.
function cut(recorder: Recorder, from: number[], to?: number[]): void {
  LISTS.forEach((key, i) => {
    const removed = recorder[key].splice(from[i]!, to ? to[i]! - from[i]! : Infinity);
    if (key === "asyncs") for (const segment of removed as Segment[]) drop(recorder.stream!, segment);
  });
  recorder.pending = null;
}
function drop(stream: Stream, segment: Segment): void {
  if (!segment.out) {
    segment.out = "dropped";
    segment.abort?.(new Error("Async boundary abandoned"));
  }
  // Dropped content may never be admitted (its render threw): its root goes now, not at a `release` that never comes.
  segment.dispose ??= segment.own;
  stream.settle(segment);
}
const inside = (scope: Scope | null, ancestor: Scope): boolean => {
  for (; scope; scope = scope.parent) if (scope === ancestor) return true;
  return false;
};
// `_regionState` directly in a site's read (not in a Show/Switch branch or a nested site): recorded on it.
// A value's slot comes before the ones its `create()` records (`nested`: how many), so the browser
// skips those when it adopts the value without calling `create()`.
_setRegionStateHook((create) => {
  const recorder = store.getStore();
  const scope = recorder?.region;
  if (!scope?.site) return recorder === undefined && lazyRow !== null ? lazyLocal(lazyRow, create) : create();
  const locals = (scope.locals ??= []),
    nested = (scope.nested ??= []);
  const i = locals.push(undefined) - 1;
  nested.push(0);
  const value = create();
  locals[i] = value;
  nested[i] = locals.length - i - 1;
  return value;
});
_onErrorBoundary((fallback) => {
  const recorder = store.getStore();
  if (!recorder) return null;
  const region = recorder.region;
  // Only a child binding site (`_rBind`) can be claimed; inside a Show/Switch branch, the site around it
  // (reset re-creates the whole Show). Rows are not claimed.
  // A branch holding a boundary is never adopted: the re-created Show must render it afresh.
  let at = region;
  while (at?.branch) ((at.claimed = true), (at = at.parent));
  const site = at?.site && at.id === null ? at : null;
  if (site) site.claimed = true;
  const content: Scope = { parent: region, id: null, mount: null };
  const info: Catch = { fallback, site, content, owner: getOwner(), recorder, failed: false };
  content.boundary = info;
  // The content scope is a logical region linked to its site (`a` entry, status 3): the browser routes failures of
  // its resumed bindings to the boundary (re-creating the site). Streaming, directly in its site only: a fallback
  // segment can retire it.
  if (site && (site === region || !recorder.stream)) {
    content.id = recorder.next++;
    recorder.links.push([content, site]);
    // A fallback segment renders after the render holding the boundary ended and disposed its scopes (an awaited
    // Async inside a streamed Suspense): it renders under a detached child of the boundary's owner (same context
    // frames), which lives until the stream ends.
    const stream = recorder.stream;
    if (stream && info.owner && !stream.closed) {
      const pin = createRoot(getOwner);
      _detach(pin.value);
      info.owner = pin.value;
      (stream.pins ??= []).push(pin.dispose);
    }
  }
  let sync: [number[], number[]] | null = null,
    deferred: number[] | null = null;
  return {
    content<T>(fn: () => T): T {
      const from = lengths(recorder);
      recorder.region = content;
      try {
        return fn();
      } finally {
        recorder.region = region;
        sync = [from, lengths(recorder)];
      }
    },
    defer: (value) => () => ((deferred = lengths(recorder)), value),
    fail() {
      if (deferred) cut(recorder, deferred);
      if (sync) cut(recorder, sync[0], sync[1]);
      info.failed = true;
      // Nothing of the content is resumed: no link (streaming keeps it, a fallback segment retires the region).
      const link = recorder.stream ? -1 : recorder.links.findIndex(([scope]) => scope === content);
      if (link >= 0) recorder.links.splice(link, 1);
      return resetOf(site);
    },
    fallback<T>(fn: () => T): T {
      const previous = recorder.region;
      recorder.region = region ?? previous;
      try {
        return fn();
      } finally {
        recorder.region = previous;
      }
    },
  };
});

class Boundary implements AsyncStream {
  declare stream: Stream;
  declare scope: Scope;
  declare segment: Segment | null;
  constructor(stream: Stream, scope: Scope) {
    this.stream = stream;
    this.scope = scope;
    this.segment = null;
  }
  defer(
    loaded: Promise<unknown>,
    success: (value: unknown) => unknown,
    failure: (cause: unknown) => unknown,
    fallback: () => ServerValue,
    owner: Owner | null | undefined,
    abort: (reason?: unknown) => void,
    own: Disposer,
    prepare?: (segment: Segment) => Recorder,
  ): ServerValue {
    const recorder = store.getStore()!;
    const marker = recorder.next++;
    // Fallback records live in their own logical region: the swap (or a re-creation of M) kills them.
    const scope: Scope = { parent: this.scope, id: recorder.next++, mount: null };
    const previous = recorder.region;
    recorder.region = scope;
    let value;
    try {
      value = fallback();
    } finally {
      recorder.region = previous;
    }
    const segment: Segment = (this.segment = {
      A: marker,
      F: scope.id!,
      M: this.scope,
      parent: recorder.segment,
      state: "pending",
      html: null,
      view: null,
      out: null,
      dispose: null,
      own,
      abort,
    });
    if (prepare) segment.prepared = prepare(segment);
    recorder.asyncs.push(segment);
    this.stream.add(segment, loaded, success, failure, owner);
    return compiledTemplate(PAIR, [compiledTemplate(BOUNDARY, [marker, value]), reset()]);
  }
  release(dispose: Disposer): void {
    if (!this.segment) return dispose();
    this.segment.dispose = dispose;
    this.stream.settle(this.segment);
  }
}

// A recorder for one streamed segment: own record lists and scope cursor, shared ids, flags,
// contexts and encoder.
const viewOf = (root: Recorder, segment: Segment): Recorder => {
  const view: Recorder = Object.create(root, {
    next: { get: () => root.next, set: (value: number) => (root.next = value) },
    used: { get: () => root.used, set: (value: boolean) => (root.used = value) },
  });
  return Object.assign(view, {
    pending: null,
    late: false,
    region: segment.M,
    segment,
    events: new Set(),
    elements: [],
    texts: [],
    effects: [],
    clientEvents: [],
    regions: [],
    asyncs: [],
    links: [],
    lists: [],
    paths: [],
    preloads: [],
    lazy: [],
  });
};

const OPEN = (segment: Segment): boolean => !segment.parent || segment.parent.out === "content";
// Nested boundaries are owned by their parent's Async scope: dispose a scope only once its own
// boundary and every nested one are out.
const disposable = (segment: Segment, all: Segment[]): boolean | null => segment.out && all.every((other) => other.parent !== segment || other.disposed);

class Stream {
  declare root: Recorder;
  declare deadline: number | undefined;
  declare start: number;
  declare segments: Segment[];
  declare wake: (() => void) | null;
  declare closed?: boolean;
  /** ErrorBoundary owners kept for fallback segments (`_onErrorBoundary`), disposed when the stream ends. */
  declare pins?: Disposer[];
  constructor(root: Recorder, deadline: number | undefined) {
    this.root = root;
    this.deadline = deadline;
    this.start = Date.now();
    this.segments = [];
    this.wake = null;
  }
  settle(segment: Segment): void {
    for (let at: Segment | null = segment; at && !at.disposed && at.dispose && disposable(at, this.segments); at = at.parent) {
      at.disposed = true;
      at.dispose();
    }
  }
  notify(): void {
    const wake = this.wake;
    this.wake = null;
    wake?.();
  }
  add(
    segment: Segment,
    loaded: Promise<unknown>,
    success: (value: unknown) => unknown,
    failure: (cause: unknown) => unknown,
    owner: Owner | null | undefined,
  ): void {
    this.segments.push(segment);
    if (this.closed) return drop(this, segment);
    const fail = (error?: unknown) => {
      segment.state = "failed";
      segment.error = error;
      this.notify();
    };
    const settle = (outcome: (input: unknown) => unknown, input: unknown) => {
      const view = segment.prepared ?? viewOf(this.root, segment);
      store.run(view, () => {
        let html;
        try {
          // Children (or error content) evaluate inside the segment's recorder.
          const value = outcome(input);
          html = renderToString(_scopedRecord(owner, value, noop), {
            signal: this.root.options.signal,
            variant: this.root.options.variant,
          });
        } catch (error) {
          return fail(error);
        }
        Promise.resolve(html).then((text) => {
          if (view.pending) return fail(new Error("Internal error: unclosed resumable element"));
          // Late captures read at the segment's end: a throwing thunk fails the segment like a render error.
          if (view.late)
            try {
              settleLate(view);
            } catch (error) {
              return fail(error);
            }
          Object.assign(segment, { state: "ready", html: text, view });
          this.notify();
        }, fail);
      });
    };
    loaded.then(
      (value) => settle(success, value),
      (cause) => settle(failure, cause),
    );
  }
  /**
   * The add-ons a segment's patch needs, unless the page shipped them: rows (path-addressed rows, `w`), expand (compact
   * row templates, `rx`) and repeat (repeated entries, `rr`); before the patch: the stream add-on decodes it when merging.
   */
  addon(delta: StatePatch, rx?: boolean, rr?: boolean): string {
    const root = this.root,
      nonce = root.options.nonce,
      open = "<script" + (nonce ? ' nonce="' + String(nonce).replace(/[^\w+/=-]/g, "") + '"' : "") + ">";
    let out = "";
    // The lazy add-on wraps the rows add-on's `$rw`: shipped after it (again, when the rows add-on comes later).
    let relazy = false;
    if (delta.w && !root.rowsAddon) ((root.rowsAddon = true), (out += open + ROWS + "</script>"), (relazy = root.lazyAddon), (root.lazyAddon = false));
    if ((delta.L || relazy) && !root.lazyAddon) ((root.lazyAddon = true), (out += open + LAZY + "</script>"));
    // The expand add-on replaces `$rx` (it chains to nothing): a repeat add-on shipped before it ships again after it.
    if (rx && !root.expandAddon) ((root.expandAddon = true), (out += open + (DOM_DATA ? EXPAND_DOM : EXPAND) + "</script>"), (root.repeatAddon = false));
    if (rr && !root.repeatAddon) ((root.repeatAddon = true), (out += open + REPEAT + "</script>"));
    return out;
  }
  /**
   * A finished segment's chunk: the add-ons its patch needs, its HTML (`<template data-a>`), the state patch, the derived
   * patch and the swap call. The patch JSON is built once (dev: its length is the segment's state bytes).
   */
  segmentChunk(marker: number, html: string, delta: StatePatch, rx: boolean | undefined, rr: boolean | undefined, swap: (marker: number) => string): string {
    const json = stateJSON(delta);
    if (DEV) DEV.stateBytes(this.root, json.length);
    return (
      this.addon(delta, rx, rr) +
      '<template data-a="' +
      marker +
      '">' +
      html +
      "</template>" +
      patchScript(marker, json) +
      (this.root.derived ? derivedHooks!.patch(this.root.derived, marker) : "") +
      swap(marker)
    );
  }
  /** After the shell: write segments in completion order (each after its parent), then stop. */
  async run(writer: { write(chunk: string): unknown }): Promise<void> {
    const { signal, nonce } = this.root.options;
    const attrs = nonce ? ' nonce="' + String(nonce).replace(/[^\w+/=-]/g, "") + '"' : "";
    const swap = (marker: number): string => "<script" + attrs + ">$rA(" + marker + ")</script>";
    const patch = (marker: number, delta: StatePatch): string => patchScript(marker, stateJSON(delta));
    const write = async (chunk: string): Promise<void> => {
      if (signal?.aborted) throw signal.reason;
      await writer.write(chunk);
    };
    const continued = (segment: Segment): Promise<void> => {
      segment.out = "continued";
      segment.abort?.(new Error("Async boundary continues in the browser"));
      return write(patch(segment.A, { a: [[segment.A, segment.F, segment.M.id!, 2]] }) + swap(segment.A));
    };
    let expired = false;
    const timer = this.deadline == null ? null : setTimeout(() => ((expired = true), this.notify()), Math.max(0, this.start + this.deadline - Date.now()));
    const stop = () => this.notify();
    signal?.addEventListener("abort", stop, { once: true });
    try {
      for (;;) {
        if (signal?.aborted) return;
        const next = this.segments.find((segment) => !segment.out && segment.state !== "pending" && OPEN(segment));
        if (next) {
          if (next.state === "failed") {
            if (!(await this.caught(next, write, swap))) await continued(next);
          } else {
            next.out = "content";
            const { events, schedule, boot, rx, rr, late, ...delta } = encodeRecords(this.root, next.view!, [[next.A, next.F, next.M.id!, 1]]);
            if (events.length) delta.ev = events;
            if (schedule.length) delta.p = [this.root.options.manifest?.runtime ?? null, ...schedule];
            if (boot) (delta as StatePatch).boot = 1;
            await write(this.segmentChunk(next.A, next.html!, delta, rx, rr, swap));
          }
          this.settle(next);
          continue;
        }
        const open = this.segments.filter((segment) => !segment.out && OPEN(segment));
        if (!open.length) return;
        if (expired) {
          for (const segment of open) {
            await continued(segment);
            this.settle(segment);
          }
          return;
        }
        await new Promise<void>((resolve) => (this.wake = resolve));
      }
    } finally {
      clearTimeout(timer!);
      signal?.removeEventListener("abort", stop);
      this.abandon();
    }
  }
  /** A failed segment inside an ErrorBoundary: write the boundary's fallback in place of its content
   * (a segment for the boundary's region), dropping every unwritten segment under it. */
  async caught(failed: Segment, write: (chunk: string) => Promise<void>, swap: (marker: number) => string): Promise<boolean> {
    const { signal, variant } = this.root.options;
    for (let scope: Scope | null = failed.M; scope; scope = scope.parent) {
      const info = scope.boundary;
      if (!info || info.failed || !info.site || info.site.id === null || info.content.id === null) continue;
      info.failed = true;
      const region = info.site.id,
        content = info.content;
      // The fallback records into its own view, in the boundary's region.
      const view = Object.assign(viewOf(this.root, failed), { region: info.site, segment: info.recorder.segment });
      let html: string;
      try {
        // Under the boundary's (pinned) owner: the fallback reads its context (locale, route data, head level).
        const render = () => renderToString(_scopedRecord(info.owner, info.fallback(failed.error, resetOf(info.site)), noop), { signal, variant });
        html = await store.run(view, () => runWithOwner(info.owner ?? null, render));
        if (view.pending) throw new Error("Internal error: unclosed resumable element");
        if (view.late) settleLate(view);
      } catch {
        continue; // the next boundary up, else the browser continues the segment
      }
      const entries: AsyncEntry[] = [[region, content.id!, region, 1]];
      const dropped = this.segments.filter((segment) => !segment.out && inside(segment.M, content));
      for (const segment of dropped) entries.push([segment.A, segment.F, segment.M.id!, 1]);
      for (const segment of dropped) drop(this, segment);
      const { events, schedule, boot, rx, rr, late, ...delta } = encodeRecords(this.root, view, entries);
      if (events.length) delta.ev = events;
      if (schedule.length) delta.p = [this.root.options.manifest?.runtime ?? null, ...schedule];
      if (boot) (delta as StatePatch).boot = 1;
      await write(this.segmentChunk(region, html, delta, rx, rr, swap));
      return true;
    }
    return false;
  }
  /** Drop every unwritten boundary (under a continued parent, or the request ended). */
  abandon(): void {
    this.closed = true;
    for (const segment of this.segments)
      if (!segment.out) {
        segment.out = "dropped";
        segment.abort?.(new Error("Async boundary abandoned"));
      }
    // The request is over: a segment never released (its record was not admitted) disposes its own root.
    for (const segment of this.segments) {
      segment.dispose ??= segment.own;
      this.settle(segment);
    }
    const pins = this.pins;
    this.pins = undefined;
    if (pins) for (const dispose of pins) dispose();
  }
}

class Recorder {
  declare options: RecorderOptions;
  declare next: number;
  declare pending: ElementRecord | null;
  declare events: Set<string>;
  declare elements: ElementRecord[];
  declare texts: TextRecord[];
  declare effects: EffectRecord[];
  declare clientEvents: ClientEventRecord[];
  /** `_rPreload` registrations: chunks the planner schedules as if a symbol of theirs had that strategy. */
  declare preloads: PreloadRecord[];
  declare contexts: Map<unknown, string>;
  /** Identified context tokens provided during the render, by id (regions record the providers enclosing them). */
  declare tokens: Map<string, Context<unknown>>;
  declare regions: RegionRecord[];
  declare links: [content: Scope, site: Scope][];
  /** Child binding sites that rendered For rows but are no region (their lists: row templates without adoption). */
  declare lists: Scope[];
  /** Path-addressed plan rows (`markPlans`): state `w` entries [first row id, stride, rows, element paths]. */
  declare paths: RowPathsEntry[];
  /** The page shipped the rows add-on (`ROWS`, before the state or a patch whose `w` needs it). */
  declare rowsAddon: boolean;
  /** The page shipped the lazy rows add-on (`LAZY`: lazy row records `L`, before the state or a patch with them). */
  declare lazyAddon: boolean;
  /** The page shipped the expand add-on (`EXPAND`: compact row templates, before the state or a patch with them). */
  declare expandAddon: boolean;
  /** The page shipped the repeat add-on (`REPEAT`: repeated handler / binding entries, before the state or a patch). */
  declare repeatAddon: boolean;
  declare region: Scope | null;
  declare used: boolean;
  /** `_rLean` tail provider of this render (framework bridges): may replace the state + loader tail. */
  declare lean?: LeanTail;
  /** A record holds a late capture thunk (`siteCaptures`): `settleLate` before encoding (own on every view: never inherited). */
  declare late: boolean;
  declare asyncs: Segment[];
  declare segment: Segment | null;
  declare enc: Encoding | null;
  declare stream: Stream | null;
  /** Derived model (`options.model === "derived"` + `server-derived.ts` loaded): the boundary recorder of this render. */
  declare derived: DerivedRender | null;
  /** `RIVET_LAZY_ROWS=on` at the render's start + manifest `lazyRows`: `$lazy` Fors write lazy row records (LAZY-ROWS T4). */
  declare lazyRows: boolean;
  /** Lazy Fors rendered while this recorder evaluated (state `L`). */
  declare lazy: LazyFor[];
  /** DOM-DATA (manifest `domData`): strings written as an element's whole text, shared by the render's segments. */
  declare dom: DomRegistry | null;
  constructor(options: RecorderOptions) {
    drainRefs();
    this.options = options;
    this.dom = options.manifest?.domData ? (domServer.create?.() ?? null) : null;
    this.derived = options.model === "derived" && derivedHooks ? derivedHooks.create() : null;
    this.lazyRows = lazyRowsOn(options.manifest);
    this.lazy = [];
    this.next = 0;
    this.pending = null;
    this.events = new Set();
    this.elements = [];
    this.texts = [];
    this.effects = [];
    this.clientEvents = [];
    this.preloads = [];
    this.contexts = new Map();
    this.tokens = new Map();
    this.regions = [];
    this.links = []; // ErrorBoundary content scopes linked to their region (streaming renders)
    this.lists = [];
    this.paths = [];
    this.rowsAddon = false;
    this.lazyAddon = false;
    this.expandAddon = false;
    this.repeatAddon = false;
    this.region = null; // innermost region scope being evaluated (synchronously)
    this.used = false;
    this.late = false;
    this.asyncs = []; // streamed boundaries opened while this recorder evaluated
    this.segment = null; // the streamed segment this recorder renders (null: the shell)
    this.enc = null; // persistent encoder state: the shell and every patch share one table
    this.stream = options.stream ? new Stream(this, options.stream.deadline) : null;
  }
  element(): ElementRecord {
    this.used = true;
    return (this.pending ??= { handlers: null, bindings: null, model: null, refs: null });
  }
}

const primitive = (value: unknown): boolean => value == null || (typeof value !== "object" && typeof value !== "function");

/**
 * Element event handler; the handler itself never runs on the server. `flags.capture`: an
 * `onXCapture` handler, keyed `type!` (the loader dispatches capture entries outermost-first before
 * bubbling ones). `present === false` (`onX={c ? f : undefined}` whose test the compiler passes):
 * nothing recorded.
 */
export function _rOn(
  type: string,
  id: string,
  captures: Captures,
  flags?: { preload?: Strategy; nav?: boolean; capture?: 1 | boolean } | null,
  present?: unknown,
): null {
  const recorder = store.getStore();
  if (!recorder || present === false) {
    // A lazy row's handler: nothing recorded, but the page listens for its type (the row materialises on it).
    if (present !== false && lazyRow !== null && !recorder) lazyListen(lazyRow, type);
    return null;
  }
  const element = recorder.element();
  const key = flags?.capture ? type + "!" : type;
  if (element.spread?.includes(key)) throw new TypeError(clash(type));
  (element.handlers ??= {})[key] = [id, captures];
  // Element `preload` directive and navigation path (link / form with action), for preload planning.
  if (flags?.preload) element.preload = flags.preload;
  if (flags?.nav) element.nav = true;
  if (!recorder.events.has(type)) listen(recorder, type);
  return null;
}

// Event types are written into the state script's `data-events` attribute (and listened to by the
// loader): letters, digits, `_` `:` `.` `-` only, checked once per type and render (U3: a spread key
// like `onX"><img …>` must not break out of the attribute).
const EVENT_TYPE = /^[\w:.-]+$/;
function listen(recorder: Recorder, type: string): void {
  if (!EVENT_TYPE.test(type)) throw new TypeError("Cannot resume a handler for event type " + JSON.stringify(type) + ": use letters, digits, _ : . - only");
  recorder.events.add(type);
}
function lazyListen(lazy: LazyFor, type: string): void {
  lazy.sites++;
  lazy.types.add(type);
  if (lazy.recorder.events.has(type) || lazy.events.has(type)) return;
  if (lazy.done) listen(lazy.recorder, type);
  else if (EVENT_TYPE.test(type)) lazy.events.add(type);
  else listen(lazy.recorder, type); // throws: the type check of `listen`
}

/**
 * Compiler ABI: the end of opaque content (`<textarea>`, `<title>`, `<noscript>`, `<template>`, …) whose
 * markers the browser never sees as comments: the marker id chain restarts after it.
 */
export function _rReset(): ServerValue {
  return store.getStore() ? reset() : null;
}

/** Close the pending element: render its `data-r` id when anything was recorded on it. */
export function _rId(): ServerValue {
  const recorder = store.getStore();
  const element = recorder?.pending;
  if (!element) return null;
  recorder.pending = null;
  const id = recorder.next++;
  element.id = id;
  element.region = recorder.region;
  if (element.refs) for (const cell of element.refs) ((cell.region = recorder.region), (cell.id = id));
  recorder.elements.push(element);
  return _attributeRecord("data-r", id, "html") as ServerValue;
}

/**
 * Child binding. No signals read → the plain value. Text → `<!--rN-->text<!--/-->`.
 * Structural (or hosting client-only code) → region `<!--rN[-->…<!--]-->`, re-created in the
 * browser by its DOM symbol when a dependency first changes (or at the client-only trigger).
 */
export function _rBind(id: string, read: () => ServerValue, captures: Captures, region?: 1): ServerValue {
  const recorder = store.getStore();
  // A lazy row calls function children here, as a recorded render does (the traversal would call them recorded).
  if (!recorder) return lazyRow !== null ? lazyRead(lazyRow, () => children(read())) : read();
  const scope: Scope = { parent: recorder.region, id: null, mount: null, site: true };
  recorder.region = scope;
  let tracked;
  try {
    // Function children (`{() => log().join()}`, also inside a returned fragment array) run here, not
    // later in the traversal, so their reads count for this site (the browser binds / re-creates on them).
    reading = read;
    readingSite = scope;
    tracked = _trackReads(readChildren);
  } finally {
    recorder.region = scope.parent;
  }
  const { signals } = tracked;
  // The browser re-runs this read up to its Shows/Switches the same way only if nothing else it read changed.
  const adopts = scope.adopts;
  if (adopts && signals.some((read) => !scope.inner!.includes(read))) for (const adopt of adopts) adopt.key = null;
  // A translated value binds as the text of this render's variant.
  let value = tracked.value;
  if (value !== null && typeof value === "object") value = _variantOf(value, recorder.options.variant ?? 0) as ServerValue;
  // A scope claimed by a streamed Async is a region even without reads: the browser re-creates it
  // (its DOM Async then loads there) when the stream cannot deliver the content.
  if (!signals.length && scope.mount === null && !scope.async && !scope.claimed) {
    if (scope.rows) unmark(recorder, scope);
    return value;
  }
  // A site reading only router locations (the routes region): only the router's listeners move them, so like those
  // (`standalone: false`) it alone does not make the page resumable.
  if (!onlyLocations(signals)) recorder.used = true;
  if (scope.plans) markPlans(recorder, scope);
  // `region`: a child expression with a JSX branch (`c() ? <a/> : null`) stays a region while primitive.
  if (primitive(value) && scope.mount === null && !region) {
    if (scope.pack) expand(recorder, scope);
    const node = recorder.next++;
    recorder.texts.push([node, id, captures, signals, scope.parent]);
    return compiledTemplate(TEXT, [node, value]);
  }
  const node = (scope.id = recorder.next++);
  // Providers enclosing the site: re-provided around the browser's re-creation (the resume root has none).
  for (const token of recorder.tokens.values()) {
    const provided = useContext(token);
    if (provided !== token.defaultValue) (scope.providers ??= []).push(token.id, provided);
  }
  recorder.regions.push([node, id, captures, signals, scope]);
  return compiledTemplate(REGION, [node, value]);
}

// Rows of a site that is no region are never adopted (no browser For re-runs over them): they render
// without row markers, and their recorded entries share one row template (a `*` list entry) when uniform.
// A compiled row template (no locale variants) takes the marker template's place (no extra level to traverse).
const PLAIN = Object.freeze(["", ""]);
const VARIANTS = Symbol.for("rivet.variants");
function unmark(recorder: Recorder, scope: Scope): void {
  for (const row of scope.rows!) {
    // Plan rows (`planRows`) write unmarked from their tape already.
    if (row.wrap === undefined) continue;
    const wrap = row.wrap,
      inner = wrap.slots[1] as { [COMPILED]?: true; [VARIANTS]?: unknown; fragments: readonly string[]; slots: ServerValue[] } | null;
    if (inner !== null && typeof inner === "object" && inner[COMPILED] === true && !inner[VARIANTS])
      ((wrap.fragments = inner.fragments), (wrap.slots = inner.slots));
    else ((wrap.fragments = PLAIN), (wrap.slots = [inner as ServerValue]));
    row.wrap = undefined;
  }
  recorder.lists.push(scope);
}

// `_rBind`'s tracked read without a closure per call: the read is taken before it runs (nested binds set their own).
let reading: (() => ServerValue) | null = null,
  readingSite: Scope | null = null;
const readChildren = (): ServerValue => {
  const read = reading!,
    site = readingSite!;
  reading = readingSite = null;
  const value = read();
  if (typeof value !== "function" && !Array.isArray(value)) return value;
  // The browser calls function children in nested bindings: Shows they create are not direct (no slot).
  site.nest = (site.nest ?? 0) + 1;
  try {
    return children(value);
  } finally {
    site.nest--;
  }
};

/** A child value with its function children called (as the server traversal would), through arrays. */
const children = (value: unknown): ServerValue => {
  if (typeof value === "function") return children((value as () => unknown)());
  if (Array.isArray(value)) for (let i = 0; i < value.length; i++) if (typeof value[i] === "function" || Array.isArray(value[i])) return value.map(children);
  return value as ServerValue;
};

/** Attribute binding on the pending element; plain attribute when nothing reactive was read. `read`
 * gets the captures array: the compiler hoists it to a module-level function over them (no closure per
 * render / row; SRV-ROWFN), other callers pass a thunk that ignores it. */
export function _rAttr(name: string, id: string, read: (captures: Captures) => unknown, captures: Captures, namespace?: AttributeNamespace): ServerValue {
  const recorder = store.getStore();
  if (!recorder) return attribute(name, lazyRow === null ? read(captures) : lazyRead(lazyRow, () => read(captures)), namespace);
  const { value, signals } = _trackReads(read, captures);
  const record = attribute(name, value, namespace);
  if (signals.length) (recorder.element().bindings ??= []).push([record?.name ?? _attributeName(name, namespace), id, captures, signals]);
  return record;
}

const clash = (type: string) => `Cannot resume two ${type} handlers on one element (a spread onX and an explicit attribute)`;

const EMPTY_READS: Signal<unknown>[] = [];
// `_rSpread` content: a function `children` that is a symbol (`_rFn`) renders as its own child site (` #r`).
let site = false;
// The `_rSpread` recorder while it resolves its content (read before the child site renders: no ALS lookup per child);
// restored afterwards (a nested spread inside a child site sets it too), so no render's recorder outlives its spread.
let contentRecorder: Recorder | undefined;
const resolveContent = (value: unknown): ServerValue => {
  if (typeof value === "function") {
    const meta = fns.get(value);
    if (meta) {
      const content = _rBind(meta.id, value as () => ServerValue, siteCaptures(meta, contentRecorder!));
      site = true;
      return content;
    }
  }
  return children(value);
};
/**
 * A reference child of a native element (`{props.children}`, `{content}`; compiler: resume server target). A symbol
 * function (`_rFn`: a component's lone function child is its slot function) renders as its own child site, like a
 * spread's `children` (`resolveContent`): reads in its body re-run it after resume. The traversal would call it
 * outside every site, so they were never recorded (the browser re-runs it only on a plain DOM mount). Other values pass.
 */
export function _rChild(value: unknown): ServerValue {
  if (typeof value !== "function") return value as ServerValue;
  const meta = fns.get(value);
  let recorder: Recorder | undefined;
  if (meta && !(recorder = store.getStore()) && lazyRow !== null) return lazyRead(lazyRow, () => children(value));
  return meta && recorder ? _rBind(meta.id, value as () => ServerValue, siteCaptures(meta, recorder)) : (value as ServerValue);
}

/**
 * Spread attributes (`{...x}`) on the pending element: a binding (name `...` + rendered attribute
 * names + `@type` per spread handler) when the merged object read signals. A spread `onX` function
 * resumes when it is a symbol (`_rFn`: an inline function in an object literal / return value /
 * component prop, or a const arrow): recorded like an `onX={…}` handler. Other functions: rejected.
 * ` =class` = the rendered string class (spaces as newlines; the resumed `_spread` keeps an equal class untouched).
 * ` #c` when the object itself (not an accessor value in it) read signals: the resumed `_spread` then
 * replaces the server content on its first run instead of keeping it until `children` changes — unless a
 * symbol `children` is its own child site (` #r`, wins: live props objects read every getter while their
 * `children` stays the forwarded slot). A `ref` key holding a `ref()` object is recorded like `ref={r}` (`_rRef`).
 */
export function _rSpread(id: string, read: () => object | null | undefined, captures: Captures, tag: string, namespace?: "svg" | "mathml"): ServerValue {
  const recorder = store.getStore();
  if (!recorder) return lazyRow === null ? spreadAttributes(read(), tag, namespace) : lazyRead(lazyRow, () => lazySpread(lazyRow!, read(), tag, namespace));
  let handlers: [type: string, symbol: string, captures: Captures][] | null = null,
    names: string[] | null = null,
    own: Signal<unknown>[] = EMPTY_READS,
    cell: Cell | null = null;
  const tracked = _trackReads(() => {
    // The object's own reads (not its accessor values'): its `children` may then change before the resumed binding's
    // first run, so the client cannot keep the server content (`#c`, DOM `_spread`).
    const read1 = _trackReads(read);
    const object = read1.value;
    own = read1.signals;
    handlers = null;
    cell = null;
    names = null;
    for (const key in object) {
      const item = (object as Record<string, unknown>)[key];
      // A spread `ref()` object (`dom.*` tags forward `ref` through their spread): recorded like `ref={r}` (`_rRef`), so a
      // resumed capture of it holds the element.
      if (key === "ref") cell = (item as Cell | null | undefined)?.[CELL] ? (item as Cell) : null;
      if (!/^on[A-Z]/.test(key) || typeof item !== "function") continue;
      const meta = fns.get(item);
      if (!meta)
        throw new TypeError(
          `Cannot resume spread event handler ${key}: pass it as an explicit ${key}={…} attribute, or create it as an inline function in an object literal, a returned function or a const arrow`,
        );
      // `onXCapture` → key `x!` (capture-phase entry).
      const capture = key.endsWith("Capture") && key.length > 9;
      (handlers ??= []).push([key.slice(2, capture ? -7 : undefined).toLowerCase() + (capture ? "!" : ""), meta.id, siteCaptures(meta, recorder)]);
    }
    // The rendered-names list: names of the attributes the server wrote (absent values left out, `spreadAttributes`).
    names = [];
    const records = spreadAttributes(object, tag, namespace, names);
    // A function `children` runs here: a symbol (`_rFn`) as its own child site (the client keeps the server content while
    // the spread re-runs; its reads re-create / update that site alone, ` #r`) — also when the object itself read
    // signals (live props: `{...props}` reads every getter, while `children` stays the forwarded slot); any other
    // function / array inside this read (its reads capture the site; ` #c` when the object read signals).
    const outer = contentRecorder;
    contentRecorder = recorder;
    try {
      resolveSpreadContent(resolveContent);
    } finally {
      contentRecorder = outer;
    }
    return records;
  });
  const value = tracked.value;
  let signals = tracked.signals,
    name = site ? " #r" : "";
  site = false;
  if (own.length) {
    if (!name) name = " #c";
    if (signals.length) {
      signals = signals.slice();
      for (const signal of own) if (!signals.includes(signal)) signals.push(signal);
    } else signals = own;
  }
  if (cell) (recorder.element().refs ??= []).push(cell);
  if (handlers) {
    const element = recorder.element();
    for (const [type, symbol, values] of handlers as [string, string, Captures][]) {
      if (element.handlers?.[type]) throw new TypeError(clash(type));
      (element.handlers ??= {})[type] = [symbol, values];
      (element.spread ??= []).push(type);
      const listened = type.endsWith("!") ? type.slice(0, -1) : type;
      if (!recorder.events.has(listened)) listen(recorder, listened);
      name += " @" + type;
    }
  }
  if (signals.length) {
    // A rendered string class (` =` token, spaces as newlines): the resumed `_spread` leaves an equal class alone on its
    // first run, so classes client code added since (DOM plugins: embla ClassNames `is-snapped`) stay.
    for (const record of value) if (record.name === "class" && typeof record.value === "string") name += " =" + record.value.replace(/ /g, "\n");
    (recorder.element().bindings ??= []).push(["..." + (names as string[] | null)!.join(" ") + name, id, captures, signals]);
  }
  return value;
}

// A spread in a lazy row: the types of its handlers are listened for (the row materialises on them).
function lazySpread(lazy: LazyFor, object: object | null | undefined, tag: string, namespace?: "svg" | "mathml"): ServerValue {
  for (const key in object) {
    const item = (object as Record<string, unknown>)[key];
    if (/^on[A-Z]/.test(key) && typeof item === "function")
      lazyListen(lazy, key.slice(2, key.endsWith("Capture") && key.length > 9 ? -7 : undefined).toLowerCase());
  }
  const records = spreadAttributes(object, tag, namespace) as ServerValue;
  // Its function `children` run now (the traversal would run them recorded).
  resolveSpreadContent(children);
  return records;
}

/**
 * `model:` state; the signal itself is the resumable state. Returns an untracked reader of its
 * current value: the browser model binding owns updates, so an enclosing region must not depend on it.
 */
export function _rModel<S>(kind: "value" | "checked", state: S): S {
  const recorder = store.getStore();
  if (!recorder) {
    if (lazyRow !== null) lazyListen(lazyRow, kind === "value" ? "input" : "change");
    return state;
  }
  const info = _inspect(state);
  if (info?.kind !== "signal") throw new TypeError("Cannot resume model:" + kind + ": state must be a signal");
  recorder.element().model = [kind, state as Signal<unknown>];
  recorder.events.add(kind === "value" ? "input" : "change");
  return (() => info.value) as S;
}

/** A local assigned only by ref callbacks; resolves to its element's id once rendered. */
export function _rRefCell(): Cell {
  return { [CELL]: true, id: null };
}

/** Attach a ref cell or a `ref()` object (`ref={expr}`) to the pending element. */
export function _rRef(cell: Cell | null | undefined): null {
  const recorder = store.getStore();
  if (recorder && cell?.[CELL]) (recorder.element().refs ??= []).push(cell);
  return null;
}

/**
 * A captured local function (or a const derived through functions); serialized as its symbol plus
 * captures. The first registration of a render wins: the creation site registers before any
 * `const x = props.fn ?? …` that passes the function on (whose captures hold `props` → the function
 * itself: a cycle, and a recipe that only returns the original). A function shared across renders
 * (module-level, cached) re-registers with the current render's captures.
 */
export function _rFn<F>(id: string, fn: F, captures: LateCaptures): F {
  const recorder = store.getStore() ?? unrecordedRender;
  // A const derived through a function may hold a primitive (`find(arrow) ?? "x"`): serialized as itself.
  if (recorder && Object(fn) === fn) {
    const known = fns.get(fn as object)?.render;
    if (known !== recorder.options && known !== MODULE) fns.set(fn as object, { id, captures, render: recorder.options });
  }
  return fn;
}

// Function values the encoder names by something other than their own recipe (Function Bridge T9): installed by the first
// `_rBound` / `_rGroup` call, so a page without either pays one optional call in `special` (zero-cost: the WeakMaps and
// entry kinds tree-shake with those exports).
let fnSpecial: ((value: object, ref: (value: unknown) => number) => EntryRecord | undefined) | undefined;
const chain = (own: (value: object, ref: (value: unknown) => number) => EntryRecord | undefined): void => {
  const next = fnSpecial;
  fnSpecial = next ? (value, ref) => own(value, ref) ?? next(value, ref) : own;
};

// `resource()` (server-resource.ts, lane RESOURCE) through its slot: its resource functions encode as
// `{k:"bind", a:[recipe, undefined, seed]}`, the recipe being the one the compiler gave the resource's `const` (`_rFn`),
// carried by a stand-in function (`alias`).
type Mark = [Recorder, number[], Scope | null, (number | undefined)[]];
_onResource({
  alias(from, to) {
    const meta = fns.get(from);
    if (meta === undefined) return false;
    fns.set(to, meta);
    return true;
  },
  encode: chain,
  mark(): Mark | null {
    const recorder = store.getStore();
    if (!recorder) return null;
    const site = recorder.region;
    return [
      recorder,
      lengths(recorder),
      site,
      site ? [site.shows, site.adopts?.length, site.locals?.length, site.nested?.length, site.rows?.length, site.plans?.length] : [],
    ];
  },
  cut(mark) {
    const [recorder, from, site, at] = mark as Mark;
    cut(recorder, from);
    if (!site) return;
    site.shows = at[0];
    if (site.adopts) site.adopts.length = at[1] ?? 0;
    if (site.locals) site.locals.length = at[2] ?? 0;
    if (site.nested) site.nested.length = at[3] ?? 0;
    if (site.rows) site.rows.length = at[4] ?? 0;
    if (site.plans) site.plans.length = at[5] ?? 0;
  },
});

// `.bind` of a resumable function (compiler C9 rewrites `f.bind(t, ...args)`, T10): `{k:"bind", a:[f, t, ...args]}`, the
// browser binds again (dom-resume custom `bind`). A function with its own `bind` (or one returning a primitive) is left to
// it, unrecorded. Limit: a bound `this` / argument that reaches the bound function back (`o.h = f.bind(o)`) is a capture
// cycle: decoding throws "Cyclic reference" unless a `let` cell breaks it (as for any function entry).
let bounds: WeakMap<object, readonly unknown[]> | undefined;
export function _rBound<F extends (...a: never[]) => unknown>(fn: F, self: unknown, args: readonly unknown[]): F {
  const bound = (fn as unknown as { bind(...a: unknown[]): F }).bind(self, ...args);
  if (fn.bind !== Function.prototype.bind || Object(bound) !== bound || !(store.getStore() ?? unrecordedRender)) return bound;
  if (!bounds) {
    const map = (bounds = new WeakMap());
    chain((value, ref) => {
      const list = map.get(value);
      return list && { k: "bind", a: list.map(ref) };
    });
  }
  bounds.set(bound, [fn, self, ...args]);
  return bound;
}

// A group symbol (compiler C8, T10: mutually recursive local functions): `members` is what its factory returns for this
// instance. The array encodes as one plain recipe `{f: id, a: captures}` (compacted / `{y}`-repeated like any recipe) and
// each member as `{i: [group ref, k]}` (the decoder's `i` entry: element `k` of the decoded array), so members of one
// instance share one factory call and two instances never share members.
let groups: WeakMap<object, [members: readonly unknown[], k: number]> | undefined;
export function _rGroup<T extends readonly unknown[]>(id: string, members: T, captures: LateCaptures): T {
  if (!(store.getStore() ?? unrecordedRender)) return members;
  _rFn(id, members, captures);
  // Members encode as `{i: [members, k]}`: the array itself must be its recipe (by value it would contain its members).
  recipeOnly.add(id);
  if (!groups) {
    const map = (groups = new WeakMap());
    chain((value, ref) => {
      const at = map.get(value);
      return at && { i: [ref(at[0]), at[1]] };
    });
  }
  for (let k = 0; k < members.length; k++) if (typeof members[k] === "function") groups.set(members[k] as object, [members, k]);
  return members;
}

// Captured stores (Function Bridge T12; compiler C11 emits the literal paths their captured code reads / writes): this
// render's marks, the union of every `_rStorePaths` call on the store. A marked store whose server reads are all by path
// (`_storePaths` not null) encodes `{k: "store", a: [root signal, nodes]}` (dev: `+ kept paths`, for the browser's
// unshipped-path warning): the root signal's value and every node signal's value are pruned to the containers along
// (server-read paths ∪ literal paths), leaf values by identity; `nodes` = the store minus `v` (its read child nodes, as
// today). Unmarked or whole-read stores, and any store encoded while streamed segments are pending (a later segment may
// mark or read more paths of an entry the browser already has), encode as before. Installed by the first call
// (zero-cost: a page without one pays one undefined check per object in `special`). A store holds signals, so it is
// never inside a plain JSON (`j`) entry: `opaque` needs no store check.
let storeMarks: WeakMap<object, { render: object; paths: string[] }> | undefined;
// Signal → value to encode instead of its own (set only while a marked store's entry encodes).
let prunedSignals: Map<object, unknown> | undefined;
let storeSpecial: ((value: object, ref: (value: unknown) => number, root: Recorder) => EntryRecord | undefined) | undefined;
export function _rStorePaths<S extends object>(target: S, paths: readonly string[]): S {
  const recorder = store.getStore() ?? unrecordedRender;
  if (!recorder) return target;
  if (!storeMarks) {
    const marks = (storeMarks = new WeakMap());
    const pruned = (prunedSignals = new Map());
    storeSpecial = (value, ref, root) => {
      const mark = marks.get(value);
      if (mark === undefined || mark.render !== root.options || root.stream?.segments.some((segment) => !segment.out)) return undefined;
      const read = _storePaths(value as never);
      if (read === null) return undefined;
      const keep = [...new Set([...read, ...mark.paths])];
      const { v, ...nodes } = value as { v: () => unknown; c?: Record<string, StoreNode> };
      // Every node signal of the tree with its pruned value, then the entry (its refs encode synchronously).
      const set: object[] = [],
        memo: PruneMemo = new Map();
      const visit = (at: { v: () => unknown; c?: Record<string, StoreNode> }, path: string): void => {
        pruned.set(at.v, prunePath(untrack(at.v), path, keep, memo));
        set.push(at.v);
        for (const key in at.c) visit(at.c[key]!, path === "" ? key : path + "." + key);
      };
      visit(value as StoreNode, "");
      try {
        return { k: "store", a: DEV ? [ref(v), ref(nodes), ref(keep)] : [ref(v), ref(nodes)] };
      } finally {
        for (const signal of set) pruned.delete(signal);
      }
    };
  }
  const mark = storeMarks.get(target);
  if (mark !== undefined && mark.render === recorder.options) mark.paths.push(...paths);
  else storeMarks.set(target, { render: recorder.options, paths: [...paths] });
  return target;
}
interface StoreNode {
  v: () => unknown;
  c?: Record<string, StoreNode>;
}
// Pruned copies of one store entry, per original container and relative path set: a container pruned the same way for the
// root value and for a node value is one object, so browser identity (`read(s).user === read(s, "user")`) holds as for an
// unmarked store.
type PruneMemo = Map<object, Map<string, unknown>>;
// The value of the node at `path` pruned to the kept absolute paths: whole when a kept path is `path` or an ancestor of it.
function prunePath(value: unknown, path: string, keep: readonly string[], memo: PruneMemo): unknown {
  const rel: string[] = [];
  for (const k of keep) {
    if (path === "" ? k === "" : k === path || path.startsWith(k + ".")) return value;
    if (path === "") rel.push(k);
    else if (k.startsWith(path + ".")) rel.push(k.slice(path.length + 1));
  }
  return value !== null && typeof value === "object" ? prune(value, rel, memo) : value;
}
// Pruned copy of `data`: new containers along `paths` (arrays stay arrays), leaf values and containers kept whole by
// identity. A path under another kept path is dropped first (its ancestor ships whole); the walk only writes containers
// it created, so the store's data is never written (it may be frozen). Recursion depth = path depth (cycles are fine).
function prune(data: object, paths: readonly string[], memo: PruneMemo): unknown {
  const kept: string[] = [];
  for (const path of [...paths].sort((a, b) => a.length - b.length)) if (!kept.some((k) => path === k || path.startsWith(k + "."))) kept.push(path);
  const key = kept.sort().join("\0");
  let copies = memo.get(data);
  if (copies === undefined) memo.set(data, (copies = new Map()));
  const known = copies.get(key);
  if (known !== undefined) return known;
  const out: Record<string, unknown> = Array.isArray(data) ? ([] as unknown as Record<string, unknown>) : {};
  copies.set(key, out);
  // First segment → the rest of each path below it (null: the child itself is kept whole).
  const children = new Map<string, string[] | null>();
  for (const path of kept) {
    const dot = path.indexOf(".");
    if (dot < 0) children.set(path, null);
    else {
      const head = path.slice(0, dot);
      const rest = children.get(head);
      if (rest === undefined) children.set(head, [path.slice(dot + 1)]);
      else rest?.push(path.slice(dot + 1));
    }
  }
  const from = data as Record<string, unknown>;
  // Object keys in the data's own order (arrays: indices, any order).
  const heads = children.size > 1 && !Array.isArray(data) ? Object.keys(from).filter((k) => children.has(k)) : children.keys();
  for (const head of heads) {
    const rest = children.get(head)!;
    // Store paths never name these (`store.ts` FORBIDDEN): a literal one ships nothing (no prototype write on `out`).
    if (!Object.hasOwn(from, head) || head === "__proto__" || head === "constructor" || head === "prototype") continue;
    const next = from[head];
    out[head] = rest === null || next === null || typeof next !== "object" ? next : prune(next, rest, memo);
  }
  return out;
}

// Function Bridge (plan T7): a boxed `let` (compiler C6: `let x = 0` → `const x = _rCell(0)`, reads / writes `x.v`) in a
// resume module's server render. Encoded once, at its first encode (`{k:"cell", a:[value]}`, interned: every symbol capturing
// it shares one browser cell) — Q2: later server writes (an `Async` continuation) do not reach the page; dev warns once.
class LetCell<T> {
  v: T;
  constructor(v: T) {
    this.v = v;
  }
}
class DevLetCell<T> {
  #v: T;
  #sealed = false;
  constructor(v: T) {
    this.#v = v;
  }
  get v(): T {
    return this.#v;
  }
  set v(next: T) {
    if (this.#sealed) {
      this.#sealed = false;
      console.warn("Rivet resume: a captured `let` was assigned after the page state was written; the browser keeps its earlier value");
    }
    this.#v = next;
  }
  seal(): void {
    this.#sealed = true;
  }
}
export function _rCell<T>(value: T): { v: T } {
  return DEV ? new DevLetCell(value) : new LetCell(value);
}

// Data classes (Function Bridge T23; compiler C12 registers the classes a resume module declares or imports). The class
// symbol `<module>#<Class>$class` returns the class in the browser; an instance restores its prototype and own fields
// (`{cls, a: [fields]}`, decoded two-phase) and is never re-constructed. True private fields (`#x`) cannot be restored
// (`Object.create` gives no private brand: D-priv), so their classes are not registered. Resource holders (T25): an instance
// with `[serialize]()` (explicit beats the data proof) or of a `registerClass` class encodes `{cls, a: [data], rv: 1}` and
// is rebuilt by its reviver (`static [revive]` / the registered hooks; `cls` = the registered id). Installed by the first
// `_rClass` call or the first render after a `registerClass` (zero-cost: a page without either pays one undefined check in
// `special` / `opaque`).
// `classes(value, ref)`: the instance's entry; without `ref`, whether `value` is one (`opaque`, side-effect free).
// Platform classes Node implements in JS (their state lives in symbol / private slots); everything else built in is native
// (MessageChannel / MessagePort are; EventSource / Worker are not Node globals — review T24 L5).
const JS_PLATFORM =
  /^(?:EventTarget|Event|CustomEvent|MessageEvent|AbortSignal|AbortController|DOMException|QuotaExceededError|URL|URLSearchParams|Headers|Request|Response|FormData|Blob|File|ReadableStream|ReadableStreamDefaultReader|ReadableStreamDefaultController|WritableStream|WritableStreamDefaultWriter|TransformStream|CountQueuingStrategy|ByteLengthQueuingStrategy|TextEncoder|TextDecoder|TextEncoderStream|TextDecoderStream|CompressionStream|DecompressionStream|BroadcastChannel|WebSocket|Performance|PerformanceEntry|PerformanceObserver|Crypto|CryptoKey|SubtleCrypto|Navigator)$/;
let classes: ((value: object, ref?: (value: unknown) => number) => TableEntry | undefined) | undefined;
let classIds: WeakMap<object, string> | undefined;
/** @internal Register a data class for resume (compiler output, module load). */
export function _rClass(cls: abstract new (...a: never[]) => unknown, id: string): void {
  (classIds ?? installClasses()).set(cls, id);
}
const NO_CLASSES = new Map<object, ClassHooks>();
function installClasses(): WeakMap<object, string> {
  const ids = (classIds = new WeakMap());
  {
    classes = (value, ref) => {
      if (typeof value === "function" || Array.isArray(value)) return undefined;
      // The instance's class (the first own `constructor` on the chain) and the registered ones up to `Object.prototype`.
      let own: { name: string } | undefined, id: string | undefined, hooks: ClassHooks | undefined, base: string | undefined, builtin: string | undefined;
      const registry = (globalThis as { [_CLASSES]?: ClassRegistry })[_CLASSES]?.of ?? NO_CLASSES;
      for (let p = Object.getPrototypeOf(value); p !== null && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
        if (!Object.hasOwn(p, "constructor")) continue;
        const ctor = (p as { constructor: { name: string } }).constructor;
        own ??= ctor;
        if (ctor === own) ((id = ids.get(ctor)), (hooks = registry.get(ctor)));
        else if (ids.has(ctor)) base ??= ctor.name;
        // A built-in base (Map, Date, Error, EventTarget, …: its state lives in internal slots, not own fields): native code,
        // or one of the platform classes Node implements in JS (by global identity; T23 re-review L1: a user class hung on
        // `globalThis`, a UMD / polyfill global, stays a data base).
        else if (
          typeof ctor === "function" &&
          (/\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(ctor)) ||
            ((globalThis as Record<string, unknown>)[ctor.name] === ctor && JS_PLATFORM.test(ctor.name)))
        )
          builtin ??= ctor.name;
      }
      if (id === undefined && hooks === undefined && base === undefined) return undefined;
      if (!ref) return 0;
      const name = own!.name,
        refuse = (why: string): never => {
          throw new TypeError(name + " instance is not serializable: " + why);
        };
      // A resource holder (T25): its reviver rebuilds it from its data in the browser (a built-in base included: the reviver
      // constructs). The registered hooks first (by their id: no class symbol needed), then the instance's own `[serialize]`.
      const write = hooks?.serialize ?? (value as { [serialize]?: unknown })[serialize];
      if (hooks !== undefined || (id !== undefined && typeof write === "function")) {
        if (typeof write !== "function") refuse("registerClass `" + hooks!.id + "` has no serialize hook and the instance no [serialize]()");
        if (hooks ? typeof hooks.revive !== "function" : typeof (own as { [revive]?: unknown })[revive] !== "function")
          throw new TypeError("RV2102: " + name + " has [serialize] but no static [revive]");
        return { cls: hooks ? hooks.id : id!, a: [ref(hooks?.serialize ? hooks.serialize(value) : (write as () => unknown).call(value))], rv: 1 };
      }
      // Review T23 M2: C12 registers every eligible class, so an unregistered subclass is ineligible (never decoded as its base).
      if (id === undefined) refuse("its class is not registered for resume (its base " + base + " is)");
      // Review T23 M1: built-in bases keep their state in internal slots.
      if (builtin !== undefined) refuse("it extends the built-in " + builtin + "; use static [revive]");
      // Its own enumerable string-keyed fields, read now. Dev (spec risk 5, review L2): the browser must get the same own-key
      // set — symbol keys, non-enumerable / accessor / non-writable fields and frozen / sealed instances do not resume as
      // they are (production drops / flattens them silently).
      if (DEV) {
        if (!Object.isExtensible(value)) refuse("it is frozen, sealed or non-extensible; use static [revive]");
        for (const key of Reflect.ownKeys(value)) {
          const d = Object.getOwnPropertyDescriptor(value, key)!;
          const what =
            typeof key === "symbol"
              ? "a symbol key"
              : !d.enumerable
                ? "a non-enumerable field"
                : !("value" in d)
                  ? "an accessor"
                  : !d.writable
                    ? "a non-writable field"
                    : "";
          if (what) refuse(what + " `" + String(key) + "` does not resume; use static [revive]");
        }
      }
      const fields: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        // Review T23 L1: an own `__proto__` field would re-prototype the fields object.
        if (key === "__proto__") refuse("its own `__proto__` field does not resume");
        fields[key] = (value as Record<string, unknown>)[key];
      }
      return { cls: id!, a: [ref(fields)] };
    };
  }
  return ids;
}

/**
 * Live props (LIVE-PROPS P3): the props object of a component call with dynamic props (`{ get variant() {…} }`,
 * compiler: server-resume target). Serialized as its recipe — the symbol (`(captures) => _c(_propsOf, props)`,
 * the call's JSX attributes compiled for the browser) plus captures, never by value — so a resumed binding
 * reading `props.variant` keeps tracking `variant` instead of a snapshot. `children` (1): the call's lazy
 * children are the symbol's last parameter (the server's slot, shared, not compiled twice). Captures that are
 * not serializable fall back to the props by value (today's snapshot).
 */
export function _rProps<P extends object>(id: string, props: P, captures: Captures, children?: 1): P {
  const recorder = store.getStore() ?? unrecordedRender;
  if (recorder) {
    const meta = metaOf(props);
    if (!meta?.live || meta.render !== recorder.options)
      Live.set(props, { id, captures: children ? [...captures, (props as { children?: unknown }).children] : captures, render: recorder.options, live: true });
  }
  return props;
}

/**
 * Live props (LIVE-PROPS P3): a member capture (`props.a` captured by a spread / styled site, compiler member
 * captures) of a live props object. A getter of a `_rProps` object or a helper-forwarded getter (`splitProps`)
 * is captured as a forward box (`{k:"m"}`, read unread here: the enclosing region records nothing) that the
 * symbol prologue (`_members`) turns back into a getter; anything else is the value, as before.
 */
export function _rMember(object: unknown, key: string): unknown {
  if (object !== null && typeof object === "object") {
    const meta = metaOf(object);
    if (meta !== undefined && (meta.live || meta.fw !== undefined) && Object.getOwnPropertyDescriptor(object, key)?.get) {
      const sources = meta.live ? [object] : meta.fw!.get(key);
      if (sources !== undefined) return { [FORWARD]: true, key, sources } satisfies Forward;
    }
  }
  return (object as Record<string, unknown>)[key];
}

/** A computed whose function is a symbol; serialized as symbol plus captures. */
export function _rComputed<T>(id: string, fn: () => T, captures: Captures, options?: EqualsOptions<T>): () => T {
  const getter = computed(fn, options);
  if (store.getStore()) computeds.set(getter, { id, captures, frame: frameOf() });
  return getter;
}

function onlyLocations(signals: readonly object[]): boolean {
  for (let i = 0; i < signals.length; i++) if (!_hrefs.has(signals[i]!)) return false;
  return signals.length > 0;
}

/** Browser-only effect: recorded, never run. */
export function _rEffect(id: string, captures: Captures, options?: { when?: string }): void {
  const recorder = store.getStore();
  // A lazy row's effect: runs when the row materialises (R6, LAZY-ROWS T5), at idle at the latest.
  if (!recorder) return lazyEffect();
  recorder.used = true;
  recorder.effects.push([id, captures, options?.when ?? null, recorder.region]);
}

/**
 * @internal Bridge ABI (framework islands): register a lazily imported chunk (its manifest URL: a `lazy` list entry or a
 * `sizes` key; or an island key the manifest's `islands` maps to its URL) with the page's preload planner, merged as if a symbol of that chunk had `strategy` (same precedence,
 * `VISIBLE_MAX` and background-budget rules); `ids`: the elements a `visible` entry observes. A URL the build
 * manifest does not know: dev warning, ignored. Records nothing outside a resumable render (0 B).
 */
export function _rPreload(chunkKey: string, strategy: "eager" | "idle" | "visible" | "intent" | "interaction", ids?: readonly number[]): void {
  const recorder = store.getStore();
  if (!recorder) return;
  recorder.preloads.push([chunkKey, strategy, ids ?? null]);
}

/**
 * @internal Bridge ABI (T7b islands-only lean client): the render's recorder as the lean tail provider sees it. Read
 * only; the shapes are internal (same package family, versioned with the runtime).
 */
export interface LeanView {
  readonly options: {
    readonly manifest?: { readonly islands?: Record<string, string>; readonly deps?: Record<string, string[]> };
    readonly nonce?: unknown;
  };
  readonly events: ReadonlySet<string>;
  readonly elements: readonly { readonly handlers: unknown; readonly bindings: unknown; readonly model: unknown; readonly spread?: unknown }[];
  readonly texts: readonly unknown[];
  readonly effects: readonly (readonly [symbol: string, captures: unknown, when: string | null, scope: unknown])[];
  readonly clientEvents: readonly unknown[];
  readonly regions: readonly unknown[];
  readonly links: readonly unknown[];
  readonly lists: readonly unknown[];
  readonly paths: readonly unknown[];
  readonly asyncs: readonly unknown[];
}
/**
 * @internal The deferred state of a lean page (bridge D-lean): the state script + resume loader of the render's other
 * resumables, encoded without the effects `drop` accepts (the lean islands' hydration effects) and the `_rPreload`
 * entries of `islands` (their keys), as a lean page (`preload.lean`: no schedule; no fetch-ahead unless `preload.ahead`)
 * that does not boot: the loader starts the runtime on the first intent / interaction its listeners see (a router's
 * link pointerover / focus / click; a cold click is held and replayed). `null` when the rest would boot at load
 * (client effects, eager client events, regions that mount): the caller keeps the full tail.
 */
export type DeferredState = (drop: (symbol: string) => boolean, islands: ReadonlySet<string>) => ServerValue | null;
/** @internal A lean tail provider: the trusted tail markup replacing the state script + loader, or `null` (full tail). */
export interface LeanTail {
  tail(view: LeanView, deferred: DeferredState): ServerValue | null;
}
/**
 * @internal Bridge ABI: the current resumable render's lean tail provider, created by `create` on first use (one per
 * render). At the end of the shell, `tail(view)` may return the page's tail instead of the state + resume loader (a
 * page whose only resumables are framework islands boots with the bridge's lean boot). `null` outside a resumable render.
 */
export function _rLean<T extends LeanTail>(create: () => T): T | null {
  const recorder = store.getStore();
  if (!recorder) return null;
  return (recorder.lean ??= create()) as T;
}

/**
 * @internal Bridge hook: the CSP nonce of the current resumable render (`ResumableRenderOptions.nonce`, sanitised the
 * way the runtime writes it into its own scripts), for framework islands whose inline scripts need it (React / Solid).
 * `undefined` outside a resumable render or when the render has no nonce.
 */
export function _renderNonce(): string | undefined {
  const nonce = store.getStore()?.options.nonce;
  return nonce ? String(nonce).replace(/[^\w+/=-]/g, "") : undefined;
}

/** Browser-only listener: recorded, never attached. */
export function _rClientEvent(id: string, captures: Captures, target: unknown, type: string, options?: ClientEventOptions): void {
  const recorder = store.getStore();
  // A lazy row's listener: attached when the row materialises (R6, LAZY-ROWS T5), at idle at the latest.
  if (!recorder) return lazyEffect();
  // `standalone: false` (the router's listeners in static builds): recorded, but alone they do not make the page
  // resumable — a page with nothing else to resume ships no state, loader or preloads (zero JS).
  if (options?.standalone !== false) recorder.used = true;
  recorder.clientEvents.push([id, captures, target, type, options ?? null, recorder.region]);
}

// Hot per-row helpers loop by hand instead of passing callbacks: V8 keeps optimized code only while a closure
// using it is alive, so a callback created per call is re-tiered after every full GC (5000 rows: ~1 per page).
const same = (a: unknown, b: unknown): boolean => {
  if (!Array.isArray(a)) return a === b;
  if (!Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false;
  return true;
};
const ITEM = Symbol("row item"),
  INDEX = Symbol("row index");
/** A uniform-row candidate: an element or text record directly inside a row region. */
type RowItem =
  | {
      source: ElementRecord;
      text?: undefined;
      id: number;
      handlers: [type: string, symbol: string, captures: Captures][];
      bindings: NonNullable<ElementRecord["bindings"]>;
    }
  | { source: TextRecord; text: true; id: number; symbol: string; values: Captures; signals: Signal<unknown>[] };
/** What a row recorded directly in its row region: element records, then text records (each in id order). */
type RowSource = ElementRecord | TextRecord;
/** A uniform list: its rows, the first row's items (template, id order) and every row's sources. */
interface RowList {
  site: Scope;
  rows: RowRecord[];
  first: RowItem[];
  sources: RowSource[][];
}

// Row-relative comparison without building canonical shapes: captures equal except the rows' own
// item / index getters, which must sit at the same places; signals by identity.
const mark = (value: unknown, row: RowRecord): unknown => (value === row.get ? ITEM : value === row.at ? INDEX : value);
const sameCaptures = (a: Captures, x: RowRecord, b: Captures, y: RowRecord): boolean => {
  if (a.length !== b.length) return false;
  // A late capture thunk (`siteCaptures`, length 0) is never equal: its row keeps its records (`settleLate` resolves them).
  if (a.length === 0) return typeof a !== "function" && typeof b !== "function";
  for (let i = 0; i < a.length; i++) if (mark(a[i], x) !== mark(b[i], y)) return false;
  return true;
};
const sameSignals = (a: readonly unknown[], b: readonly unknown[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
function sameSource(p: RowSource, x: RowRecord, q: RowSource, y: RowRecord): boolean {
  if (Array.isArray(p)) {
    const t = q as TextRecord;
    return Array.isArray(q) && p[0] - x.id === t[0] - y.id && p[1] === t[1] && sameCaptures(p[2], x, t[2], y) && sameSignals(p[3], t[3]);
  }
  const e = q as ElementRecord;
  if (Array.isArray(q) || p.id! - x.id !== e.id! - y.id) return false;
  const ph = p.handlers,
    qh = e.handlers;
  if (ph || qh) {
    if (!ph || !qh) return false;
    let n = 0;
    for (const type in ph) {
      const a = ph[type]!,
        b = qh[type];
      if (!b || a[0] !== b[0] || !sameCaptures(a[1], x, b[1], y)) return false;
      n++;
    }
    for (const _ in qh) n--;
    if (n) return false;
  }
  const pb = p.bindings ?? [],
    qb = e.bindings ?? [];
  if (pb.length !== qb.length) return false;
  for (let i = 0; i < pb.length; i++) {
    const a = pb[i]!,
      b = qb[i]!;
    if (a[0] !== b[0] || a[1] !== b[1] || !sameCaptures(a[2], x, b[2], y) || !sameSignals(a[3], b[3])) return false;
  }
  return true;
}

const rowOf = (scope: Scope | null | undefined): Scope | null | undefined => {
  while (scope && !scope.row) scope = scope.held ? null : scope.parent;
  return scope;
};
const sameList = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/**
 * Called when a row of child binding site `site` finished evaluating (its records are the recorder's
 * elements from `e0`, texts from `t0`, regions / effects / client events from `r0` / `f0` / `c0`;
 * `others` = asyncs + links + lists before it). The
 * first row is the reference. A later row equal to it (`sameSource` per record, same preload / nav /
 * spread flags) whose range holds nothing but its own direct records is packed: its records are dropped
 * now (they would only be consumed by the row template), so a long list does not keep ~10 objects per
 * row alive until the state encode. A row that makes the list complex or non-uniform (as `rowTemplates`
 * decides) turns packing off for the site and rebuilds every packed row's records in place.
 */
function pack(recorder: Recorder, site: Scope, row: RowRecord, e0: number, t0: number, r0: number, f0: number, c0: number, others: number): void {
  const scope = row.scope!,
    elements = recorder.elements,
    texts = recorder.texts;
  // Classify the row's range without collecting it (a packed row's items would be garbage at once): only the
  // site's reference row keeps its item list; later rows compare in place.
  let foreign = recorder.pending !== null,
    complex = false,
    count = 0;
  for (let i = e0; i < elements.length; i++) {
    const element = elements[i]!;
    if (rowOf(element.region) !== scope) foreign = true;
    else if (element.region !== scope || element.model || element.refs) complex = true;
    else count++;
  }
  for (let i = t0; i < texts.length; i++) {
    const text = texts[i]!;
    if (rowOf(text[4]) !== scope) foreign = true;
    else if (text[4] !== scope) complex = true;
    else count++;
  }
  // As rowTemplates: regions, effects and client events recorded in the row make its list complex.
  const { regions, effects, clientEvents } = recorder;
  for (let i = r0; i < regions.length; i++) if (rowOf(regions[i]![4].parent) === scope) complex = true;
  for (let i = f0; i < effects.length; i++) if (rowOf(effects[i]![3]) === scope) complex = true;
  for (let i = c0; i < clientEvents.length; i++) if (rowOf(clientEvents[i]![5]) === scope) complex = true;
  if (
    regions.length !== r0 ||
    effects.length !== f0 ||
    clientEvents.length !== c0 ||
    recorder.asyncs.length + recorder.links.length + recorder.lists.length !== others
  )
    foreign = true;
  const state = site.pack;
  if (complex) return expand(recorder, site);
  // Not complex: every record of the range that belongs to the row is directly in its region (an item).
  if (!state) {
    const items: RowSource[] = new Array(count);
    let k = 0;
    for (let i = e0; i < elements.length; i++) if (rowOf(elements[i]!.region) === scope) items[k++] = elements[i]!;
    for (let i = t0; i < texts.length; i++) if (rowOf(texts[i]![4]) === scope) items[k++] = texts[i]!;
    site.pack = { ref: row, items, packed: [] };
    return;
  }
  const ref = state.ref,
    first = state.items;
  if (row.list !== ref.list || count !== first.length) return expand(recorder, site);
  let k = 0;
  for (let i = e0; i < elements.length; i++) {
    const element = elements[i]!;
    if (rowOf(element.region) === scope && !sameSource(first[k++]!, ref, element, row)) return expand(recorder, site);
  }
  for (let i = t0; i < texts.length; i++) {
    const text = texts[i]!;
    if (rowOf(text[4]) === scope && !sameSource(first[k++]!, ref, text, row)) return expand(recorder, site);
  }
  if (foreign || !count) return;
  // Elements come first in both lists: the reference's element items line up with the row's elements.
  for (let i = e0, j = 0; i < elements.length; i++, j++) {
    const a = first[j]!,
      b = elements[i]!;
    if (!Array.isArray(a) && (a.preload !== b.preload || a.nav !== b.nav || !sameList(a.spread, b.spread))) return;
  }
  elements.length = e0;
  texts.length = t0;
  row.packed = true;
  // Nothing recorded references the row's getters / scope any more: drop them (live set), `expand` makes new ones.
  row.get = row.at = row.scope = null;
  state.packed.push(row, e0, t0);
}

/** Packing off for `site`: every packed row gets its records back (rebuilt from the reference), at their places. */
function expand(recorder: Recorder, site: Scope): void {
  const state = site.pack;
  site.pack = null;
  if (!state?.packed.length) return;
  const { ref, items } = state;
  const packed = state.packed;
  for (let k = packed.length - 3; k >= 0; k -= 3) {
    const row = packed[k] as RowRecord,
      at = packed[k + 1] as number,
      textAt = packed[k + 2] as number;
    row.packed = false;
    // Fresh constant getters and row scope (the row's own were dropped when it was packed): they encode the same.
    const get: ConstantGetter<unknown> = (row.get = () => row.item),
      index: ConstantGetter<number> = (row.at = () => row.index);
    get[CONSTANT] = row.item;
    index[CONSTANT] = row.index;
    row.scope = { parent: site, id: row.id, mount: null, row: true, record: row };
    const remap = (values: Captures): Captures => values.map((value) => (value === ref.get ? get : value === ref.at ? index : value));
    const elements: ElementRecord[] = [],
      texts: TextRecord[] = [];
    for (const item of items) {
      if (Array.isArray(item)) {
        texts.push([item[0] - ref.id + row.id, item[1], remap(item[2]), item[3], row.scope!]);
        continue;
      }
      let handlers: ElementRecord["handlers"] = null;
      if (item.handlers) {
        handlers = {};
        for (const type in item.handlers) handlers[type] = [item.handlers[type]![0], remap(item.handlers[type]![1])];
      }
      const element: ElementRecord = {
        handlers,
        bindings: item.bindings && item.bindings.map(([name, symbol, values, signals]) => [name, symbol, remap(values), signals]),
        model: null,
        refs: null,
      };
      if (item.preload) element.preload = item.preload;
      if (item.nav) element.nav = true;
      if (item.spread) element.spread = item.spread;
      element.id = item.id! - ref.id + row.id;
      element.region = row.scope!;
      elements.push(element);
    }
    recorder.elements.splice(at, 0, ...elements);
    recorder.texts.splice(textAt, 0, ...texts);
  }
}

/**
 * Lists whose rows are uniform: every row holds only elements (handlers, attribute bindings) and text
 * bindings directly in its row region, at the same offsets from the row id, with the same symbols,
 * dependencies and captures except the row's own item/index getters. Map list → rows, template items, sources.
 */
function rowTemplates(recorder: Recorder): Map<object, RowList> {
  const lists = new Map<object, RowList>();
  const sites = recorder.lists.length ? recorder.regions.map((region) => region[4]).concat(recorder.lists) : recorder.regions.map((region) => region[4]);
  // No recorded site holds rows (most pages): nothing to template, skip the record scans.
  let rowed = false;
  for (let i = 0; i < sites.length && !rowed; i++) rowed = !!sites[i]!.rows?.length;
  if (!rowed) return lists;
  const complex = new Set<object>();
  for (const element of recorder.elements) {
    const row = rowOf(element.region);
    if (!row) continue;
    if (row !== element.region || element.model || element.refs) complex.add(row.record!.list);
    else (row.items ??= []).push(element);
  }
  for (const text of recorder.texts) {
    const row = rowOf(text[4]);
    if (!row) continue;
    if (row !== text[4]) complex.add(row.record!.list);
    else (row.items ??= []).push(text);
  }
  for (const [, , , , scope] of recorder.regions) if (rowOf(scope.parent)) complex.add(rowOf(scope.parent)!.record!.list);
  for (const [, , , scope] of recorder.effects) if (rowOf(scope)) complex.add(rowOf(scope)!.record!.list);
  for (const [, , , , , scope] of recorder.clientEvents) if (rowOf(scope)) complex.add(rowOf(scope)!.record!.list);
  for (const site of sites) {
    const rows = site.rows;
    if (!rows?.length || complex.has(rows[0]!.list)) continue;
    const head = rows[0]!,
      list = head.list,
      first = head.scope!.items;
    if (!first?.length) continue;
    let uniform = true;
    for (let k = 1; uniform && k < rows.length; k++) {
      const row = rows[k]!;
      // Packed: equal to the site's reference row (itself one of these rows) by construction.
      if (row.packed) continue;
      const items = row.scope!.items;
      if (row.list !== list || !items || items.length !== first.length) uniform = false;
      else for (let i = 0; uniform && i < items.length; i++) uniform = sameSource(first[i]!, head, items[i]!, row);
    }
    if (!uniform) continue;
    const template = first
      .map((source): RowItem =>
        Array.isArray(source)
          ? { source, text: true, id: source[0], symbol: source[1], values: source[2], signals: source[3] }
          : {
              source,
              id: source.id!,
              handlers: Object.entries(source.handlers ?? {}).map(([type, [symbol, values]]): [string, string, Captures] => [type, symbol, values]),
              bindings: source.bindings ?? [],
            },
      )
      .sort((x, y) => x.id - y.id);
    const sources: RowSource[][] = new Array(rows.length);
    for (let k = 0; k < rows.length; k++) sources[k] = rows[k]!.scope?.items ?? [];
    lists.set(list, { site, rows, first: template, sources });
  }
  // A site whose list is not templated after all needs its packed rows' records back.
  for (const site of sites) if (site.pack?.packed.length && !lists.has(site.rows![0]!.list)) expand(recorder, site);
  return lists;
}

// Flat [rowId, itemRef, indexed, …] when the region holds exactly one For whose items serialize.
// Keys are not sent: the browser For recomputes them with its own `by`.
function adoptable(encoder: Encoding["encoder"], rows: RowRecord[] | undefined): number[] | null {
  if (!rows?.length) return null;
  const list = rows[0]!.list;
  for (let k = 1; k < rows.length; k++) if (rows[k]!.list !== list) return null;
  const out: number[] = new Array(rows.length * 3);
  try {
    for (let k = 0; k < rows.length; k++) {
      const row = rows[k]!;
      out[3 * k] = row.id;
      out[3 * k + 1] = encoder.ref(row.item);
      out[3 * k + 2] = (row.indexed ? 1 : 0) | (row.reads ? 2 : 0);
    }
  } catch {
    return null;
  }
  return out;
}

// Templated list rows: ids as start + stride (else explicit), items as an existing table array
// with the same references (else explicit), one index flag.
function compactRows(encoder: Encoding["encoder"], rows: RowRecord[], items: number[]): CompactRows {
  const out: CompactRows = {};
  const start = rows[0]!.id,
    stride = rows.length > 1 ? rows[1]!.id - start : 0;
  let strided = true,
    indexed = false,
    reads = false;
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k]!;
    if (row.id !== start + k * stride) strided = false;
    if (row.indexed) indexed = true;
    if (row.reads) reads = true;
  }
  if (strided) Object.assign(out, { i: start, d: stride });
  else {
    const ids: number[] = new Array(rows.length);
    for (let k = 0; k < rows.length; k++) ids[k] = rows[k]!.id;
    out.ids = ids;
  }
  const table = encoder.table;
  let array = -1;
  for (let t = 0; t < table.length; t++) {
    const entry = table[t];
    if (Array.isArray(entry) && same(entry, items)) {
      array = t;
      break;
    }
  }
  if (array >= 0) out.a = array;
  else out.r = items;
  if (indexed) out.x = 1;
  if (reads) out.w = 1;
  return out;
}

/** Whether `value` has an own enumerable accessor (`{ get x() {…} }`). */
function hasAccessor(value: object): boolean {
  for (const key in value) if (Object.getOwnPropertyDescriptor(value, key)?.get) return true;
  return false;
}

// Persistent per render: one encoder (table), chunk list and symbol map for the shell and its patches.
/** A router location's root-relative href in the state (`href` kind). */
class Href {
  readonly path: string;
  constructor(path: string) {
    this.path = path;
  }
}
function encoding(root: Recorder): Encoding {
  if (root.enc) return root.enc;
  // `registerClass` (T25) classes encode through the class path: installed on the first render after one registers.
  if (classes === undefined && (globalThis as { [_CLASSES]?: unknown })[_CLASSES] !== undefined) installClasses();
  const { manifest = {} as BuildManifest } = root.options;
  const contexts = root.contexts;
  const special: Special = (value, ref, plain, refs) => {
    // A provided context value: a `{x}` reference the client supplies through `createResume({ contexts })`,
    // unless the token is registered (`resumableContext`) — then it ships structurally, so a region
    // re-created inside the provider reads it without any client-side table.
    const context = contexts.get(value);
    if (context !== undefined && !_contextById(context)) return { x: context };
    // A registered context token held as a value (Popover `clearContexts`): by id, so the browser gets the token itself.
    if (_isContextToken(value)) return { k: "ctx", a: [ref((value as Context<unknown>).id)] };
    if (value instanceof Href) return { k: "href", a: [ref(value.path)] };
    const cell = (value as Partial<Cell>)[CELL];
    if (cell === true) {
      if ((value as Cell).id === null) throw new TypeError("ref is not attached to a rendered element");
      // `z`: the nearest recorded region (omitted at the page root): the client resets the ref when it dies.
      let scope = (value as Cell).region;
      while (scope && scope.id === null) scope = scope.parent;
      return scope ? { r: (value as Cell).id!, z: scope.id! } : { r: (value as Cell).id! };
    }
    // A `ref()` object (server.ts) encodes itself.
    if (cell) return (cell as unknown as Special)(value, ref, plain, refs);
    const router = (value as { [ROUTER]?: unknown })[ROUTER];
    if (router !== undefined) return { k: "router", a: [ref(router)] };
    if (typeof value !== "function") {
      // A captured store marked by `_rStorePaths` (Function Bridge T12): narrowed to the paths anyone reads.
      if (storeSpecial !== undefined) {
        const entry = storeSpecial(value, ref, root);
        if (entry !== undefined) return entry;
      }
      // A `let` cell (`_rCell`): its value at this first encode (interned: later encodes reuse the entry; Q2).
      if (value instanceof LetCell || (DEV && value instanceof DevLetCell)) {
        // Dev seal: a `plain` / `attemptRefs` attempt that rolls this entry back keeps the seal (a later write warns
        // spuriously; the value re-encodes correctly) — accepted, dev only.
        if (DEV) (value as DevLetCell<unknown>).seal();
        return { k: "cell", a: [ref((value as { v: unknown }).v)] };
      }
      // Eager JSX (a value prop or children) has no symbol: it cannot be re-rendered in the browser.
      if ((value as { [TEMPLATE]?: true })[TEMPLATE])
        throw new TypeError(DEV ? DEV.hint("rendered content is not serializable", "content") : "rendered content is not serializable");
      // A const derived through a function (`_rFn` value: `const s = createSelectState()`, `[() => …]`, mapped data) goes
      // by value when it encodes, so handlers and bindings share its signals and its initializer runs once (Q5 / T18);
      // re-created from its recipe when its value is not serializable (an unstamped function, a class instance).
      // One WeakMap read per object (plain data objects are most of a page's values).
      if ((value as Partial<Forward>)[FORWARD]) {
        const { key, sources } = value as Forward;
        const a = [ref(key)];
        forwardSources(key, sources, a, ref, refs);
        return { k: "m", a };
      }
      // A registered data class instance (T23) — by value, also as a recipe const's value (`const u = new User()`).
      if (classes) {
        const entry = classes(value, ref);
        if (entry !== undefined) return entry;
      }
      const meta = metaOf(value);
      if (meta === undefined) return undefined;
      if (meta.render === MODULE) return { f: meta.id, a: [] };
      if (meta.live) {
        // A recipe whose captures did not serialize once (e.g. a module-level function among them) goes by
        // value from then on: no failed attempt (a thrown encode) per instance and render.
        const a = unportable.has(meta.id) ? undefined : refs(capturesOf(meta));
        if (a) return { f: meta.id, a };
        unportable.add(meta.id);
        return plain(value);
      }
      if (meta.fw) return forwards(value as Record<string, unknown>, meta.fw, ref);
      // A getter object (`{ get variant() {…} }`, compiler seed — context values over live props): its recipe, so the
      // browser rebuilds the getters instead of a snapshot of what they returned here; by value when the captures
      // do not serialize (as before).
      if (hasAccessor(value)) {
        const a = refs(capturesOf(meta));
        return a ? { f: meta.id, a } : plain(value);
      }
      // Q5 (Function Bridge T18): by value when everything in it encodes (functions are References) — the browser does not
      // re-run the initializer (side effects once). A recipe whose value failed once goes straight to its recipe.
      if (!recipeOnly.has(meta.id)) {
        const entry = plain(value);
        if (entry !== undefined) return entry;
        recipeOnly.add(meta.id);
      }
      return { f: meta.id, a: capturesOf(meta).map(ref) };
    }
    if (CONSTANT in value) return { k: "const", a: [ref((value as ConstantGetter<unknown>)[CONSTANT])] };
    const site = resets.get(value);
    if (site) return { k: "reset", a: [ref(site.id)] };
    const reactive = _inspect(value);
    if (reactive?.kind === "signal") {
      // A router's location: same-origin, its href ships relative (`href` kind: the browser resolves it against its
      // location), so a prerendered page's state carries no build-time origin and the router adopts it unchanged.
      // A marked store's node signal (T12): its pruned value.
      const v = prunedSignals !== undefined && prunedSignals.has(value) ? prunedSignals.get(value) : reactive.value,
        origin = root.options.origin;
      const at = origin && typeof v === "string" && _hrefs.has(value) && v.startsWith(origin + "/") ? new Href(v.slice(origin.length)) : v;
      return withEquals({ s: ref(at) }, reactive.equals, ref);
    }
    const meta = computeds.get(value);
    if (meta) return withEquals(withProviders({ c: meta.id, a: meta.captures.map(ref) }, meta.frame, ref, refs), reactive!.equals, ref);
    if (reactive)
      throw new TypeError(
        DEV ? DEV.hint("computed was not created in a resume-compiled component", "computed") : "computed was not created in a resume-compiled component",
      );
    return fnSpecial?.(value, ref) ?? fnEntry(value, ref);
  };
  // A props object of forwarded getters: `{k:"props", a: [key, value, …]}` in key order, a forwarded getter's value
  // a `{k:"m"}` forward (the browser defines a getter over the decoded sources), other keys by value.
  const forwards = (value: Record<string, unknown>, fw: Map<string, readonly object[]>, ref: (value: unknown) => number): EntryRecord => {
    const a: number[] = [];
    for (const key of Object.keys(value)) {
      const sources = fw.get(key);
      const forward = sources !== undefined && Object.getOwnPropertyDescriptor(value, key)!.get !== undefined;
      a.push(ref(key), ref(forward ? ({ [FORWARD]: true, key, sources } satisfies Forward) : value[key]));
    }
    return { k: "props", a };
  };
  // Providers a computed was created under (`providersOf`): their list is the entry's last capture, flag `v: 1` (the
  // browser creates the computed under them); values that do not encode are left out (that context reads its default).
  // One list entry per frame chain and render. Not for recipe consts (`_rFn` values): their symbol runs their initializer
  // with the same captures, and their provider values would join the state (+3–7% on ui showcases) and chunk reach.
  const lists = new WeakMap<unknown[], number | null>();
  const withProviders = (
    entry: EntryRecord,
    frame: Frame | null | undefined,
    ref: (value: unknown) => number,
    refs: (values: readonly unknown[]) => number[] | undefined,
  ): EntryRecord => {
    const list = frame ? providersOf(frame) : null;
    if (list === null) return entry;
    let at = lists.get(list);
    if (at === undefined) {
      const kept: unknown[] = [];
      for (let i = 0; i < list.length; i += 2) if (refs([list[i + 1]]) !== undefined) kept.push(list[i], list[i + 1]);
      lists.set(list, (at = kept.length ? ref(kept) : null));
    }
    if (at !== null) {
      entry.a!.push(at);
      entry.v = 1;
    }
    return entry;
  };
  // Default Object.is stays implicit; `equals: false` is a flag; a comparator must be a symbol.
  const withEquals = (entry: EntryRecord, equals: Equals, ref: (value: unknown) => number): EntryRecord => {
    if (equals === Object.is) return entry;
    if (equals === null) entry.q = false;
    else if (fns.has(equals)) entry.q = ref(equals);
    else
      throw new TypeError(
        "equals comparator is not resumable: pass an inline function (or a module/component-local function) in signal()/computed() options of a resume-compiled component",
      );
    return entry;
  };
  const fnEntry = (value: object, ref: (value: unknown) => number): EntryRecord | undefined => {
    const meta = fns.get(value);
    return meta ? { f: meta.id, a: capturesOf(meta).map(ref) } : undefined;
  };
  // Objects `special` encodes itself (side-effect free mirror of its checks): never inside a plain JSON (`j`) entry.
  const opaque = (value: object): boolean => {
    const context = contexts.get(value);
    return (
      (context !== undefined && !_contextById(context)) ||
      _isContextToken(value) ||
      value instanceof LetCell ||
      (DEV && value instanceof DevLetCell) ||
      (value as Partial<Cell>)[CELL] !== undefined ||
      (value as { [ROUTER]?: unknown })[ROUTER] !== undefined ||
      value instanceof Href ||
      (value as { [TEMPLATE]?: true })[TEMPLATE] !== undefined ||
      (value as Partial<Forward>)[FORWARD] !== undefined ||
      metaOf(value) !== undefined ||
      (classes !== undefined && classes(value) !== undefined)
    );
  };
  return (root.enc = {
    manifest,
    encoder: createEncoder({ special, opaque, json: false, origin: root.options.origin, dom: root.dom ?? undefined }),
    chunks: [],
    chunkOf: new Map(),
    symbols: new Map(),
    events: new Set(),
  });
}

// "Cannot resume <id>: …" for a capture that does not encode — dev names the capture (dev manifest `captures`, Function
// Bridge Q6 / T19; `#<i>` without names), prod carries no index.
function captureError(manifest: Pick<ResumeManifest, "captures"> | undefined, id: string, i: number, error: unknown): TypeError {
  const message = (error as Error | null)?.message ?? String(error);
  if (!DEV) return new TypeError("Cannot resume " + id + ": " + message, { cause: error });
  const name = manifest?.captures?.[id]?.[i];
  return new TypeError("Cannot resume " + id + ": capture " + (name ? "`" + name + "`" : "#" + i) + " " + message, { cause: error });
}
// A site's capture refs (module level: no callback per site).
function refsOf(ref: (value: unknown) => number, manifest: Pick<ResumeManifest, "captures"> | undefined, id: string, values: Captures): number[] {
  const out: number[] = new Array(values.length);
  for (let i = 0; i < values.length; i++)
    try {
      out[i] = ref(values[i]);
    } catch (error) {
      throw captureError(manifest, id, i, error);
    }
  return out;
}
/**
 * One region site's binding entry (`#`, `encodeRecords`): captures, signals, its rows (compact `templated` rows or
 * adoptable triples), branches, `_regionState` locals, providers and row reads in their slots ([8]–[13]); the chunk list
 * [5] covers the symbols reached by everything the activation decodes.
 */
function regionEntry(
  encoder: Encoding["encoder"],
  [node, symbol, values, signals, scope]: RegionRecord,
  templated: { tpl: RowTemplate; rows: RowRecord[]; items: number[] } | undefined,
  captures: (id: string, values: Captures) => number[],
  needs: (symbol: string, refs: number[]) => number[],
  regionOf: (scope: Scope | null | undefined) => number,
): BindingEntry {
  const refs = captures(symbol, values);
  // Everything the activation decodes besides the captures (row items, branch value, `_regionState`
  // locals, providers): their symbols' chunks join the entry's chunk list too.
  const extra: number[] = [];
  const entry: BindingEntry = [node, "#", symbol, refs, signals.map(encoder.ref), [], regionOf(scope.parent), scope.mount];
  // After the region's captures: its item array is in the table by now, and rows can point at it.
  const rows = templated ? compactRows(encoder, templated.rows, templated.items) : adoptable(encoder, scope.rows);
  if (rows) {
    (entry as unknown[]).push(rows);
    if (Array.isArray(rows)) for (let i = 1; i < rows.length; i += 3) extra.push(rows[i]!);
    else extra.push(...(rows.a !== undefined ? [rows.a] : rows.r!));
  }
  if (templated) (entry as unknown[]).push(templated.tpl);
  const adopts = scope.adopts;
  if (adopts) {
    // Branches at [8], or [10] after rows (and template, else 0): one spec, or an array of them (≥ 2 adoptable);
    // `s`: slots skipped before it (Shows rendered plainly).
    const specs: BranchSpec[] = [];
    let next = 0;
    for (const adopt of adopts) {
      const branch: BranchSpec = { w: adopt.id, k: adopt.key };
      if (adopt.slot > next) branch.s = adopt.slot - next;
      next = adopt.slot + 1;
      if (adopt.valued)
        try {
          extra.push((branch.v = encoder.ref(adopt.value)));
        } catch {
          branch.k = null; // unserializable value: never adopted, still disposed with its region
        }
      specs.push(branch);
    }
    if (rows && !templated) (entry as unknown[]).push(0);
    (entry as unknown[]).push(specs.length === 1 ? specs[0]! : specs);
  }
  if (scope.locals) {
    // `_regionState` values at [11] (missing rows / template / branch slots padded with 0); null: not
    // serializable, created afresh by the browser; `n`: nested slot counts.
    const refs = scope.locals.map((value) => {
      try {
        const ref = encoder.ref(value);
        extra.push(ref);
        return ref;
      } catch {
        return null;
      }
    });
    while (entry.length < 11) (entry as unknown[]).push(0);
    const locals: RegionLocals = { l: refs };
    if (scope.nested!.some((n) => n > 0)) locals.n = scope.nested;
    (entry as unknown[]).push(locals);
  }
  if (scope.providers) {
    // Identified providers enclosing the site at [12]: [token id, value ref, …] (unserializable values omitted).
    const providers: (string | number)[] = [];
    for (let i = 0; i < scope.providers.length; i += 2)
      try {
        const ref = encoder.ref(scope.providers[i + 1]);
        providers.push(scope.providers[i] as string, ref);
        extra.push(ref);
      } catch {
        /* not serializable: the re-created content sees the default */
      }
    if (providers.length) {
      while (entry.length < 12) (entry as unknown[]).push(0);
      (entry as unknown[]).push(providers);
    }
  }
  if (rows && scope.rowReads) {
    // Signals the rows' own renders read at [13] (RESUME-KEEP-ROWS): the browser keeps those rows while each still
    // holds its server value. Not encodable: omitted, the rows are re-created with the region.
    try {
      const reads = scope.rowReads.map(encoder.ref);
      extra.push(...reads);
      // Missing slots padded with 0, providers [12] with null (a number there is a shared table list).
      while (entry.length < 12) (entry as unknown[]).push(0);
      if (entry.length === 12) (entry as unknown[]).push(null);
      (entry as unknown[]).push(reads);
    } catch {
      /* re-created */
    }
  }
  entry[5] = needs(symbol, refs.concat(extra));
  return entry;
}
/**
 * Encode what `recorder` recorded (the shell, or one streamed segment) against the render's
 * persistent table: new table entries from `t0`, new chunks, and this recorder's entries.
 * `a`: streamed boundary entries [marker, fallback region, region, status 0 pending | 1 content | 2 continue].
 */
function encodeRecords(root: Recorder, recorder: Recorder, a: AsyncEntry[] = []): Encoded {
  // Modules evaluated during the render (lazy imports) stamped after it started.
  drainRefs();
  if (recorder.late) settleLate(recorder);
  let templatedRows = false;
  const enc = encoding(root);
  const { manifest, encoder, chunks, chunkOf, symbols } = enc;
  // Plain JSON (`j`) entries only in the render's last segment: a later segment could reference an object inside one,
  // and the browser may have decoded (and mutated) that tree by then.
  encoder.json(!root.stream?.segments.some((segment) => !segment.out));
  const t0 = encoder.table.length,
    c0 = chunks.length,
    s: Record<string, number> = {};
  // Nearest recorded region of a scope (-1 = page root).
  const regionOf = (scope: Scope | null | undefined): number => {
    while (scope && scope.id === null) scope = scope.parent;
    return scope ? scope.id! : -1;
  };
  const captures = (id: string, values: Captures): number[] => refsOf(encoder.ref, manifest, id, values);
  // Symbol → chunk index, once per symbol and call (most bindings / handlers share their symbols).
  const known = new Map<string, number>();
  const chunk = (symbol: string): number => {
    const seen = known.get(symbol);
    if (seen !== undefined) return seen;
    const builtins = symbol === BUILTINS,
      url = builtins ? manifest.builtins : manifest.symbols?.[symbol];
    if (url === undefined) {
      // No builtins chunk in the manifest: the app loads the decoders itself (-1: no chunk).
      if (builtins) return -1;
      throw new Error(DEV ? DEV.hint("Resume manifest has no chunk for " + symbol, "manifest") : "Resume manifest has no chunk for " + symbol);
    }
    let index = chunkOf.get(url);
    if (index === undefined) chunkOf.set(url, (index = chunks.push(url) - 1));
    // New page symbols of this segment (wire indexes assigned when it is written, `symbolList`).
    if (!symbols.has(symbol) && !builtins) s[symbol] = index;
    known.set(symbol, index);
    return index;
  };
  // Chunks a symbol needs to run: its own plus every function/computed reachable from its captures (walks memoised
  // per table entry in `reach`: most bindings share captures — contexts, props objects, signals).
  const reach: ReachMemo = [];
  const needs = (symbol: string, refs: number[]): number[] => {
    const out = [chunk(symbol)];
    // Last capture first: the order the one-stack walk visited them in (chunk indexes stay as before).
    for (let r = refs.length - 1; r >= 0; r--) {
      const found = reachOf(encoder.table, refs[r]!, reach);
      if (found === NO_REACH) continue;
      let inner = found.chunks;
      if (inner === undefined) {
        // Chunk indexes once per reach (same `chunk` call order as resolving them per binding).
        const list = found.symbols;
        inner = found.chunks = new Array(list.length);
        for (let k = 0; k < list.length; k++) inner[k] = chunk(list[k]!);
      }
      for (let k = 0; k < inner.length; k++) if (inner[k]! >= 0 && !out.includes(inner[k]!)) out.push(inner[k]!);
    }
    return out;
  };
  const e: Record<string, Record<string, HandlerEntry>> = {},
    m: Record<string, ModelEntry> = {},
    b: BindingEntry[] = [];
  const handlers: PlannedHandler[] = []; // [elementId, type, symbol, refs, entry] for preload planning
  const raw: RawBinding[] = [];
  // Packed template bindings, for preload planning (their signals / chunks: [4] / [5], like `b` entries).
  const planned: TemplateBinding[] = [];
  const templates = rowTemplates(recorder);
  const consumed = new Set<unknown>();
  // One template per uniform list: entries relative to the row id; row item/index captures → -2/-3.
  const templateOf = new Map<object, { tpl: RowTemplate; rows: RowRecord[]; items: number[] }>();
  for (const [list, { site, rows, first, sources }] of templates) {
    const row = rows[0]!;
    let rowItems: number[];
    try {
      rowItems = new Array(rows.length);
      for (let k = 0; k < rows.length; k++) rowItems[k] = encoder.ref(rows[k]!.item);
    } catch {
      expand(recorder, site);
      continue; // unserializable items: no adoption, explicit entries
    }
    const refs = (symbol: string, values: Captures): number[] =>
      values.map((value, i) => {
        if (value === row.get) return -2;
        if (value === row.at) return -3;
        try {
          return encoder.ref(value);
        } catch (error) {
          throw captureError(manifest, symbol, i, error);
        }
      });
    const own = (symbol: string, list: number[]): number[] =>
      needs(
        symbol,
        list.filter((ref) => ref >= 0),
      );
    const tpl: RowTemplate = { e: {}, b: [] };
    for (const item of first) {
      consumed.add(item.source);
      const offset = item.id - row.id;
      if (item.text) {
        const r = refs(item.symbol, item.values);
        tpl.b.push([offset, null, item.symbol, r, item.signals.map(encoder.ref), own(item.symbol, r)]);
        continue;
      }
      for (const [type, symbol, values] of item.handlers) {
        const r = refs(symbol, values);
        const entry: HandlerEntry = ((tpl.e[offset] ??= {})[type] = [symbol, r, own(symbol, r)]);
        // One planned handler for the whole list (its element ids): planning is O(template), not O(rows).
        const ids: number[] = new Array(rows.length);
        for (let k = 0; k < rows.length; k++) ids[k] = rows[k]!.id + offset;
        handlers.push([ids, type, symbol, r, entry, item.source]);
      }
      for (const [name, symbol, values, signals] of item.bindings) {
        const r = refs(symbol, values);
        tpl.b.push([offset, name, symbol, r, signals.map(encoder.ref), own(symbol, r)]);
      }
    }
    for (let k = 1; k < sources.length; k++) for (const source of sources[k]!) consumed.add(source);
    templateOf.set(list, { tpl, rows, items: rowItems });
  }
  for (const element of recorder.elements) {
    if (consumed.has(element)) continue;
    if (element.handlers) {
      const entry: Record<string, HandlerEntry> = (e[element.id!] = {});
      for (const type in element.handlers) {
        const [symbol, values] = element.handlers[type]!;
        const refs = captures(symbol, values);
        entry[type] = [symbol, refs, needs(symbol, refs)];
        handlers.push([element.id!, type, symbol, refs, entry[type]!, element]);
      }
    }
    if (element.model) m[element.id!] = [element.model[0], encoder.ref(element.model[1])];
    if (element.bindings) {
      const region = regionOf(element.region);
      for (const [name, symbol, values, signals] of element.bindings) raw.push([element.id!, name, symbol, values, signals, region]);
    }
  }
  // Text / attribute bindings, repeated runs packed (`packBindings`): attribute ones first, then texts.
  const single = (item: RawBinding): void => {
    const [node, name, symbol, values, signals, region] = item;
    const refs = captures(symbol, values);
    b.push([node, name, symbol, refs, signals.map(encoder.ref), needs(symbol, refs), region]);
  };
  const flush = (): void => {
    packBindings(raw, single, (start, period) => {
      const packed = packRun(encoder.table, raw, start, period, captures, needs, encoder.ref, manifest);
      if (!packed) return 0;
      b.push([-1, "+", "", [], [], [], raw[start]![5], null, packed]);
      for (const entry of packed.b) planned.push(entry);
      return packed.k * period;
    });
    raw.length = 0;
  };
  flush();
  for (const text of recorder.texts) {
    if (consumed.has(text)) continue;
    const [node, symbol, values, signals, scope] = text;
    raw.push([node, null, symbol, values, signals, regionOf(scope)]);
  }
  flush();
  for (const region of recorder.regions) {
    const scope = region[4],
      templated = scope.rows && templateOf.get(scope.rows[0]!.list);
    if (templated) templatedRows = true;
    b.push(regionEntry(encoder, region, templated || undefined, captures, needs, regionOf));
  }
  // Uniform rows of a site that is no region: one inert `*` entry carries their compact rows and
  // template (the loader expands it like a region's; the runtime registers the rows' parent region).
  for (const site of recorder.lists) {
    const templated = templateOf.get(site.rows![0]!.list);
    if (templated) templatedRows = true;
    if (templated)
      b.push([
        -1,
        "*",
        "",
        [],
        [],
        [],
        regionOf(site.parent),
        null,
        compactRows(encoder, templated.rows, templated.items),
        templated.tpl,
      ] as unknown as BindingEntry);
  }
  const L = encodeLazy(encoder, recorder.lazy, regionOf, needs);
  const fx = recorder.effects.map(([symbol, values, when, scope]): EffectEntry => {
    const refs = captures(symbol, values);
    return [symbol, refs, when, needs(symbol, refs), regionOf(scope)];
  });
  const ce = recorder.clientEvents.map(([symbol, values, target, type, options, scope]): ClientEventEntry => {
    const refs = captures(symbol, values);
    const spec = (target as Partial<Cell> | null | undefined)?.[CELL] ? ["r", (target as Cell).id] : target;
    if ((spec as unknown[] | null | undefined)?.[1] === null)
      throw new TypeError("Cannot resume " + symbol + ": clientEvent ref target is not attached to a rendered element");
    return [
      symbol,
      refs,
      spec as ClientEventEntry[2],
      type,
      options && { passive: options.passive, capture: options.capture, once: options.once, when: options.when, match: options.match },
      needs(symbol, refs),
      regionOf(scope),
    ];
  });
  const out = { t0, c: chunks.slice(c0) } as Encoded;
  // Lazy imports per new chunk (manifest.lazy), prefetched on intent after the chunk itself.
  const lazy: Record<string, string[]> = {};
  for (let i = c0; i < chunks.length; i++) if (manifest.lazy?.[chunks[i]!]) lazy[i] = manifest.lazy[chunks[i]!]!;
  if (Object.keys(lazy).length) out.l = lazy;
  const preload = planPreload({
    manifest,
    chunks,
    encoder,
    handlers,
    models: m,
    bindings: planned.length ? [...b, ...(planned as unknown as BindingEntry[])] : b,
    clientEvents: recorder.clientEvents,
    ce,
    reach,
    background: root.options.preload?.background ?? BACKGROUND_DEFAULT,
    preloads: recorder.preloads,
  });
  if (preload.interaction.length) out.x = preload.interaction;
  // Chunk group / route siblings among this page's chunks: an interaction that loads one prefetches the rest.
  const siblings = (manifest.groups ?? [])
    .map((urls) => urls.map((url) => chunks.indexOf(url)).filter((i) => i >= 0 && !preload.interaction.includes(i)))
    .filter((group) => group.length > 1);
  if (siblings.length) out.g = siblings;
  out.s = wireSymbols(encoder, t0, s, enc.symbols, chunk, e, b, fx, ce);
  // Repeated entries (collections: rows / cells record the same recipes, objects, handlers and bindings per element) as
  // wire repeats (table `{R}`, `RepeatedHandlers` / `RepeatedBinding`), when together they save more than the repeat
  // add-on costs (nothing once the page shipped it); else the table again without `{R}`.
  const cost = root.repeatAddon ? 0 : REPEAT.length;
  const { t, relocations, saved: tableSaved } = compactTable(encoder.table, t0, enc.symbols, true);
  Object.assign(out, { t, e, m, b, fx, ce });
  const repeated = repeatEntries(e, b, cost - tableSaved);
  // (Wire forms typed as the decoded entries the browser reads.)
  if (repeated) ((out.e = repeated[0] as typeof e), (out.b = repeated[1] as typeof b), (out.rr = true));
  else if (relocations && tableSaved > cost) out.rr = true;
  else if (relocations) out.t = compactTable(encoder.table, t0, enc.symbols, false).t;
  // DOM-DATA: runs of DOM-backed rows (one shape, evenly spaced anchors) as one `Dr` entry + placeholders.
  if (root.dom !== null) root.dom.runs(out.t!, encoder.table);
  // DOM-DATA builds: compact rows' item refs as runs (`rs`; their expand add-on `EXPAND_DOM` reads them back).
  if (DOM_DATA && root.dom !== null) root.dom.strided(out.b!);
  if (DEV) assertAcyclic(encoder.table, t0);
  // Dev: per capture site, the bytes it adds to the state (warned once the state bytes are known, `DEV.stateBytes`).
  if (DEV) DEV.stateCaptures(root, DEV.stateSites(encoder.table, symbols, manifest.captures, t0, out.t!, e, m, b, fx, ce));
  for (const segment of recorder.asyncs) a.push([segment.A, segment.F, segment.M.id!, 0]);
  for (const [content, site] of recorder.links) if (site.id !== null) a.push([site.id, content.id!, site.id, 3]);
  if (a.length) out.a = a;
  if (recorder.paths.length) out.w = recorder.paths;
  if (L.length) out.L = L;
  if (templatedRows) out.rx = true;
  // Listeners that load on interaction (`preload: "intent" | "interaction"`) don't boot the page: the runtime
  // attaches them whenever it starts. Document / window `click` ones (a router's link interception) start it
  // from the loader on a cold root-relative link click (`n`: their chunks; the click is held and replayed).
  const late = (n: number): boolean => lateEvent(recorder.clientEvents[n]!);
  const nav = ce.flatMap((entry, n) => (late(n) && entry[3] === "click" && !Array.isArray(entry[2]) ? entry[5] : []));
  if (nav.length) ((out.n = [...new Set(nav)]), recorder.events.add("click"));
  out.events = [...recorder.events].filter((type) => !enc.events.has(type));
  for (const type of out.events) enc.events.add(type);
  // Lean pages (`preload.lean`): no schedule, so the loader prefetches on intent only (its Save-Data mode).
  out.schedule = root.options.preload?.lean ? [] : preload.schedule;
  if (preload.late) out.late = preload.late;
  out.boot = bootsAtLoad(recorder, fx.length);
  return out;
}

/** A client event that loads on intent / interaction (`preload: "intent" | "interaction"`): it does not boot the page. */
const lateEvent = (entry: ClientEventRecord): boolean => /^int/.test(entry[4]?.preload ?? "");
/** The state boots the runtime at load (`data-boot`): client effects, eager client events or regions that mount. */
const bootsAtLoad = (recorder: Recorder, effects: number): boolean =>
  effects > 0 ||
  recorder.lazy.some((lazy) => lazy.effects !== null) ||
  recorder.clientEvents.some((entry) => !lateEvent(entry)) ||
  recorder.regions.some(([, , , , scope]) => scope.mount !== null);

// A text / attribute binding before encoding: [node, name, symbol, captures, signals, enclosing region].
type RawBinding = [node: number, name: string | null, symbol: string, values: Captures, signals: Signal<unknown>[], region: number];
// Repeated runs: `period` consecutive bindings (one component instance's) recur ≥ PACK_ROWS times at the same node
// offsets with the same name / symbol / signals / region, e.g. `xs.map((x) => <Badge …/>)`. Periods up to PACK_PERIOD.
const PACK_ROWS = 3,
  PACK_PERIOD = 8;
const sameShape = (x: RawBinding, y: RawBinding): boolean => {
  if (x[2] !== y[2] || x[1] !== y[1] || x[3].length !== y[3].length) return false;
  const a = x[4],
    b = y[4];
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
// Whether row `k` of the run at `start` has row 0's shape at the same node offsets, in row 0's region — or, when row 1's
// region differs (`relative`), in a region shifted by the row's node offset: For rows that are no region site of their
// own (hidden select options) each sit in their row's region (row id = first node − 1). Relative runs keep one region
// per row (every binding of row 0 in row 0's region): the packed entry holds one region and `g`.
const relative = (raw: RawBinding[], start: number, period: number): boolean => raw[start + period]![5] !== raw[start]![5];
const sameRow = (raw: RawBinding[], start: number, period: number, k: number): boolean => {
  const base = start + k * period,
    origin = raw[base]![0] - raw[start]![0],
    shift = relative(raw, start, period) ? origin : 0;
  if (shift === 0 && raw[base]![5] !== raw[start]![5]) return false;
  for (let j = 0; j < period; j++) {
    const x = raw[start + j]!,
      y = raw[base + j]!;
    if (!sameShape(x, y) || y[0] - x[0] !== origin || y[5] - x[5] !== shift || (shift !== 0 && x[5] !== raw[start]![5])) return false;
  }
  return true;
};
/**
 * Walk `raw` in order: a repeated run (the smallest period whose first PACK_ROWS rows match and `pack` accepts) goes
 * to `pack`, which returns how many bindings it packed (0: none); every other binding goes to `single`. Linear: a
 * failed attempt stops at its first mismatching row (< PACK_ROWS rows).
 */
function packBindings(raw: RawBinding[], single: (item: RawBinding) => void, pack: (start: number, period: number) => number): void {
  const length = raw.length;
  for (let s = 0; s < length;) {
    let packed = 0;
    for (let p = 1; p <= PACK_PERIOD && s + p * PACK_ROWS <= length && !packed; p++) if (sameRow(raw, s, p, 1) && sameRow(raw, s, p, 2)) packed = pack(s, p);
    if (packed) s += packed;
    else single(raw[s++]!);
  }
}
/**
 * Encode the repeated run at `start` as `PackedBindings`, extended row by row while rows keep row 0's shape and their
 * captures reach the same symbols as row 0's (same chunk lists); null below PACK_ROWS rows. Captures equal in every
 * row stay in the template, the others become per-row slots (one slot per distinct row-0 value when every row agrees).
 */
function packRun(
  table: readonly TableEntry[],
  raw: RawBinding[],
  start: number,
  period: number,
  captures: (id: string, values: Captures) => number[],
  needs: (symbol: string, refs: number[]) => number[],
  ref: (value: unknown) => number,
  manifest: Pick<ResumeManifest, "captures"> | undefined,
): PackedBindings | null {
  const encode = (item: RawBinding, p: number): number => {
    try {
      return ref(item[3][p]);
    } catch (error) {
      throw captureError(manifest, item[2], p, error);
    }
  };
  let rows = 1;
  rows: for (; start + (rows + 1) * period <= raw.length && sameRow(raw, start, period, rows); rows++)
    for (let j = 0; j < period; j++) {
      const first = raw[start + j]!,
        item = raw[start + rows * period + j]!;
      for (let p = 0; p < first[3].length; p++) if (item[3][p] !== first[3][p] && !sameReach(table, encode(first, p), encode(item, p), 0)) break rows;
    }
  if (rows < PACK_ROWS) return null;
  // Varying positions (entry j, capture p) in row-0 order, and the slot each one reads.
  const positions: number[] = [],
    slotOf: number[] = [];
  for (let j = 0; j < period; j++) {
    const values = raw[start + j]![3];
    for (let p = 0; p < values.length; p++) {
      let k = 1;
      while (k < rows && raw[start + k * period + j]![3][p] === values[p]) k++;
      if (k < rows) positions.push(j, p);
    }
  }
  // Slot sharing: a varying position holding the same row-0 value as an earlier one reads its slot, if every row agrees.
  let slots = 0;
  for (let v = 0; v < positions.length; v += 2) {
    const value = raw[start + positions[v]!]![3][positions[v + 1]!];
    let slot = -1;
    for (let w = 0; w < v && slot < 0; w += 2) if (raw[start + positions[w]!]![3][positions[w + 1]!] === value) slot = slotOf[w >> 1]!;
    slotOf.push(slot < 0 ? slots++ : slot);
  }
  check: for (let k = 1; k < rows && slots < positions.length >> 1; k++)
    for (let v = 0; v < positions.length; v += 2)
      for (let w = 0; w < v; w += 2)
        if (
          slotOf[v >> 1] === slotOf[w >> 1] &&
          raw[start + k * period + positions[v]!]![3][positions[v + 1]!] !== raw[start + k * period + positions[w]!]![3][positions[w + 1]!]
        ) {
          for (let x = 0; x < slotOf.length; x++) slotOf[x] = x;
          slots = slotOf.length;
          break check;
        }
  // Row slot refs (position of each slot's first use), then template entries: row 0's refs, varying ones → -1 - slot.
  const at: number[] = new Array(slots),
    r: number[] = new Array(rows * slots);
  for (let v = slotOf.length - 1; v >= 0; v--) at[slotOf[v]!] = v * 2;
  for (let k = 0; k < rows; k++)
    for (let slot = 0; slot < slots; slot++) r[k * slots + slot] = encode(raw[start + k * period + positions[at[slot]!]!]!, positions[at[slot]! + 1]!);
  const base = raw[start]![0],
    b: TemplateBinding[] = new Array(period);
  for (let j = 0, v = 0; j < period; j++) {
    const [node, name, symbol, values, signals] = raw[start + j]!;
    const refs = captures(symbol, values);
    for (let p = 0; p < refs.length; p++)
      if (v < positions.length && positions[v] === j && positions[v + 1] === p) {
        refs[p] = -1 - slotOf[v >> 1]!;
        v += 2;
      }
    // Chunks from row 0's captures (every row reaches the same symbols, checked above).
    b[j] = [node - base, name, symbol, refs, signals.map(ref), needs(symbol, captures(symbol, values))];
  }
  const packed = { k: rows, n: slots, r, b } as PackedBindings;
  if (relative(raw, start, period)) packed.g = 1;
  const stride = raw[start + period]![0] - base;
  let even = true;
  for (let k = 2; k < rows && even; k++) even = raw[start + k * period]![0] === base + k * stride;
  if (even) ((packed.i = base), (packed.d = stride));
  else {
    packed.ids = new Array(rows);
    for (let k = 0; k < rows; k++) packed.ids[k] = raw[start + k * period]![0];
  }
  return packed;
}
// Whether two table refs reach the same symbols, structurally (conservative: false when unsure — the rows stay single):
// a component's props recipe per instance has one symbol and captures differing in literals.
function sameReach(table: readonly TableEntry[], x: number, y: number, depth: number): boolean {
  if (x === y) return true;
  const a = table[x],
    b = table[y];
  const objectA = a !== null && typeof a === "object",
    objectB = b !== null && typeof b === "object";
  if (!objectA || !objectB) return !objectA && !objectB ? true : reachesNone(table, objectA ? x : y, depth);
  if (depth > 3) return false;
  if (Array.isArray(a) || Array.isArray(b) || !("f" in a || "c" in a || "s" in a)) return reachesNone(table, x, depth) && reachesNone(table, y, depth);
  const p = a as EntryRecord,
    q = b as EntryRecord;
  if (p.q !== q.q) return false;
  if ("s" in p) return "s" in q && sameReach(table, p.s!, q.s!, depth + 1);
  if ((p.f ?? p.c) === undefined || (q.f ?? q.c) === undefined || !p.a || !q.a || p.a.length !== q.a.length || symbolOf(p) !== symbolOf(q)) return false;
  for (let i = 0; i < p.a.length; i++) if (!sameReach(table, p.a[i]!, q.a[i]!, depth + 1)) return false;
  return true;
}

// Whether a table ref reaches no symbol (plain data: literals, arrays / objects / maps / sets of them, signals holding
// them); false when unsure (deeper than 4 levels, functions, computeds, custom entries).
function reachesNone(table: readonly TableEntry[], index: number, depth: number): boolean {
  const entry = table[index];
  if (entry === null || typeof entry !== "object") return true;
  if (depth > 3) return false;
  if (Array.isArray(entry)) {
    for (let i = 0; i < entry.length; i++) if (entry[i] !== -1 && !reachesNone(table, entry[i]!, depth + 1)) return false;
    return true;
  }
  // Built-in entries reach their decoders' chunk (`BUILTINS`).
  if (entry.t || entry.U !== undefined || entry.b || entry.E) return false;
  const refs = entry.o
    ? entry.o.filter((_, i) => i % 2)
    : entry.p
      ? entry.p.filter((v, i) => i % 2 && Array.isArray(v)).map((v) => (v as [number])[0])
      : (entry.m ?? entry.e);
  if (refs) {
    for (let i = 0; i < refs.length; i++) if (!reachesNone(table, refs[i] as number, depth + 1)) return false;
    return true;
  }
  if ("s" in entry) return entry.q === undefined && reachesNone(table, entry.s!, depth + 1);
  if (entry.i) return reachesNone(table, entry.i[0], depth + 1);
  return !(entry.a || entry.k || entry.c !== undefined || entry.f !== undefined || entry.x !== undefined);
}

// Dev only: a signal / computed / function entry whose captures reach itself fails in the browser's
// decoder ("Cyclic reference"); name the symbol here instead. A `let` cell breaks every cycle (the decoder fills a cell reached
// inside a decoding entry once the outermost one is done; a class instance `{cls}` its fields likewise), so only cycles without one are named.
function assertAcyclic(table: readonly TableEntry[], from: number): void {
  for (let index = from; index < table.length; index++) {
    const entry = table[index] as { s?: number; c?: string | number; f?: string | number; k?: unknown; a?: number[] } | null;
    if (!entry || typeof entry !== "object" || (!("s" in entry) && entry.a === undefined) || twoPhase(entry)) continue;
    const stack = "s" in entry ? [entry.s!] : entry.a!.slice(),
      seen = new Set<number>();
    while (stack.length) {
      const ref = stack.pop()!;
      if (ref === index)
        throw new TypeError(
          "Resume entry " +
            ("s" in entry ? "signal" : symbolOf(entry as EntryRecord)) +
            " captures itself: a cyclic reference through a reactive or function entry",
        );
      if (ref < 0 || seen.has(ref)) continue;
      seen.add(ref);
      const inner = table[ref] as TableEntry;
      if (inner === null || typeof inner !== "object") continue;
      if (Array.isArray(inner)) stack.push(...inner);
      else if (inner.o) for (let i = 1; i < inner.o.length; i += 2) stack.push(inner.o[i] as number);
      else if (inner.p) for (let i = 1; i < inner.p.length; i += 2) Array.isArray(inner.p[i]) && stack.push((inner.p[i] as [number])[0]);
      else if (inner.m) stack.push(...inner.m);
      else if (inner.e) stack.push(...inner.e);
      else if (inner.E) inner.E.length > 2 && stack.push(inner.E[2] as number);
      else if ("s" in inner) stack.push(inner.s!);
      else if (inner.a && !twoPhase(inner)) stack.push(...inner.a);
    }
  }
}
// A two-phase entry (memoized before its value / fields decode, so cycles through it decode): a `{k:"cell"}` entry
// (server table or wire compact form `k: ["cell", value]`) or a class instance `{cls}` (T23).
const twoPhase = (entry: { k?: unknown; cls?: unknown }): boolean => (Array.isArray(entry.k) ? entry.k[0] : entry.k) === "cell" || entry.cls !== undefined;

// The page tail after the dynamic state script: hoisted frozen fragments around nonce attribute slots,
// so byte writers encode the ~6 KB loader (and stream add-on) once per process, not per response.
const tail = (loader: string, stream: boolean): readonly string[] =>
  Object.freeze(
    stream ? ["", "</script><script", ">" + loader + "</script><script", ">" + STREAM + "</script>"] : ["", "</script><script", ">" + loader + "</script>"],
  );
const TAILS = [tail(LOADER, false), tail(LOADER_KEYS, false), tail(LOADER, true), tail(LOADER_KEYS, true)] as const;
const ROWS_SCRIPT = Object.freeze(["<script", ">" + ROWS + "</script>"]);
const LAZY_SCRIPT = Object.freeze(["<script", ">" + LAZY + "</script>"]);
// DOM-DATA builds: the expand add-on with the strided item refs part (`rs`, `EXPAND_DOM`).
const EXPAND_SCRIPT = Object.freeze(["<script", ">" + (DOM_DATA ? EXPAND_DOM : EXPAND) + "</script>"]);
const REPEAT_SCRIPT = Object.freeze(["<script", ">" + REPEAT + "</script>"]);

// `JSON.stringify(state)`, byte for byte, ~1.6× faster: V8's fast serializer bails out to its slow
// path for a whole call once it meets an object with integer keys, and the element-id maps (`e`, `m`,
// `l`) have nothing else. Those maps are written here (same ascending key order), the rest natively.
// Keys are the state's own field names and decimal ids, so they need no escaping.
const KEYED = new Set(["e", "m", "l"]);
function idMap(value: object): string {
  let out = "{";
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i++) {
    const json = JSON.stringify((value as Record<string, unknown>)[keys[i]!]);
    if (json !== undefined) out += (out.length > 1 ? ',"' : '"') + keys[i] + '":' + json;
  }
  return out + "}";
}
// Wire table (`t` from `t0`): a `c` / `f` / `k` entry equal to an earlier one of the same symbol / kind (from `t0`)
// with its references past that one moved by the distance becomes `{y: base}` (resume-format `repeated`): the
// recipes of repeated component instances (`{f, a: [signal, own value]}` per instance) shrink to a constant.
// Bases: the first and the latest full entry per symbol.
// Only the encoder's own shapes repeat: `{f|c, a, q?}`, `{k, a}` (a / c / f / k / q own keys only; `Object.keys`, not
// `for…in`, over the table's many entry shapes).
const plain = (entry: EntryRecord): boolean => {
  const names = Object.keys(entry);
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    if (name !== "a" && name !== "f" && name !== "c" && name !== "q" && name !== "k" && name !== "v") return false;
  }
  return true;
};
/** `compactTable`'s result: the wire table, its `{R}` entries and the bytes they saved (estimated). */
interface CompactTable {
  t: TableEntry[];
  relocations: number;
  saved: number;
}
function compactTable(table: readonly TableEntry[], t0: number, symbols: Map<string, number>, relocate: boolean): CompactTable {
  let relocations = 0,
    saved = 0;
  const out = table.slice(t0),
    // Symbol (page index; computeds -1 - index) / kind → [first, latest] full entry index.
    bases = new Map<string | number, number[]>(),
    // Object key list → the first `o` / `p` entry with it (`shape`).
    shapes = new Map<string, number>(),
    // Recipe key (as `bases`) / `o` key list → the latest entry with it, any wire form (`R` relocation bases).
    latest = new Map<string | number, number>(),
    // Captures / comparator of each recipe entry (from t0), read once: `repeats` compares these arrays instead of the
    // entries themselves (dozens of entry shapes made its property loads deopt-loop in Maglev: ~640 recompiles / 700
    // renders).
    args: (number[] | undefined)[] = new Array(table.length - t0),
    equals: unknown[] = new Array(table.length - t0);
  for (let i = t0; i < table.length; i++) {
    const entry = table[i] as EntryRecord;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
    if (entry.a === undefined) {
      const pairs = entry.o ?? entry.p;
      if (pairs === undefined || pairs.length <= 2) continue;
      const key = shape(out, shapes, pairs, entry.o !== undefined, i, t0);
      if (key === undefined || entry.o === undefined || Object.keys(entry).length !== 1) continue;
      // A props / state object of the latest one's keys with relocated value refs: `R` when not longer than its wire form.
      const from = latest.get("o" + key);
      latest.set("o" + key, i);
      if (from === undefined || !relocate) continue;
      const source = (table[from] as EntryRecord).o!;
      let ok = true;
      relocationStart();
      for (let k = 1; k < pairs.length && ok; k += 2) ok = relocate1(source[k] as number, (pairs[k] as number) - (source[k] as number));
      if (!ok) continue;
      const R = relocationOf(from, i),
        wire = out[i - t0] as EntryRecord;
      let size = 0;
      if (wire.w !== undefined) size = 12 + digits(wire.w) + listLength(wire.o as number[]);
      else for (let k = 0; k < pairs.length; k += 2) size += (pairs[k] as string).length + 4 + digits(pairs[k + 1] as number);
      if (8 + listLength(R) <= size) ((out[i - t0] = { R }), relocations++, (saved += size - 8 - listLength(R)));
      continue;
    }
    // A class instance (T23): its class by page symbol index (a registered id, T25, stays a string); never compact / repeated (one field object each).
    if (entry.cls !== undefined) {
      const index = typeof entry.cls === "string" ? symbols.get(entry.cls) : undefined;
      if (index !== undefined) out[i - t0] = { ...entry, cls: index };
      continue;
    }
    // Server table entries hold symbol ids / kinds (the compact wire form is written here).
    const id = (entry.f ?? entry.c) as string | number | undefined,
      kind = entry.k as string | undefined;
    // The wire names a symbol by its page index (one without an index stays an id: the browser reports it).
    const index = id === undefined ? undefined : typeof id === "string" ? symbols.get(id) : id;
    const key = id === undefined ? kind : index === undefined ? (entry.f !== undefined ? "f" : "c") + id : entry.f !== undefined ? index : -1 - index;
    if (key === undefined) continue;
    const candidates = bases.get(key),
      simple = plain(entry);
    args[i - t0] = entry.a;
    equals[i - t0] = entry.q;
    if (candidates === undefined) {
      if (simple) bases.set(key, [i]);
    } else {
      const base = simple
        ? repeats(args, equals, t0, candidates[0]!, i)
          ? candidates[0]!
          : candidates.length > 1 && repeats(args, equals, t0, candidates[1]!, i)
            ? candidates[1]!
            : -1
        : -1;
      if (base >= 0) {
        out[i - t0] = { y: base };
        latest.set(key, i);
        continue;
      }
      // The latest entry of the key (any wire form) with relocated captures: `R` when not longer than the compact form.
      // Never a `y` base (`repeated` reads its base's wire entry in full): `candidates` keep full entries only.
      const from = simple && relocate ? latest.get(key) : undefined;
      if (from !== undefined) {
        const source = args[from - t0]!,
          q = equals[from - t0];
        relocationStart();
        let ok = source.length === entry.a.length && (typeof q === "number" ? typeof entry.q === "number" : q === entry.q) && relocation(source, entry.a);
        if (ok && typeof q === "number") ok = relocate1(q, (entry.q as number) - q);
        if (ok) {
          const R = relocationOf(from, i),
            head = id === undefined ? kind! : (index ?? id),
            size =
              (typeof head === "string" ? head.length + 2 : digits(head)) +
              listLength(entry.a) +
              (typeof entry.q === "number" ? 5 + digits(entry.q) : entry.q === false ? 9 : 0) +
              (entry.v !== undefined ? 6 : 0);
          if (listLength(R) - 1 <= size) {
            out[i - t0] = { R };
            relocations++;
            saved += size + 1 - listLength(R);
            latest.set(key, i);
            continue;
          }
        }
      }
      if (simple) candidates[1] = i;
    }
    if (simple) latest.set(key, i);
    if (simple) {
      // Compact wire form: `{f | c | k: [symbol index | kind, ...captures], q?}` (resume-format `full`).
      const head = id === undefined ? kind! : (index ?? id);
      const list: (string | number)[] = new Array(entry.a.length + 1);
      list[0] = head;
      for (let k = 0; k < entry.a.length; k++) list[k + 1] = entry.a[k]!;
      const copy: EntryRecord = entry.f !== undefined ? { f: list as never } : entry.c !== undefined ? { c: list as never } : { k: list as never };
      if (entry.q !== undefined) copy.q = entry.q;
      if (entry.v !== undefined) copy.v = entry.v;
      out[i - t0] = copy;
    } else if (index !== undefined) {
      const copy = { ...entry };
      if (entry.f !== undefined) copy.f = index;
      else copy.c = index;
      out[i - t0] = copy;
    }
  }
  return { t: out, relocations, saved };
}

/**
 * Wire symbols (IMPL-STATE-SIZE 2026-10-09): the segment's new symbols (`fresh`: id → chunk, first-seen order, plus
 * symbols only the table names) get the next page indexes, grouped by module (`symbolList`), and every handler /
 * binding / effect / clientEvent entry (row templates and packed bindings included) names its symbol by index. Spread
 * binding names (`...names`, one per instance) become refs to table strings (deduplicated). Runs after preload planning
 * (it reads the entries' chunk lists, not their symbols); returns the wire `s`.
 */
/**
 * Region provider lists [12] written once: a list that a captured computed's provider capture already holds (same
 * token / value refs: the table array entry `withProviders` made), or that two regions of this segment share, becomes
 * that table array's index (`[token ref, value ref, …]`, the same wire numbers); other lists stay inline. Regions under
 * one cdk `Provider values` (Select: its SelectValue and Popover regions + the popover's exit computed) repeated
 * 26-number lists per region.
 */
function shareProviders(table: TableEntry[], b: BindingEntry[]): void {
  let count: Map<string, number> | undefined;
  const lengths = new Set<number>(),
    firsts = new Set<unknown>();
  for (const entry of b) {
    const providers = entry[12];
    if (!Array.isArray(providers)) continue;
    const key = providers.join();
    (count ??= new Map()).set(key, (count.get(key) ?? 0) + 1);
    lengths.add(providers.length);
    firsts.add(providers[0]);
  }
  if (!count) return;
  // Table arrays of a provider list's length and first token only (the join is the cost): the first one per content wins.
  const arrays = new Map<string, number>();
  for (let i = 0; i < table.length; i++) {
    const entry = table[i];
    if (!Array.isArray(entry) || !lengths.has(entry.length) || !firsts.has(entry[0])) continue;
    const key = entry.join();
    if (count.has(key) && !arrays.has(key)) arrays.set(key, i);
  }
  for (const entry of b) {
    const providers = entry[12];
    if (!Array.isArray(providers)) continue;
    const key = providers.join();
    let at = arrays.get(key);
    if (at === undefined && count.get(key)! > 1) arrays.set(key, (at = table.push(providers as number[]) - 1));
    if (at !== undefined) entry[12] = at;
  }
}
function wireSymbols(
  encoder: ReturnType<typeof createEncoder>,
  t0: number,
  fresh: Record<string, number>,
  symbols: Map<string, number>,
  chunk: (symbol: string) => number,
  e: Record<string, Record<string, HandlerEntry>>,
  b: BindingEntry[],
  fx: EffectEntry[],
  ce: ClientEventEntry[],
): SymbolList {
  for (let i = 0; i < b.length; i++) {
    const entry = b[i]!;
    spreadName(encoder, entry, 1);
    if (entry[1] === "+") for (const item of (entry[8] as PackedBindings).b) spreadName(encoder, item, 1);
    const tpl = entry[9];
    if (tpl) for (const item of tpl.b) spreadName(encoder, item, 1);
    // Region providers [12]: token ids (repeated by every region under them) as table strings too.
    const providers = entry[12];
    if (Array.isArray(providers)) for (let k = 0; k < providers.length; k += 2) providers[k] = encoder.ref(providers[k]);
  }
  shareProviders(encoder.table, b);
  const table = encoder.table;
  for (let i = t0; i < table.length; i++) {
    const entry = table[i] as EntryRecord | null;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry) || entry.a === undefined) continue;
    const id = entry.f ?? entry.c ?? entry.cls;
    if (typeof id === "string" && !symbols.has(id) && !(id in fresh) && !(entry.cls !== undefined && _registeredId(id)))
      try {
        chunk(id);
      } catch {
        /* not in the manifest: stays an id (the browser reports it when decoded) */
      }
  }
  const list = symbolList(fresh, symbols);
  for (const id in e) {
    const handlers = e[id]!;
    for (const type in handlers) wireSymbol(symbols, handlers[type]!, 0);
  }
  for (let i = 0; i < b.length; i++) {
    const entry = b[i]!;
    wireSymbol(symbols, entry, 2);
    if (entry[1] === "+") for (const item of (entry[8] as PackedBindings).b) wireSymbol(symbols, item, 2);
    const tpl = entry[9];
    if (tpl) {
      for (const item of tpl.b) wireSymbol(symbols, item, 2);
      for (const offset in tpl.e) {
        const handlers = tpl.e[offset]!;
        for (const type in handlers) wireSymbol(symbols, handlers[type]!, 0);
      }
    }
  }
  for (let i = 0; i < fx.length; i++) wireSymbol(symbols, fx[i]!, 0);
  for (let i = 0; i < ce.length; i++) wireSymbol(symbols, ce[i]!, 0);
  return list;
}
const wireSymbol = (symbols: Map<string, number>, entry: unknown[], at: number): void => {
  const id = entry[at];
  if (typeof id === "string") {
    const index = symbols.get(id);
    if (index !== undefined) entry[at] = index;
  }
};
// `...names` (a spread binding) → the table string's ref.
const spreadName = (encoder: ReturnType<typeof createEncoder>, entry: unknown[], at: number): void => {
  const name = entry[at];
  if (typeof name === "string" && name.charCodeAt(0) === 46) entry[at] = encoder.ref(name);
};
/**
 * Index the new symbols (`fresh`, first-seen order) grouped by module, then by component (stable), and write them as
 * the wire list: a number switches the chunk of the ids after it; an id is written whole, as `#Local` after an id of
 * the same module, and the following ids of the same module, component and chunk as one `$suffix$suffix…` run
 * (`Local` = `Component$suffix`; C1C2-SLIM: one string per run instead of one per id). Each list starts afresh (a
 * chunk, then a whole id), so a streamed patch decodes on its own.
 */
function symbolList(fresh: Record<string, number>, symbols: Map<string, number>): SymbolList {
  const groups = new Map<string, Map<string | null, SymbolParts[]>>();
  for (const id in fresh) {
    const parts = partsOf(id);
    let group = groups.get(parts[0]);
    if (!group) groups.set(parts[0], (group = new Map()));
    const own = group.get(parts[2]);
    if (own) own.push(parts);
    else group.set(parts[2], [parts]);
  }
  const out: SymbolList = [];
  let chunk = -1,
    module: string | null = null,
    component: string | null = null;
  for (const [name, components] of groups)
    for (const list of components.values())
      for (const [, id, own, local, suffix] of list) {
        symbols.set(id, symbols.size);
        const at = fresh[id]!;
        if (at !== chunk) out.push((chunk = at));
        if (local === null || name !== module) out.push(id);
        else if (own === null || own !== component) out.push(local);
        else {
          const last = out.length - 1,
            run = out[last];
          // Extend the run only after a run (`$…`): a whole id / `#Local` before it keeps its own string.
          if (typeof run === "string" && run.charCodeAt(0) === 36) out[last] = run + suffix!;
          else out.push(suffix!);
        }
        module = local === null ? null : name;
        component = own;
      }
  return out;
}
// A symbol id's wire pieces: [module, id, component (null: no `$`), `#Local` (null: no `#`), `$suffix`]. Ids are the
// app's (bounded by its manifest): cached for the process.
type SymbolParts = [module: string, id: string, own: string | null, local: string | null, suffix: string | null];
const PARTS = new Map<string, SymbolParts>();
function partsOf(id: string): SymbolParts {
  let parts = PARTS.get(id);
  if (parts === undefined) {
    const hash = id.indexOf("#"),
      local = hash > 0 ? id.slice(hash + 1) : null,
      dollar = local === null ? -1 : local.lastIndexOf("$"),
      own = dollar > 0 ? local!.slice(0, dollar) : null;
    parts = [hash > 0 ? id.slice(0, hash) : "", id, own, local === null ? null : "#" + local, own === null ? null : local!.slice(dollar)];
    if (PARTS.size < 65536) PARTS.set(id, parts);
  }
  return parts;
}
// Object shapes (wire only): an `o` / `p` entry whose key list equals an earlier one's in the segment is written as
// `{w: base, o | p: values}` (the base's keys, in order; resume-format `EntryRecord.w`). Key lists of ≥ 2 keys whose
// keys outweigh the base ref. Returns the key list's key, undefined when the entry became a shape base (written in full:
// later `w` entries read its keys).
function shape(out: TableEntry[], shapes: Map<string, number>, pairs: readonly unknown[], refs: boolean, i: number, t0: number): string | undefined {
  let key = "",
    bytes = 0;
  for (let k = 0; k < pairs.length; k += 2) {
    const name = pairs[k] as string;
    key += name.length + ":" + name;
    bytes += name.length + 3;
  }
  if (bytes < 12) return key;
  const base = shapes.get(key);
  if (base === undefined) {
    shapes.set(key, i);
    return undefined;
  }
  const values: unknown[] = new Array(pairs.length >> 1);
  for (let k = 1; k < pairs.length; k += 2) values[k >> 1] = pairs[k];
  out[i - t0] = refs ? { w: base, o: values as number[] } : { w: base, p: values as (Literal | [number])[] };
  return key;
}
// JSON length of an integer (wire size estimates).
const digits = (n: number): number =>
  n < 0 ? 1 + digits(-n) : n < 10 ? 1 : n < 100 ? 2 : n < 1e3 ? 3 : n < 1e4 ? 4 : n < 1e5 ? 5 : n < 1e6 ? 6 : String(n).length;
// JSON length of a list of integers' elements and commas.
const listLength = (list: readonly number[]): number => {
  let n = list.length;
  for (let k = 0; k < list.length; k++) n += digits(list[k]!);
  return n;
};
// Relocation (`R`, resume-format `EntryRecord.R`) of the entry at `index` from `base`: the scratch (`relocation`) as
// `[back, floor - index, delta, …]`, or undefined.
function relocationOf(base: number, index: number): number[] {
  const R = [index - base];
  relocationMap(R);
  for (let k = 1; k < R.length; k += 2) R[k]! -= index;
  return R;
}
// Whether the plain recipe at `index` repeats the one at `base` (same symbol / kind: the `bases` key) with its references
// past `base` moved by the distance.
function repeats(args: readonly (number[] | undefined)[], equals: readonly unknown[], t0: number, base: number, index: number): boolean {
  const ba = args[base - t0]!,
    ea = args[index - t0]!,
    bq = equals[base - t0],
    eq = equals[index - t0],
    by = index - base;
  if (ba.length !== ea.length) return false;
  for (let k = 0; k < ba.length; k++) if (ea[k] !== (ba[k]! > base ? ba[k]! + by : ba[k])) return false;
  return typeof bq === "number" ? eq === (bq > base ? bq + by : bq) : eq === bq;
}

// ---- Repeated entries (wire only; decoded by the repeat add-on `resume-repeat.ts`, resume-format `RepeatedHandlers` /
// `RepeatedBinding`) ----
// Collections record the same handler map / binding per element (a table's rows and cells, list items), differing only
// in their captures: an element's handlers equal to a recent element's of the same shape (types in order, symbols, capture
// counts, chunk lists) are written `[back, floor, delta, …]`, a plain binding (no region data) equal to a recent one of
// its shape (name, symbol, ref / signal counts, chunks) `[-1 - back, node delta, region delta (when not the node's), floor,
// delta, …]`: the source's refs relocated by a piecewise map (a ref takes the delta of the last floor ≤ it; below the first
// floor it stays). Only within a segment's own entries; the source is the most recent match (candidates per first symbol,
// newest first), so a row repeats the previous row (small, regular maps). Shapes compare structurally (no key strings: the
// encode stays allocation-light). Estimated JSON bytes (6 per ref, 2 per chunk index) decide each repeat and whether the
// page writes any.

// The relocation being built: source refs ascending with their deltas (module level: no per-render allocation).
const RELOC_FROM: number[] = [],
  RELOC_DELTA: number[] = [];
let relocSize = 0;
/** Add `from → from + delta`; false when `from` already maps to another delta (the attempt is dropped: the next one
 * starts with `relocationStart`). */
function relocate1(from: number, delta: number): boolean {
  let k = relocSize;
  while (k > 0 && RELOC_FROM[k - 1]! > from) k--;
  if (k > 0 && RELOC_FROM[k - 1] === from) return RELOC_DELTA[k - 1] === delta;
  for (let j = relocSize; j > k; j--) ((RELOC_FROM[j] = RELOC_FROM[j - 1]!), (RELOC_DELTA[j] = RELOC_DELTA[j - 1]!));
  RELOC_FROM[k] = from;
  RELOC_DELTA[k] = delta;
  relocSize++;
  return true;
}
/** Add `from[i] → to[i]` (same length) to the relocation being built; false on a conflict. */
function relocation(from: readonly number[], to: readonly number[]): boolean {
  for (let i = 0; i < from.length; i++) if (!relocate1(from[i]!, to[i]! - from[i]!)) return false;
  return true;
}
/** Start building a relocation: every attempt starts here, so a failed one (a conflicting delta) leaves nothing behind. */
const relocationStart = (): void => void (relocSize = 0);
/** Append the relocation being built to `out` (floors ascending, a run of equal deltas one floor, the leading run of delta
 * 0 none) and reset it. */
function relocationMap(out: number[]): void {
  let delta = 0;
  for (let k = 0; k < relocSize; k++)
    if (RELOC_DELTA[k] !== delta) {
      delta = RELOC_DELTA[k]!;
      out.push(RELOC_FROM[k]!, delta);
    }
  relocSize = 0;
}
// Same handler shape: types in order, symbols, capture counts, chunk lists.
function sameHandlers(a: Record<string, HandlerEntry>, types: readonly string[], b: Record<string, HandlerEntry>, own: readonly string[]): boolean {
  if (types.length !== own.length) return false;
  for (let i = 0; i < types.length; i++) {
    const type = types[i]!;
    if (type !== own[i]) return false;
    const x = a[type]!,
      y = b[type]!;
    if (x[0] !== y[0] || x[1].length !== y[1].length || !sameList(x[2], y[2]) || !sameList(x[3], y[3])) return false;
  }
  return true;
}
// Recent candidates per first symbol (newest last; at most CANDIDATES).
const CANDIDATES = 4;
const remember = (map: Map<SymbolRef, number[]>, key: SymbolRef, index: number): void => {
  const list = map.get(key);
  if (list === undefined) map.set(key, [index]);
  else {
    if (list.length === CANDIDATES) list.shift();
    list.push(index);
  }
};
/**
 * Wire `e` / `b` with repeats (see above), or undefined when they would save no more than `cost` bytes (the repeat
 * add-on, unless the page shipped it). `e` / `b` themselves are left as they are.
 */
function repeatEntries(e: Record<string, Record<string, HandlerEntry>>, b: BindingEntry[], cost: number): [Record<string, unknown>, unknown[]] | undefined {
  let saved = 0,
    any = false;
  const recent = new Map<SymbolRef, number[]>(),
    ids = Object.keys(e),
    types: string[][] = new Array(ids.length),
    forms: (number[] | undefined)[] = new Array(ids.length);
  for (let i = 0; i < ids.length; i++) {
    const id = +ids[i]!,
      handlers = e[id]!,
      own = (types[i] = Object.keys(handlers));
    if (own.length === 0) continue;
    const key = handlers[own[0]!]![0],
      list = recent.get(key);
    remember(recent, key, i);
    if (list === undefined) continue;
    for (let c = list.length - (list[list.length - 1] === i ? 2 : 1); c >= 0; c--) {
      const at = list[c]!,
        source = e[ids[at]!]!;
      if (!sameHandlers(source, types[at]!, handlers, own)) continue;
      let ok = true,
        full = 0;
      relocationStart();
      for (let k = 0; k < own.length && ok; k++) {
        const s = source[own[k]!]!;
        ok = relocation(s[1], handlers[own[k]!]![1]);
        full += own[k]!.length + 8 + 6 * s[1].length + 2 * (s[2].length + (s.length > 3 ? s[3]!.length + 3 : 0));
      }
      if (!ok) continue;
      const form = [id - +ids[at]!];
      relocationMap(form);
      if (6 * form.length < full) {
        forms[i] = form;
        saved += full - 6 * form.length;
        any = true;
      }
      break;
    }
  }
  recent.clear();
  const bindings: (number[] | undefined)[] = new Array(b.length);
  for (let j = 0; j < b.length; j++) {
    const entry = b[j]!;
    // Plain bindings only: region entries carry rows / branches / locals of their own.
    if (entry.length !== 7) continue;
    const list = recent.get(entry[2]);
    remember(recent, entry[2], j);
    if (list === undefined) continue;
    for (let c = list.length - (list[list.length - 1] === j ? 2 : 1); c >= 0; c--) {
      const from = list[c]!,
        source = b[from]!;
      if (source[1] !== entry[1] || source[3].length !== entry[3].length || source[4].length !== entry[4].length || !sameList(source[5], entry[5])) continue;
      relocationStart();
      if (!relocation(source[3], entry[3]) || !relocation(source[4], entry[4])) continue;
      const node = entry[0] - source[0],
        region = entry[6] - source[6],
        form = node === region ? [-1 - (j - from), node] : [-1 - (j - from), node, region];
      relocationMap(form);
      const full = 6 * (entry[3].length + entry[4].length) + 2 * entry[5].length + 20;
      if (6 * form.length < full) {
        bindings[j] = form;
        saved += full - 6 * form.length;
        any = true;
      }
      break;
    }
  }
  if (!any || saved <= cost) return undefined;
  const wireE: Record<string, unknown> = {};
  for (let i = 0; i < ids.length; i++) wireE[ids[i]!] = forms[i] ?? e[ids[i]!];
  const wireB: unknown[] = new Array(b.length);
  for (let j = 0; j < b.length; j++) wireB[j] = bindings[j] ?? b[j];
  return [wireE, wireB];
}

// The table in slices of TABLE_SLICE entries, byte for byte `JSON.stringify(table)`: V8 (Node 26) serializes a table of
// ~600+ resume entries 2.5–3× slower per entry in one call than in slices (showcase dashboard 51 → 18 µs).
const TABLE_SLICE = 256;
function sliced(table: readonly unknown[]): string {
  let out = "[";
  for (let i = 0; i < table.length; i += TABLE_SLICE) {
    const json = JSON.stringify(table.slice(i, i + TABLE_SLICE));
    out += (i ? "," : "") + json.slice(1, -1);
  }
  return out + "]";
}
// `b`, byte for byte `JSON.stringify(b)`: a region entry with a row template (`[9]`, `RowTemplate`) carries the template's
// element-id handler map (`e`, integer keys), which sends the whole call to V8's slow serializer (a 100-row list's
// entries 4.0 -> 1.6 us). The template is written like `idMap`; runs of other entries natively, in one call each.
function bindingsJSON(b: readonly unknown[][]): string {
  let out = "[",
    from = 0;
  for (let i = 0; i < b.length; i++) {
    const entry = b[i]!,
      tpl = entry.length > 9 ? (entry[9] as RowTemplate | null) : null;
    // A template is the only object at [9] (else 0: padding before locals / branches); its own keys are `e`, `b`.
    if (tpl === null || typeof tpl !== "object" || Array.isArray(tpl) || Object.keys(tpl).length !== 2 || !tpl.e || !Array.isArray(tpl.b)) continue;
    if (i > from) out += (out.length > 1 ? "," : "") + JSON.stringify(b.slice(from, i)).slice(1, -1);
    let json = "[";
    for (let k = 0; k < entry.length; k++)
      json += (k ? "," : "") + (k === 9 ? '{"e":' + idMap(tpl.e) + ',"b":' + JSON.stringify(tpl.b) + "}" : (JSON.stringify(entry[k]) ?? "null"));
    out += (out.length > 1 ? "," : "") + json + "]";
    from = i + 1;
  }
  if (from === 0) return JSON.stringify(b);
  if (from < b.length) out += "," + JSON.stringify(b.slice(from)).slice(1, -1);
  return out + "]";
}
/** A streamed segment's state patch script (`json`: `stateJSON` of the patch). */
const patchScript = (marker: number, json: string): string => '<script type="rivet/state" data-patch="' + marker + '">' + escapeJSON(json) + "</script>";
function stateJSON(state: object): string {
  let out = "{";
  const keys = Object.keys(state);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!,
      value = (state as Record<string, unknown>)[key];
    const json =
      KEYED.has(key) && value !== null && typeof value === "object"
        ? idMap(value)
        : key === "t" && (value as unknown[]).length > TABLE_SLICE
          ? sliced(value as unknown[])
          : key === "b"
            ? bindingsJSON(value as unknown[][])
            : JSON.stringify(value);
    if (json !== undefined) out += (out.length > 1 ? ',"' : '"') + key + '":' + json;
  }
  return out + "}";
}

/** `ahead`: fetch-ahead (`data-fo`) even though the options say `lean` (the D-lean deferred state, `deferredState`). */
function encodeState(recorder: Recorder, ahead = false): ServerValue {
  const { manifest = {} as BuildManifest, nonce } = recorder.options;
  const { t0, events, schedule, boot, rx, rr, late, ...part } = encodeRecords(recorder, recorder);
  const { c, s, l, x, g, t, e, m, b, fx, ce, a, n, w, L } = part;
  const state = { v: RESUME_VERSION, h: manifest.hash ?? null, rt: manifest.runtime ?? null, c, s } as ResumeState;
  if (l) state.l = l;
  if (x) state.x = x;
  if (g) state.g = g;
  Object.assign(state, { t, e, m, b, fx, ce });
  if (a) state.a = a;
  if (n) state.n = n;
  if (w) state.w = w;
  if (L) state.L = L;
  // DOM-DATA: the runtime reads the `D` entries back from the DOM at idle (before anything replaces server nodes).
  if (recorder.dom !== null && t?.some((entry) => entry !== null && typeof entry === "object" && "D" in entry)) state.D = 1;
  // ` nonce="…"` (sanitized to base64 characters, so the attribute encoder never escapes it).
  const attrs = nonce ? _attributeRecord("nonce", String(nonce).replace(/[^\w+/=-]/g, ""), "html") : null;
  // Pending streamed boundaries: [marker, fallback region, region] triples, for the stream add-on.
  const streamed = a?.filter((entry) => entry[3] === 0);
  const pending = streamed?.length ? ' data-stream="' + streamed.map((entry) => entry.slice(0, 3).join(",")).join(" ") + '"' : "";
  // The state script is per request: a plain (non-compiled) template, which string and byte
  // writers take as one string write, with no encode-cache entry for a one-off fragment.
  // A lazy router's chunks (`n`) + the runtime: fetched (never evaluated) ahead of the first link click, by the
  // loader module after the `load` event and the web fonts (`data-fo`; as `<link>`s in the HTML they took bandwidth
  // from the LCP: docs `/learn/resuming/` Lighthouse mobile LCP 1,879 → 1,353 ms, LOADER-DIET). modulepreload fetches one module:
  // their static imports (manifest `deps`) are listed too. Lean pages / no loader module: none (the first link
  // intent / click loads them; the loader holds and replays the click).
  // Route chunk builds (`manifest.fetchAhead`) on apps with document prefetch (`preload.ahead`): the page's own handler
  // chunks too (ROUTE-CHUNKS), on non-lean pages — except chunks declared to load on intent / interaction (`late`: an
  // element `preload` directive, component-level `preload` or app `preload.rules` rule; automatic intent handlers stay):
  // their intent prefetch loads them (DOCS-JS: a docs page fetched its frame menus' cdk closure, ~330 KB, on every load).
  // The same holds for a lazy router's chunks (`n`) an app rule / component `preload` declares late (DOCS-COLD: the docs
  // sites rule the generated App on intent — every link reloads a document; its route tables + router client, ~43 KB, were
  // fetched on every page): the first link intent loads them, a cold click without one waits for them (held, replayed).
  const own = !!manifest.fetchAhead && !!recorder.options.preload?.ahead && !recorder.options.preload.lean && c.length > 0;
  const fetchOnly =
    manifest.loader && ((n && (ahead || !recorder.options.preload?.lean)) || own)
      ? [
          ...new Set(
            [
              state.rt,
              ...(n ?? []).flatMap((i) => (late?.includes(i) ? [] : [c[i]])),
              ...(own ? (late?.length ? c.filter((_, i) => !late.includes(i)) : c) : []),
            ].flatMap((url) => (url ? [url, ...(manifest.deps?.[url] ?? [])] : [])),
          ),
        ].join(" ")
      : "";
  // Dev: large captures / page state budget (`DEV.stateCaptures` above); the JSON is built once.
  const json = stateJSON(state);
  if (DEV) DEV.stateBytes(recorder, json.length);
  const head = template([
    '<script type="rivet/state" data-region="0" data-events="' +
      events.join(" ") +
      '"' +
      (boot ? " data-boot" : "") +
      pending +
      // `<chunk>.deps.js` modules exist (build manifest `depsModules`): the loader imports one with each chunk it
      // hints for an interaction and hints that chunk's static import closure at once.
      (manifest.depsModules && (c.length || streamed?.length) ? " data-deps" : "") +
      // The loader module (manifest `loader`): imported with the first intent / interaction, or after the first frame.
      (manifest.loader && (c.length || streamed?.length) ? ' data-ld="' + escapeAttribute(manifest.loader) + '"' : "") +
      (fetchOnly ? ' data-fo="' + escapeAttribute(fetchOnly) + '"' : "") +
      (schedule.length ? ' data-preload="' + escapeAttribute(JSON.stringify([state.rt, ...schedule])) + '"' : "") +
      ">" +
      escapeJSON(json),
  ]);
  const fragments = TAILS[(recorder.events.has("keydown") ? 1 : 0) + (a ? 2 : 0)]!;
  const tail = compiledTemplate(fragments, a ? [head, attrs, attrs] : [head, attrs]);
  // Path-addressed rows (`w`): the rows add-on goes before the state script (the loader binds to the script right
  // before it, and schedules visible preloads of row elements while it runs).
  // Compact row templates (`rx`) / repeated entries (`rr`): the expand / repeat add-ons too (the loader decodes the state
  // with them when parsing).
  const before = [
    ...(w ? [compiledTemplate(ROWS_SCRIPT, [attrs])] : []),
    // Lazy rows (`L`): the lazy add-on, after the rows add-on (it wraps its `$rw`).
    ...(L ? [compiledTemplate(LAZY_SCRIPT, [attrs])] : []),
    ...(rx ? [compiledTemplate(EXPAND_SCRIPT, [attrs])] : []),
    ...(rr ? [compiledTemplate(REPEAT_SCRIPT, [attrs])] : []),
  ];
  const out = before.length ? [...before, tail] : tail;
  if (w) recorder.rowsAddon = true;
  if (L) recorder.lazyAddon = true;
  if (rx) recorder.expandAddon = true;
  if (rr) recorder.repeatAddon = true;
  return out;
}

// Preload strategies, strongest first. A chunk takes the strongest strategy any of its uses asks for;
// app rules (manifest.preload, per symbol) replace the automatic choice.
const STRENGTH: Record<Strategy, number> = { eager: 4, idle: 3, visible: 2, intent: 1, interaction: 0 };
const CODE: Partial<Record<Strategy, string>> = { eager: "e", idle: "i", visible: "v" };
// Events normally preceded by intent (dwell, focus, touch, pointerdown/keydown) or announced by the
// loader's own intent listeners (pointerover dwell, focusin, touchstart): no automatic visible preload.
const INTENT = new Set([
  "click",
  "pointerdown",
  "mousedown",
  "touchstart",
  "focus",
  "focusin",
  "invalid",
  "submit",
  "input",
  "change",
  "keydown",
  "keyup",
  "keypress",
  "pointerup",
  "mouseup",
  "dblclick",
  "contextmenu",
  "focusout",
  "blur",
]);
const WEIGHT: Record<string, number> = { click: 3, submit: 3, input: 2, change: 2 };
const NAV = 2; // impact bonus for handlers on a navigation path
const LIST = 3; // one handler symbol on this many rows of one For list → visible
const VISIBLE_MAX = 8192; // automatic visible only for chunks up to this many bytes (minified, manifest.sizes); larger wait for intent
// Visible chunks also fetched in the background at idle (`P`), in plan order, while their new static closures
// (minified, manifest `sizes`, runtime + eager / idle closures already counted) fit this budget (render option
// `preload.background`); later ones stay viewport-only (`v`). A below-the-fold widget is then ready when scrolled to.
// 1 MiB: /themes' below-fold Select needs ~1 MB of closures in plan order (2026-10-11, docs/benchmarks/2026-10-11-preload-background.md).
const BACKGROUND_DEFAULT = 1024 * 1024;
const OBSERVED = 48; // visible chunks observe at most this many elements, spread evenly (with a 1-viewport margin)
const sample = (ids: number[]): number[] =>
  ids.length <= OBSERVED ? ids : Array.from({ length: OBSERVED }, (_, i) => ids[Math.floor((i * ids.length) / OBSERVED)]!);
/** A handler for preload planning: [element id, type, symbol, refs, its (shared) entry, source element]. */
type PlannedHandler = [id: number | number[], type: string, symbol: string, refs: number[], entry: HandlerEntry, element: ElementRecord | TextRecord];
/** Per-chunk preload plan state. */
/** Module-level (a per-call closure's loop is re-tiered after every full GC): a row list's element ids. */
const addAll = (set: Set<number>, ids: readonly number[]): void => {
  for (let i = 0; i < ids.length; i++) set.add(ids[i]!);
};
/** A chunk plan's id Set, made on first need (from its lone list, if any). */
const idSet = (info: ChunkPlan): Set<number> => {
  if (info.ids === null) {
    info.ids = new Set(info.list ?? undefined);
    info.list = null;
  }
  return info.ids;
};
interface ChunkPlan {
  strategy: Strategy;
  score: number;
  /** Element ids: `list` while one list handler (distinct row element ids) is all there is, a Set once more join. */
  ids: Set<number> | null;
  list: readonly number[] | null;
  rule: Strategy | null;
  element: Strategy | null;
}

/** Symbol ids and signal entries reachable from one table entry; `chunks`: the symbols' chunk indexes (`needs`, per encode);
 * `at`: the entry it was built for (a reach shared from a child is extended on a copy). */
interface Reach {
  symbols: string[];
  signals: number[];
  chunks: number[] | undefined;
  at: number;
}
const NO_REACH: Reach = { symbols: [], signals: [], chunks: [], at: -1 };
/** Reach "symbol" of built-in entries (`t` / `U` / `b` / `E`): their decoders' chunk, manifest `builtins`. */
const BUILTINS = "@rivetjs/runtime/resume-builtins";
/** Per encode: reach per table index (`ACTIVE` while its walk runs). */
type ReachMemo = (Reach | undefined)[];
const ACTIVE: Reach = { symbols: [], signals: [], chunks: [], at: -2 };
/**
 * What `root` reaches through captures, memoised per table entry in `memo` (a table entry never changes once written):
 * a recursive walk that memoises every entry it finishes, so shared sub-objects (contexts, props recipes, signals) are
 * walked once per encode, not once per capture that reaches them. Order = the one-stack walk's (pre-order, an entry's
 * own symbol / signal first, then its children last to first; first occurrence wins). An entry reached again while its
 * walk is unfinished (a plain object / array cycle) taints the walk: nothing on that path is memoised and the root is
 * walked the old way (`reachStack`).
 */
let tainted = 0;
function reachOf(table: readonly TableEntry[], root: number, memo: ReachMemo): Reach {
  const head = table[root];
  if (head === null || typeof head !== "object") return NO_REACH;
  const found = memo[root];
  if (found !== undefined && found !== ACTIVE) return found;
  tainted = 0;
  const reach = reachEntry(table, memo, root);
  if (tainted === 0) return reach;
  tainted = 0;
  return (memo[root] = reachStack(table, root, memo));
}
// Merge `child` into `acc` (the reach being built for entry `at`): a lone child's reach is shared as is.
function union(acc: Reach, child: Reach, at: number): Reach {
  if (child === NO_REACH || child === acc) return acc;
  if (acc === NO_REACH) return child;
  // Most merges add nothing (one props object / context reached through several captures): no copy then.
  if (within(child.symbols, acc.symbols) && within(child.signals, acc.signals)) return acc;
  if (acc.at !== at) acc = { symbols: acc.symbols.slice(), signals: acc.signals.slice(), chunks: undefined, at };
  addNew(acc.symbols, child.symbols);
  addNew(acc.signals, child.signals);
  return acc;
}
function reachEntry(table: readonly TableEntry[], memo: ReachMemo, index: number): Reach {
  // A tainted walk is redone by `reachStack`: stop at once (linear, also over cyclic data).
  if (index < 0 || tainted) return NO_REACH;
  const entry = table[index];
  if (entry === null || typeof entry !== "object") return NO_REACH;
  const done = memo[index];
  if (done !== undefined) {
    if (done !== ACTIVE) return done;
    tainted++;
    return NO_REACH;
  }
  memo[index] = ACTIVE;
  const before = tainted;
  let acc = NO_REACH;
  if (Array.isArray(entry)) for (let i = entry.length - 1; i >= 0; i--) acc = union(acc, reachEntry(table, memo, entry[i] as number), index);
  else if (entry.o) {
    const o = entry.o;
    for (let i = o.length - 1; i >= 1; i -= 2) acc = union(acc, reachEntry(table, memo, o[i] as number), index);
  } else if (entry.p) {
    const p = entry.p;
    for (let i = p.length - 1; i >= 1; i -= 2) if (Array.isArray(p[i])) acc = union(acc, reachEntry(table, memo, (p[i] as [number])[0]), index);
  } else if (entry.m) {
    const m = entry.m;
    for (let i = m.length - 1; i >= 0; i--) acc = union(acc, reachEntry(table, memo, m[i] as number), index);
  } else if (entry.e) {
    const e = entry.e;
    for (let i = e.length - 1; i >= 0; i--) acc = union(acc, reachEntry(table, memo, e[i] as number), index);
  } else if (entry.i) {
    // An element of a decoded entry (a `j` tree object, a group symbol's member: Function Bridge T9): its parent's reach.
    acc = union(acc, reachEntry(table, memo, entry.i[0]), index);
  } else if (entry.t || entry.U !== undefined || entry.b || entry.E) {
    // Built-in entries need their decoders' chunk (`BUILTINS`, manifest `builtins`).
    acc = { symbols: [BUILTINS], signals: [], chunks: undefined, at: index };
    if (entry.E && entry.E.length > 2) acc = union(acc, reachEntry(table, memo, entry.E[2] as number), index);
  } else if ("s" in entry) {
    acc = { symbols: [], signals: [index], chunks: undefined, at: index };
    if (typeof entry.q === "number") acc = union(acc, reachEntry(table, memo, entry.q), index);
    acc = union(acc, reachEntry(table, memo, entry.s!), index);
  } else if (entry.a) {
    // A class instance (T23) also needs the built-in decoders' chunk (its decoder lives there).
    if (entry.c !== undefined || entry.f !== undefined || entry.cls !== undefined)
      acc = {
        // A registered class id (T25, no `#`) is no symbol: only the built-in decoders' chunk.
        symbols: entry.cls === undefined ? [symbolOf(entry) as string] : _registeredId(entry.cls) ? [BUILTINS] : [entry.cls as string, BUILTINS],
        signals: [],
        chunks: undefined,
        at: index,
      };
    if (typeof entry.q === "number") acc = union(acc, reachEntry(table, memo, entry.q), index);
    const a = entry.a;
    for (let i = a.length - 1; i >= 0; i--) acc = union(acc, reachEntry(table, memo, a[i] as number), index);
  }
  memo[index] = tainted === before ? acc : undefined;
  return acc;
}
// Whether every value of `part` is in `all` (short lists; false past 32 values: the caller merges).
function within<T>(part: readonly T[], all: readonly T[]): boolean {
  if (part.length > all.length || all.length > 32) return part.length === 0;
  for (let i = 0; i < part.length; i++) if (!all.includes(part[i]!)) return false;
  return true;
}
// Append the values of `from` that `into` lacks (lists are short; a Set past 32 keeps long ones linear).
function addNew<T>(into: T[], from: readonly T[]): void {
  if (!from.length) return;
  if (into.length + from.length > 32) {
    const set = new Set(into);
    for (let i = 0; i < from.length; i++) if (!set.has(from[i]!)) (set.add(from[i]!), into.push(from[i]!));
    return;
  }
  for (let i = 0; i < from.length; i++) if (!into.includes(from[i]!)) into.push(from[i]!);
}
// The one-stack walk (cyclic plain data only): fresh `seen`, memoised results of other entries merged in.
function reachStack(table: readonly TableEntry[], root: number, memo: ReachMemo): Reach {
  let symbols: Set<string> | null = null,
    signals: Set<number> | null = null;
  const seen = new Set<number>(),
    stack = [root];
  while (stack.length) {
    const index = stack.pop()!;
    if (index < 0 || seen.has(index)) continue;
    seen.add(index);
    const entry = table[index];
    if (entry === null || typeof entry !== "object") continue;
    if (index !== root) {
      const done = memo[index];
      if (done !== undefined && done !== ACTIVE) {
        if (done.symbols.length) for (const symbol of done.symbols) (symbols ??= new Set()).add(symbol);
        if (done.signals.length) for (const signal of done.signals) (signals ??= new Set()).add(signal);
        continue;
      }
    }
    if (Array.isArray(entry)) for (let i = 0; i < entry.length; i++) stack.push(entry[i] as number);
    else if (entry.o) for (let i = 1; i < entry.o.length; i += 2) stack.push(entry.o[i] as number);
    else if (entry.p) for (let i = 1; i < entry.p.length; i += 2) Array.isArray(entry.p[i]) && stack.push((entry.p[i] as [number])[0]);
    else if (entry.m) for (let i = 0; i < entry.m.length; i++) stack.push(entry.m[i] as number);
    else if (entry.e) for (let i = 0; i < entry.e.length; i++) stack.push(entry.e[i] as number);
    else if (entry.i) stack.push(entry.i[0]);
    else if (entry.t || entry.U !== undefined || entry.b || entry.E) {
      (symbols ??= new Set()).add(BUILTINS);
      if (entry.E && entry.E.length > 2) stack.push(entry.E[2] as number);
    } else if ("s" in entry) {
      (signals ??= new Set()).add(index);
      stack.push(entry.s!);
      if (typeof entry.q === "number") stack.push(entry.q);
    } else if (entry.a) {
      if (entry.c !== undefined || entry.f !== undefined || (entry.cls !== undefined && !_registeredId(entry.cls)))
        (symbols ??= new Set()).add(symbolOf(entry) as string);
      if (entry.cls !== undefined) (symbols ??= new Set()).add(BUILTINS);
      for (let i = 0; i < entry.a.length; i++) stack.push(entry.a[i] as number);
      if (typeof entry.q === "number") stack.push(entry.q);
    }
  }
  return symbols === null && signals === null
    ? NO_REACH
    : { symbols: symbols ? [...symbols] : [], signals: signals ? [...signals] : [], chunks: undefined, at: root };
}

/**
 * Per page:
 * - dependency prefetch: a handler or model also prefetches (and evaluates on pointerdown/keydown) the
 *   chunks of bindings reading signals it can reach, so its update applies synchronously;
 * - schedule: `[[url, "e"|"i"|"v", elementIds?], …]` (the loader prefixes the runtime url) by impact (event weight × elements), smaller first on ties;
 * - interaction: chunk indexes intent must not prefetch.
 */
function planPreload({
  manifest,
  chunks: shipped,
  encoder,
  handlers,
  models,
  bindings,
  clientEvents,
  ce,
  reach,
  background,
  preloads,
}: {
  manifest: BuildManifest;
  chunks: string[];
  encoder: Encoding["encoder"];
  handlers: PlannedHandler[];
  models: Record<string, ModelEntry>;
  bindings: BindingEntry[];
  clientEvents: ClientEventRecord[];
  ce: ClientEventEntry[];
  reach: ReachMemo;
  background: number;
  preloads: readonly PreloadRecord[];
}): { schedule: PreloadEntry[]; interaction: number[]; late?: number[] } {
  // `_rPreload` chunks may be outside the page's shipped list (an island chunk no symbol of this page is in): planned on a
  // local copy, so the shared list (state `c`, later patches) is untouched; `interaction` keeps shipped indexes only.
  const chunks = preloads.length ? shipped.slice() : shipped;
  const table: readonly TableEntry[] = encoder.table;
  // Signal ref → chunk indexes of the bindings reading it (a Set: 1,000 row bindings share one chunk).
  const readers = new Map<number, Set<number>>();
  for (const binding of bindings)
    for (const dep of binding[4]) {
      let chunks = readers.get(dep);
      if (!chunks) readers.set(dep, (chunks = new Set()));
      for (const i of binding[5]) chunks.add(i);
    }
  // Extras per (reached signals, own chunks): row handlers reach the same signals (O(handlers), not × readers).
  const followed = new Map<string, number[]>();
  const follow = (refs: number[], own: number[]): number[] => {
    const signals = new Set<number>();
    for (let r = 0; r < refs.length; r++) for (const signal of reachOf(table, refs[r]!, reach).signals) signals.add(signal);
    if (!signals.size) return [];
    const key = [...signals].join() + "|" + own.join();
    let extra = followed.get(key);
    if (extra) return extra;
    const found = new Set<number>();
    for (const signal of signals) for (const i of readers.get(signal) ?? []) if (!own.includes(i)) found.add(i);
    followed.set(key, (extra = [...found]));
    return extra;
  };
  const chunk = new Map<number, ChunkPlan>(); // index → { strategy, score, ids, rule, element }
  const stronger = (a: Strategy | null, b: Strategy): Strategy => (a === null || STRENGTH[b] > STRENGTH[a] ? b : a);
  // `distinct`: `id` is a list handler's row element ids (no repeats): kept as the list itself until a second source of
  // ids joins (no Set of every row id for a lone list; the visible sample is the same, in the same order).
  const use = (index: number, strategy: Strategy, score: number, id?: number | number[], override?: Strategy, distinct = false): void => {
    const info = chunk.get(index) ?? chunk.set(index, { strategy: "interaction", score: 0, ids: null, list: null, rule: null, element: null }).get(index)!;
    if (STRENGTH[strategy] > STRENGTH[info.strategy]) info.strategy = strategy;
    if (override) info.element = stronger(info.element, override);
    if (typeof id === "object") {
      info.score += score * id.length;
      if (distinct && info.ids === null && info.list === null) info.list = id;
      else addAll(idSet(info), id);
    } else {
      info.score += score;
      if (id !== undefined) idSet(info).add(id);
    }
  };
  const sizes = manifest.sizes ?? {};
  // Repetition counts per (For list, symbol), not per symbol: N independent instances of a component
  // are not a list. Handlers outside For rows count alone (their entry).
  const repeated = new Map<unknown, number>(),
    lists = new Map<object, Map<string, object>>(),
    planned = new Set<HandlerEntry>();
  const keyOf = ([, , symbol, , entry, element]: PlannedHandler): unknown => {
    let scope = (element as ElementRecord).region;
    while (scope && !scope.row) scope = scope.held ? null : scope.parent;
    const list = scope?.record?.list ?? (element as ElementRecord).list;
    if (!list) return entry;
    const symbols = lists.get(list) ?? lists.set(list, new Map()).get(list)!;
    return symbols.get(symbol) ?? symbols.set(symbol, {}).get(symbol)!;
  };
  const keys = handlers.map(keyOf);
  for (let h = 0; h < handlers.length; h++) {
    const id = handlers[h]![0];
    repeated.set(keys[h], (repeated.get(keys[h]) ?? 0) + (typeof id === "object" ? id.length : 1));
  }
  for (let h = 0; h < handlers.length; h++) {
    const [id, type, , refs, entry, element] = handlers[h]!;
    // Template entries are shared by every row: plan their extras once.
    if (!planned.has(entry)) {
      planned.add(entry);
      const found = follow(refs, entry[2]);
      if (found.length) (entry as unknown[]).push(found);
    }
    const extra = entry[3] || [];
    // Capture-phase entries are keyed `type!`.
    const event = type.endsWith("!") ? type.slice(0, -1) : type;
    const visible = !INTENT.has(event) || repeated.get(keys[h])! >= LIST;
    // Handlers on a navigation path (links, forms with an action) weigh +2.
    const score = (WEIGHT[event] ?? 1) + ((element as ElementRecord)?.nav ? NAV : 0);
    for (const i of entry[2])
      use(i, visible && (sizes[chunks[i]!] ?? 0) <= VISIBLE_MAX ? "visible" : "intent", score, id, (element as ElementRecord)?.preload, true);
    for (const i of extra) use(i, "intent", 0, id, (element as ElementRecord)?.preload, true);
  }
  for (const id in models) {
    const extra = follow([models[id]![1]], []);
    if (extra.length) (models[id] as unknown[]).push(extra);
    for (const i of extra) use(i, "intent", 2, Number(id));
  }
  clientEvents.forEach(([, , target, , options], n) => {
    const [, , spec, , , needed] = ce[n]!;
    const element = Array.isArray(spec);
    const strategy = options?.passive === false ? "eager" : (options?.preload ?? (element ? "visible" : "idle"));
    for (const i of needed) use(i, strategy, 1, element ? (spec as [string, number])[1] : undefined);
  });
  // Bridge registrations (`_rPreload`): a known chunk URL (or island key, manifest `islands`) plans like a symbol of that
  // chunk with that strategy.
  for (const [key, wanted, ids] of preloads) {
    const url = manifest.islands?.[key] ?? key;
    const known =
      sizes[url] !== undefined ||
      chunks.includes(url) ||
      manifest.deps?.[url] !== undefined ||
      Object.values(manifest.lazy ?? {}).some((list) => list.includes(url));
    // A dev manifest (no sizes) knows no lazy chunks: accept its URLs.
    if (!known && manifest.sizes) {
      if (DEV) console.warn("[rivet] _rPreload: " + url + " is not a chunk of this build (ignored)");
      continue;
    }
    let index = chunks.indexOf(url);
    if (index < 0) index = chunks.push(url) - 1;
    const strategy = wanted === "visible" && (sizes[url] ?? 0) > VISIBLE_MAX ? "intent" : wanted;
    use(index, strategy, 1, ids ? [...ids] : undefined);
  }
  // App rules: per symbol, applied to that symbol's chunk.
  const rules = manifest.preload ?? {};
  for (const symbol in rules) {
    const url = manifest.symbols?.[symbol];
    const index = chunks.indexOf(url!);
    if (index < 0) continue;
    const info = chunk.get(index);
    if (info && (info.rule === null || STRENGTH[rules[symbol]!] > STRENGTH[info.rule])) info.rule = rules[symbol]!;
  }
  const schedule: PreloadEntry[] = [],
    interaction: number[] = [],
    listed = new Set<string>(),
    lazyQueue: string[] = [];
  // Route chunk builds: chunks declared to wait for intent / interaction stay out of the page's fetch-ahead (`encodeState`).
  const late: number[] | undefined = manifest.fetchAhead ? [] : undefined;
  const ranked = [...chunk].sort(([a, x], [b, y]) => y.score - x.score || (sizes[chunks[a]!] ?? 0) - (sizes[chunks[b]!] ?? 0));
  for (const [index, info] of ranked) {
    // Precedence: element directive > component / app rule (manifest) > automatic.
    const strategy = info.element ?? info.rule ?? info.strategy;
    // Declared late only (element directive / component level / app rule): automatic intent (a click handler) keeps
    // its fetch-ahead, so the first click on it downloads nothing.
    const declared = info.element ?? info.rule;
    if (late && (declared === "intent" || declared === "interaction") && index < shipped.length) late.push(index);
    if (strategy === "interaction") {
      if (index < shipped.length) interaction.push(index);
    } else if (CODE[strategy]) {
      // A lone list is the handler entry's own id array: the schedule gets its own (`sample` returns a short input as is).
      const ids =
        strategy === "visible"
          ? info.list
            ? info.list.length <= OBSERVED
              ? info.list.slice()
              : sample(info.list as number[])
            : sample([...(info.ids ?? [])])
          : null;
      if (!listed.has(chunks[index]!)) (listed.add(chunks[index]!), schedule.push(ids ? [chunks[index]!, "v", ids] : [chunks[index]!, CODE[strategy]!]));
      // The chunk's lazy imports (routes, components, idle-loaded modules it may import on use) follow
      // at idle at the earliest: an eager or visible chunk never pulls them before idle.
      if (manifest.lazyIdle !== false) for (const url of manifest.lazy?.[chunks[index]!] ?? []) lazyQueue.push(url);
    }
  }
  for (const url of lazyQueue) if (!listed.has(url)) (listed.add(url), schedule.push([url, "i"]));
  const counted = new Set<string>();
  const closure = (url: string): string[] => [url, ...(manifest.deps?.[url] ?? [])].filter((dep) => !counted.has(dep));
  if (manifest.runtime) for (const url of closure(manifest.runtime)) counted.add(url);
  for (const entry of schedule) if (entry[1] !== "v") for (const url of closure(entry[0])) counted.add(url);
  let budget = background;
  for (const entry of schedule) {
    if (entry[1] !== "v") continue;
    const add = closure(entry[0]);
    // An unknown size (dev server, a manifest without shared-chunk sizes) keeps the chunk viewport-only.
    const cost = add.reduce((sum, url) => sum + (sizes[url] ?? Infinity), 0);
    if (cost > budget) continue;
    budget -= cost;
    for (const url of add) counted.add(url);
    entry[1] = "P";
  }
  return late ? { schedule, interaction, late } : { schedule, interaction };
}

const tailOf = (recorder: Recorder) => (): ServerValue => {
  if (recorder.pending) throw new Error("Internal error: unclosed resumable element");
  const state = recorder.used ? (recorder.lean?.tail(recorder, deferredState(recorder)) ?? encodeState(recorder)) : null;
  // Derived model: the boundaries script follows the content (and any serialized-model state a `.ts` helper recorded).
  const derived = recorder.derived ? derivedHooks!.tail(recorder.derived) : null;
  return derived ? (state ? [state, derived] : derived) : state;
};

const deferredState =
  (recorder: Recorder): DeferredState =>
  (drop, islands) => {
    const effects = recorder.effects.filter(([symbol]) => !drop(symbol));
    if (bootsAtLoad(recorder, effects.length)) return null;
    const { effects: all, preloads, options } = recorder;
    recorder.effects = effects;
    recorder.preloads = preloads.filter(([key]) => !islands.has(key));
    recorder.options = { ...options, preload: { ...options.preload, lean: true } };
    try {
      return encodeState(recorder, options.preload?.ahead === true && !options.preload.lean);
    } finally {
      recorder.effects = all;
      recorder.preloads = preloads;
      recorder.options = options;
    }
  };

/** Render a resumable page; state and loader follow the content when any resumable slot rendered. */
export function renderResumable(
  factory: () => ServerValue,
  writer: { write(chunk: string): unknown },
  options: StreamingResumableOptions,
): void | Promise<void>;
// Same contract as renderToWriter.
export function renderResumable(factory: () => ServerValue, writer: { write(chunk: string): unknown }, options: RecorderOptions = {}): void | Promise<void> {
  const recorder = new Recorder(options);
  let shell: void | Promise<void>;
  try {
    const render = () => renderToWriter([factory(), tailOf(recorder)], writer as ServerWriter, options);
    shell = store.run(recorder, () => (recorder.derived ? derivedHooks!.run(recorder.derived, render) : render()));
  } catch (error) {
    // A synchronous throw (no ErrorBoundary): boundaries streamed so far left their parents, so only the stream ends them.
    recorder.stream?.abandon();
    throw error;
  }
  const stream = recorder.stream;
  if (!stream) return shell;
  // Streamed boundaries follow the shell (state + loader included), in completion order.
  return Promise.resolve(shell).then(
    () => stream.run(writer),
    (error: unknown) => {
      stream.abandon();
      throw error;
    },
  );
}

/** String convenience for renderResumable. */
export function resumableToString(factory: () => ServerValue, options: ResumableOptions): string | Promise<string>;
export function resumableToString(factory: () => ServerValue, options: RecorderOptions = {}): string | Promise<string> {
  const recorder = new Recorder({ ...options, stream: undefined });
  const render = () => renderToString([factory(), tailOf(recorder)], options);
  return store.run(recorder, () => (recorder.derived ? derivedHooks!.run(recorder.derived, render) : render()));
}

export { typeName as _typeName };
