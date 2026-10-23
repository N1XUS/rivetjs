// Resumable server rendering (the derived model, the only resume model since M6; plan
// docs/design/plans/2026-10-18-derived-client.md, design docs/design/specs/2026-10-18-structural-resume-design.md §3.3).
// The compiled server module (`resume: { module }`) calls nothing but:
//
//   const B = _rB("Name", flags[, props]);   // boundary open: a record [id, parent, flags, name, …], the body's token
//   try { return _rBOut(B, <template>); }    // the boundary's rendered value: markers + the render-time context
//   finally { _rBEnd(B); }                    // boundary close (the body token leaves the stack, also on throw)
//   _rBAttr(B)                                // `data-b="<id>"` on the boundary's element root (ATTR flag: no comments)
//   _rSig(key, init[, options])               // keyed state: `signal(init)` whose value ships and whose tracked reads
//   _rSigStore(key, init)                     // record the reading boundary (wake list); `createStore(init)` likewise
//   _rFor(props)                              // a keyed `For` whose rows render from a compiled tape (DERIVED-S)
//
// Own subpath (`@rivetjs/runtime/server-derived`, pay-per-use); `@rivetjs/runtime/server-resume` re-exports its renderers as
// `renderResumable` / `resumableToString`. The render frame (one per render, AsyncLocalStorage) holds the render options,
// the row / branch marker counter and the derived recorder.
//
// Nothing else is recorded: no handler / binding / site records, no object table, no captures. The tail is one JSON
// script (`<script type="rivet/boundaries">`, `BoundaryTail` in resume-format.ts): boundary records with their keyed
// values, plus wake lists (which boundaries read which keys). The current boundary is the innermost body being
// evaluated (a per-render stack: component bodies run eagerly, in tree order) or, while the renderer walks a boundary's
// subtree (lazy slots, For rows, Show branches), the one `_rBOut` provided as a context frame around that subtree.
//
// Derived client (M2 lane R, R2): with the manifest and nonce in hand the tail also names each boundary's chunk (`m`), the
// keys its cold keydowns hold (`k`), the delegated event types (`data-events`), the runtime (`data-rt`) and `data-boot`
// (a load / idle / visible trigger), and the derived inline loader (`resume-loader-derived.ts`) follows it. Without a
// `manifest.runtime` the tail only.
import { AsyncLocalStorage } from "node:async_hooks";
import {
  computed,
  createContext,
  createRoot,
  provide,
  selector,
  useContext,
  getOwner,
  runWithOwner,
  signal,
  _dispose,
  _scheduleFolds,
  _tracking,
  _wrapEffects,
} from "@rivetjs/reactivity";
import type { EqualsOptions, Owner, Signal } from "@rivetjs/reactivity";
import { createStore, read } from "@rivetjs/reactivity/store";
import type { Store } from "@rivetjs/reactivity/store";
import { compiledTemplate, template, MARK_CHAIN, _attributeRecord, _markFragments } from "./template.ts";
import { CONSTANT, For, ROWS, _onBranch, _onForRow, _scopedRecord } from "./server-structural.ts";
import type { ConstantGetter } from "./server-structural.ts";
import { _onErrorBoundary } from "./server-boundary.ts";
import { _onSlot } from "./slot.ts";
import { _list, renderToString, renderToWriter, type ServerWriter } from "./server.ts";
import { _asyncHook, _onAsync, _onAsyncContent, _onUserAsync } from "./server-async.ts";
import { _onDerivedResource } from "./server-resource-slot.ts";
import type { AsyncStream } from "./server-async.ts";
import { _CLASSES, _builtinKinds, _setUnrecorded, createEncoder, escapeJSON, serialize, typeName } from "./resume-format.ts";
import type { BoundaryRecord, BoundaryTail, ClassHooks, ClassRegistry, DerivedAsync, DerivedDom, TableEntry } from "./resume-format.ts";
import { derivedDom } from "./dom-data-derived.ts";
import type { DomList } from "./server-derived-dom.ts";
import { DERIVED_LOADER, DERIVED_STREAM } from "./resume-loader-derived.min.ts";
import { _onEager, _onIsland } from "./derived-eager.ts";
import type { DerivedIsland } from "./derived-eager.ts";
import type { ListPlan, ServerValue } from "./server.ts";
import { _idScope } from "./id.ts";
import { omitted } from "./omitted.ts";
import { _trigger, EFFECT, ONLY as ONLY_KIND } from "./server-trigger.ts";
import type { ShellHole, ShellHookOptions, ShellSeal, _FrameSignals as FrameSignals } from "./server-shell.ts";

/** Boundary flags (`_rB`'s `flags`; wire `BoundaryRecord[2]`); the compiler sets `INDEPENDENT` / `ATTR`. */
export const INDEPENDENT = 1,
  ATTR = 2,
  /** A keyed value of this boundary is not JSON data (not shipped): the browser renders the boundary instead of adopting it. */
  UNKEYED = 4,
  /** `INDEPENDENT` demoted at render: its props object holds a non-data value (a function, a class instance, a signal). */
  DEMOTED = 8,
  /** Its body returned nothing through `_rBOut` (early `return;` / a throw): no markers on the page. */
  SILENT = 16,
  /** Client trigger (derived client): materialise at load (`clientEffect` / `clientOnly` / a `load` island). */
  LOAD = 32,
  /** Client trigger: materialise at idle (`idle` island / effect). */
  IDLE = 64,
  /** Client trigger: materialise when its first element enters the viewport (`visible` island / effect). */
  VISIBLE = 128,
  /**
   * Dependency facts (DERIVED-C4): a dependent boundary whose subtree is closed (every reactive source it read from outside
   * is named in the wake lists, nothing it made escaped, it wrote nothing outside) and heavy enough: the browser adopts it
   * after its parent at idle, or earlier on an event inside it / a write its wake lists name, not with its parent.
   */
  DEFER = 256,
  /** `DEFER` whose subtree also read a source the wake lists cannot name (module level, a build pass): any write to such a
   * source in the browser adopts it first. */
  MOD = 512,
  /**
   * Conditional (M6-PARITY 6b, compiler: build verdict `conditional`): a boundary without a change source of its own. Its
   * record is kept only for a live instance (`keep` below); never on the wire.
   */
  COND = 1024;
const TRIGGERS = LOAD | IDLE | VISIBLE;

/** One boundary of a render (the token the compiled body holds). */
export interface Boundary {
  readonly id: number;
  readonly parent: Boundary | null;
  readonly name: string;
  flags: number;
  /** Independent boundaries: the props object (checked to be data at `_rB`). */
  props: object | null;
  /** Keyed state registered while this body evaluated: (key, current value getter), creation order. */
  signals: [key: string, value: () => unknown][];
  /** Occurrences per key (a site registering twice in one boundary gets `key#2`, `key#3`, …). */
  keys: Map<string, number> | null;
  /** `_rBAttr` ran: the element root carries `data-b`, `_rBOut` writes no comment pair. */
  attr: boolean;
  /** `_rBOut` ran. */
  out: boolean;
  /** `Async`s with a fallback constructed while it was the current boundary (their `k` in `BoundaryTail.a`). */
  an: number;
  /** While its body evaluates: the owner whose context frame names it (`CURRENT`), and that owner's frame before. */
  frame: [owner: OwnerFrames, ctx: unknown] | null;
  /** Dependency facts (DERIVED-C4): plain signals made in its unit, numbered (`"<id>.$<n>"` wake keys); reactive sources made in
   * its unit (signals, computeds: the deferral weight); `EAGER` / `MOD` marks (below). */
  made: number;
  weight: number;
  mark: number;
  /** `COND` boundaries: a read in its unit of a source that can change from outside its subtree (`note`). */
  hot?: boolean;
  /** A boundary below it keeps its record (flush). */
  kept?: boolean;
  /** STATIC-ZERO T3: its body installs a listener whose value was checked (`_rHandler` / `_rHandlers` saw a function). */
  on?: boolean;
}
/** Reactivity's owner as the body sees it: `ctx` is its context chain (immutable frames, inherited by owners made under it). */
interface OwnerFrames {
  ctx: unknown;
}

/** The derived recorder of one render (held by the render frame, provided as the `DERIVED` context). */
export interface DerivedRender {
  boundaries: Boundary[];
  /** Bodies being evaluated, innermost last. */
  stack: Boundary[];
  /** `"<boundary id>.<key>"` → ids of the other boundaries whose reads tracked it. */
  wake: Map<string, Set<number>>;
  /** Wake lists changed since the last flush (patches re-send a changed list whole). */
  dirty: Set<string>;
  /** Boundaries written by the shell / earlier patches. */
  flushed: number;
  next: number;
  /** `derivedToString` / `renderDerived`: the render's manifest + nonce (the tail names chunks, the loader follows). */
  options: DerivedOptions | null;
  /** Delegated event types of every boundary (`_rB` `events`). */
  events: Set<string>;
  /** Boundary id → its cold-held keydown keys (`_rB` `keys`). */
  keys: Record<string, string>;
  /** A boundary has a client trigger: the loader starts the runtime at once (`data-boot`). */
  boot: boolean;
  /** `_rListen` selectors not yet attached to a top-level boundary. */
  listen: string[];
  /** Selectors of the shell's document click listeners (`data-g`). */
  clicks: string;
  /** `Async`s whose load was pending (DERIVED-C2): every one, those changed since the last flush. */
  asyncs: DerivedAsyncState[];
  changed: Set<DerivedAsyncState>;
  /** `Async`s with a fallback constructed outside every boundary. */
  an: number;
  /** The render streams (`renderDerived` with `stream`): a pending `Async` writes its fallback, its content follows the shell. */
  stream: boolean;
  /** The segment whose content is rendering (its synchronous part): `Async`s constructed there are its children. */
  segment: DerivedAsyncState | null;
  /** The segment writer waits for a settled segment. */
  wakeup: (() => void) | null;
  /** The swap add-on (`$rD`) is on the page. */
  addon: boolean;
  /** Shell cache (`server-shell.ts`, DERIVED-C3): the derived half of a stored shell's fill / replay / H-holes hit. */
  readonly shell: DerivedShell;
  /** H-holes hit: boundaries numbered below it are the stored shell's (their keyed state is not this render's). */
  base: number;
  /** H-holes hit: the next `Async` is a retained hole (its unit key and place, as the fill counted them). */
  forced: readonly [b: number, k: number] | null;
  /** Shell cache renders (`options.shell`): keyed signal getter → its signal (the frame watch reads the value). */
  sources: WeakMap<object, () => unknown> | null;
  /** Dependency facts (DERIVED-C4): computeds evaluating, innermost last (their reads become their sources). */
  ev: Src[];
  /** A store was made in this render (store reads are not tracked): no boundary of it defers. */
  stores: boolean;
  /** Creators whose numbered signals some wake key names (tail `c`: their counts, the browser checks its own). */
  counted: Set<Boundary>;
  /** DOM data (DERIVED-C5, manifest `domData`): the lists written from a tape with DOM text slots; null when off. */
  dom: DomList[] | null;
  /** Framework islands (M6-PARITY): lean ones (booted by the bridge's lean boot, shell only), the ids and keys of those
   * the adopt run of their boundary hydrates (tail / patch `i`, fetch-ahead), the shell tail is written. */
  lean: DerivedIsland[];
  adopt: DerivedIsland[];
  tailed: boolean;
}

