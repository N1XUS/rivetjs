// Derived model, boundary recorder (milestone M2 lane A, R1; plan docs/design/plans/2026-10-18-derived-client.md, design
// docs/design/specs/2026-10-18-structural-resume-design.md §3.3). Under `resumableToString(…, { model: "derived" })`
// the compiled server module (`resume: { model: "derived" }`) calls nothing but:
//
//   const B = _rB("Name", flags[, props]);   // boundary open: a record [id, parent, flags, name, …], the body's token
//   try { return _rBOut(B, <template>); }    // the boundary's rendered value: markers + the render-time context
//   finally { _rBEnd(B); }                    // boundary close (the body token leaves the stack, also on throw)
//   _rBAttr(B)                                // `data-b="<id>"` on the boundary's element root (ATTR flag: no comments)
//   _rSig(key, init[, options])               // keyed state: `signal(init)` whose value ships and whose tracked reads
//   _rSigStore(key, init)                     // record the reading boundary (wake list); `createStore(init)` likewise
//
// Own subpath (`@rivetjs/runtime/server-derived`, pay-per-use): the compiled module imports the ABI from here and this
// module installs the recorder hooks into `server-resume.ts` on import (`_setDerived`), so serialized-model pages and
// bundles never carry it (zero-cost gate: `/server-resume` unchanged by this file).
//
// Nothing else is recorded: no handler / binding / site records, no object table, no captures. The tail is one JSON
// script (`<script type="rivet/boundaries">`, `BoundaryTail` in resume-format.ts): boundary records with their keyed
// values, plus wake lists (which boundaries read which keys). The current boundary is the innermost body being
// evaluated (a per-render stack: component bodies run eagerly, in tree order) or, while the renderer walks a boundary's
// subtree (lazy slots, For rows, Show branches), the one `_rBOut` provided as a context frame around that subtree.
//
// Derived client (M2 lane R, R2): `derivedToString` / `renderDerived` render with the manifest and nonce in hand, so the
// tail also names each boundary's chunk (`m`), the keys its cold keydowns hold (`k`), the delegated event types
// (`data-events`), the runtime (`data-rt`) and `data-boot` (a load / idle / visible trigger), and the derived inline loader
// (`resume-loader-derived.ts`) follows it. Plain `resumableToString(…, { model: "derived" })` writes the tail only.
import { createContext, createRoot, provide, useContext, getOwner, runWithOwner, signal, _dispose } from "@rivetjs/reactivity";
import type { EqualsOptions, Signal } from "@rivetjs/reactivity";
import { createStore, read } from "@rivetjs/reactivity/store";
import type { Store } from "@rivetjs/reactivity/store";
import { compiledTemplate, template, _attributeRecord } from "./template.ts";
import { For, ROWS, _scopedRecord } from "./server-structural.ts";
import { _list, renderToString } from "./server.ts";
import { _asyncHook, _onAsync } from "./server-async.ts";
import type { AsyncStream } from "./server-async.ts";
import { _CLASSES, _builtinKinds, createEncoder, escapeJSON, serialize, typeName } from "./resume-format.ts";
import { _setDerived, _shellRecorder, renderResumable, resumableToString } from "./server-resume.ts";
import type { ResumableOptions, ResumeManifest, StreamingResumableOptions } from "./server-resume.ts";
import type { BoundaryRecord, BoundaryTail, ClassHooks, ClassRegistry, DerivedAsync, TableEntry } from "./resume-format.ts";
import { DERIVED_LOADER, DERIVED_STREAM } from "./resume-loader-derived.min.ts";
import type { ListPlan, ServerValue } from "./server.ts";
import { _idScope } from "./id.ts";
import type { ShellHole, ShellHookOptions, ShellSeal, _FrameSignals as FrameSignals } from "./server-shell.ts";
import type { _Recorder as Recorder } from "./server-resume.ts";

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
  VISIBLE = 128;
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
}
/** Reactivity's owner as the body sees it: `ctx` is its context chain (immutable frames, inherited by owners made under it). */
interface OwnerFrames {
  ctx: unknown;
}

/** The derived recorder of one render (held by `server-resume.ts`'s Recorder, provided as the `DERIVED` context). */
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
// The options of the render being started (read once by `createDerived`: the Recorder constructor runs synchronously), and
// the recorder it created (`renderDerived` writes its segments after the shell).
let pending: DerivedOptions | null = null,
  created: DerivedRender | null = null;

