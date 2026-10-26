import {
  TEMPLATE,
  ATTRIBUTE,
  COMPILED,
  LIST,
  SPREAD,
  MARK,
  MARK_CHAIN,
  MARK_RESET,
  escapeText,
  escapeAttribute,
  encodeAttribute,
  encodeAttributeValue,
  booleanAttributes,
  _attributeRecord,
  _compiledRecord,
} from "./template.ts";
import type { AttributeNamespace, AttributeRecord, Coercible, TemplateRecord } from "./template.ts";
import { omitted, isOmitted, inert } from "./omitted.ts";
import { computed, createRoot, getOwner, runWithOwner } from "@rivetjs/reactivity";
import type { Owner } from "@rivetjs/reactivity";
import { SCOPED, _forListMount } from "./server-structural.ts";
import type { ScopedRecord } from "./server-structural.ts";
import { withRequestSignal } from "./server-async.ts";
import { _trigger, EFFECT, EVENT } from "./server-trigger.ts";
import { CAUGHT } from "./server-boundary.ts";
import { ATTRIBUTE_UNIT_BYTES, INTEGER_BYTES, TEXT_UNIT_BYTES, putAttribute, putInt32, putSafeInteger, putText } from "./server-bytes.ts";
import { TEXT_SPECIAL } from "./escape.ts";
import { _listRows } from "./server-rows.ts";
import { URLS, unsafeUrl } from "./url.ts";
import type { CaughtRecord } from "./server-boundary.ts";
import type { CompiledElement, Ref } from "./jsx-runtime.ts";
export type { Ref, RefProp } from "./jsx-runtime.ts";
export { Async, lazyComponent, clientOnly } from "./server-async.ts";
export { Provider, For, Show, Switch, Match, Dynamic, Portal } from "./server-structural.ts";
export { ErrorBoundary } from "./server-boundary.ts";
/**
 * `mount` (`@rivetjs/runtime/dom`) is browser-only: the server form exists so a resumable module that mounts from browser
 * code (a handler's dynamic import, a module function) still links in a server build; calling it throws.
 */
export function mount(_factory: unknown, _container: unknown): never {
  throw new Error("Rivet: mount() is browser-only; call it from a handler, clientEffect or clientEvent");
}
export { Suspense, startTransition, useTransition } from "./server-suspense.ts";
export { resource } from "./server-resource.ts";
export type { Resource, ResourceFetcher, ResourceInfo, ResourceOptions, ResourceSource, ResourceState } from "./server-resource.ts";

declare const scopeBrand: unique symbol;
/** Opaque single-response structural scope; finalized by the server renderer. */
export interface ServerScope {
  readonly [scopeBrand]: true;
}
/** Opaque compiler-trusted HTML region. */
export interface ServerTemplate {
  readonly fragments: readonly string[];
  readonly slots: readonly ServerValue[];
}
/** Opaque context-aware native attribute slot. */
export interface AttributeSlot {
  readonly name: string;
  readonly value: unknown;
  readonly namespace?: AttributeNamespace;
}
/** Compiler-only expression evaluated in order but never emitted or invoked. */
export interface OmittedSlot {
  readonly value: unknown;
}
/** Any value a server component can render. */
export type ServerValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | ServerTemplate
  | ServerScope
  | CompiledElement
  | AttributeSlot
  | OmittedSlot
  | VariantValue
  | readonly ServerValue[]
  | PromiseLike<ServerValue>
  | (() => ServerValue);
/** Options of server rendering: abort signal and locale variant. */
export interface RenderOptions {
  signal?: AbortSignal;
  /** Locale variant index for compiled i18n templates and values (default 0). */
  variant?: number;
}
/** Where server rendering writes its output. */
export interface ServerWriter {
  write(chunk: string): void | PromiseLike<void>;
}
/** When browser-only work starts on a resumed page (CSR runs after mount). */
export type ClientWhen = "load" | "visible" | "idle" | "interaction" | `media:${string}`;

/** A writer as the renderer drives it: byte writers (NodeStreamWriter) take pre-encoded output. */
interface Sink {
  write(chunk: string): unknown;
  writeBytes?(bytes: Uint8Array): unknown;
  writeInteger?(value: number): unknown;
  /** Writes `text` HTML-text-escaped (as escapeText); NodeStreamWriter fuses the escape into its UTF-8 encode. */
  writeText?(text: string): unknown;
  /** Raw slab protocol (NodeStreamWriter): `claim(n)` makes room for n bytes at `bytes[offset]`, `commit(end)` records them. */
  claim?(length: number): unknown;
  commit?(offset: number): unknown;
  readonly bytes?: Uint8Array | null;
  readonly offset?: number;
}
/** A list row plan slot: an attribute, null for a child slot, or a break (OPEN / CLOSE: the bounds of a flattened child component). */
interface PlanAttribute {
  readonly name: string;
  readonly namespace: AttributeNamespace;
  readonly raw: RawAttribute | null;
}
type PlanSlot = PlanAttribute | null | typeof OPEN | typeof CLOSE;
/** Compiler-private row plan (see _listPlan). */
export interface ListPlan {
  readonly fragments: readonly string[];
  readonly attributes: readonly PlanSlot[];
  /** Encoded fragments and their total size, set on first byte-writer use (`planBytes`). */
  bytes: readonly Uint8Array[] | null;
  fixed: number;
  /** The WebAssembly row emitter (`server-rows.ts`), set by `_listPlan` only: bundles without compiled list rows drop it. */
  readonly rows?: typeof _listRows | null;
}
/** Compiler-private list of rows sharing one plan (see _list). */
export interface ListRecord {
  readonly [LIST]: true;
  readonly plan: ListPlan;
  readonly tape: unknown[];
  readonly rows: number;
}
/** Structural view of a formed value, read through its private brands. */
type Branded = {
  readonly [TEMPLATE]?: unknown;
  readonly [COMPILED]?: unknown;
  readonly [ATTRIBUTE]?: unknown;
  readonly [LIST]?: unknown;
  readonly [SPREAD]?: true;
  readonly [SCOPED]?: unknown;
  readonly [VARIANTS]?: VariantFragments;
  readonly [VARIANT_VALUE]?: readonly (string | (() => unknown))[];
  readonly [CAUGHT]?: true;
};
/** Resume marker fragments (template.ts `_markFragments`): their mode; slot 0 holds the marker id. */
type Marked = { readonly [MARK]?: number };
type Within = <T>(owner: Owner | null, run: () => T) => T;
/** What the record writer writes: a compiled record, or one row of a list (its plan + tape). */
type Rows = TemplateRecord | ListRecord;

/** Resume chunk-grouping boundary (`resume.chunks: "group"`): renders children unchanged. `name` keys the
 * chunk; `preload` sets the group's component-level strategy. */
export const ChunkGroup: (props: {
  name?: string;
  preload?: "eager" | "idle" | "visible" | "intent" | "interaction";
  children?: ServerValue;
}) => ServerValue = (props) => props.children;
/**
 * An element ref (see `@rivetjs/runtime/dom`). On the server no element exists: `r()` is undefined. The
 * `rivet.ref` key marks it as a Rivet ref (cdk popover tells it from a callback ref by it).
 */
const REF_CELL = Symbol.for("rivet.ref");
export function ref<T extends Element = HTMLElement>(): Ref<T> {
  const r = (() => undefined) as (() => undefined) & { [REF_CELL]?: true };
  r[REF_CELL] = true;
  return r as unknown as Ref<T>;
}
export { template, compiledTemplate, attribute } from "./template.ts";
export { spreadAttributes, spreadChildren } from "./server-spread.ts";
/** @internal Static SVG shapes (`[tag, attrs][]`, kit `Icon`) as one cached pre-escaped chunk; twin of `/dom` `_svgShapes`. */
export { _svgShapes } from "./server-svg.ts";
export { omitted };
/** Byte slab writer core (claim / commit / writeText / writeBytes / writeInteger) for custom byte writers. */
export { SlabWriter } from "./server-slab.ts";
const pending = (value: unknown): value is PromiseLike<unknown> => value != null && typeof (value as PromiseLike<unknown>).then === "function";
/** The render-scoped steps `arrayLoop` calls back into (one object per render). */
interface ArraySteps {
  here(owner: Owner | null): boolean;
  visit(value: unknown, owner: Owner | null): unknown;
  visitValue(value: unknown, owner: Owner | null): unknown;
  visitWithin(value: unknown, owner: Owner | null): unknown;
  resumeArray(result: PromiseLike<unknown>, value: readonly unknown[], owner: Owner | null, count: number, next: number): unknown;
}
// An array's item loop (a For's rows: thousands of iterations) is module-level, not a per-render closure: V8
// keeps optimized and OSR code only while a closure using it is alive, so the loop of a per-render closure was
// re-tiered (interpreter → OSR Maglev → OSR TurboFan) after nearly every full GC on large pages.
function arrayLoop(steps: ArraySteps, value: readonly unknown[], owner: Owner | null, count: number, start: number): unknown {
  for (let i = start; i < count; i++) {
    const item = value[i];
    const result =
      item !== null && typeof item === "object" && (item as Branded)[TEMPLATE]
        ? steps.visitValue(item, owner)
        : steps.here(owner)
          ? steps.visit(item, owner)
          : steps.visitWithin(item, owner);
    if (pending(result)) return steps.resumeArray(result, value, owner, count, i + 1);
  }
}
// String(n) for these is plain decimal digits (no exponent, no fraction, -0 prints "0").
const safeInteger = (value: number): boolean => value % 1 === 0 && value <= 9007199254740991 && value >= -9007199254740991;
// Compiled fragments are frozen and hoisted, so their UTF-8 encoding is computed once per array.
const encoder = new TextEncoder();
/** An incremental list's rows (`@rivetjs/runtime/server-incr` forms it): `runWrite` in the renderer. */
const RUN = Symbol.for("rivet.incr.run");
interface RunRecord {
  readonly [RUN]: true;
  /** Row `r` (`from` ≤ r < `to`) = `bufs[bi[r]]` bytes `st[r]`..`en[r]`: `<!--r[-->…<!--]-->` (marker id left out). */
  readonly bufs: readonly Uint8Array[];
  readonly bi: Int32Array;
  readonly st: Int32Array;
  readonly en: Int32Array;
  readonly from: number;
  readonly to: number;
  /** Row `from`'s marker id (the next rows count on from it); -1: tape rows, whose markers carry no id. */
  readonly first: number;
}
const runDecoder = /* @__PURE__ */ new TextDecoder();
const encodedFragments = new WeakMap<readonly string[], Uint8Array[]>();
// i18n: a template whose static text differs per locale carries one fragment set per variant;
// a translated value outside static text (plural, formatted number, non-JSX `t()`) one value per
// variant. Both resolve by the render's variant index, which lives only in its renderCore closure.
const VARIANTS = Symbol.for("rivet.variants");
const VARIANT_VALUE = Symbol.for("rivet.variantValue");
// Set once a translated template or value exists: untranslated apps skip every variant check.
let translated = false;
/** Compiler-private: per-variant frozen fragment sets plus per-variant slot write order (null = source order). */
export interface VariantFragments {
  readonly sets: readonly (readonly string[])[];
  readonly orders: readonly (readonly number[])[] | null;
}
/** Compiler-private translated value; resolved by the renderer in child and attribute positions. */
export interface VariantValue {
  readonly [VARIANT_VALUE]: readonly (string | (() => unknown))[];
}
/** Compiler-private: hoisted fragment sets of one translated template (index = variant). */
export function _variants(sets: readonly (readonly string[])[], orders: readonly (readonly number[])[] | null = null): VariantFragments {
  translated = true;
  for (const set of sets) Object.freeze(set);
  return Object.freeze({ sets: Object.freeze(sets), orders });
}
// Class records (pinned shapes), not computed-key literals: see template.ts.
let variantPin: VariantTemplate | null = null,
  listPin: List | null = null;