/** H-holes (DERIVED-C3): what a fill's derived recorder retains for hits (`ShellHoles.derived`). */
export interface DerivedSeal {
  /** Boundary id the content of the holes numbers on from. */
  readonly next: number;
  /** Per retained hole (`Async` id order): its unit key and place. */
  readonly holes: readonly (readonly [b: number, k: number])[];
}
/** @internal The shell cache's view of a derived render (`server-shell.ts` calls it through `DerivedRender.shell`). */
export interface DerivedShell {
  /** `shellHook`'s root tail of a derived render: fill (seal / retained holes) or replay (muted); true = written nothing. */
  tail(
    ctx: DerivedRender,
    options: ShellHookOptions,
    recorder: Recorder,
    kept: ShellHole[] | null,
    refused: string | null,
    reset: () => void,
    frameSignals: FrameSignals,
  ): boolean;
  /** Replay: the shell tail writes nothing; its records count as written (the segments number on from them). */
  mute(ctx: DerivedRender): void;
  /** Fill, at the cut: the numbering for H-holes hits, or why not. */
  seal(ctx: DerivedRender): DerivedSeal | string;
  /** H-holes hit: before the holes run (the content numbers on from the fill's shell). */
  begin(ctx: DerivedRender, seal: DerivedSeal): void;
  /** H-holes hit: run hole `i` (`fn` constructs its `Async`) under this render's recorder. */
  hole<T>(ctx: DerivedRender, seal: DerivedSeal, i: number, fn: () => T): T;
  /** Fill, once its holes ended: why hits cannot re-run the holes alone (their content's reads woke shell boundaries). */
  crossed(ctx: DerivedRender, seal: DerivedSeal): string | null;
  /** A keyed signal getter's signal (`_rSig` wraps it), else undefined. */
  source(ctx: DerivedRender, fn: object): (() => unknown) | undefined;
}

/** A pending `Async` of a derived render (wire: `BoundaryTail.a`). */
interface DerivedAsyncState {
  id: number;
  /** The boundary whose unit constructed it (0: none) and its place among that unit's `Async`s with a fallback. */
  b: number;
  k: number;
  /** 0 pending, 1 settled with JSON data (`value`), 2 settled without (the browser renders it), 3 content rendering. */
  state: number;
  value: unknown;
  /** `value` is the resume table encoding of a value that is not JSON data (Date, Map, … : tail entry settled `2`). */
  enc: boolean;
  /** The boundary current where it was constructed; `Async`s constructed while its content renders (`an`: their `k`). */
  at: Boundary | null;
  an: number;
  /** Streamed only: the segment it renders in (written after it), its content's HTML (null: none), written yet. */
  parent: DerivedAsyncState | null;
  html: string | null;
  out: boolean;
  dispose: (() => void) | null;
  own: (() => void) | null;
}

/** What the derived client needs from the render options. */
export interface DerivedOptions {
  /** `deps`: static import closure per chunk URL (the derived build's manifest): fetch-ahead (`data-fo`) lists them too. */
  manifest?: Partial<ResumeManifest> & { deps?: Record<string, string[]> };
  nonce?: string;
  /** The request's origin (`ResumableOptions.origin`): same-origin `URL` values in `_rData` payloads ship relative. */
  origin?: string;
  /** `lean`: no fetch-ahead (`data-fo`): chunks load on intent / interaction only. */
  preload?: { lean?: boolean };
  /** `renderDerived` with `stream` (out-of-order streaming): `deadline` stops waiting (the browser renders what is left). */
  stream?: { deadline?: number };
  signal?: AbortSignal;
  variant?: unknown;
}
// The options of the render being started (read once by `createDerived`).
let pending: DerivedOptions | null = null;

const DERIVED = createContext<DerivedRender | null>(null);
/** The boundary whose subtree the renderer is walking (`_rBOut` provides it around the rendered value). */
const CURRENT = createContext<Boundary | null>(null);

/** A fresh derived recorder for one render. */
export function createDerived(): DerivedRender {
  const options = pending;
  pending = null;
  return {
    boundaries: [],
    stack: [],
    wake: new Map(),
    dirty: new Set(),
    flushed: 0,
    next: 1,
    options,
    events: new Set(),
    keys: {},
    boot: false,
    listen: [],
    clicks: "",
    asyncs: [],
    changed: new Set(),
    an: 0,
    stream: !!options?.stream,
    segment: null,
    wakeup: null,
    addon: false,
    shell: SHELL,
    base: 0,
    forced: null,
    sources: options && (options as { shell?: unknown }).shell ? new WeakMap() : null,
    ev: [],
    stores: false,
    counted: new Set(),
    dom: options?.manifest?.domData && derivedDom.api ? [] : null,
    lean: [],
    adopt: [],
    tailed: false,
  };
}

// ---- Render frame ----
/** Build output the renderers read (`rivet()` plugin `.vite/rivet-resume.json`). */
export interface ResumeManifest {
  hash?: string;
  /** URL whose default export is the `@rivetjs/runtime/dom-derived` instance (`data-rt`). */
  runtime: string;
  /** Boundary name (`<module>#<Name>`) → URL of the chunk exporting the component. */
  symbols: Record<string, string>;
  /**
   * URL of the `@rivetjs/runtime/resume-builtins` chunk (RegExp / URLSearchParams / binary / error / `registerClass`
   * decoders of a `_rData` payload or an `Async` value that is not JSON data). Omitted: the app loads it itself.
   */
  builtins?: string;
  /** The build's browser runtime reads DOM-backed data (`rivet({ resume: { domData: true } })`, DERIVED-C5). */
  domData?: boolean;
  /** Static import closure per chunk URL: fetch-ahead (`data-fo`) lists it too. */
  deps?: Record<string, string[]>;
  /** Minified chunk sizes per URL. */
  sizes?: Record<string, number>;
  /** Framework island chunk URL per island key (`@rivetjs/bridge` facades: `<module>#<export>`). */
  islands?: Record<string, string>;
}
/** Options of resumable server rendering: manifest, CSP nonce, locale variant. */
export interface ResumableOptions {
  signal?: AbortSignal;
  manifest: ResumeManifest;
  /** CSP nonce for the inline loader (and stream) scripts. */
  nonce?: string;
  /** Locale variant index for compiled i18n templates (default 0); see RenderOptions. */
  variant?: number;
  /** `lean`: no fetch-ahead (`data-fo`): chunks load on intent / interaction only. */
  preload?: { lean?: boolean };
  /** The request's origin: same-origin `URL` values in `_rData` payloads ship relative. */
  origin?: string;
  /** @internal Shell cache (router route rule `shell`, PPR-T3B): built by `@rivetjs/runtime/server-shell` `shellHook`. */
  shell?: ShellHook;
}
/** Options of streaming resumable rendering. */
export interface StreamingResumableOptions extends ResumableOptions {
  /**
   * Out-of-order streaming: a pending `Async` with a fallback writes the fallback first; its content streams after the
   * shell with a boundaries patch. `deadline` (ms from render start, no default) stops waiting: unfinished boundaries
   * continue in the browser (their `load` runs there).
   */
  stream?: { deadline?: number };
}
/** @internal `server-shell.ts`: at the root tail; true = the tail writes nothing (a replay). */
export interface ShellHook {
  tail(recorder: Recorder): boolean;
  /** A streamed top-level `Async` (its props, its root owner) whose compiler fact marks it retainable (`$hole`, PPR-T6). */
  hole?(props: object, owner: Owner | null | undefined): void;
  /** H-holes hit: the request's deferred loader promises per data slot. */
  slots?: readonly (PromiseLike<unknown> | undefined)[];
}
/** @internal One render's frame (`_shellRecorder`). */
export interface Recorder {
  readonly options: Partial<StreamingResumableOptions>;
  /** Row / branch marker ids (`<!--rN[-->…<!--]-->`, the adopt run's anchors). */
  next: number;
  readonly derived: DerivedRender;
  /** Inside an `ErrorBoundary`'s synchronously evaluated content (or a slot / awaited `Async` content made there): `Show`
   * / `Switch` branches render without markers. */
  held: boolean;
}
export type { Recorder as _Recorder };

const store = new AsyncLocalStorage<Recorder>();
/** @internal The running render's frame (shell cache, bridges). */
export const _shellRecorder = (): Recorder | undefined => store.getStore();
/**
 * @internal Bridge hook: the CSP nonce of the current resumable render, sanitised the way the runtime writes it into its own
 * scripts, for framework islands whose inline scripts need it. `undefined` outside a resumable render or without a nonce.
 */
