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
import { createContext, provide, useContext, getOwner, signal, _dispose } from "@rivetjs/reactivity";
import type { EqualsOptions, Signal } from "@rivetjs/reactivity";
import { createStore, read } from "@rivetjs/reactivity/store";
import type { Store } from "@rivetjs/reactivity/store";
import { compiledTemplate, template, _attributeRecord } from "./template.ts";
import { _scopedRecord } from "./server-structural.ts";
import { escapeJSON } from "./resume-format.ts";
import { _setDerived, renderResumable, resumableToString } from "./server-resume.ts";
import type { ResumableOptions, ResumeManifest, StreamingResumableOptions } from "./server-resume.ts";
import type { BoundaryRecord, BoundaryTail } from "./resume-format.ts";
import { DERIVED_LOADER } from "./resume-loader-derived.min.ts";
import type { ServerValue } from "./server.ts";

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
}

/** What the derived client needs from the render options. */
export interface DerivedOptions {
  manifest?: Partial<ResumeManifest>;
  nonce?: string;
}
// The options of the render being started (read once by `createDerived`: the Recorder constructor runs synchronously).
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
  };
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
  try {
    return renderResumable(factory, writer, { ...options, model: "derived" } as StreamingResumableOptions);
  } finally {
    pending = null;
  }
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
const current = (ctx: DerivedRender): Boundary | null => (ctx.stack.length ? ctx.stack[ctx.stack.length - 1]! : useContext(CURRENT));

/** Plain JSON data: primitives, arrays and plain objects of such (no functions, signals, class instances, Dates, Maps). */
export function isData(value: unknown, depth = 0): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
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
  const boundary: Boundary = { id: ctx.next++, parent, name, flags, props: keep, signals: [], keys: null, attr: false, out: false };
  if (events) for (const type of events.split(" ")) if (type) ctx.events.add(type);
  if (keys) ctx.keys[boundary.id] = keys;
  if (flags & TRIGGERS) ctx.boot = true;
  ctx.boundaries.push(boundary);
  ctx.stack.push(boundary);
  return boundary;
}

/** Close a boundary body (compiled into the body's `finally`): the token leaves the stack, whatever is above it too. */
export function _rBEnd(token: Boundary | null): void {
  if (!token) return;
  const ctx = useContext(DERIVED);
  if (!ctx) return;
  const at = ctx.stack.lastIndexOf(token);
  if (at >= 0) ctx.stack.length = at;
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
  if (!ctx || !owner) return s;
  const id = register(owner, key, s);
  const get = function () {
    const at = current(ctx);
    if (at && at !== owner) wake(ctx, id, at.id);
    return s();
  } as Signal<T>;
  get.set = (value) => s.set(value);
  get.update = (fn) => s.update(fn);
  return get;
}

/** Keyed store (compiled from `createStore(init)`): registered like `_rSig` (value = `read(store)` at the flush); reads
 * through `read` / `at` are not wake-tracked in M2 (a store-reading boundary materialises on its own events only). */
export function _rSigStore<T extends object>(key: string, init: T): Store<T> {
  const store = createStore(init);
  const ctx = useContext(DERIVED);
  const owner = ctx && current(ctx);
  if (ctx && owner) register(owner, key, () => read(store));
  return store;
}

/** Records of the boundaries not flushed yet (values read now), plus the wake lists changed since the last flush. */
function flush(ctx: DerivedRender): BoundaryTail | null {
  if (ctx.flushed === ctx.boundaries.length && ctx.dirty.size === 0) return null;
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
  return tail;
}

/** The shell's tail script (null when the render opened no boundary). A trusted one-fragment template, as the state script. */
export function derivedTail(ctx: DerivedRender): ServerValue {
  const tail = flush(ctx);
  if (!tail) return null;
  const options = ctx.options,
    json = escapeJSON(JSON.stringify(tail));
  if (!options?.manifest?.runtime) return template(['<script type="rivet/boundaries">' + json + "</script>"]);
  // The derived client: attributes the loader reads, then the loader (same nonce sanitising as the serialized loader).
  const nonce = options.nonce ? ' nonce="' + String(options.nonce).replace(/[^\w+/=-]/g, "") + '"' : "",
    events = [...ctx.events].join(" "),
    attrs =
      ' data-rt="' +
      attr(options.manifest.runtime) +
      '"' +
      (events && events !== DEFAULT_EVENTS ? ' data-events="' + attr(events) + '"' : "") +
      (ctx.boot ? " data-boot" : "") +
      (ctx.clicks ? ' data-g="' + attr(ctx.clicks) + '"' : "");
  return template(['<script type="rivet/boundaries"' + attrs + ">" + json + "</script><script" + nonce + ">" + DERIVED_LOADER + "</script>"]);
}
/** The loader's event types when `data-events` is absent (`resume-loader-derived.ts`). */
const DEFAULT_EVENTS = "click input change submit keydown";
const attr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** A streamed segment's patch (records + wake lists added since the last flush), "" when nothing was added. */
export function derivedPatch(ctx: DerivedRender, marker: number): string {
  const tail = flush(ctx);
  return tail ? '<script type="rivet/boundaries" data-patch="' + marker + '">' + escapeJSON(JSON.stringify(tail)) + "</script>" : "";
}

_setDerived({ create: createDerived, run: withDerived, tail: derivedTail, patch: derivedPatch });