class VariantTemplate {
  declare [TEMPLATE]: true;
  declare [COMPILED]: true;
  declare [VARIANTS]: VariantFragments;
  declare fragments: readonly string[];
  declare slots: readonly ServerValue[];
  constructor(variants: VariantFragments, slots: readonly ServerValue[]) {
    this[TEMPLATE] = true;
    this[COMPILED] = true;
    this[VARIANTS] = variants;
    this.fragments = variants.sets[0]!;
    this.slots = slots;
  }
}
/** Compiler-private compiledTemplate for a translated template; `fragments` reads as variant 0. */
export function _variantTemplate(variants: VariantFragments, slots: readonly ServerValue[] = []): TemplateRecord {
  variantPin ??= new VariantTemplate({ sets: [[""]], orders: null }, []);
  return new VariantTemplate(variants, slots) as TemplateRecord;
}
/** Compiler-private per-variant value: a string or a thunk evaluated when rendered. */
export function _variantValue(values: readonly (string | (() => unknown))[]): VariantValue {
  translated = true;
  return { [VARIANT_VALUE]: values, toString: translatedOutsideRender } as VariantValue;
}
function translatedOutsideRender(): never {
  throw new TypeError("rivet: translated value used outside JSX on the server; use t.in(locale, key, params)");
}
/** Compiler-private: the value of a VariantValue for `variant`; anything else unchanged. */
export function _variantOf(value: unknown, variant: number): unknown {
  if (!translated || value === null || typeof value !== "object" || !(value as Branded)[VARIANT_VALUE]) return value;
  const values = (value as Branded)[VARIANT_VALUE]!;
  const v = values[variant] ?? values[0];
  return typeof v === "function" ? v() : v;
}
// A translated record as the plain compiled record of one variant (slots in that variant's write order).
function variantRecord(value: TemplateRecord, variant: number): TemplateRecord {
  const { sets, orders } = (value as Branded)[VARIANTS]!;
  const order = orders && (orders[variant] ?? orders[0]!);
  const slots = order ? order.map((i) => value.slots[i]) : value.slots;
  return _compiledRecord(sets[variant] ?? sets[0]!, slots as ServerValue[]);
}
const QUOTE = encoder.encode('"');
// Raw-slab records: strings up to RAW_TEXT code units are escaped inline, records up to RAW_MAX bytes;
// nested compiled children inline up to RAW_DEPTH levels.
const RAW_TEXT = 64;
/** Writes a clean (no `&<>`) string longer than RAW_TEXT straight into the slab: native UTF-8 encode, no copy. */
const putLong = (target: Uint8Array, offset: number, text: string): number => {
  const native = (target as Uint8Array & { utf8Write?: (chunk: string, offset: number, length: number) => number }).utf8Write;
  // Explicit length: workerd's (nodejs_compat) Buffer#utf8Write throws ERR_OUT_OF_RANGE without it.
  return native !== undefined
    ? offset + native.call(target, text, offset, target.length - offset)
    : offset + encoder.encodeInto(text, target.subarray(offset)).written;
};
const RAW_MAX = 32 * 1024;
const RAW_DEPTH = 8;
/** recordBytes `path`: the caller already tried the record raw. */
const RAW_TRIED = -2;
/** List rawRow: the row needs rawSize + rawWrite (string attributes, nested records). */
const RAW_WIDE: unique symbol = Symbol("wide");
/** rawPut results: a slot needs the generic path / the slab's room ran out. */
const RAW_NOT = -1;
const RAW_ROOM = -2;
// A non-boolean attribute's ` name="` prefix (bytes + string), and its lowercase name when it carries a URL
// (checked like encodeAttributeValue). null: an HTML boolean attribute (truthiness output, generic path).
interface RawAttribute {
  readonly prefix: Uint8Array;
  /** The prefix as a string (string writers). */
  readonly text: string;
  readonly url: string | null;
  /** A URL list (`srcset`, `ping`, SMIL `values`): every entry is checked. */
  readonly list: boolean;
}
const rawAttributes = new Map<string, RawAttribute | null>();
function rawAttribute(name: string, namespace: AttributeNamespace): RawAttribute | null {
  const key = namespace === "html" ? name : namespace + ":" + name;
  let info = rawAttributes.get(key);
  if (info === undefined) {
    const lower = name.toLowerCase(),
      kind = URLS.get(lower);
    info =
      namespace === "html" && booleanAttributes.has(lower)
        ? null
        : { prefix: encoder.encode(` ${name}="`), text: ` ${name}="`, url: kind === undefined ? null : lower, list: kind === 2 };
    // Bounded like template.ts's caches: dynamic attribute names must not grow it without limit.
    if (rawAttributes.size < 1024) rawAttributes.set(key, info);
  }
  return info;
}
const templateFixed = new WeakMap<readonly Uint8Array[], number>();
function fragmentBytes(fragments: readonly Uint8Array[]): number {
  let size = templateFixed.get(fragments);
  if (size === undefined) {
    size = 0;
    for (const fragment of fragments) size += fragment.length;
    templateFixed.set(fragments, size);
  }
  return size;
}
/** A slot needs the generic path (not a raw record / attribute write). */
const GENERIC: unique symbol = Symbol("generic");
const arrayMap = Array.prototype.map;
const MAX_LENGTH = Number.MAX_SAFE_INTEGER;
const PRESIZED = 65536;
/**
 * Compiler-private row plan: frozen fragments around `attributes.length` slots. An entry is null
 * for a child slot, or the attribute's compile-time validated output name and namespace.
 */
export function _listPlan(fragments: readonly string[], entries: readonly (readonly [string, AttributeNamespace] | ListPlan | null)[]): ListPlan {
  if (fragments.length !== entries.length + 1) throw new TypeError("List plan requires one more fragment than slots");
  const flat = [fragments[0]!],
    attributes: PlanSlot[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    if (entry !== null && !Array.isArray(entry)) {
      // A flattened child component's plan, between break slots (tape positions the compiler's row
      // writers count; nothing is written there). Its captures fill the slots in between.
      attributes.push(OPEN);
      flat.push((entry as ListPlan).fragments[0]!);
      for (let k = 0; k < (entry as ListPlan).attributes.length; k++) {
        attributes.push((entry as ListPlan).attributes[k]!);
        flat.push((entry as ListPlan).fragments[k + 1]!);
      }
      attributes.push(CLOSE);
    } else if (entry) {
      // HTML names lowercase (`readOnly` → `readonly`), as `attribute` writes them; once per plan.
      const [given, namespace] = entry as readonly [string, AttributeNamespace],
        name = namespace === "svg" || namespace === "mathml" ? given : given.toLowerCase();
      attributes.push({ name, namespace, raw: rawAttribute(name, namespace) });
    } else attributes.push(null);
    flat.push(fragments[i + 1]!);
  }
  return { fragments: Object.freeze(flat), attributes, bytes: null, fixed: 0, rows: _listRows };
}
function planBytes(plan: ListPlan): readonly Uint8Array[] {
  const bytes = encoded(plan.fragments);
  plan.fixed = fragmentBytes(bytes);
  return (plan.bytes = bytes);
}
/** Plan slots that hold no value: the bounds of a flattened child component (numbers: the nesting delta). */
const OPEN = 1 as const,
  CLOSE = -1 as const;
/**
 * Compiler-private `items.map(original)` in a JSX child position. With the intrinsic map on an
 * Array whose constructor is Array, this performs the same observable operations in the same
 * order (Get map, Get length, Get constructor, then HasProperty/Get per index) and runs `each`
 * where map would run `original`; `each(tape, base, item, index)` stores one row of captures at
 * tape[base..] instead of returning a record. Anything else runs the original callback with the
 * original semantics.
 */