export function _renderNonce(): string | undefined {
  const nonce = store.getStore()?.options.nonce;
  return nonce ? String(nonce).replace(/[^\w+/=-]/g, "") : undefined;
}
// An effect created during a resumable render re-runs in its own request's async context: a write by another, concurrent
// request (module-level signal) must not run this render's work under that one.
_wrapEffects((fn) => {
  if (store.getStore() === undefined) return fn;
  const snapshot = AsyncLocalStorage.snapshot();
  return () => snapshot(fn);
});
// Server memory (VIRT-LEAK 2026-10-21): a keyed selector read during a render schedules its index fold in a timer; a Node
// timer keeps the async context it was created in, and with it this render's frame. The fold timer is created in the
// context captured here, at module load, outside any render.
const outside = store.exit(() => AsyncLocalStorage.snapshot());
_scheduleFolds((fn) => outside(() => (setTimeout(fn, 0) as unknown as { unref?: () => void }).unref?.()));
// `_rUnrecorded(fn)` (cdk collection build passes): `fn` runs outside the frame — no row / branch markers.
_setUnrecorded((fn) => (store.getStore() ? store.exit(fn) : fn()));

// For rows and Show / Switch branches keep `<!--rN[-->…<!--]-->` markers (the adopt run's anchors); a marker id that
// continues the stride of the two before it is left out (`MARK_CHAIN`).
const REGION = /* @__PURE__ */ _markFragments(["<!--r", "[-->", "<!--]-->"], MARK_CHAIN);
_onBranch((pick, _keyed, render) => {
  const [key, value] = pick();
  const get: ConstantGetter<unknown> = () => value;
  get[CONSTANT] = value;
  const recorder = store.getStore();
  return recorder && !recorder.held ? compiledTemplate(REGION, [recorder.next++, render(key, get)]) : render(key, get);
});
_onForRow((_list, item, _key, index, render) => {
  const get: ConstantGetter<unknown> = () => item;
  get[CONSTANT] = item;
  const at: ConstantGetter<number> = () => index;
  at[CONSTANT] = index;
  const recorder = store.getStore();
  return recorder ? compiledTemplate(REGION, [recorder.next++, render(get, at)]) : render(get, at);
});
// Content held in place (an `ErrorBoundary`'s content, and the slots / awaited `Async` content made while it evaluates):
// its branches render plainly.
const held =
  <T>(recorder: Recorder, fn: () => T) =>
  (): T => {
    if (store.getStore() !== recorder || recorder.held) return fn();
    recorder.held = true;
    try {
      return fn();
    } finally {
      recorder.held = false;
    }
  };
_onSlot((fn) => {
  const recorder = store.getStore();
  return recorder?.held ? held(recorder, fn) : fn;
});
_onAsyncContent(() => {
  const recorder = store.getStore();
  return recorder?.held ? <R>(fn: () => R): R => held(recorder, fn)() : null;
});
_onErrorBoundary(() => {
  const recorder = store.getStore();
  if (!recorder) return null;
  return {
    content<T>(fn: () => T): T {
      const outer = recorder.held;
      recorder.held = true;
      try {
        return fn();
      } finally {
        recorder.held = outer;
      }
    },
    defer: (value) => value,
    fail: () => noop,
    fallback: <T>(fn: () => T): T => fn(),
  };
});

const frame = (options: Partial<StreamingResumableOptions>): Recorder => {
  pending = options as DerivedOptions;
  try {
    return { options, next: 0, derived: createDerived(), held: false };
  } finally {
    pending = null;
  }
};
// The root tail: the boundaries script + loader, unless the shell cache writes nothing (a replay).
const tailOf = (recorder: Recorder) => (): ServerValue => (recorder.options.shell?.tail(recorder) ? null : derivedTail(recorder.derived));

/**
 * A resumable page as a string (`@rivetjs/runtime/server-resume` `resumableToString`): the content, then the derived tail
 * (`<script type="rivet/boundaries">`) and, with `manifest.runtime`, the inline loader.
 */
export function derivedToString(factory: () => ServerValue, options: Partial<ResumableOptions> = {}): string | Promise<string> {
  const recorder = frame(options);
  return store.run(recorder, () => withDerived(recorder.derived, () => renderToString([factory(), tailOf(recorder)], options)));
}

/** `renderResumable` (`@rivetjs/runtime/server-resume`): streaming twin of `derivedToString`. */
export function renderDerived(
  factory: () => ServerValue,
  writer: { write(chunk: string): unknown },
  options: Partial<StreamingResumableOptions> = {},
): void | Promise<void> {
  const recorder = frame(options),
    ctx = recorder.derived;
  const shell = store.run(recorder, () => withDerived(ctx, () => renderToWriter([factory(), tailOf(recorder)], writer as ServerWriter, options)));
  // Streamed `Async`s (DERIVED-C2): their segments follow the shell (state + loader included), in completion order.
  if (!ctx.stream) return shell;
  return Promise.resolve(shell).then(
    () => segments(ctx, writer),
    (error: unknown) => {
      release(ctx);
      throw error;
    },
  );
}

/**
 * The next top-level boundary listens on the whole document for clicks inside a `match` element (the router's generated
 * server entry, `a[href]`: link clicks anywhere — a document shell's links, content outside the app's markup — are the
 * root `App`'s). Tail `g` + loader `data-g`: such a click is held for that boundary even outside every boundary, and the
 * runtime adopts it before the replay, so its document listener (a `clientEvent`) sees the click. Outside a derived
 * render: nothing.
 */
export function _rListen(match: string): void {
  useContext(DERIVED)?.listen.push(match);
}

/** Run a render with `ctx` as its derived recorder (`_rB` / `_rSig` find it through the owner context). */
export function withDerived<T>(ctx: DerivedRender, fn: () => T): T {
  return provide(DERIVED, ctx, fn);
}

/** The boundary reads attribute to: the innermost body being evaluated, else the subtree being rendered. */
// A streamed segment's content renders under its `Async`'s owner, outside the boundary frame it was constructed in: that
// boundary (DERIVED-C2).
const current = (ctx: DerivedRender): Boundary | null =>
  ctx.stack.length ? ctx.stack[ctx.stack.length - 1]! : (useContext(CURRENT) ?? ctx.segment?.at ?? null);

/** Plain JSON data: primitives, arrays and plain objects of such (no functions, signals, class instances, Dates, Maps). */
export function isData(value: unknown, depth = 0): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  // `_rData`'s payload, checked a moment ago (the generated `Root`'s props): not walked twice.
  if (value === verified && value !== null) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || depth > 64) return false;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (!(i in value) || !isData(value[i], depth + 1)) return false;
    return true;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  for (const key in value) if (!isData((value as Record<string, unknown>)[key], depth + 1)) return false;
  return true;
}

/**
 * Open a boundary (compiled at the top of an interactive component's body). `flags`: `INDEPENDENT` / `ATTR` from the
 * compiler; an independent boundary whose `props` object is not data is demoted (`DEMOTED`, the flag cleared); `LOAD` /
 * `IDLE` / `VISIBLE` client triggers pass through. `events`: the delegated event types its handlers use (space separated,
 * loader `data-events`); `keys`: the keydown keys its handlers handle (held while cold, tail `k`). Outside a derived
 * render: `null` (every other call takes a null token and does nothing).
 */
export function _rB(name: string, flags: number, props?: object | null, events?: string, keys?: string): Boundary | null {
  const ctx = useContext(DERIVED);
  if (!ctx) return null;
  const parent = current(ctx);
  let keep: object | null = null;
  if (flags & INDEPENDENT) {
    if (props && isData(props)) keep = props;
    else flags = (flags & ~INDEPENDENT) | DEMOTED;
  }
  verified = null;
  const boundary: Boundary = {
    id: ctx.next++,
    parent,
    name,
    flags,
    props: keep,
    signals: [],
    keys: null,
    attr: false,
    out: false,
    an: 0,
    frame: null,
    made: 0,
    weight: 0,
    mark: 0,
  };
  if (events) for (const type of events.split(" ")) if (type) ctx.events.add(type);
  if (keys) ctx.keys[boundary.id] = keys;
  if (flags & TRIGGERS) ctx.boot = true;
  ctx.boundaries.push(boundary);
  ctx.stack.push(boundary);
  // Owners the body makes (a `Provider`, a scoped slot) render their lazy content after the body returned, outside the
  // `_rBOut` frame: while the body runs, its owner's context names this boundary (restored at `_rBEnd`), so content those
  // owners render later — an `Async` in a children slot under a provider (DERIVED-C3) — attributes to it, as the browser's
  // adopt run of this boundary's unit counts it.
  const owner = getOwner() as unknown as OwnerFrames | null;
  if (owner) {
    boundary.frame = [owner, owner.ctx];
    owner.ctx = { token: CURRENT, value: boundary, up: owner.ctx, owner, memo: null };
  }
  return boundary;
}

// `clientEffect` / `clientEvent` / `clientOnly` during a derived render: the open boundary gets the trigger `when` names
// (`interaction` / `media:` have no boundary trigger: the boundary runs at its first use).
_trigger.on = (when, kind) => {
  const ctx = useContext(DERIVED);
  const b = ctx && current(ctx);
  if (!b || b.id < ctx.base) return;
  const flag =
    when === undefined
      ? kind === ONLY_KIND
        ? VISIBLE
        : IDLE
      : when === "visible"
        ? VISIBLE
        : when === "idle"
          ? IDLE
          : when === "load"
            ? kind === EFFECT
              ? IDLE
              : LOAD
            : 0;
  if (!flag) return;
  b.flags |= flag;
  ctx.boot = true;
};
// A spread listener prop (`onPointerEnter` forwarded through cdk props): its type, unless the loader delegates it anyway.
const listenerTypes = new Map<string, string>();
_trigger.ev = (key) => {
  let type = listenerTypes.get(key);
  if (type === undefined) listenerTypes.set(key, (type = /^on(.+?)((?<!Pointer)Capture)?$/.exec(key)![1]!.toLowerCase()));
  if (!DEFAULT_TYPES.has(type)) useContext(DERIVED)?.events.add(type);
};