const DERIVED = createContext<DerivedRender | null>(null);
/** The boundary whose subtree the renderer is walking (`_rBOut` provides it around the rendered value). */
const CURRENT = createContext<Boundary | null>(null);

/** A fresh derived recorder for one render. */
export function createDerived(): DerivedRender {
  const options = pending;
  pending = null;
  return (created = {
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
  });
}

/**
 * A derived-model page as a string (`resumableToString` with `model: "derived"`), plus the derived client: tail `m` / `k`,
 * the script attributes and the inline loader. `manifest.runtime` = the URL whose default export is the
 * `@rivetjs/runtime/dom-derived` instance; `manifest.symbols[<boundary name>]` = the chunk exporting that component.
 */
export function derivedToString(factory: () => ServerValue, options: Partial<ResumableOptions> = {}): string | Promise<string> {
  pending = options as DerivedOptions;
  try {
    return resumableToString(factory, { ...options, model: "derived" } as ResumableOptions);
  } finally {
    pending = null;
  }
}

/** `renderResumable` twin of `derivedToString`. */
export function renderDerived(
  factory: () => ServerValue,
  writer: { write(chunk: string): unknown },
  options: Partial<StreamingResumableOptions> = {},
): void | Promise<void> {
  pending = options as DerivedOptions;
  created = null;
  let shell: void | Promise<void>;
  try {
    shell = renderResumable(factory, writer, { ...options, model: "derived" } as StreamingResumableOptions);
  } finally {
    pending = null;
  }
  const ctx = created as DerivedRender | null;
  created = null;
  // Streamed `Async`s (DERIVED-C2): their segments follow the shell (state + loader included), in completion order.
  if (!ctx || !ctx.stream) return shell;
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
  const boundary: Boundary = { id: ctx.next++, parent, name, flags, props: keep, signals: [], keys: null, attr: false, out: false, an: 0, frame: null };
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
  const get = function () {
    const at = current(ctx);
    if (at && at !== owner) wake(ctx, id, at.id);
    return s();
  } as Signal<T>;
  get.set = (value) => s.set(value);
  get.update = (fn) => s.update(fn);
  ctx.sources?.set(get, s);
  return get;
}

/** Keyed store (compiled from `createStore(init)`): registered like `_rSig` (value = `read(store)` at the flush); reads
 * through `read` / `at` are not wake-tracked in M2 (a store-reading boundary materialises on its own events only). */