export function _list(
  items: readonly unknown[],
  original: (item: unknown, index: number, array: readonly unknown[]) => unknown,
  plan: ListPlan,
  each: (tape: unknown[], base: number, item: unknown, index: number) => void,
): unknown {
  const map = items.map;
  if (map !== arrayMap || !Array.isArray(items)) {
    if (typeof map !== "function") throw new TypeError("List source map is not a function");
    return Reflect.apply(map, items, [original]);
  }
  const length = toLength(items.length);
  const constructor = items.constructor;
  if (constructor !== Array) return speciesMap(items, length, constructor, original);
  // Presized while V8 still keeps a preallocated array in fast elements; growth copies otherwise
  // dominate the tape's allocation. Larger lists append in order.
  const width = plan.attributes.length,
    size = length * width;
  const tape: unknown[] = size <= PRESIZED ? new Array(size) : [];
  let rows = 0;
  for (let k = 0; k < length; k++) {
    if (k in items) {
      each(tape, rows * width, items[k], k);
      rows++;
    }
  }
  listPin ??= new List({ fragments: [""], attributes: [], bytes: null, fixed: 0, rows: null }, [], 0);
  return new List(plan, tape, rows);
}
class List {
  declare [LIST]: true;
  declare plan: ListPlan;
  declare tape: unknown[];
  declare rows: number;
  constructor(plan: ListPlan, tape: unknown[], rows: number) {
    this[LIST] = true;
    this.plan = plan;
    this.tape = tape;
    this.rows = rows;
  }
}
_forListMount(_list as Parameters<typeof _forListMount>[0]);
function toLength(value: unknown): number {
  const length = Math.trunc(+(value as number));
  return length > 0 ? Math.min(length, MAX_LENGTH) : 0;
}
// The rest of Array.prototype.map after Get(constructor), for subclasses and species overrides.
function speciesMap(
  items: readonly unknown[],
  length: number,
  constructor: unknown,
  callback: (item: unknown, index: number, array: readonly unknown[]) => unknown,
): unknown {
  let species = constructor;
  if (species !== null && (typeof species === "object" || typeof species === "function")) {
    species = (species as { [Symbol.species]?: unknown })[Symbol.species];
    if (species === null) species = undefined;
  }
  if (species !== undefined && typeof species !== "function") throw new TypeError("Array species is not a constructor");
  const result: object = species === undefined ? new Array(length) : Reflect.construct(species as new (length: number) => object, [length]);
  for (let k = 0; k < length; k++) {
    if (k in items) {
      const mapped = callback(items[k], k, items);
      if (!Reflect.defineProperty(result, k, { value: mapped, writable: true, enumerable: true, configurable: true }))
        throw new TypeError("Cannot define mapped element " + k);
    }
  }
  return result;
}
function encoded(fragments: readonly string[]): Uint8Array[] {
  let bytes = encodedFragments.get(fragments);
  if (!bytes) {
    encodedFragments.set(fragments, (bytes = fragments.map((fragment) => encoder.encode(fragment))));
    const mode = (fragments as Marked)[MARK];
    if (mode !== undefined) Object.defineProperty(bytes, MARK, { value: mode });
  }
  return bytes;
}
// Read then exactly once. Preserve Promise.resolve scheduling: getter now, invocation
// in a later microtask, with the original receiver. Getter errors become observed
// slot failures so admission can continue through already-formed siblings.
function normalizeThenable(value: unknown): PromiseLike<unknown> | null {
  if (value == null || (typeof value !== "object" && typeof value !== "function")) return null;
  let then;
  try {
    then = (value as PromiseLike<unknown>).then;
  } catch (error) {
    return Promise.reject(error);
  }
  if (typeof then !== "function") return null;
  return adoptThenable(value, then);
}
// Kept apart from normalizeThenable: a closure over its parameters would make every
// call, including the common non-thenable one, allocate a context.
function adoptThenable(value: object, then: PromiseLike<unknown>["then"]): PromiseLike<unknown> {
  // Preserve the original native-Promise admission timing without rereading an
  // accessor: only an ordinary inherited data-method qualifies for this path.
  try {
    if (
      then === Promise.prototype.then &&
      Object.getPrototypeOf(value) === Promise.prototype &&
      !Object.hasOwn(value, "then") &&
      Object.getOwnPropertyDescriptor(Promise.prototype, "then")?.value === then
    )
      return value as Promise<unknown>;
  } catch {
    /* Optional native fast-path inspection must not reject a legal thenable. */
  }
  return new Promise((resolve, reject) => {
    queueMicrotask(() => {
      try {
        Reflect.apply(then, value, [resolve, reject]);
      } catch (error) {
        reject(error);
      }
    });
  });
}
function check(signal: AbortSignal | undefined): void {
  signal?.throwIfAborted();
}
function wait<T>(value: PromiseLike<T>, signal: AbortSignal | undefined): PromiseLike<T> {
  if (!signal) return value;
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      cleanup();
      reject(signal.reason ?? new Error("Aborted"));
    };
    const cleanup = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    value.then(
      (v) => {
        cleanup();
        resolve(v);
      },
      (e: unknown) => {
        cleanup();
        reject(e);
      },
    );
    if (signal.aborted) abort();
  });
}
// An attribute record holding a primitive (encoding it runs no user code).
const primitive = (attribute: AttributeRecord): boolean => {
  const value = attribute.value;
  return value === null || (typeof value !== "object" && typeof value !== "function");
};
// A primitive attribute value's encoding (encodeAttributeValue's output; strings and numbers from the cached
// prefix), else null: objects / functions (thenables, coercible objects, translated values) and URLs the
// unsafe rule would neutralize (their dev warning) take the generic path. `info`: the name's rawAttribute
// when the caller has it (list plans).
// A spread's records (server-spread.ts) as one encoded string when every value is primitive, else null.
function spreadString(records: readonly AttributeRecord[]): string | null {
  let out = "";
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!,
      encoded = primitive(record) ? primitiveAttribute(record.name, record.namespace, record.value) : null;
    if (encoded === null) return null;
    out += encoded;
  }
  return out;
}
function primitiveAttribute(name: string, namespace: AttributeNamespace, value: unknown, info?: RawAttribute | null): string | null {
  if (value == null) return "";
  const kind = typeof value;
  if (kind === "object" || kind === "function") return null;
  if (kind === "string" || kind === "number") {
    const raw = info === undefined ? rawAttribute(name, namespace) : info;
    if (raw !== null) {
      if (kind === "number") return raw.text + (value as number) + '"';
      if (raw.url !== null && unsafeUrl(raw.url, value as string, namespace === "media") !== undefined) return null;
      return raw.text + escapeAttribute(value as string) + '"';
    }
  }
  return encodeAttributeValue(name, value as Coercible, namespace);
}
/** Render ordered output; function factories own setup until completion/abort. Caller finalizes the sink. */
// Function factories run in request-owned roots until completion/abort. Stream in order; synchronous sinks stay synchronous until a child or write actually suspends.
export function renderToWriter(value: ServerValue, writer: ServerWriter, { signal, variant = 0 }: RenderOptions = {}): void | Promise<void> {
  return renderCore(value, writer, signal, variant);
}
function renderCore(value: unknown, writer: Sink, signal: AbortSignal | undefined, variant: number): void | Promise<void> {
  // Observe the formed input once, without running deferred functions or coercing values.
  // Retain original rejection semantics: traversal awaits the normalized promise at its slot.
  const promises = new WeakMap<object, PromiseLike<unknown> | null>();
  const admitted = new WeakSet<object>();
  const promiseOf = (value: unknown): PromiseLike<unknown> | null | undefined => {
    if (value == null || (typeof value !== "object" && typeof value !== "function")) return null;
    if (!promises.has(value)) promises.set(value, normalizeThenable(value));
    return promises.get(value);
  };
  const scopes = new Set<ScopedRecord>();
  let finalized = false,
    requestRoot: { value: unknown; dispose: () => void } | undefined;
  const finish = () => {
    if (finalized) return;
    finalized = true;
    let failure: unknown;
    for (const scope of scopes) {
      try {
        scope.dispose();
      } catch (error) {
        failure ??= error;
      }
    }
    scopes.clear();
    try {
      requestRoot?.dispose();
    } catch (error) {
      failure ??= error;
    }
    if (failure) throw failure;
  };
  const admit = (value: unknown): void => {
    if (value == null || (typeof value !== "object" && typeof value !== "function")) return;
    // Compiler records are never thenable with untampered built-ins and carry no scope, so
    // they need no identity cache entry; their slots are still admitted in order.
    if ((value as Branded)[COMPILED]) {
      const slots = (value as TemplateRecord).slots;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (slot === null || (typeof slot !== "object" && typeof slot !== "function")) continue;
        // Attribute records (most object slots) admit their value: inlined for scalar values.
        if ((slot as Branded)[ATTRIBUTE]) {
          const attributeValue = (slot as AttributeRecord).value;
          if (attributeValue !== null && (typeof attributeValue === "object" || typeof attributeValue === "function")) admit(attributeValue);
        } else admit(slot);
      }
      return;
    }
    if ((value as Branded)[LIST]) {
      // A compiler-owned tape is fixed once formed. Cache one identity for the whole list,
      // so repeated parent/child visits do not rescan every row's captures.
      if (admitted.has(value)) return;
      admitted.add(value);
      const tape = (value as ListRecord).tape;
      for (let i = 0; i < tape.length; i++) {
        const slot = tape[i];
        if (slot !== null && (typeof slot === "object" || typeof slot === "function")) admit(slot);
      }
      return;
    }
    if ((value as Branded)[ATTRIBUTE]) return admit((value as AttributeRecord).value);
    // Template records (`template()`; runtime-made like compiled ones, never thenable with untampered built-ins, no scope):
    // no identity / thenable probe either (ORPHAN-B: two hash operations and a `then` lookup per record).
    if ((value as Branded)[TEMPLATE]) {
      for (const child of (value as TemplateRecord).slots) admit(child);
      return;
    }
    // Scoped records (Provider and other owned scopes) are runtime-made, never thenable: `scopes` is their
    // identity cache (no `admitted` / thenable probe per record — one hash op per nested provider).
    if ((value as Branded)[SCOPED]) {
      if (finalized) (value as ScopedRecord).dispose();
      else if (scopes.has(value as ScopedRecord)) return;
      else scopes.add(value as ScopedRecord);
      return admit((value as ScopedRecord).value);
    }
    // Runtime-made, never thenable: no identity / thenable probe. An event handler (plain function) is inert.
    if (isOmitted(value)) {
      const inner = value.value;
      if (!inert(inner)) admit(inner);
      return;
    }
    // Spread attribute record arrays (`server-spread.ts`; runtime-made, never thenable, never mutated after forming): admit their values.
    if ((value as Branded)[SPREAD]) {
      for (const record of value as AttributeRecord[]) {
        const attributeValue = record.value;
        if (attributeValue !== null && (typeof attributeValue === "object" || typeof attributeValue === "function")) admit(attributeValue);
      }
      return;
    }
    if (admitted.has(value)) return;
    admitted.add(value);
    const promise = promiseOf(value);
    if (promise) {
      promise.then(
        (resolved) => {
          try {
            admit(resolved);
          } catch {
            /* Traversal reports unsupported values in order. */
          }
        },
        () => {},
      );
    } else if (Array.isArray(value)) {
      for (const child of value) if (child !== null && (typeof child === "object" || typeof child === "function")) admit(child);
    } else if ((value as Branded)[CAUGHT]) admit((value as CaughtRecord).value);
  };
  // A reused writer acknowledgment is a fresh wait for each write, unlike
  // formed response values whose assimilation is cached for this render.
  const acknowledge = (result: unknown): PromiseLike<void> | undefined => {
    const acknowledgment = normalizeThenable(result);
    if (acknowledgment) return wait(acknowledgment, signal).then(() => check(signal));
    check(signal);
  };
  const write = (chunk: string): PromiseLike<void> | undefined => {
    check(signal);
    if (!chunk) return;
    return acknowledge(writer.write(chunk));
  };
  // Resume marker ids (slot 0 of a record over MARK fragments, server-resume) in write order: an id that
  // continues the stride of the two marks written before it is left out (-1: write nothing); the browser reads
  // it from document order. A reset (content the browser never sees as comments, or a raw template fragment
  // that may hold markers of its own) forgets both, so the next two marks are written. A failed ErrorBoundary
  // restores the state its discarded content advanced, as does a raw slab attempt that wrote nothing.
  let markLast = -1,
    markStep = 0;
  const markOut = (id: number, mode: number): number => {
    if (mode === MARK_RESET) return ((markLast = -1), (markStep = 0), -1);
    if (mode === MARK_CHAIN && markStep !== 0 && id === markLast + markStep) return ((markLast = id), -1);
    markStep = markLast < 0 ? 0 : id - markLast;
    markLast = id;
    return id;
  };
  // Restore only for the synchronous step; a returned Promise never retains the global owner.
  // Plain scalar/template responses keep the no-owner path.
  // `inside`: the owner the renderer's current synchronous frame already runs under (set by `within`), so
  // nested steps under the same owner (rows of an owned list, slots of an owned template) neither allocate
  // a callback nor re-enter `runWithOwner`. A disposed owner still takes `runWithOwner` (it throws there).
  let inside: Owner | null = null;
  const here = (owner: Owner | null): boolean => owner === null || (owner === inside && !(owner as { disposed?: boolean }).disposed);
  const within: Within = (owner, run) => {
    if (here(owner)) return run();
    const outer = inside;
    inside = owner;
    try {
      return runWithOwner(owner, run);
    } finally {
      inside = outer;
    }
  };
  // Every callback below lives in a helper of its own: V8 allocates a context on entry to any
  // function whose parameters an inner closure captures, even when that branch never runs.
  // The per-node traversal functions therefore create no closures.
  const visitWithin = (value: unknown, owner: Owner | null): unknown => within(owner, () => visit(value, owner));
  const valueWithin = (value: unknown, owner: Owner | null): unknown => within(owner, () => visitValue(value, owner));
  const arrayWithin = (value: readonly unknown[], owner: Owner | null, count: number, start: number): unknown =>
    within(owner, () => arraySequence(value, owner, count, start));
  const templateSequenceWithin = (value: TemplateRecord, owner: Owner | null, count: number, start: number): unknown =>
    within(owner, () => templateSequence(value, owner, count, start));
  const resumeArray = (result: PromiseLike<unknown>, value: readonly unknown[], owner: Owner | null, count: number, next: number): unknown =>
    result.then(() => arraySequence(value, owner, count, next));
  const templateWithin = (value: TemplateRecord, owner: Owner | null, i: number): unknown => within(owner, () => templateStep(value, owner, i));
  const resumeTemplate = (result: PromiseLike<unknown>, value: TemplateRecord, owner: Owner | null, count: number, next: number): unknown =>
    result.then(() => templateSequence(value, owner, count, next));
  // Records (compiled records, and list rows: `plan` + the tape from `base`) and lists resume here.
  const recordWithin = (value: Rows, plan: ListPlan | null, base: number, owner: Owner | null, count: number, start: number): unknown =>
    within(owner, () => recordValue(value, plan, base, owner, count, start));
  const resumeRecord = (
    result: PromiseLike<unknown>,
    value: Rows,
    plan: ListPlan | null,
    base: number,
    owner: Owner | null,
    count: number,
    next: number,
  ): unknown => result.then(() => recordSequence(value, plan, base, owner, count, next));
  const acknowledgeRecord = (
    acknowledgment: PromiseLike<unknown>,
    value: Rows,
    plan: ListPlan | null,
    base: number,
    owner: Owner | null,
    count: number,
    next: number,
  ): unknown =>
    wait(acknowledgment, signal).then(() => {
      check(signal);
      return recordSequence(value, plan, base, owner, count, next);
    });
  const resumeRecordChild = (
    flushed: PromiseLike<unknown>,
    child: unknown,
    value: Rows,
    plan: ListPlan | null,
    base: number,
    owner: Owner | null,
    count: number,
    next: number,
  ): unknown =>
    flushed.then(() =>
      within(owner, () => {
        const result = visitChild(child, owner);
        return pending(result) ? resumeRecord(result, value, plan, base, owner, count, next) : recordSequence(value, plan, base, owner, count, next);
      }),
    );
  const listWithin = (value: ListRecord, owner: Owner | null, row: number): unknown => within(owner, () => listValue(value, owner, row));
  const resumeList = (result: PromiseLike<unknown>, value: ListRecord, owner: Owner | null, row: number): unknown =>
    result.then(() => listSequence(value, owner, row));
  const acknowledgeList = (acknowledgment: PromiseLike<unknown>, value: ListRecord, owner: Owner | null, row: number): unknown =>
    wait(acknowledgment, signal).then(() => {
      check(signal);
      return listSequence(value, owner, row);
    });
  const admitWithin = (value: unknown, owner: Owner | null): unknown =>
    within(owner, () => {
      admit(value);
      return visitValue(value, owner);
    });
  const awaitAttribute = (promise: PromiseLike<unknown>, value: AttributeRecord, owner: Owner | null): unknown =>
    wait(promise, signal).then((resolved) => visit({ ...value, value: resolved }, owner));
  // `within` makes `owner` the current frame's owner, so visiting = admitting once + dispatching.
  const awaitValue = (promise: PromiseLike<unknown>, owner: Owner | null): unknown => wait(promise, signal).then((resolved) => admitWithin(resolved, owner));
  // Specialized loops avoid allocating a callback for each template/array.
  // Capture the original position count, while reading values at visit time.
  const arraySequence = (value: readonly unknown[], owner: Owner | null, count: number, start = 0): unknown => {
    // Every array reaches here admitted (`visit` admits it first; admission recurses into its items), so a compiled item
    // dispatches without re-admitting its subtree (visitChild's rule; visitValue restores the owner itself) — a server
    // For's rows and a `.map` list alike (ORPHAN-B: nested `.map` lists re-admitted every item subtree once per level, the
    // codex 1000-section page admitted each section twice: `admit` 11.5 % → see docs/server.md). An item put in after
    // admission (mutating formed values is unsupported) is still observed: its non-compiled slots are admitted when visited.
    // Outside the owner (a continuation after a wait): re-enter it once for the remaining items, not per item.
    if (start < count && !here(owner)) return arrayWithin(value, owner, count, start);
    return arrayLoop(steps, value, owner, count, start);
  };
  // A template record reaches here admitted too: its compiled slots dispatch without re-admission (`visitChild`'s rule).
  const templateStep = (value: TemplateRecord, owner: Owner | null, i: number): unknown => {
    if (!(i % 2)) return templateFragment(value.fragments[i / 2]!);
    const slot = value.slots[(i - 1) / 2];
    return slot !== null && typeof slot === "object" && (slot as Branded)[TEMPLATE] ? visitValue(slot, owner) : visit(slot, owner);
  };
  // A runtime / user template's raw HTML may carry resume markers of its own (a cached render): reset.
  const templateFragment = (fragment: string): unknown => {
    if (fragment) ((markLast = -1), (markStep = 0));
    return write(fragment);
  };
  const templateSequence = (value: TemplateRecord, owner: Owner | null, count: number, start = 0): unknown => {
    if (start < count && !here(owner)) return templateSequenceWithin(value, owner, count, start);
    for (let i = start; i < count; i++) {
      const result = here(owner) ? templateStep(value, owner, i) : templateWithin(value, owner, i);
      if (pending(result)) return resumeTemplate(result, value, owner, count, i + 1);
    }
  };
  // The record writer: one implementation for compiled records (`plan` null: fragments + slots of the record)
  // and list rows (`plan` = the list's plan: its fragments, slot `k` = tape[base + k], attribute names in the
  // plan, OPEN / CLOSE bounds of a flattened child component). Only compiler-owned immutable regions may change
  // physical write granularity: flush before any observable child work; primitives carry no user coercion.
  const recordSequence = (value: Rows, plan: ListPlan | null, base: number, owner: Owner | null, count: number, start = 0): unknown =>
    here(owner) ? recordValue(value, plan, base, owner, count, start) : recordWithin(value, plan, base, owner, count, start);
  // Byte writers receive pre-encoded fragments and scalars directly; the writer owns
  // chunking and backpressure, so no intermediate response strings are built.
  const bytes = typeof writer.writeBytes === "function";
  const writeInteger = bytes && typeof writer.writeInteger === "function";
  const writeText = bytes && typeof writer.writeText === "function";
  const text = (child: unknown): unknown => (writeText && typeof child === "string" ? writer.writeText!(child) : writer.write(escapeText(child as Coercible)));
  const recordValue = (value: Rows, plan: ListPlan | null, base: number, owner: Owner | null, count: number, start: number): unknown =>
    bytes ? recordBytes(value, plan, base, owner, count, start) : recordString(value, plan, base, owner, count, start);
  // An object list attribute value (thenable or coercible) takes the generic record path.
  const attributeRecord = (attribute: PlanAttribute, value: unknown): AttributeRecord => _attributeRecord(attribute.name, value, attribute.namespace);
  // A primitive attribute on a byte writer: integers as prefix + digits + quote (all three writes are accepted
  // even under backpressure; any returned wait covers them), else its encoding; GENERIC: the generic path.
  const attributeBytes = (name: string, namespace: AttributeNamespace, value: unknown, info?: RawAttribute | null): unknown => {
    if (writeInteger && typeof value === "number" && safeInteger(value)) {
      const raw = info === undefined ? rawAttribute(name, namespace) : info;
      if (raw !== null) {
        const head = writer.writeBytes!(raw.prefix),
          digits = writer.writeInteger!(value),
          tail = writer.writeBytes!(QUOTE);
        return head ?? digits ?? tail;
      }
    }
    const encoded = primitiveAttribute(name, namespace, value, info);
    if (encoded === null) return GENERIC;
    return encoded ? writer.write(encoded) : undefined;
  };
  // A whole record of scalar slots written straight into the writer's slab: integers, short strings, omitted
  // values, attributes holding an integer, a short string or null, and nested compiled records of such slots
  // (a component's markup: a link, a cell). One room check, one write threshold check and no abort check per
  // piece. Bytes are exactly the per-piece path's; anything else (unsafe URLs included: their dev warning)
  // takes that path. The size pass queues each attribute record's prefix and each nested record's encoded
  // fragments in `rawParts`, in the order the write pass consumes them (no user code runs in between); list
  // attributes read theirs from the plan.
  const rawParts: (RawAttribute | readonly Uint8Array[])[] = [];
  let rawCount = 0;
  const rawSize = (slots: readonly unknown[], base: number, width: number, attributes: readonly PlanSlot[] | null, need: number, depth: number): number => {
    for (let k = 0; k < width; k++) {
      let child = slots[base + k],
        // Set for an attribute: its raw info (null: boolean name, generic path); `child` is then its value.
        info: RawAttribute | null | undefined,
        namespace: AttributeNamespace = "html";
      if (attributes !== null) {
        const entry = attributes[k]!;
        if (typeof entry === "number") continue;
        if (entry !== null) {
          // A null attribute writes nothing (encodeAttributeValue's first rule, before any name check).
          if (child == null) continue;
          info = entry.raw;
          namespace = entry.namespace;
        }
      }
      if (info === undefined) {
        const kind = typeof child;
        if (kind === "number") {
          if (!safeInteger(child as number)) return -1;
          need += INTEGER_BYTES;
          continue;
        }
        if (kind === "string") {
          if ((child as string).length > RAW_TEXT) return -1;
          need += (child as string).length * TEXT_UNIT_BYTES;
          continue;
        }
        if (child == null || kind === "boolean") continue;
        if (kind !== "object") return -1;
        if ((child as Branded)[ATTRIBUTE]) {
          const attribute = child as AttributeRecord;
          if ((child = attribute.value) == null) continue;
          namespace = attribute.namespace;
          rawParts[rawCount++] = info = rawAttribute(attribute.name, namespace)!;
        } else if ((child as Branded)[COMPILED] && depth < RAW_DEPTH && !(translated && (child as Branded)[VARIANTS] !== undefined)) {
          const inner = encoded((child as TemplateRecord).fragments),
            innerSlots = (child as TemplateRecord).slots;
          rawParts[rawCount++] = inner;
          const size = rawSize(innerSlots, 0, innerSlots.length, null, fragmentBytes(inner), depth + 1);
          if (size < 0) {
            // The nested records down to the failure: each would fail its own attempt (a non-raw slot
            // within reach) or nearly (the depth bound), so recordBytes skips their size passes.
            rawPath[depth] = child as TemplateRecord;
            if (rawPathEnd <= depth) rawPathEnd = depth + 1;
            return -1;
          }
          need = size + need;
          continue;
        } else return -1;
      }
      // An attribute's primitive value: boolean names, non-integer numbers, long strings and URLs the unsafe
      // rule would neutralize (their dev warning) take the generic path.
      if (info === null) return -1;
      if (typeof child === "number") {
        if (!safeInteger(child)) return -1;
        need += info.prefix.length + 1 + INTEGER_BYTES;
      } else if (typeof child === "string") {
        if (child.length > RAW_TEXT) return -1;
        // A single URL starting with `/` `#` `?` `.` has no scheme (stripping controls and spaces keeps that
        // first character); anything else is checked as encodeAttributeValue checks it.
        if (info.url !== null) {
          const first = child.charCodeAt(0);
          if ((info.list || (first !== 47 && first !== 35 && first !== 63 && first !== 46)) && unsafeUrl(info.url, child, namespace === "media") !== undefined)
            return -1;
        }
        need += info.prefix.length + 1 + child.length * ATTRIBUTE_UNIT_BYTES;
      } else return -1;
    }
    return need;
  };
  let rawRead = 0;
  // Records on the nested path of the last failed raw attempt (rawPath[0] = the attempted record's child).
  const rawPath: TemplateRecord[] = [];
  let rawPathEnd = 0;
  const rawWrite = (
    target: Uint8Array,
    offset: number,
    fragments: readonly Uint8Array[],
    slots: readonly unknown[],
    base: number,
    width: number,
    attributes: readonly PlanSlot[] | null,
  ): number => {
    for (let k = 0; k < width; k++) {
      const fragment = fragments[k]!,
        length = fragment.length;
      // Short fragments (attribute gaps are often empty) copy by hand: TypedArray#set costs a native call.
      if (length > 16) (target.set(fragment, offset), (offset += length));
      else for (let b = 0; b < length; b++) target[offset++] = fragment[b]!;
      let child = slots[base + k],
        prefix: Uint8Array | null = null;
      if (attributes !== null) {
        const entry = attributes[k]!;
        if (typeof entry === "number") continue;
        if (entry !== null) {
          if (child == null) continue;
          prefix = entry.raw!.prefix;
        }
      }
      if (prefix === null) {
        const kind = typeof child;
        if (kind === "string") {
          offset = putText(target, offset, child as string);
          continue;
        }
        if (child == null || kind === "boolean") continue;
        if (kind !== "object") {
          if (k === 0 && (fragments as Marked)[MARK] !== undefined) {
            const id = markOut(child as number, (fragments as Marked)[MARK]!);
            if (id >= 0) offset = putInt32(target, offset, id);
            continue;
          }
          offset = ((child as number) | 0) === child ? putInt32(target, offset, child as number) : putSafeInteger(target, offset, child as number);
          continue;
        }
        if (!(child as Branded)[ATTRIBUTE]) {
          const inner = rawParts[rawRead++] as readonly Uint8Array[],
            innerSlots = (child as TemplateRecord).slots;
          offset = rawWrite(target, offset, inner, innerSlots, 0, innerSlots.length, null);
          continue;
        }
        if ((child = (child as AttributeRecord).value) == null) continue;
        prefix = (rawParts[rawRead++] as RawAttribute).prefix;
      }
      // ` name="value"`.
      target.set(prefix, offset);
      offset += prefix.length;
      if (typeof child === "string") offset = putAttribute(target, offset, child);
      else offset = ((child as number) | 0) === child ? putInt32(target, offset, child as number) : putSafeInteger(target, offset, child as number);
      target[offset++] = 34;
    }
    const last = fragments[width]!;
    target.set(last, offset);
    return offset + last.length;
  };
  // One-pass raw write: rawSize's checks and rawWrite's output fused, into the room the slab already has
  // (`limit`); nothing is committed until the caller's `commit`, so a failure leaves only scratch bytes past
  // the writer's offset. Returns the end offset, RAW_NOT (a slot needs the generic path; `rawPath` marked as
  // rawSize marks it) or RAW_ROOM (the room ran out: the caller sizes the record and claims room first).
  const rawPut = (
    target: Uint8Array,
    offset: number,
    limit: number,
    fragments: readonly Uint8Array[],
    slots: readonly unknown[],
    base: number,
    width: number,
    attributes: readonly PlanSlot[] | null,
    depth: number,
  ): number => {
    for (let k = 0; k < width; k++) {
      const fragment = fragments[k]!,
        length = fragment.length;
      if (offset + length > limit) return RAW_ROOM;
      if (length > 16) (target.set(fragment, offset), (offset += length));
      else for (let b = 0; b < length; b++) target[offset++] = fragment[b]!;
      let child = slots[base + k],
        info: RawAttribute | null | undefined,
        namespace: AttributeNamespace = "html";
      if (attributes !== null) {
        const entry = attributes[k]!;
        if (typeof entry === "number") continue;
        if (entry !== null) {
          if (child == null) continue;
          info = entry.raw;
          namespace = entry.namespace;
        }
      }
      if (info === undefined) {
        const kind = typeof child;
        if (kind === "string") {
          if ((child as string).length > RAW_TEXT) {
            if (TEXT_SPECIAL.test(child as string)) return RAW_NOT;
            if (offset + (child as string).length * TEXT_UNIT_BYTES > limit) return RAW_ROOM;
            offset = putLong(target, offset, child as string);
            continue;
          }
          if (offset + (child as string).length * TEXT_UNIT_BYTES > limit) return RAW_ROOM;
          offset = putText(target, offset, child as string);
          continue;
        }
        if (kind === "number") {
          if (!safeInteger(child as number)) return RAW_NOT;
          if (offset + INTEGER_BYTES > limit) return RAW_ROOM;
          if (k === 0 && (fragments as Marked)[MARK] !== undefined) {
            const id = markOut(child as number, (fragments as Marked)[MARK]!);
            if (id >= 0) offset = putInt32(target, offset, id);
            continue;
          }
          offset = ((child as number) | 0) === child ? putInt32(target, offset, child as number) : putSafeInteger(target, offset, child as number);
          continue;
        }
        if (child == null || kind === "boolean") continue;
        if (kind !== "object") return RAW_NOT;
        if ((child as Branded)[ATTRIBUTE]) {
          const attribute = child as AttributeRecord;
          if ((child = attribute.value) == null) continue;
          namespace = attribute.namespace;
          info = rawAttribute(attribute.name, namespace);
        } else if ((child as Branded)[COMPILED] && depth < RAW_DEPTH && !(translated && (child as Branded)[VARIANTS] !== undefined)) {
          const innerSlots = (child as TemplateRecord).slots;
          const end = rawPut(target, offset, limit, encoded((child as TemplateRecord).fragments), innerSlots, 0, innerSlots.length, null, depth + 1);
          if (end < 0) {
            if (end === RAW_NOT) {
              rawPath[depth] = child as TemplateRecord;
              if (rawPathEnd <= depth) rawPathEnd = depth + 1;
            }
            return end;
          }
          offset = end;
          continue;
        } else return RAW_NOT;
      }
      if (info === null) return RAW_NOT;
      const prefix = info.prefix;
      if (typeof child === "number") {
        if (!safeInteger(child)) return RAW_NOT;
        if (offset + prefix.length + 1 + INTEGER_BYTES > limit) return RAW_ROOM;
        target.set(prefix, offset);
        offset += prefix.length;
        offset = (child | 0) === child ? putInt32(target, offset, child) : putSafeInteger(target, offset, child);
      } else if (typeof child === "string") {
        if (child.length > RAW_TEXT) return RAW_NOT;
        if (info.url !== null) {
          const first = child.charCodeAt(0);
          if ((info.list || (first !== 47 && first !== 35 && first !== 63 && first !== 46)) && unsafeUrl(info.url, child, namespace === "media") !== undefined)
            return RAW_NOT;
        }
        if (offset + prefix.length + 1 + child.length * ATTRIBUTE_UNIT_BYTES > limit) return RAW_ROOM;
        target.set(prefix, offset);
        offset += prefix.length;
        offset = putAttribute(target, offset, child);
      } else return RAW_NOT;
      target[offset++] = 34;
    }
    const last = fragments[width]!;
    if (offset + last.length > limit) return RAW_ROOM;
    target.set(last, offset);
    return offset + last.length;
  };
  const rawTemplate = (
    fragments: readonly Uint8Array[],
    slots: readonly unknown[],
    base: number,
    width: number,
    attributes: readonly PlanSlot[] | null,
    fixed: number,
  ): unknown => {
    rawPathEnd = 0;
    // Abort check + a slab (claim of nothing never flushes); then one pass into the room left.
    writer.claim!(0);
    const target = writer.bytes!,
      last = markLast,
      step = markStep;
    const end = rawPut(target, writer.offset!, target.length, fragments, slots, base, width, attributes, 0);
    if (end >= 0) return writer.commit!(end);
    // Nothing was written: the marks it passed are written again.
    ((markLast = last), (markStep = step));
    if (end === RAW_NOT) return GENERIC;
    rawCount = 0;
    rawPathEnd = 0;
    const need = rawSize(slots, base, width, attributes, fixed, 0);
    if (need < 0 || need > RAW_MAX) return GENERIC;
    const waiting = writer.claim!(need);
    rawRead = 0;
    const committed = writer.commit!(rawWrite(writer.bytes!, writer.offset!, fragments, slots, base, width, attributes));
    return waiting ?? committed;
  };
  // `path`: this record's index on rawPath when its parent reached it there (nested compiled children are
  // rendered by direct recursion: no visitChild / visitValue / recordSequence frames), RAW_TRIED when the
  // caller's raw attempt failed (list rows), else -1.
  const recordBytes = (value: Rows, plan: ListPlan | null, base: number, owner: Owner | null, count: number, start: number, path = -1): unknown => {
    let fragments: readonly Uint8Array[], slots: readonly unknown[], attributes: readonly PlanSlot[] | null;
    if (plan === null) {
      fragments = encoded((value as TemplateRecord).fragments);
      slots = (value as TemplateRecord).slots;
      attributes = null;
    } else {
      fragments = plan.bytes ?? planBytes(plan);
      slots = (value as ListRecord).tape;
      attributes = plan.attributes;
    }
    const skip = path === RAW_TRIED || (path >= 0 && path < rawPathEnd && rawPath[path] === value);
    // Read per call: an ErrorBoundary swaps `writer` for a buffer while its content renders.
    if (!skip && start === 0 && typeof writer.claim === "function") {
      const written = rawTemplate(fragments, slots, base, (count - 1) / 2, attributes, plan === null ? fragmentBytes(fragments) : plan.fixed);
      if (written !== GENERIC) {
        const acknowledgment = written === undefined ? null : normalizeThenable(written);
        return acknowledgment ? acknowledgeRecord(acknowledgment, value, plan, base, owner, count, count) : undefined;
      }
    }
    const nested = skip && path >= 0 ? path + 1 : 0;
    for (let i = start; i < count; i++) {
      check(signal);
      let result: unknown;
      if (i % 2 === 0) result = writer.writeBytes!(fragments[i / 2]!);
      else {
        const k = (i - 1) / 2,
          entry = attributes === null ? null : attributes[k]!;
        if (typeof entry === "number") continue;
        let child = slots[base + k];
        const kind = typeof child;
        let generic = false;
        if (entry !== null) {
          if (child !== null && (kind === "object" || kind === "function")) generic = true;
          else if ((result = attributeBytes(entry.name, entry.namespace, child, entry.raw)) === GENERIC) generic = true;
          if (generic) child = attributeRecord(entry, child);
        } else if (kind === "number") {
          if (k === 0 && (fragments as Marked)[MARK] !== undefined) {
            const id = markOut(child as number, (fragments as Marked)[MARK]!);
            if (id < 0) continue;
            child = id;
          }
          result = safeInteger(child as number) && writeInteger ? writer.writeInteger!(child as number) : writer.write("" + (child as number));
        } else if (child == null || kind === "boolean") continue;
        else if (kind !== "object" && kind !== "function") result = text(child);
        else if ((child as Branded)[ATTRIBUTE] && primitive(child as AttributeRecord)) {
          const attribute = child as AttributeRecord;
          if ((result = attributeBytes(attribute.name, attribute.namespace, attribute.value)) === GENERIC) generic = true;
        } else if ((child as Branded)[COMPILED] && here(owner)) {
          const record = translated && (child as Branded)[VARIANTS] !== undefined ? variantRecord(child as TemplateRecord, variant) : (child as TemplateRecord);
          result = recordBytes(record, null, 0, owner, record.slots.length * 2 + 1, 0, nested);
          if (pending(result)) return resumeRecord(result, value, plan, base, owner, count, i + 1);
          continue;
        } else if ((child as Branded)[SPREAD]) {
          const encoded = spreadString(child as AttributeRecord[]);
          if (encoded === null) generic = true;
          else if (encoded) result = writer.write(encoded);
          else continue;
        } else generic = true;
        if (generic) {
          result = visitChild(child, owner);
          if (pending(result)) return resumeRecord(result, value, plan, base, owner, count, i + 1);
          continue;
        }
      }
      const acknowledgment = result === undefined ? null : normalizeThenable(result);
      if (acknowledgment) return acknowledgeRecord(acknowledgment, value, plan, base, owner, count, i + 1);
    }
  };
  // String writers: a nested compiled child continues the parent's chunk (`head`) and hands its tail back
  // in `carry` (read by the parent right after a non-pending return), and an attribute holding a primitive
  // encodes into the chunk: neither runs user code, so the chunk is still flushed before any observable
  // child work (functions, promises, objects, unsafe URLs: their dev warning), as the byte path's rawTemplate
  // does. One frame per nested record instead of four, no write per attribute or nesting level. (An
  // explicit parent stack instead of the recursion measured the same.) A list row ends with its own write; its
  // flattened child components continue the row's chunk, as nested compiled records do — and, like those,
  // end with their own write once they continued after a wait (same chunks as the per-row records).
  let carry = "";
  const recordString = (value: Rows, plan: ListPlan | null, base: number, owner: Owner | null, count: number, start: number, head?: string): unknown => {
    let fragments: readonly string[], slots: readonly unknown[], attributes: readonly PlanSlot[] | null;
    if (plan === null) {
      fragments = (value as TemplateRecord).fragments;
      slots = (value as TemplateRecord).slots;
      attributes = null;
    } else {
      fragments = plan.fragments;
      slots = (value as ListRecord).tape;
      attributes = plan.attributes;
    }
    let chunk = head === undefined ? "" : head;
    // List rows: `depth` = open flattened children; a continuation (start > 0) resumes every enclosing one.
    let depth = 0,
      resumed = 0;
    if (attributes !== null && start > 0) {
      for (let k = 0; 2 * k + 1 < start; k++) if (typeof attributes[k] === "number") depth += attributes[k] as number;
      resumed = depth;
    }
    for (let i = start; i < count; i++) {
      check(signal);
      if (i % 2 === 0) chunk += fragments[i / 2];
      else {
        const k = (i - 1) / 2,
          entry = attributes === null ? null : attributes[k]!;
        let child = slots[base + k];
        const kind = typeof child;
        if (typeof entry === "number") {
          // The end of a flattened child that continued after a wait: its own record would end with a write.
          if (entry === CLOSE && depth <= resumed) {
            resumed = depth - 1;
            const flushed = write(chunk);
            chunk = "";
            if (pending(flushed)) return resumeRecord(flushed, value, plan, base, owner, count, i + 1);
          }
          depth += entry;
          continue;
        }
        if (entry === null) {
          if (child == null || kind === "boolean") continue; // Omitted scalar child.
          if (kind === "number") {
            if (k === 0 && (fragments as Marked)[MARK] !== undefined) {
              const id = markOut(child as number, (fragments as Marked)[MARK]!);
              if (id >= 0) chunk += id;
            } else chunk += child as number;
          } else if (kind !== "object" && kind !== "function") chunk += escapeText(child as Coercible);
          else if ((child as Branded)[ATTRIBUTE]) {
            const attribute = child as AttributeRecord,
              encoded = primitiveAttribute(attribute.name, attribute.namespace, attribute.value);
            if (encoded !== null) {
              chunk += encoded;
              continue;
            }
          } else if ((child as Branded)[COMPILED] && here(owner)) {
            if (translated && (child as Branded)[VARIANTS] !== undefined) child = variantRecord(child as TemplateRecord, variant);
            const result = recordString(child as TemplateRecord, null, 0, owner, (child as TemplateRecord).slots.length * 2 + 1, 0, chunk);
            if (pending(result)) return resumeRecord(result, value, plan, base, owner, count, i + 1);
            chunk = carry;
            carry = "";
            continue;
          }
        } else {
          // A list attribute: its name in the plan, its value on the tape.
          if (child === null || (kind !== "object" && kind !== "function")) {
            const encoded = primitiveAttribute(entry.name, entry.namespace, child, entry.raw);
            if (encoded !== null) {
              chunk += encoded;
              continue;
            }
          }
          child = attributeRecord(entry, child);
        }
        if (child !== null && (typeof child === "object" || typeof child === "function")) {
          // A spread of primitive attributes encodes into the chunk (no flush + per-record dispatch); anything
          // else takes the generic path.
          if ((child as Branded)[SPREAD]) {
            const encoded = spreadString(child as AttributeRecord[]);
            if (encoded !== null) {
              chunk += encoded;
              continue;
            }
          }
          const flushed = write(chunk);
          chunk = "";
          if (pending(flushed)) return resumeRecordChild(flushed, child, value, plan, base, owner, count, i + 1);
          const result = visitChild(child, owner);
          if (pending(result)) return resumeRecord(result, value, plan, base, owner, count, i + 1);
        }
      }
      // Bounded accumulation between atomic parts, measured in UTF-16 code units.
      // A single authored fragment or escaped scalar can exceed this threshold.
      if (chunk.length >= 16 * 1024) {
        const flushed = write(chunk);
        chunk = "";
        if (pending(flushed)) return resumeRecord(flushed, value, plan, base, owner, count, i + 1);
      }
    }
    if (head === undefined) return write(chunk);
    carry = chunk;
  };
  // The list mount: its rows through the record writer, in order (`row`: the next row to write).
  const listSequence = (value: ListRecord, owner: Owner | null, row: number): unknown =>
    here(owner) ? listValue(value, owner, row) : listWithin(value, owner, row);
  // A list row of plain scalars only (integers, short strings, omitted values; integer attributes): one tight
  // size + write loop, no nested-record / string-attribute cases (rivet-compiled / rivet-for rows re-tier
  // faster after a GC than through rawSize + rawWrite: 20-iteration samples −13%). RAW_WIDE: a row
  // holding more (string attributes, nested records, …) → rawSize + rawWrite.
  const rawRow = (fragments: readonly Uint8Array[], attributes: readonly PlanSlot[], tape: readonly unknown[], base: number, fixed: number): unknown => {
    const width = attributes.length;
    let need = fixed;
    for (let k = 0; k < width; k++) {
      const attribute = attributes[k]!;
      if (typeof attribute === "number") continue;
      const child = tape[base + k],
        kind = typeof child;
      if (kind === "number") {
        if (!safeInteger(child as number)) return GENERIC;
        if (attribute !== null) {
          if (attribute.raw === null) return GENERIC;
          need += attribute.raw.prefix.length + 1;
        }
        need += INTEGER_BYTES;
      } else if (attribute !== null) {
        if (child != null) return RAW_WIDE;
      } else if (kind === "string") {
        if ((child as string).length > RAW_TEXT && TEXT_SPECIAL.test(child as string)) return GENERIC;
        need += (child as string).length * TEXT_UNIT_BYTES;
      } else if (child != null && kind !== "boolean") return kind === "object" ? RAW_WIDE : GENERIC;
    }
    if (need > RAW_MAX) return GENERIC;
    const waiting = writer.claim!(need);
    const target = writer.bytes!;
    const mark = (fragments as Marked)[MARK];
    let offset = writer.offset!;
    for (let k = 0; k < width; k++) {
      const fragment = fragments[k]!;
      target.set(fragment, offset);
      offset += fragment.length;
      const attribute = attributes[k]!;
      if (typeof attribute === "number") continue;
      const child = tape[base + k];
      if (typeof child === "number") {
        if (attribute !== null) {
          const prefix = attribute.raw!.prefix;
          target.set(prefix, offset);
          offset += prefix.length;
        }
        if (k === 0 && mark !== undefined) {
          // A row region's marker id (server-resume row plans): left out when it continues the stride.
          const id = markOut(child, mark);
          if (id >= 0) offset = putInt32(target, offset, id);
          continue;
        }
        offset = (child | 0) === child ? putInt32(target, offset, child) : putSafeInteger(target, offset, child);
        if (attribute !== null) target[offset++] = 34;
      } else if (typeof child === "string") offset = child.length > RAW_TEXT ? putLong(target, offset, child) : putText(target, offset, child);
    }
    const last = fragments[width]!;
    target.set(last, offset);
    const committed = writer.commit!(offset + last.length);
    return waiting ?? committed;
  };
  const listValue = (value: ListRecord, owner: Owner | null, row: number): unknown => {
    const plan = value.plan,
      attributes = plan.attributes,
      tape = value.tape,
      width = attributes.length,
      span = 2 * width + 1,
      rows = value.rows;
    // Byte writers with the raw-slab protocol try each row whole first (read per call: an ErrorBoundary
    // swaps `writer` for a buffer while its content renders).
    const fragments = bytes && typeof writer.claim === "function" ? (plan.bytes ?? planBytes(plan)) : null;
    // Runs of plain-value rows go through the WebAssembly emitter (row regions too: it hands each taken row's
    // marker id to `markOut`); a row it does not take is written below, then it continues with the next one.
    let emitter = fragments !== null ? plan.rows : null;
    const mode = emitter ? (fragments as Marked)[MARK] : undefined;
    for (let r = row; r < rows; r++) {
      if (emitter) {
        const next = emitter(plan, tape, r, rows, writer, signal, mode === undefined ? undefined : markOut, mode);
        if (typeof next !== "number") {
          const acknowledgment = normalizeThenable(next.wait);
          if (acknowledgment) return acknowledgeList(acknowledgment, value, owner, next.row);
          r = next.row;
        } else if (next < 0) emitter = null;
        else r = next;
        if (r >= rows) return;
      }
      check(signal);
      const base = r * width;
      // rawTemplate, inlined: one call fewer per row.
      let result: unknown = fragments === null ? GENERIC : rawRow(fragments, attributes, tape, base, plan.fixed);
      if (result === RAW_WIDE) result = rawTemplate(fragments!, tape, base, width, attributes, plan.fixed);
      if (result === GENERIC) result = bytes ? recordBytes(value, plan, base, owner, span, 0, RAW_TRIED) : recordString(value, plan, base, owner, span, 0);
      else if (result !== undefined) {
        const acknowledgment = normalizeThenable(result);
        if (acknowledgment) return acknowledgeList(acknowledgment, value, owner, r + 1);
        continue;
      }
      if (result !== undefined && pending(result)) return resumeList(result, value, owner, r + 1);
    }
  };
  const visit = (value: unknown, owner: Owner | null): unknown => {
    if (here(owner)) {
      admit(value);
      return visitValue(value, owner);
    }
    return admitWithin(value, owner);
  };
  // A child of an admitted compiled record or list tape was admitted with it (compiled admission
  // recurses into every object slot), so a compiled child dispatches without re-admitting its
  // subtree, which made admission quadratic in nesting depth. Template records (compiled or
  // `template()`) alike: they carry no identity cache entry (ORPHAN-B). visitValue's record branches
  // restore the owner themselves (recordSequence / templateSequence); anything else still goes through visit.
  const visitChild = (child: unknown, owner: Owner | null): unknown => ((child as Branded)[TEMPLATE] ? visitValue(child, owner) : visit(child, owner));
  const visitValue = (value: unknown, owner: Owner | null): unknown => {
    check(signal);
    if (value == null || typeof value === "boolean") return;
    const kind = typeof value;
    // Scalars cannot suspend or carry ownership/structure brands. Avoid boxing
    // strings and structural dispatch for every native text slot.
    if (kind !== "object" && kind !== "function") return write(escapeText(value));
    if ((value as Branded)[COMPILED]) {
      if (translated && (value as Branded)[VARIANTS] !== undefined) value = variantRecord(value as TemplateRecord, variant);
      return recordSequence(value as TemplateRecord, null, 0, owner, (value as TemplateRecord).slots.length * 2 + 1);
    }
    if ((value as Branded)[LIST]) return listSequence(value as ListRecord, owner, 0);
    if ((value as Branded)[ATTRIBUTE]) {
      const attributeValue = (value as AttributeRecord).value;
      if (writeInteger && typeof attributeValue === "number" && safeInteger(attributeValue)) {
        // Decimal digits need no escaping and can never form an unsafe URL scheme.
        const info = rawAttribute((value as AttributeRecord).name, (value as AttributeRecord).namespace);
        if (info !== null) {
          // All three writes are accepted even under backpressure; any returned wait covers them.
          const head = writer.writeBytes!(info.prefix),
            digits = writer.writeInteger!(attributeValue),
            tail = writer.writeBytes!(QUOTE);
          return acknowledge(head ?? digits ?? tail);
        }
      }
      const promise = promiseOf(attributeValue);
      if (promise) return awaitAttribute(promise, value as AttributeRecord, owner);
      if (translated && attributeValue !== null && typeof attributeValue === "object" && (attributeValue as Branded)[VARIANT_VALUE])
        return visit({ ...(value as AttributeRecord), value: _variantOf(attributeValue, variant) }, owner);
      return write(encodeAttribute(value as AttributeRecord));
    }
    // A scoped record's value was admitted with the record (admission recurses into it): dispatch without
    // re-admitting — nested providers would otherwise rescan their whole compiled subtree once per level.
    if ((value as Branded)[SCOPED]) {
      const inner = (value as ScopedRecord).value,
        scope = (value as ScopedRecord).owner!;
      return here(scope) ? visitValue(inner, scope) : valueWithin(inner, scope);
    }
    // Runtime-made records, never thenable: no promise probe.
    if ((value as Branded)[SPREAD]) return arraySequence(value as AttributeRecord[], owner, (value as AttributeRecord[]).length);
    if (isOmitted(value)) {
      if (inert(value.value)) return;
      const promise = promiseOf(value.value);
      if (promise) return wait(promise, signal).then(() => {});
      return;
    }
    // Template records are never thenable (admission skips their probe too).
    if ((value as Branded)[TEMPLATE]) return templateSequence(value as TemplateRecord, owner, (value as TemplateRecord).slots.length * 2 + 1);
    const promise = promiseOf(value);
    if (promise) return awaitValue(promise, owner);
    if (Array.isArray(value)) return arraySequence(value, owner, value.length);
    // COMPILED, TEMPLATE and ATTRIBUTE records returned above.
    if ((value as Branded)[CAUGHT]) return caught(value as CaughtRecord, owner);
    if (typeof value === "function") {
      // Only deferred user setup needs the private Async request signal. Owner
      // restoration still covers attributes, writers and traversal callbacks.
      const output = withRequestSignal(signal, value as () => unknown);
      admit(output);
      return here(owner) ? visitValue(output, owner) : valueWithin(output, owner);
    }
    if (translated && (value as Branded)[VARIANT_VALUE]) return visit(_variantOf(value, variant), owner);
    if ((value as { [RUN]?: true })[RUN]) return runWrite(value as RunRecord, 0);
    if (typeof value === "object") throw new TypeError("Unsupported server child object");
    return write(escapeText(value));
  };
  const steps: ArraySteps = { here, visit, visitValue, visitWithin, resumeArray };
  // Incremental list rows (`@rivetjs/runtime/server-incr`, lane INCR2): each row's bytes `<!--r[-->…<!--]-->` with its
  // marker id left out. The id goes in where the marker chain needs it (`markOut`: the first rows of a list); rows adjacent
  // in one buffer whose ids the chain leaves out are one write.
  const runWrite = (run: RunRecord, start: number): unknown => {
    const { bufs, bi, st, en, to } = run,
      marked = run.first >= 0,
      first = run.first - run.from;
    for (let i = start < run.from ? run.from : start; i < to;) {
      check(signal);
      const b = bi[i]!,
        buffer = bufs[b]!;
      let from = st[i]!,
        end = en[i]!,
        head: unknown;
      const id = marked ? markOut(first + i, MARK_CHAIN) : -1;
      if (id >= 0) {
        // `<!--r` + id, then the rest of the row joins the span.
        head = bytes ? writer.writeBytes!(buffer.subarray(from, from + 5)) : writer.write("<!--r");
        head = (writeInteger ? writer.writeInteger!(id) : writer.write(String(id))) ?? head;
        from += 5;
      }
      for (i++; i < to; i++) {
        if (bi[i] !== b || st[i] !== end) break;
        if (marked) {
          if (markStep !== 1 || markLast !== first + i - 1) break;
          markLast++;
        }
        end = en[i]!;
      }
      const span = buffer.subarray(from, end);
      const result = (bytes ? writer.writeBytes!(span) : writer.write(runDecoder.decode(span))) ?? head;
      const acknowledgment = result === undefined ? null : normalizeThenable(result);
      if (acknowledgment) return wait(acknowledgment, signal).then(() => runWrite(run, i));
    }
  };
  // ErrorBoundary content renders into a buffer (traversal is sequential, so the sink swap covers
  // exactly this content): complete → written in order; failed → none of it was written and the
  // fallback renders in its place. Request abort is never caught.
  const caught = (record: CaughtRecord, owner: Owner | null): unknown => {
    const target = writer,
      items: (string | Uint8Array | number)[] = [],
      last = markLast,
      step = markStep;
    writer = {
      write: (chunk: string) => void items.push(chunk),
      writeBytes: (chunk: Uint8Array) => void items.push(chunk),
      writeInteger: (n: number) => void items.push(n),
      writeText: (chunk: string) => void items.push(escapeText(chunk)),
    };
    let result: unknown;
    try {
      result = visit(record.value, owner);
    } catch (error) {
      writer = target;
      return caughtFailure(record, owner, error, last, step);
    }
    if (!pending(result)) {
      writer = target;
      return replay(items, 0);
    }
    return result.then(
      () => {
        writer = target;
        return replay(items, 0);
      },
      (error: unknown) => {
        writer = target;
        return caughtFailure(record, owner, error, last, step);
      },
    );
  };
  const caughtFailure = (record: CaughtRecord, owner: Owner | null, error: unknown, last: number, step: number): unknown => {
    if (signal?.aborted) throw error;
    // The content's marks were never written.
    ((markLast = last), (markStep = step));
    return within(owner, () => visit(record.fallback(error), owner));
  };
  const replay = (items: (string | Uint8Array | number)[], start: number): unknown => {
    if (!bytes) return write(items.join(""));
    for (let i = start; i < items.length; i++) {
      check(signal);
      const item = items[i]!;
      const result = typeof item === "string" ? writer.write(item) : typeof item === "number" ? writer.writeInteger!(item) : writer.writeBytes!(item);
      const acknowledgment = result === undefined ? null : normalizeThenable(result);
      if (acknowledgment) return wait(acknowledgment, signal).then(() => replay(items, i + 1));
    }
  };
  try {
    let result: unknown;
    admit(value);
    if (typeof value === "function") result = (requestRoot = createRoot(() => visit(value, getOwner()))).value;
    else {
      // Admission already observed the complete formed root before any output. Dispatch it
      // without rescanning compiled slots/list tapes, preserving the writer's owner boundary.
      const owner = getOwner();
      result = owner === null ? visitValue(value, owner) : within(owner, () => visitValue(value, owner));
    }
    if (pending(result))
      return result.then(
        () => finish(),
        (error: unknown) => {
          try {
            finish();
          } catch {
            /* Preserve rendering failure. */
          }
          throw error;
        },
      ) as Promise<void>;
    finish();
  } catch (error) {
    try {
      finish();
    } catch {
      /* Preserve rendering failure. */
    }
    return Promise.reject(error);
  }
}
/** Render escaped HTML; function factories own request setup, preformed values retain their existing ownership. */
// Render escaped HTML synchronously, returning a Promise only for async children or failure.
export function renderToString(value: ServerValue, options?: RenderOptions): string | Promise<string> {
  const chunks: string[] = [];
  const result = renderToWriter(
    value,
    {
      write(chunk: string) {
        chunks.push(chunk);
      },
    },
    options,
  );
  return pending(result) ? (result as Promise<void>).then(() => chunks.join("")) : chunks.join("");
}