/**
 * A handler of a boundary body whose value the compiler cannot tell is a function (STATIC-ZERO T3: `cond ? f : undefined`,
 * `props.onX`, a hook's destructured handler), compiled in place of the server's evaluation slot: with a function the
 * boundary installs a listener (a conditional boundary keeps its record; `type`, a type the loader does not delegate by
 * default, joins `data-events`); without one nothing — a page whose only handlers are absent ships no tail.
 */
export function _rHandler(token: Boundary | null, value: unknown, type?: string): ServerValue {
  if (token && typeof value === "function") {
    token.on = true;
    if (type) useContext(DERIVED)?.events.add(type);
  }
  return omitted(value) as unknown as ServerValue;
}

/**
 * The attribute object of a native spread element written in a conditional boundary's own body (STATIC-ZERO T3, compiled
 * around the object `spreadAttributes` takes): a listener prop holding a function (`<Box onClick={…}>` forwarded through
 * `{...props}`) makes the instance live. Listeners spread by a component that is not a boundary (a cdk hook's handlers
 * inside a static `Link`) do not: that component runs in the browser only when an ancestor adopts.
 */
export function _rHandlers<T extends object>(token: Boundary | null, attrs: T): T {
  if (token && !token.on)
    for (const key in attrs) {
      const third = key.charCodeAt(2);
      if (
        key.charCodeAt(0) === 111 &&
        key.charCodeAt(1) === 110 &&
        third >= 65 &&
        third <= 90 &&
        typeof (attrs as Record<string, unknown>)[key] === "function"
      ) {
        token.on = true;
        break;
      }
    }
  return attrs;
}

/** Close a boundary body (compiled into the body's `finally`): the token leaves the stack, whatever is above it too. */
export function _rBEnd(token: Boundary | null): void {
  if (!token) return;
  const ctx = useContext(DERIVED);
  if (!ctx) return;
  const at = ctx.stack.lastIndexOf(token);
  if (at < 0) return;
  for (let i = ctx.stack.length - 1; i >= at; i--) {
    const frame = ctx.stack[i]!.frame;
    if (frame) frame[0].ctx = frame[1];
    ctx.stack[i]!.frame = null;
  }
  ctx.stack.length = at;
}

const COMMENTS = /* @__PURE__ */ Object.freeze(["<!--b", "-->", "<!--/b-->"]);

/**
 * The boundary's rendered value (compiled around every `return` of its body): a scoped record whose content renders
 * under a `CURRENT` frame naming the boundary (reads in lazy slots / rows / branches attribute to it), between
 * `<!--b<id>-->` … `<!--/b-->` unless its element root carries `data-b` (`_rBAttr`).
 */
export function _rBOut(token: Boundary | null, value: ServerValue): ServerValue {
  if (!token) return value;
  token.out = true;
  let owner = getOwner();
  const content = provide(CURRENT, token, () => {
    owner = getOwner();
    return value;
  });
  const scoped = _scopedRecord(owner, content, () => _dispose(owner)) as unknown as ServerValue;
  return token.attr ? scoped : compiledTemplate(COMMENTS, [token.id, scoped]);
}

/** `data-b="<id>"` on the boundary's element root (an attribute slot the compiler writes into the root's start tag). */
export function _rBAttr(token: Boundary | null): ServerValue {
  if (!token) return null;
  token.attr = true;
  return _attributeRecord("data-b", token.id, "html") as unknown as ServerValue;
}

function register(owner: Boundary, key: string, value: () => unknown): string {
  const keys = (owner.keys ??= new Map());
  const n = (keys.get(key) ?? 0) + 1;
  keys.set(key, n);
  const k = n > 1 ? key + "#" + n : key;
  owner.signals.push([k, value]);
  return owner.id + "." + k;
}

function wake(ctx: DerivedRender, id: string, reader: number): void {
  let set = ctx.wake.get(id);
  if (!set) ctx.wake.set(id, (set = new Set()));
  if (!set.has(reader)) {
    set.add(reader);
    ctx.dirty.add(id);
  }
}

/**
 * Keyed state (compiled from `signal(init)` in a resume module): the signal, registered on the boundary whose body is
 * evaluating (its value ships in the tail); a tracked read by another boundary adds that boundary to the key's wake
 * list. Outside a boundary (module level, a static component): a plain signal.
 */
export function _rSig<T>(key: string, init?: T, options?: EqualsOptions<T>): Signal<T> {
  const s = signal(init as T, options);
  const ctx = useContext(DERIVED);
  const owner = ctx && current(ctx);
  // (An H-holes hit's content outside a child boundary: the stored shell's boundary, not this render's — never registered.)
  if (!ctx || !owner || owner.id < ctx.base) return s;
  const id = register(owner, key, s);
  const src: Src = { c: owner, n: -1, k: id, x: ctx, s: null, r: null, z: 0 };
  owner.weight++;
  const get = function () {
    note(src);
    return s();
  } as Signal<T>;
  get.set = (value) => (wrote(src), s.set(value));
  get.update = (fn) => (wrote(src), s.update(fn));
  (get as unknown as Tracked)[SRC] = src;
  ctx.sources?.set(get, s);
  return get;
}

/** Keyed store (compiled from `createStore(init)`): registered like `_rSig` (value = `read(store)` at the flush); reads
 * through `read` / `at` are not wake-tracked in M2 (a store-reading boundary materialises on its own events only). */
export function _rSigStore<T extends object>(key: string, init: T): Store<T> {
  const store = createStore(init);
  const ctx = useContext(DERIVED);
  const owner = ctx && current(ctx);
  // Store reads are not tracked (M2): a render holding one defers nothing (DERIVED-C4).
  if (ctx) ctx.stores = true;
  if (ctx && owner && owner.id >= ctx.base) register(owner, key, () => read(store));
  return store;
}

// ---- Dependency facts (DERIVED-C4, 2026-10-21) ----
// The browser adopts a heavy dependent boundary (a cdk collection host: its build pass runs in both adopt runs) after its
// parent at idle, not with it, when every reactive source its subtree read from outside is named — the derived build
// routes `@rivetjs/reactivity`'s `signal` / `computed` / `selector` (and `/store`'s `createStore`) of every module but the
// runtime's own through `_dsignal` / `_dcomputed` / `_dselector` / `_dstore` (`server-derived-reactivity.ts`; the Vite plugin's
// derived alias). A plain signal made in a unit is numbered there (`made`, in creation order, outside build passes /
// computeds / streamed content — the browser's adopt run numbers its own the same way and checks the count, tail `c`); a
// read by a boundary outside the maker's subtree adds the reader to the wake list `"<maker>.$<n>"` (a write in the browser
// adopts the readers first, as for keyed signals). Marks (`mark`): `EAGER` — something made in the subtree was read outside
// it (it escaped), or the subtree wrote a source made outside it: the boundary adopts with its parent; `MOD` — the subtree
// read a source no wake key can name (module level, another render, a build pass): any such write in the browser adopts it
// first. Computed reads stand for their sources (recorded while they evaluate); a store in the render defers nothing.
/** A reactive source made through the derived alias: maker, number (-1: none), keyed wake id, render, computed sources;
 * the last boundary whose read was noted and (computeds) how many sources it had then — a read again by the same boundary
 * notes nothing new (DERIVED-C5: 1000 rows reading one host signal paid the walk + wake key per read, +27 % server CPU). */
interface Src {
  c: Boundary | null;
  n: number;
  k: string | null;
  x: DerivedRender | null;
  s: Set<Src> | null;
  r: Boundary | null;
  z: number;
  /** Numbered: its wake key, built on the first cross read. */
  w?: string;
}
const EAGER_MARK = 1,
  MOD_MARK = 2,
  /** Sources a subtree makes before it is worth adopting on its own (a cdk ListBox host: 15, a Table 30+). */
  DEFER_WEIGHT = 8;
/** A tracked getter's source (a property, not a WeakMap: no ephemeron per signal for the collector). */
const SRC = Symbol();
type Tracked = { [SRC]?: Src };
/** A store was made outside every render (module level): its reads are not tracked, nothing defers. */
let moduleStores = false;
/** `b` is `a` or inside its subtree. */
const within = (a: Boundary, b: Boundary | null): boolean => {
  for (let x = b; x !== null; x = x.parent) if (x === a) return true;
  return false;
};
/** Mark `from` and its ancestors up to (not including) the first one whose subtree holds `stop` (null: all of them). */
function markUp(from: Boundary, stop: Boundary | null, bit: number): void {
  for (let x: Boundary | null = from; x !== null && !(stop !== null && within(x, stop)); x = x.parent) x.mark |= bit;
}
/** A tracked read of `src`: inside a computed's evaluation one of its sources, else the current boundary's. */
function note(src: Src): void {
  const ctx = src.x ?? useContext(DERIVED);
  if (ctx === null) return;
  const ev = ctx.ev;
  if (ev.length) return void (ev[ev.length - 1]!.s ??= new Set()).add(src);
  const r = current(ctx);
  if (r === null) return;
  if (r.flags & COND && !r.hot && changes(ctx, src, r, 0)) r.hot = true;
  if (r !== src.c && (src.r !== r || (src.s !== null && src.z !== src.s.size))) cross(ctx, src, r, 0);
}
/**
 * `src` can change from outside `r`'s subtree: a signal made outside it (another boundary, module level, another render),
 * or a computed over such a source. A computed whose sources are all constant (cdk render props over literal props) or
 * made inside `r`'s subtree does not make `r` live (a write to those comes from a handler inside, whose boundary is kept).
 */