export function _rSigStore<T extends object>(key: string, init: T): Store<T> {
  const store = createStore(init);
  const ctx = useContext(DERIVED);
  const owner = ctx && current(ctx);
  if (ctx && owner && owner.id >= ctx.base) register(owner, key, () => read(store));
  return store;
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
function derivedAsync(ctx: DerivedRender): AsyncStream {
  // Constructed while another `Async`'s content renders, in that content's own unit (not in a boundary body inside it):
  // keyed by that `Async` (`-id`: the browser adopts its content as a unit of its own and counts there).
  const seg = ctx.segment,
    at = current(ctx),
    by = seg && at === seg.at ? seg : at,
    forced = ctx.forced;
  // An H-holes hit re-runs a retained hole: its key and place are the fill's (the shell's counters are not re-run).
  ctx.forced = null;
  const b = forced ? forced[0] : by === seg ? -seg!.id : (at?.id ?? 0),
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
      ctx.asyncs.push(a);
      ctx.changed.add(a);
      // Shell cache fill (H-holes): a streamed top-level boundary the compiler marked `$hole` may be retained.
      if (hole && ctx.stream && !seg && ctx.sources) _shellRecorder()?.options.shell?.hole?.({ parent: null, A: a.id, F: 0, M: null } as never, hole, owner);
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
      if (!ctx.stream)
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
      if (!entry || !ctx.stream) return dispose();
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
  const $list = props.$list;
  if ($list === undefined || !tapeRows || !useContext(DERIVED)) return For(props) as unknown as ServerValue;
  let owner = getOwner();
  const root = createRoot(() => {
    owner = getOwner();
    return derivedRows(props, $list);
  });
  return _scopedRecord(owner, root.value, root.dispose) as unknown as ServerValue;
}
function derivedRows(props: ForProps, $list: NonNullable<ForProps["$list"]>): unknown {
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
  if (dense) return _list(items, noRow, rowPlan($list[0]), $list[1] as (tape: unknown[], base: number, item: unknown, index: number) => void);
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
function flush(ctx: DerivedRender): BoundaryTail | null {
  if (ctx.flushed === ctx.boundaries.length && ctx.dirty.size === 0 && ctx.changed.size === 0) return null;
  const b: BoundaryRecord[] = [];
  for (let i = ctx.flushed; i < ctx.boundaries.length; i++) {
    const boundary = ctx.boundaries[i]!;
    const signals: unknown[] = [];
    for (const [key, value] of boundary.signals) {
      const v = value();
      if (isData(v)) signals.push(key, v);
      else boundary.flags |= UNKEYED;
    }
    if (!boundary.out) boundary.flags |= SILENT;
    const record: BoundaryRecord = [boundary.id, boundary.parent?.id ?? 0, boundary.flags, boundary.name, signals];
    if (boundary.props) record.push(boundary.props);
    b.push(record);
  }
  ctx.flushed = ctx.boundaries.length;
  const tail: BoundaryTail = { v: 1, b };
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
  return tail;
}

/** The shell's tail script (null when the render opened no boundary). A trusted one-fragment template, as the state script. */
export function derivedTail(ctx: DerivedRender): ServerValue {
  const tail = flush(ctx);
  if (!tail) return null;
  const options = ctx.options,
    json = escapeJSON(JSON.stringify(tail));
  if (!options?.manifest?.runtime) return template(['<script type="rivet/boundaries">' + json + "</script>"]);
  // Fetch-ahead (DERIVED-C): the runtime, the chunks of the page's boundaries (tail `m`) and their static import closures
  // (manifest `deps`), as low-priority modulepreloads after `load` (`data-fo`; fetched + compiled, never evaluated before
  // an event): the first click evaluates modules already in the module map instead of an import waterfall.
  const manifest = options.manifest,
    deps = manifest.deps;
  let ahead = "";
  if (!options.preload?.lean) {
    const urls = new Set<string>();
    for (const url of [manifest.runtime!, ...(tail.m ? Object.values(tail.m) : [])]) {
      urls.add(url);
      if (deps?.[url]) for (const dep of deps[url]!) urls.add(dep);
    }
    ahead = [...urls].join(" ");
  }
  // The derived client: attributes the loader reads, then the loader (same nonce sanitising as the serialized loader).
  const nonce = options.nonce ? ' nonce="' + String(options.nonce).replace(/[^\w+/=-]/g, "") + '"' : "",
    events = [...ctx.events].join(" "),
    attrs =
      ' data-rt="' +
      attr(options.manifest.runtime) +
      '"' +
      (events && events !== DEFAULT_EVENTS ? ' data-events="' + attr(events) + '"' : "") +
      (ctx.boot ? " data-boot" : "") +
      (ctx.clicks ? ' data-g="' + attr(ctx.clicks) + '"' : "") +
      (ahead ? ' data-fo="' + attr(ahead) + '"' : "");
  return template(['<script type="rivet/boundaries"' + attrs + ">" + json + "</script><script" + nonce + ">" + DERIVED_LOADER + "</script>"]);
}
/** The loader's event types when `data-events` is absent (`resume-loader-derived.ts`). */
const DEFAULT_EVENTS = "click input change submit keydown pointerdown pointerup mousedown mouseup focusin focusout";
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
const DERIVED_SEAL: ShellSeal = Object.freeze({ t: 0, c: [], s: [], e: [], f: 0, d: 1 });
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
  // Not covered: serialized-model state beside the derived tail, DOM-backed data, no stream.
  const covered = !recorder.used && recorder.stream !== null && !recorder.dom && !recorder.lean;
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
            contexts: new Map(recorder.contexts),
            tokens: new Map(recorder.tokens),
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
    options.cut?.(true);
    return false;
  }
  if (!covered) {
    options.mismatch?.("the replay's page has no streamed resumable state of the derived model");
    options.cut?.(true);
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
  options.cut?.(true);
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

_setDerived({ create: createDerived, run: withDerived, tail: derivedTail, patch: derivedPatch });