export { Router, defineRoute } from "./server-router.ts";
/** Run browser-only work as an owned effect; a returned function is its cleanup. Never runs on the server. */
/**
 * Server twin of `@rivetjs/runtime/dom` `reconstruct`: a value built where it is used: lazy (first read), reactive (a factory reading signals re-runs; `onCleanup` inside it
 * disposes the previous value). On a resumed page the factory runs in the browser on first read, under the server's
 * context providers — for resource holders (sockets, library objects) that must not be serialized. Not `clientOnly`:
 * the server runs the factory too when it renders a read. Function Bridge T26 (Q3); resume sites: compiler C14 (T27).
 */
export function reconstruct<T>(factory: () => T): () => T {
  return computed(factory, { equals: false });
}

export function clientEffect(fn: () => void | (() => void) | Promise<unknown>, options?: { when?: ClientWhen }): void;
/** Browser-only work never runs during server rendering; under a derived render it flags its boundary's client trigger. */
export function clientEffect(_fn?: unknown, options?: { when?: ClientWhen }): void {
  _trigger.on?.(options?.when, EFFECT);
}
/** Owned browser listener; never attaches on the server. `standalone: false`: alone it does not make the page resumable; `match`: target filter (`@rivetjs/runtime/dom`). */
export function clientEvent<E extends Event = Event>(
  target: Window | Document | Element | `media:${string}`,
  type: string,
  handler: (event: E) => void,
  options?: {
    when?: ClientWhen;
    passive?: boolean;
    capture?: boolean;
    once?: boolean;
    preload?: "eager" | "idle" | "visible" | "intent" | "interaction";
    standalone?: boolean;
    match?: string;
  },
): void;
/** Browser-only listeners never attach during server rendering; under a derived render a standalone listener flags its boundary's client trigger. */
export function clientEvent(_target?: unknown, _type?: unknown, _handler?: unknown, options?: { when?: ClientWhen; standalone?: boolean }): void {
  if (options?.standalone !== false) _trigger.on?.(options?.when, EVENT);
}
/** Hand an element to a ref callback / `ref()` signal (see `@rivetjs/runtime/dom`). The server has no elements: only client
 * code paths (`clientEffect`, handlers) call it, so a server-compiled `.tsx` module importing it from `/dom` links. */
export function bindRef(target: Element, fn: ((element: Element) => void) | null | undefined): void;
/** Never called during server rendering. */
export function bindRef(): void {}