function changes(ctx: DerivedRender, src: Src, r: Boundary, depth: number): boolean {
  if (src.x !== ctx) return true;
  if (src.s === null) return src.c === null || !within(r, src.c);
  if (depth >= 32) return true;
  for (const t of src.s) if (changes(ctx, t, r, depth + 1)) return true;
  return false;
}
function cross(ctx: DerivedRender, src: Src, r: Boundary, depth: number): void {
  if (src.r === r && (src.s === null || src.z === src.s.size)) return;
  src.r = r;
  if (src.s !== null) src.z = src.s.size;
  const c = src.x === ctx ? src.c : null;
  if (src.s !== null) {
    // A computed: its sources, read now by `r` (cached reads ran nothing).
    if (src.x !== ctx) return markUp(r, null, MOD_MARK);
    if (depth < 32) for (const t of src.s) if (t.c !== r) cross(ctx, t, r, depth + 1);
    if (c !== null && !within(r, c) && !within(c, r)) markUp(c, r, EAGER_MARK);
    return;
  }
  if (c === null) return markUp(r, null, MOD_MARK);
  if (src.k !== null && c !== r) wake(ctx, src.k, r.id);
  if (within(r, c)) return;
  if (!within(c, r)) markUp(c, r, EAGER_MARK);
  if (src.k !== null) return;
  if (src.n < 0) return markUp(r, c, MOD_MARK);
  wake(ctx, (src.w ??= c.id + ".$" + src.n), r.id);
  ctx.counted.add(c);
}
/** A write while the server renders: a boundary writing a source made outside its subtree adopts with its parent. */
function wrote(src: Src): void {
  const ctx = useContext(DERIVED);
  const w = ctx && current(ctx);
  if (w === null || (src.x === ctx && src.c !== null && within(w, src.c))) return;
  markUp(w, src.x === ctx ? src.c : null, EAGER_MARK);
}
function made(ctx: DerivedRender | null, s: Src): void {
  const c = s.c;
  if (ctx === null || c === null) return;
  c.weight++;
  if (s.s === null && !_tracking() && ctx.segment === null && _shellRecorder() !== undefined) s.n = c.made++;
}
/** Derived alias of `signal` (DERIVED-C4): the signal, its reads and writes noted while a derived render runs. */
export function _dsignal<T>(init?: T, options?: EqualsOptions<T>): Signal<T> {
  const s = signal(init as T, options);
  const ctx = useContext(DERIVED);
  const src: Src = { c: ctx && current(ctx), n: -1, k: null, x: ctx, s: null, r: null, z: 0 };
  made(ctx, src);
  const get = function () {
    note(src);
    return s();
  } as Signal<T>;
  get.set = (value) => (wrote(src), s.set(value));
  get.update = (fn) => (wrote(src), s.update(fn));
  (get as unknown as Tracked)[SRC] = src;
  ctx?.sources?.set(get, s);
  return get;
}
/** Derived alias of `computed` (DERIVED-C4): its reads while it evaluates become its sources; a read of it reads them. */
export function _dcomputed<T>(fn: () => T, options?: EqualsOptions<T>): () => T {
  const ctx = useContext(DERIVED);
  const src: Src = { c: ctx && current(ctx), n: -1, k: null, x: ctx, s: new Set(), r: null, z: 0 };
  made(ctx, src);
  const base = computed(
    ctx === null
      ? fn
      : () => {
          ctx.ev.push(src);
          try {
            return fn();
          } finally {
            ctx.ev.pop();
          }
        },
    options,
  ) as () => T;
  const get = (): T => {
    const value = base();
    note(src);
    return value;
  };
  (get as unknown as Tracked)[SRC] = src;
  return get;
}
/** Derived alias of `selector` (DERIVED-C4): a key read reads its source (the selector caches it). */
export function _dselector<T, K = T, R = boolean>(
  source: () => T,
  fn?: (key: K, value: T) => R,
  options?: { keys?: (next: T, previous: T) => Iterable<K> | null | undefined },
): (key: K) => R {
  const tracked = (source as Tracked)[SRC] ? source : _dcomputed(source);
  const src = (tracked as Tracked)[SRC]!;
  const read = selector(tracked, fn, options);
  return (key) => {
    note(src);
    return read(key);
  };
}
/** Derived alias of `createStore` (DERIVED-C4): store reads are not tracked, so a render holding one defers nothing. */
export function _dstore<T extends object>(init: T): Store<T> {
  const ctx = useContext(DERIVED);
  if (ctx) ctx.stores = true;
  else moduleStores = true;
  return createStore(init);
}
// A `Router` level renders here (generated route modules, `derived-eager.ts`): its swap and revived loads are the page
// load's, so this boundary and its ancestors adopt with their parents.
_onEager(() => {
  const ctx = useContext(DERIVED),
    r = ctx && current(ctx);
  if (r) markUp(r, null, EAGER_MARK);
});
// ---- Framework islands (M6-PARITY, `@rivetjs/bridge`) ----
// A hydrated island with plain JSON props rendered in the shell boots through the bridge's lean boot (its records + boot
// script before the boundaries tail): the Rivet runtime never runs for it. Any other one (live / callback props, Rivet
// slot content, `intent`, or first rendered in a streamed segment) is hydrated by the adopt run of the boundary rendering
// it (`dom-derived.ts` island holes): that boundary gets the island's trigger (`load` / `only` → LOAD, `visible` → VISIBLE,
// else IDLE: the bridge driver applies the policy itself once adopted) and tail / patch `i` names the island. Outside every
// boundary such an island cannot hydrate (dev warning).
const ISLAND_WHEN: Record<string, number> = { load: LOAD, only: LOAD, visible: VISIBLE };
_onIsland((entry) => {
  const ctx = useContext(DERIVED);
  if (!ctx) return false;
  const values = entry.values();
  entry.props = typeof values === "string" ? null : values;
  if (entry.props !== null && !ctx.tailed) return (ctx.lean.push(entry), true);
  const at = current(ctx);
  if (at === null) {
    if (warned.size < 64 && !warned.has(entry.key)) {
      warned.add(entry.key);
      console.warn(
        "[rivet:bridge] island " +
          entry.key +
          " does not hydrate on the derived model: its props need the Rivet runtime and no interactive component renders it",
      );
    }
    return true;
  }
  at.flags |= entry.on === undefined ? IDLE : (ISLAND_WHEN[entry.on] ?? IDLE);
  ctx.boot = true;
  ctx.adopt.push(entry);
  return true;
});
/** Flush: `DEFER` / `MOD` on the dependent boundaries whose subtree is closed and heavy enough (`flags`), creator counts. */
function deferFlags(ctx: DerivedRender, from: number): void {
  if (ctx.stores || moduleStores || ctx.sources !== null || (ctx.stream && ctx.asyncs.some((a) => a.state === 0 || a.state === 3))) return;
  const weight = new Map<Boundary, number>();
  for (let i = ctx.boundaries.length - 1; i >= 0; i--) {
    const b = ctx.boundaries[i]!,
      w = (weight.get(b) ?? 0) + b.weight;
    weight.set(b, w);
    if (b.parent) weight.set(b.parent, (weight.get(b.parent) ?? 0) + w);
  }
  for (let i = from; i < ctx.boundaries.length; i++) {
    const b = ctx.boundaries[i]!;
    if (b.parent === null || !b.out || b.flags & (INDEPENDENT | TRIGGERS) || b.mark & EAGER_MARK || weight.get(b)! < DEFER_WEIGHT) continue;
    b.flags |= DEFER | (b.mark & MOD_MARK ? MOD : 0);
  }
}

// ---- Streamed holes (DERIVED-C2, 2026-10-21) ----
// An `Async` with a fallback whose load is pending writes `<!--a<id>-->…<!--/a-->` around its output and an entry in the
// tail / patch (`BoundaryTail.a`): the boundary whose unit constructed it and its place `k` among that unit's `Async`s
// with a fallback (the browser's adopt run counts them the same way and turns that one into a hole), then its value once
// settled. Not streaming (`derivedToString`, `renderDerived` without `stream`): the content renders in place, the value is
// in the shell's tail. Streaming: the fallback renders in place; once the load settles the content renders as a segment
// (`<template data-a>` + `<script type="rivet/boundaries" data-patch>` + `$rD(id)`, the swap add-on `DERIVED_STREAM`
// first) after the shell, its boundaries numbered on from the shell's, in completion order (a nested one after the
// segment holding it). The browser swaps the content in and adopts it with the value (`dom-derived.ts` async holes); a
// value that is not JSON data, a failed load or a stream cut by `deadline` leaves it to the browser (its load runs there).
// Ruling (DERIVED-C2): the hole is keyed by (boundary, k), not by a marker id the client cannot know before aligning — the
// adopt run must decide hole vs plain `Async` while probing, before it sees the server's nodes.
const ASYNC = /* @__PURE__ */ Object.freeze(["<!--a", "-->", "<!--/a-->"]);
const NONE: unique symbol = Symbol();
const noop = (): void => {};
const prior = _asyncHook();
_onAsync(() => {
  const ctx = useContext(DERIVED);
  return ctx ? derivedAsync(ctx) : prior ? prior() : null;
});
// An app `<Async>` without a fallback function (M6-PARITY task 4): awaited in place as before, now between its markers
// with its value in the tail, so the browser adopts its content instead of loading again.
_onUserAsync(() => {
  const ctx = useContext(DERIVED);
  return ctx ? derivedAsync(ctx) : null;
});
// `resource()` (M6-PARITY task 3): its state ships as a keyed value `$r` of the boundary whose body made it (in creation
// order; the browser's adopt run numbers its own the same way and binds the seed, so it does not load again). A Suspense
// build discarded because a read was pending (`server-resource.ts` `build`) drops what it recorded: its boundaries, the
// `Async` places and keyed values it counted — the build that renders numbers them again, as the browser's single run does.
interface DerivedMark {
  ctx: DerivedRender;
  next: number;
  n: number;
  asyncs: number;
  an: number;
  at: Boundary | null;
  atAn: number;
  seg: DerivedAsyncState | null;
  segAn: number;
  signals: number;
  keys: [string, number][] | null;
  made: number;
}
_onDerivedResource({
  seed(get) {
    const ctx = useContext(DERIVED);
    const owner = ctx && current(ctx);
    if (!ctx || !owner || owner.id < ctx.base) return;
    register(owner, "$r", () => {
      const seed = get();
      return isData(seed) ? seed : { x: 1 };
    });
  },
  mark() {
    const ctx = useContext(DERIVED);
    if (!ctx) return null;
    const at = current(ctx),
      seg = ctx.segment;
    return {
      ctx,
      next: ctx.next,
      n: ctx.boundaries.length,
      asyncs: ctx.asyncs.length,
      an: ctx.an,
      at,
      atAn: at?.an ?? 0,
      seg,
      segAn: seg?.an ?? 0,
      signals: at?.signals.length ?? 0,
      keys: at?.keys ? [...at.keys] : null,
      made: at?.made ?? 0,
    } satisfies DerivedMark;
  },
  cut(mark) {
    const m = mark as DerivedMark,
      ctx = m.ctx;
    for (let i = m.n; i < ctx.boundaries.length; i++) delete ctx.keys[ctx.boundaries[i]!.id];
    ctx.boundaries.length = m.n;
    ctx.next = m.next;
    for (let i = m.asyncs; i < ctx.asyncs.length; i++) ctx.changed.delete(ctx.asyncs[i]!);
    ctx.asyncs.length = m.asyncs;
    ctx.an = m.an;
    if (m.seg) m.seg.an = m.segAn;
    const at = m.at;
    if (at) {
      at.an = m.atAn;
      at.signals.length = m.signals;
      at.keys = m.keys && new Map(m.keys);
      at.made = m.made;
    }
  },
});
function derivedAsync(ctx: DerivedRender): AsyncStream {
  // Constructed while another `Async`'s content renders, in that content's own unit (not in a boundary body inside it):
  // keyed by that `Async` (`-id`: the browser adopts its content as a unit of its own and counts there).
  const seg = ctx.segment,
    at = current(ctx),
    by = seg && at === seg.at ? seg : at,
    forced = ctx.forced;
  // An H-holes hit re-runs a retained hole: its key and place are the fill's (the shell's counters are not re-run).
  ctx.forced = null;
  // (No segment and no boundary — an `Async` outside every boundary: `by` and `seg` are both null — keys at the page.)
  const b = forced ? forced[0] : seg && by === seg ? -seg.id : (at?.id ?? 0),
    k = forced ? forced[1] : by ? by.an++ : ctx.an++;
  let entry: DerivedAsyncState | null = null;
  return {
    defer(loaded, success, failure, fallback, owner, _abort, own, _prepare, hole) {
      const a: DerivedAsyncState = (entry = {
        id: ctx.asyncs.length + 1,
        b,
        k,
        state: 0,
        value: undefined,
        enc: false,
        at,
        an: 0,
        parent: seg,
        html: null,
        out: false,
        dispose: null,
        own,
      });
      // No fallback to stream first (an app `Async` without one): awaited in place, also while streaming.
      const inplace = !ctx.stream || typeof fallback !== "function";
      if (ctx.stream && inplace) a.out = true;
      ctx.asyncs.push(a);
      ctx.changed.add(a);
      // Shell cache fill (H-holes): a streamed top-level boundary the compiler marked `$hole` may be retained.
      if (hole && ctx.stream && !seg && ctx.sources) _shellRecorder()?.options.shell?.hole?.(hole, owner);
      // In place: the content renders where the boundary is (its `Async`s constructed meanwhile are its own).
      const inside = (fn: () => unknown): ServerValue => {
        const outer = ctx.segment;
        ctx.segment = a;
        try {
          return fn() as ServerValue;
        } finally {
          ctx.segment = outer;
        }
      };
      if (inplace)
        return compiledTemplate(ASYNC, [
          a.id,
          loaded.then(
            (value) => ((a.html = ""), settled(ctx, a, value), inside(() => success(value))),
            (cause) => (settled(ctx, a, NONE), inside(() => failure(cause))),
          ),
        ]);
      const content = (outcome: () => unknown, value: unknown): void => {
        const outer = ctx.segment;
        ctx.segment = a;
        a.state = 3;
        let html: string | Promise<string> | null;
        try {
          html = renderToString(
            _scopedRecord(owner ?? null, outcome() as ServerValue, noop) as unknown as ServerValue,
            {
              signal: ctx.options?.signal,
              variant: ctx.options?.variant,
            } as never,
          );
        } catch {
          html = null;
        } finally {
          ctx.segment = outer;
        }
        Promise.resolve(html).then(
          (text) => ((a.html = text), settled(ctx, a, value)),
          () => ((a.html = null), settled(ctx, a, NONE)),
        );
      };
      loaded.then(
        (value) => content(() => success(value), value),
        (cause) => content(() => failure(cause), NONE),
      );
      return compiledTemplate(ASYNC, [a.id, fallback()]);
    },
    release(dispose) {
      // Rendered in place (no stream, or no fallback to stream): its content is in the shell already.
      if (!entry || !ctx.stream || entry.out) return dispose();
      entry.dispose = dispose;
    },
  };
}
function settled(ctx: DerivedRender, a: DerivedAsyncState, value: unknown): void {
  if (value === NONE || a.html === null) a.state = 2;
  else if (isData(value)) ((a.state = 1), (a.value = value));
  else {
    // Not JSON data (a Date, Map, URL, registerClass instance, …): its resume table (`_rData`'s wire, decoded by the
    // decoder the router's generated `Root` installs); what the table cannot encode, or what needs the built-in decoders'
    // chunk, renders in the browser (settled 0) as before.
    const encoded = encodeTable(ctx, value);
    if (encoded) ((a.state = 1), (a.value = encoded), (a.enc = true));
    else a.state = 2;
  }
  ctx.changed.add(a);
  const wake = ctx.wakeup;
  ctx.wakeup = null;
  wake?.();
}
// After the shell: each settled segment whose parent is out, then wait; at the deadline the rest continue in the browser.
async function segments(ctx: DerivedRender, writer: { write(chunk: string): unknown }): Promise<void> {
  const options = ctx.options,
    signal = options?.signal,
    deadline = options?.stream?.deadline,
    nonce = options?.nonce ? ' nonce="' + String(options.nonce).replace(/[^\w+/=-]/g, "") + '"' : "",
    open = "<script" + nonce + ">";
  let expired = false;
  const timer = deadline == null ? null : setTimeout(() => ((expired = true), ctx.wakeup?.()), Math.max(0, deadline));
  const chunk = (a: DerivedAsyncState): string => {
    let out = ctx.addon ? "" : ((ctx.addon = true), open + DERIVED_STREAM + "</script>");
    if (a.state === 1 || a.html !== null) out += '<template data-a="' + a.id + '">' + (a.html ?? "") + "</template>";
    return out + derivedPatch(ctx, a.id) + open + "$rD(" + a.id + ")</script>";
  };
  try {
    for (;;) {
      if (signal?.aborted) return;
      const next = ctx.asyncs.find((a) => !a.out && (a.state === 1 || a.state === 2) && (!a.parent || a.parent.out));
      if (next) {
        next.out = true;
        await writer.write(chunk(next));
        continue;
      }
      const left = ctx.asyncs.filter((a) => !a.out);
      if (!left.length) return;
      if (expired) {
        for (const a of left) ((a.out = true), (a.state = 2), (a.html = null), ctx.changed.add(a));
        await writer.write(chunk(left[0]!));
        return;
      }
      await new Promise<void>((resolve) => (ctx.wakeup = resolve));
    }
  } finally {
    if (timer) clearTimeout(timer);
    release(ctx);
  }
}
// The stream is over: every streamed boundary's root goes (its content rendered, or it never will).
function release(ctx: DerivedRender): void {
  for (const a of ctx.asyncs) {
    const dispose = a.dispose ?? a.own;
    a.dispose = a.own = null;
    try {
      dispose?.();
    } catch {}
  }
}

// ---- Route payload (DERIVED-S, 2026-10-21) ----
// The router's generated server entry passes its `Root` props payload through `_rData`: plain JSON data stays as it is (the
// tail's one `JSON.stringify`); anything else the resume table encodes — Date, Map, Set, BigInt, undefined, NaN / ±Infinity,
// -0, URL, cycles / shared references, RegExp, URLSearchParams, binary, errors, `registerClass` instances — ships as the
// table `{ t, r }` (the router's data-endpoint wire, `encodeData`), decoded by the generated browser `Root` (`createDecoder`);
// RegExp / URLSearchParams / binary / errors / registered classes need `@rivetjs/runtime/resume-builtins`: the payload then
// names its chunk (`x` = manifest `builtins`, as the data endpoint does) and `Root.ready` loads it as a module script (a
// bundled `import()` of the side-effect module would be dropped: the package is `sideEffects: false`). What the table cannot encode (functions, symbols, promises, other class instances — `static [revive]`
// needs a class symbol, which the derived model has not) warns RV2107 once per message and the payload is kept as is:
// `Root` is demoted (no props), the page renders but does not resume.
let verified: object | null = null;
const warned = new Set<string>();
// The `registerClass` hooks of `value`'s own class (the first own `constructor` on its chain), as server-resume finds them.
function hooksOf(value: object): ClassHooks | undefined {
  const registry = (globalThis as { [_CLASSES]?: ClassRegistry })[_CLASSES]?.of;
  if (registry === undefined || typeof value === "function" || Array.isArray(value)) return undefined;
  for (let p = Object.getPrototypeOf(value); p !== null && p !== Object.prototype; p = Object.getPrototypeOf(p))
    if (Object.hasOwn(p, "constructor")) return registry.get((p as { constructor: object }).constructor);
  return undefined;
}
function registered(value: object, ref: (value: unknown) => number): TableEntry | undefined {
  const hooks = hooksOf(value);
  if (hooks === undefined) return undefined;
  const write = hooks.serialize ?? (value as { [serialize]?: () => unknown })[serialize];
  if (typeof write !== "function")
    throw new TypeError(typeName(value) + " is not serializable: registerClass `" + hooks.id + "` has no serialize hook and the instance no [serialize]()");
  return { cls: hooks.id, a: [ref(hooks.serialize ? hooks.serialize(value) : (write as () => unknown).call(value))], rv: 1 };
}
const opaque = (value: object): boolean => hooksOf(value) !== undefined;
/** A wire-encoded route payload (`_rData`): the resume table and its root reference. */
export interface EncodedData {
  t: TableEntry[];
  r: number;
  /** The built-in decoders' chunk (manifest `builtins`) when the table holds built-in entries. */
  x?: string;
}
// A settled `Async` value that is not JSON data as its resume table (no warning: the hole then renders in the browser).
function encodeTable(ctx: DerivedRender, value: unknown): EncodedData | null {
  try {
    const encoder = createEncoder({ special: registered, opaque, origin: ctx.options?.origin });
    const r = encoder.ref(value);
    return _builtinKinds(encoder.table) ? null : { t: encoder.table, r };
  } catch {
    return null;
  }
}
/**
 * Router ABI (generated `entry.server.tsx`, derived model): the `Root` boundary's route payload as `Root` props can carry it —
 * `payload` itself when it is JSON data, else its resume table encoding (`EncodedData`), else (RV2107 warning) `payload`.
 */
export function _rData<T extends object>(payload: T): T | EncodedData {
  if (isData(payload)) return (verified = payload);
  try {
    const options = useContext(DERIVED)?.options;
    const encoder = createEncoder({ special: registered, opaque, origin: options?.origin });
    const r = encoder.ref(payload),
      x = _builtinKinds(encoder.table) ? options?.manifest?.builtins : undefined;
    return (verified = x ? { t: encoder.table, r, x } : { t: encoder.table, r });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (warned.size < 64 && !warned.has(reason)) {
      warned.add(reason);
      console.warn(
        "[RV2107] Route data cannot resume (derived model): " +
          reason +
          ". The page renders but does not resume. Return JSON data, Date / Map / Set / BigInt / URL values, or instances of a class registered with registerClass(…) from loaders.",
      );
    }
    return payload;
  }
}

// ---- Derived rows (DERIVED-S, 2026-10-21) ----
// A keyed `<For>` the derived server target list-mounts (`$list: [plan, each]`, the plain server's FLATTEN-CMP-3 row
// plan) calls `_rFor` instead of `For`. Under a derived render its rows are written from ONE list tape — the plan with the
// row region markers folded into its first / last fragment (`<!--r[-->…<!--]-->`: the derived client claims row groups by
// balance, never by id) — so byte writers take the WebAssembly row emitter (`_listRows`) as plain server lists do, instead
// of one row record + template record + REGION record per row through the resume row hook (`forRow`). Outside a derived
// render (or without a list mount): the ordinary `For`. Same evaluation order as `For` under the row hook: `each`, every
// `by`, then the rows in order under the For's root.
const ROW = /* @__PURE__ */ Object.freeze(["<!--r[-->", "<!--]-->"]);
const rowPlans = new WeakMap<ListPlan, ListPlan>();
function rowPlan(plan: ListPlan): ListPlan {
  let marked = rowPlans.get(plan);
  if (marked === undefined) {
    const fragments = plan.fragments.slice(),
      last = fragments.length - 1;
    fragments[0] = "<!--r[-->" + fragments[0];
    fragments[last] = fragments[last] + "<!--]-->";
    rowPlans.set(plan, (marked = { fragments: Object.freeze(fragments), attributes: plan.attributes, bytes: null, fixed: 0, rows: plan.rows }));
  }
  return marked;
}
type ForProps = Parameters<typeof For>[0];
const noRow = (): never => {
  throw new Error("unreachable");
};
// Test hook: false sends every `_rFor` through `For` (the resume row hook's per-row records), the pre-DERIVED-S path.
let tapeRows = true;
/** Test hook (internal): derived list rows from one tape on / off for the rest of the process (`tests/derived-rows.test.ts`). */
export function _setDerivedRows(enabled: boolean): void {
  tapeRows = enabled;
}
/** Compiler ABI (derived server target): a list-mounted `<For>` (`$list`). */
export function _rFor(props: ForProps): ServerValue {
  const $list = props.$list,
    ctx = useContext(DERIVED);
  if ($list === undefined || !tapeRows || !ctx) return For(props) as unknown as ServerValue;
  let owner = getOwner();
  const root = createRoot(() => {
    owner = getOwner();
    return derivedRows(props, $list, ctx);
  });
  return _scopedRecord(owner, root.value, root.dispose) as unknown as ServerValue;
}
function derivedRows(props: ForProps, $list: NonNullable<ForProps["$list"]>, ctx: DerivedRender): unknown {
  const { each, by, children } = props;
  const items = typeof each === "function" ? (each as () => readonly unknown[])() : each;
  if (!Array.isArray(items)) throw new TypeError("For each must return an array (or be one)");
  const keys = new Set<unknown>();
  let dense = Object.getPrototypeOf(items) === Array.prototype;
  for (let index = 0; index < items.length; index++) {
    if (!(index in items)) dense = false;
    const key = (by as (item: unknown, index: number) => unknown)(items[index], index);
    if (keys.has(key)) throw new Error("Duplicate For key");
    keys.add(key);
  }
  // A plain dense array: one list over the marked plan (`_list` keeps `.map`'s observable reads: Get map / length /
  // constructor, then each index).
  if (dense) {
    const marked = rowPlan($list[0]),
      list = _list(items, noRow, marked, $list[1] as (tape: unknown[], base: number, item: unknown, index: number) => void);
    return ctx.dom !== null && items.length ? derivedDom.api!.list(ctx.dom, items, $list[0], marked, list, ROWS) : list;
  }
  // Holes / subclasses: row by row, each between its row region markers (as the resume row hook writes them).
  const rows: ServerValue[] = new Array(items.length);
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    rows[index] = compiledTemplate(ROW, [
      (children as (get: () => unknown, at: () => number) => ServerValue)(
        () => item,
        () => index,
      ),
    ]) as unknown as ServerValue;
  }
  ROWS.add(rows);
  return rows;
}

/** Records of the boundaries not flushed yet (values read now), plus the wake lists changed since the last flush. */
// Island keys of the last flush's `i` (the tail's fetch-ahead lists their chunks).
let islandUrls: string[] = [];
function flush(ctx: DerivedRender): BoundaryTail | null {
  islandUrls = [];
  if (ctx.flushed === ctx.boundaries.length && ctx.dirty.size === 0 && ctx.changed.size === 0 && ctx.adopt.length === 0) return null;
  const b: BoundaryRecord[] = [];
  let d: DerivedDom[] | undefined;
  deferFlags(ctx, ctx.flushed);
  keep(ctx, ctx.flushed);
  for (let i = ctx.flushed; i < ctx.boundaries.length; i++) {
    const boundary = ctx.boundaries[i]!;
    if (boundary.flags & COND && !boundary.kept) continue;
    boundary.flags &= ~COND;
    const signals: unknown[] = [];
    for (const [key, value] of boundary.signals) {
      const v = value();
      if (isData(v)) signals.push(key, v);
      else boundary.flags |= UNKEYED;
    }
    if (!boundary.out) boundary.flags |= SILENT;
    const record: BoundaryRecord = [boundary.id, boundary.parent?.id ?? 0, boundary.flags, boundary.name, signals];
    if (boundary.props)
      record.push(ctx.dom?.length ? (derivedDom.api!.props(ctx.dom, boundary.id, boundary.props, [], (d ??= []), 0) as object) : boundary.props);
    b.push(record);
  }
  ctx.flushed = ctx.boundaries.length;
  const tail: BoundaryTail & { i?: string[] } = { v: 1, b };
  if (ctx.adopt.length) tail.i = ctx.adopt.splice(0).map((island) => (islandUrls.push(island.key), island.id));
  if (d?.length) tail.d = d;
  // `_rListen`: the first top-level boundary of this flush takes the pending document click listeners.
  if (ctx.listen.length) {
    const root = b.find((record) => record[1] === 0);
    if (root) {
      tail.g = ctx.listen.map((match) => [root[0], match]);
      ctx.clicks ||= ctx.listen.join(",");
      ctx.listen = [];
    }
  }
  const manifest = ctx.options?.manifest;
  if (manifest) {
    const m: Record<string, string> = {},
      k: Record<string, string> = {};
    let named = false,
      keyed = false;
    for (const [id, , , name] of b) {
      const url = manifest.symbols?.[name];
      if (url !== undefined) ((m[name] = url), (named = true));
      if (ctx.keys[id] !== undefined) ((k[id] = ctx.keys[id]!), (keyed = true));
    }
    if (named) tail.m = m;
    if (keyed) tail.k = k;
  }
  if (ctx.dirty.size) {
    const w: Record<string, number[]> = {};
    for (const id of ctx.dirty) w[id] = [...ctx.wake.get(id)!];
    ctx.dirty.clear();
    tail.w = w;
  }
  if (ctx.counted.size) {
    const c: Record<string, number> = {};
    for (const x of ctx.counted) c[x.id] = x.made;
    ctx.counted.clear();
    tail.c = c;
  }
  if (ctx.changed.size) {
    // A segment settled but not written yet ships as pending: its value comes with its own content.
    const a: DerivedAsync[] = [],
      later: DerivedAsyncState[] = [];
    for (const x of ctx.changed) {
      const done = (x.state === 1 || x.state === 2) && (x.out || !ctx.stream);
      a.push(done ? (x.state === 1 ? [x.id, x.b, x.k, x.enc ? 2 : 1, x.value] : [x.id, x.b, x.k, 0]) : [x.id, x.b, x.k]);
      if (!done && x.state !== 0 && x.state !== 3) later.push(x);
    }
    ctx.changed.clear();
    for (const x of later) ctx.changed.add(x);
    tail.a = a;
  }
  // Every boundary of this flush was a static conditional instance: nothing for the browser (no runtime, no chunk).
  if (!b.length && !tail.i && !tail.d && !tail.w && !tail.c && !tail.a) return null;
  return tail;
}

// ---- Conditional boundaries (M6-PARITY 6b, 2026-10-22) ----
// Props are live when the caller passes a reactive value; literals are static. The build marks `COND` the boundaries
// without a change source of their own (no handler, keyed state, effect, resource, Async, island): they are boundaries
// only because some caller may feed them live data, a live context, or because they render an interactive child. Per
// instance, the server keeps such a record when the instance turned out live: its unit read a source that can change
// from outside its subtree (`changes`: a live prop getter, slot content reading the caller's signal, a context value over
// a signal), a boundary below it was kept, its body installs a listener (`_rHandler` / `_rHandlers` saw a function,
// STATIC-ZERO T3), it holds an `Async` / island trigger / keyed state, something it made escaped
// or it wrote outside (`EAGER_MARK`), or the render holds a store (store reads are not tracked). Otherwise the record is
// dropped: its markers stay on the page (inert: no record, the browser's adopt run of an ancestor keeps its server nodes
// as a hole), and a page of static instances only (`<Meter value={40}>`) ships no tail, no runtime, no chunk.
function keep(ctx: DerivedRender, from: number): void {
  const all = ctx.stores || moduleStores;
  for (let i = ctx.boundaries.length - 1; i >= from; i--) {
    const x = ctx.boundaries[i]!;
    if (
      !(x.flags & COND) ||
      all ||
      x.hot ||
      x.kept ||
      x.on ||
      x.flags & TRIGGERS ||
      x.an ||
      x.signals.length ||
      x.mark & EAGER_MARK ||
      ctx.keys[x.id] !== undefined
    ) {
      x.kept = true;
      if (x.parent) x.parent.kept = true;
    }
  }
}

/** The shell's tail script (null when the render opened no boundary). A trusted one-fragment template, as the state script. */
export function derivedTail(ctx: DerivedRender): ServerValue {
  const tail = flush(ctx);
  ctx.tailed = true;
  const options = ctx.options;
  // Lean islands (M6-PARITY): their records + the bridge's boot, before the boundaries tail (each script reads the one
  // right before it). A page whose only boundaries are such islands ships nothing else.
  const lean = ctx.lean.length
    ? ctx.lean[0]!.tail(ctx.lean, options?.manifest as never, options?.nonce ? String(options.nonce).replace(/[^\w+/=-]/g, "") : "")
    : "";
  if (!tail) return lean ? template([lean]) : null;
  const json = escapeJSON(JSON.stringify(tail));
  if (!options?.manifest?.runtime) return template([lean + '<script type="rivet/boundaries">' + json + "</script>"]);
  // Fetch-ahead (DERIVED-C): the runtime, the chunks of the page's boundaries (tail `m`) and their static import closures
  // (manifest `deps`), as low-priority modulepreloads after `load` (`data-fo`; fetched + compiled, never evaluated before
  // an event): the first click evaluates modules already in the module map instead of an import waterfall.
  const manifest = options.manifest,
    deps = manifest.deps;
  let ahead = "";
  if (!options.preload?.lean) {
    const urls = new Set<string>();
    // (+ the chunks of the islands an adopt run hydrates, M6-PARITY.)
    const islands = (manifest as { islands?: Record<string, string> }).islands;
    for (const url of [manifest.runtime!, ...(tail.m ? Object.values(tail.m) : []), ...islandUrls.map((key) => islands?.[key]!).filter(Boolean)]) {
      urls.add(url);
      if (deps?.[url]) for (const dep of deps[url]!) urls.add(dep);
    }
    ahead = [...urls].join(" ");
  }
  // The derived client: attributes the loader reads, then the loader (same nonce sanitising as the serialized loader).
  const nonce = options.nonce ? ' nonce="' + String(options.nonce).replace(/[^\w+/=-]/g, "") + '"' : "",
    events = [...ctx.events].filter((type) => !DEFAULT_TYPES.has(type)).join(" "),
    attrs =
      ' data-rt="' +
      attr(options.manifest.runtime) +
      '"' +
      (events ? ' data-events="' + attr(DEFAULT_EVENTS + " " + events) + '"' : "") +
      (ctx.boot ? " data-boot" : "") +
      (ctx.clicks ? ' data-g="' + attr(ctx.clicks) + '"' : "") +
      (ahead ? ' data-fo="' + attr(ahead) + '"' : "");
  return template([lean + '<script type="rivet/boundaries"' + attrs + ">" + json + "</script><script" + nonce + ">" + DERIVED_LOADER + "</script>"]);
}
/** The loader's event types when `data-events` is absent (`resume-loader-derived.ts`); `data-events` = these + the page's
 * other listener types (boundary `events`, spread listener props). */
const DEFAULT_EVENTS = "click input change submit keydown pointerdown pointerup mousedown mouseup focusin focusout";
const DEFAULT_TYPES = new Set(DEFAULT_EVENTS.split(" "));
const attr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** A streamed segment's patch (records + wake lists added since the last flush), "" when nothing was added. */
export function derivedPatch(ctx: DerivedRender, marker: number): string {
  const tail = flush(ctx);
  return tail ? '<script type="rivet/boundaries" data-patch="' + marker + '">' + escapeJSON(JSON.stringify(tail)) + "</script>" : "";
}

// ---- Shell cache (DERIVED-C3, 2026-10-21) ----
// A stored shell of a derived page (router route rule `shell`, `server-shell.ts`): the prefix ends after the derived tail
// (boundaries script + loader). Muted replay: the shell renders again, its tail is flushed (records count as written) but
// not written. H-holes: the fill retains its top-level `Async` holes (`$hole`) with their unit key / place and the next
// boundary id; a hit renders no shell, re-runs each hole under its frame with this render's recorder (`hole`: the fill's
// key / place forced, content boundaries numbered from the fill's `next`), and its patches carry what the fill's did — not
// wake lists from the content's reads of shell boundaries: a fill whose content made one keeps the entry on replays.
const DERIVED_SEAL: ShellSeal = Object.freeze({ d: 1 });
/**
 * The shell tail of a derived render (DERIVED-C3; `server-shell.ts` `shellHook` calls it as `DerivedShell.tail`, so servers
 * of serialized builds carry none of it): the tail is the boundaries script + the loader, values only (no
 * numbering to seal or thaw). Fill: the default tail writes (the prefix ends after it); with `holes`, the top-level holes
 * retained with the derived recorder's keys and numbering. Replay: the tail is flushed, not written; an H-holes hit checks
 * its holes against the fill's.
 */
function shellTail(
  derived: DerivedRender,
  options: ShellHookOptions,
  recorder: Recorder,
  kept: ShellHole[] | null,
  refused: string | null,
  reset: () => void,
  frameSignals: FrameSignals,
): boolean {
  // Not covered: no stream.
  const covered = derived.stream;
  const replay = options.replay;
  if (!replay) {
    if (options.holes) {
      const seal = covered ? SHELL.seal(derived) : null;
      const why = !covered
        ? "no streamed resumable state of the derived model"
        : typeof seal === "string"
          ? seal
          : (refused ??
            ((kept ??= []).length === 0
              ? "no streamed boundary"
              : kept.length !== derived.asyncs.length
                ? "a streamed boundary is not a top-level `Async` the compiler marked `$hole`"
                : null));
      const scope = why === null ? runWithOwner(kept![0]!.pin, _idScope) : null;
      if (why !== null || !scope) options.holes(null, why ?? "no id scope");
      else {
        const sealed = seal as DerivedSeal;
        options.holes(
          {
            holes: kept!,
            n: recorder.next,
            ids: scope.n,
            prefix: scope.prefix,
            watch: frameSignals(kept!, (fn) => SHELL.source(derived, fn)),
            derived: sealed,
            check: () => SHELL.crossed(derived, sealed),
          },
          null,
        );
      }
      reset();
    }
    if (covered) options.seal?.(DERIVED_SEAL);
    options.cut?.();
    return false;
  }
  if (!covered) {
    options.mismatch?.("the replay's page has no streamed resumable state of the derived model");
    options.cut?.();
    return false;
  }
  const retained = options.retained;
  if (retained) {
    const holes = retained.derived?.holes ?? [];
    if (derived.asyncs.length !== holes.length) options.mismatch?.("the hit opened " + derived.asyncs.length + " boundaries, the stored shell " + holes.length);
    else if (derived.asyncs.some((a, i) => a.id !== i + 1 || a.b !== holes[i]![0] || a.k !== holes[i]![1]))
      options.mismatch?.("the hit's boundaries number differently from the stored shell's");
  }
  SHELL.mute(derived);
  options.cut?.();
  return true;
}

const SHELL: DerivedShell = {
  tail: shellTail,
  mute: (ctx) => void flush(ctx),
  seal(ctx) {
    if (ctx.asyncs.some((a) => a.state !== 0 || a.parent !== null)) return "a hole's content rendered before the shell ended";
    return { next: ctx.next, holes: ctx.asyncs.map((a) => [a.b, a.k] as const) };
  },
  begin(ctx, seal) {
    ctx.next = ctx.base = seal.next;
  },
  hole(ctx, seal, i, fn) {
    ctx.forced = seal.holes[i] ?? null;
    try {
      return withDerived(ctx, fn);
    } finally {
      ctx.forced = null;
    }
  },
  crossed(ctx, seal) {
    for (const [id, readers] of ctx.wake)
      if (+id.slice(0, id.indexOf(".")) < seal.next)
        for (const reader of readers) if (reader >= seal.next) return "a hole's content reads keyed state of a shell boundary (wake list)";
    return null;
  },
  source: (ctx, fn) => ctx.sources?.get(fn),
};
