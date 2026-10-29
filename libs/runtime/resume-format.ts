// Resume value table (route payloads, form answers, `Async` values, non-JSON boundary data). Every value is interned
// into one flat table and referenced by index, so sharing and cycles survive and the browser decodes lazily, one
// reference at a time. Plus the derived model's tail types (`<script type="rivet/boundaries">`).
import { DEV } from "#dev";
import { BINARY, ERRORS, builtin } from "./resume-kinds.ts";
import { eachRecord, urlOf } from "./resume-tail.ts";

/**
 * Run `fn` with resume recording suspended: nothing it renders registers ids, bindings, handlers or
 * markers (output a pass only inspects and discards — cdk's collection build pass). In the browser, or outside a
 * resumable render, it is `fn()`. `server-derived` installs the real implementation on import (`_setUnrecorded`), so
 * this entry stays trivial where no recorder exists.
 */
export function _rUnrecorded<T>(fn: () => T): T {
  return unrecorded(fn);
}
let unrecorded: <T>(fn: () => T) => T = (fn) => fn();
/**
 * Derived client: the decoder of table-encoded `Async` values (tail `a` entries settled `2`), installed by whoever already
 * ships `createDecoder` (the router's generated derived `Root`) so the derived runtime carries none of it. Null: such a
 * hole renders in the browser.
 */
export let _tableDecoder: ((table: readonly unknown[]) => { get: (index: number) => unknown }) | null = null;
/** @internal Installs `createDecoder` as `_tableDecoder` (router codegen, derived model). */
export function _useTableDecoder(): void {
  _tableDecoder = createDecoder;
}
/** @internal `server-derived` hook. */
export function _setUnrecorded(run: <T>(fn: () => T) => T): void {
  unrecorded = run;
}
/** A JSON-exact primitive stored inline in `{l}` / `{p}` entries; in `{p}` a one-element array `[ref]` is a reference. */
export type Literal = string | number | boolean | null;
/**
 * One table entry. Primitives are stored as themselves, arrays as element refs (-1: hole); records: `l` literal array,
 * `p` object pairs of literals and `[ref]` references (some value literal), `o` object [key, ref] pairs (no literal
 * value), `u` undefined, `n` special number, `g` bigint, `d` date, `h` URL, `t` RegExp, `U` URLSearchParams, `b` binary,
 * `E` error, `m` map ref pairs, `e` set refs, `j` plain JSON tree, `i` an object inside one, `cls` + `rv` a
 * `registerClass` instance.
 */
export interface EntryRecord {
  l?: Literal[];
  p?: (string | Literal | [ref: number])[];
  o?: (string | number)[];
  u?: 0;
  n?: string;
  g?: string;
  d?: number;
  /** URL (href). */
  h?: string;
  /** RegExp: [source, flags, lastIndex when not 0]. */
  t?: [source: string, flags: string, lastIndex?: number];
  /** URLSearchParams (its string). */
  U?: string;
  /** ArrayBuffer / DataView / typed array: [global constructor name, base64 of the view's bytes]. */
  b?: [kind: string, base64: string];
  /** Error (`Error` … `AggregateError`): [constructor name, message, ref of its own data (enumerable keys, `cause`, `errors`)]; no stack. */
  E?: (string | number)[];
  m?: number[];
  e?: number[];
  a?: number[];
  /**
   * Plain JSON value (an object / array tree of JSON-exact literals with no object reachable twice): decoded as
   * the parsed value itself. Objects inside it that other entries reference are `i` entries.
   */
  j?: object;
  /** An object inside a `j` tree: [parent ref (a `j` or `i` entry), own key]; resolved when its `j` root decodes. */
  i?: [parent: number, key: string | number];
  /**
   * `registerClass` instance (with `rv: 1`): its registered id, `a: [serialize() data ref]`; rebuilt on first decode by the
   * registered `revive(data)` (`resume-builtins.ts`, loaded on demand) once the data (and every instance in it) is complete.
   */
  cls?: string;
  rv?: 1;
}
export type TableEntry = Literal | number[] | EntryRecord;
/**
 * `special(value, ref, plain, refs)` may return a finished entry for a function or object. `plain(value)` tries
 * the value's ordinary entry: the entry, or undefined (everything the attempt added rolled back); `refs(values)`
 * tries references to `values` the same way.
 */
export type Special = (
  value: object,
  ref: (value: unknown) => number,
  plain: (value: object) => TableEntry | undefined,
  refs: (values: readonly unknown[]) => number[] | undefined,
) => TableEntry | undefined;

const objectProto = Object.prototype,
  arrayProto = Array.prototype;
const SPECIAL_NUMBERS: Record<string, number> = { NaN: NaN, Infinity: Infinity, "-Infinity": -Infinity, "-0": -0 };

// The refusals name the fix: data only; a package class you cannot edit → `registerClass`.
const NOT_FN = "function is not serializable: pass data, create functions in the component that uses them";
const notSerializable = (value: unknown): string => {
  const name = typeName(value);
  // Built-ins (Promise, WeakMap, …: native constructors) keep the short message.
  if (!name.endsWith(" instance") || /\[native code\]\s*\}$/.test(Function.prototype.toString.call(Object.getPrototypeOf(value).constructor)))
    return name + " is not serializable";
  const cls = name.slice(0, -9);
  return name + " is not serializable (pass its data, or register the class: registerClass(" + cls + ", { id, serialize, revive }))";
};
/** Name a value's type for diagnostics without invoking author code. */
export function typeName(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  const proto = Object.getPrototypeOf(value);
  const ctor = proto && Object.getOwnPropertyDescriptor(proto, "constructor")?.value;
  return typeof ctor === "function" && ctor.name ? ctor.name + " instance" : "object";
}

// JSON-exact primitives may sit inline in object/array entries ({p}/{l}): no separate entries or refs.
const literal = (v: unknown): v is Literal =>
  v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v) && !Object.is(v, -0));
// `literal` inlined (once per row value of a page's data).
const plainArray = (array: readonly unknown[]): boolean => {
  for (let i = 0; i < array.length; i++) {
    if (!(i in array)) return false;
    const v = array[i];
    if (!(v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v) && !Object.is(v, -0)))) return false;
  }
  return true;
};
// How an object's values encode: 2 = all literals (`{p}`, inline), 1 = some number / boolean / null
// among other values (`{p}`: those inline, the rest — strings included, which stay interned — as
// `[ref]`), 0 = refs only (`{o}`).
const literalValues = (value: Record<string, unknown>, keys: readonly string[]): 0 | 1 | 2 => {
  let all = keys.length > 0,
    some = false;
  for (let i = 0; i < keys.length; i++) {
    const v = value[keys[i]!];
    if (v === null || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v) && !Object.is(v, -0))) some = true;
    else if (typeof v !== "string") all = false;
  }
  return all ? 2 : some ? 1 : 0;
};

/** Encoder options: `special(value, ref, …)` may return a finished entry for functions / objects; `opaque(object)` tells
 * (without side effects) that `special` would — such objects never sit inside a `j` entry; `json` (default true) allows `j`
 * entries. */
export interface EncoderOptions {
  special?: Special | undefined;
  opaque?: ((value: object) => boolean) | undefined;
  json?: boolean;
  /** Same-origin `URL` values serialize relative to this origin (path, search, hash); the decoder resolves them
   * against the browser's location, so prerendered data never bakes the build's origin in. */
  origin?: string | undefined;
}
type Journal = [Map<unknown, number>, unknown, number | undefined][];

// ---- `j` trees (module level: closures made per encoder would re-tier on every render, see libs/runtime/CLAUDE.md
// "Per-render closures") ----
/** An encoder's `j` tree registry: `objects` maps a tree's objects to -2 - slot; per slot the object, its parent (a `j`
 * entry index, or the parent's slot code) and its key. */
interface JsonTrees {
  objects: Map<object, number>;
  inner: object[];
  parents: number[];
  keys: (string | number)[];
  opaque: ((value: object) => boolean) | undefined;
}
// A plain JSON tree: JSON-exact literals, arrays without holes, plain objects without digit-leading keys (V8's fast
// JSON.stringify path) that are no object any other entry holds (or `opaque`), none reached twice. Registers its
// objects as `j` slots (the caller drops them on failure).
function arrayTree(t: JsonTrees, value: readonly unknown[], parent: number): boolean {
  for (let i = 0; i < value.length; i++) {
    if (!(i in value)) return false;
    const v = value[i];
    if (v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v) && !Object.is(v, -0))) continue;
    if (typeof v !== "object" || !childTree(t, v, parent, i)) return false;
  }
  return true;
}
function objectTree(t: JsonTrees, value: Record<string, unknown>, parent: number): boolean {
  // `Object.keys` (not `for…in`): for-in over the many object shapes of a page's state deopt-loops (Maglev, Node 26).
  const names = Object.keys(value);
  for (let i = 0; i < names.length; i++) {
    const key = names[i]!,
      c = key.charCodeAt(0);
    if (c >= 48 && c <= 57) return false;
    const v = value[key];
    if (v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v) && !Object.is(v, -0))) continue;
    if (typeof v !== "object" || !childTree(t, v, parent, key)) return false;
  }
  return true;
}
function childTree(t: JsonTrees, value: object, parent: number, key: string | number): boolean {
  if (t.objects.has(value)) return false;
  const proto = Object.getPrototypeOf(value),
    array = Array.isArray(value);
  if (array ? proto !== arrayProto : proto !== objectProto && proto !== null) return false;
  if (t.opaque?.(value)) return false;
  const slot = t.inner.push(value) - 1,
    code = -2 - slot;
  t.parents.push(parent);
  t.keys.push(key);
  t.objects.set(value, code);
  return array ? arrayTree(t, value as unknown[], code) : objectTree(t, value as Record<string, unknown>, code);
}

// A flat (sequential) copy of a string. V8's fast `JSON.stringify` path (Node 26) bails out on a sliced or cons string and
// re-serializes the whole call on the slow path: one sliced URL path in a 100-row page's table made its stringify
// 3.2x slower (7.8 -> 26 us). An own-key round trip internalizes it (~0.1 us); used for strings the encoder slices itself.
const flat = (s: string): string => Object.keys({ [s]: 0 })[0]!;

// The `b` kind of an ArrayBuffer / DataView / typed array whose prototype is the global constructor's own (no subclass,
// no SharedArrayBuffer); undefined otherwise.
function binaryKind(value: object, proto: unknown): string | undefined {
  if (!(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)) return undefined;
  const name = (proto as { constructor?: { name?: unknown } } | null)?.constructor?.name;
  return typeof name === "string" && BINARY.includes(name) && builtin(name)?.prototype === proto ? name : undefined;
}

/** Create an encoder. `special(value, ref)` may return a finished entry for functions/objects. */
export function createEncoder({ special, opaque, json: jsonOn = true, origin }: EncoderOptions = {}): {
  ref: (value: unknown) => number;
  table: TableEntry[];
} {
  const table: (TableEntry | null)[] = [],
    primitives = new Map<unknown, number>(),
    specials = new Map<string, number>(),
    objects = new Map<object, number>();
  const add = (entry: TableEntry | null): number => table.push(entry) - 1;
  // Undo log of a running `plain()` attempt: interned keys to forget (or restore) on failure.
  let journal: Journal | null = null;
  const keep = <K>(map: Map<K, number>, key: K, index: number): number => (
    journal?.push([map as Map<unknown, number>, key, (map as Map<unknown, number>).get(key)]),
    map.set(key, index),
    index
  );
  const undo = (entries: Journal): void => {
    for (let i = entries.length - 1; i >= 0; i--) {
      const [map, key, previous] = entries[i]!;
      if (previous === undefined) map.delete(key);
      else map.set(key, previous);
    }
  };
  // Objects inside `j` trees: `objects` maps them to -2 - slot; per slot the object, its parent (a `j` entry index, or
  // the parent's slot code) and its key. A later reference makes it an `i` entry (`place`).
  const inner: object[] = [],
    parents: number[] = [],
    keys: (string | number)[] = [];
  function ref(value: unknown): number {
    switch (typeof value) {
      case "string":
      case "boolean":
        break;
      case "number":
        if (Number.isNaN(value) || !Number.isFinite(value) || Object.is(value, -0)) {
          const key = Object.is(value, -0) ? "-0" : String(value);
          return intern("n:" + key, { n: key });
        }
        break;
      case "undefined":
        return intern("u", { u: 0 });
      case "bigint":
        return intern("g:" + value, { g: String(value) });
      case "symbol":
        throw new TypeError("symbol is not serializable");
      default:
        if (value === null) break;
        return object(value as object);
    }
    // SameValueZero keys keep strings, numbers, booleans and null apart; -0 is handled above.
    const index = primitives.get(value);
    return index ?? keep(primitives, value, add(value as Literal));
  }
  function intern(key: string, entry: EntryRecord): number {
    return specials.get(key) ?? keep(specials, key, add(entry));
  }
  function object(value: object): number {
    const known = objects.get(value);
    if (known !== undefined) return known >= 0 ? known : place(-2 - known);
    const index = keep(objects, value, add(null));
    const entry = special?.(value, ref, plain, attemptRefs);
    if (entry !== undefined) return ((table[index] = entry), index);
    return build(value, index);
  }
  // `special`'s `plain(value)`: one function per encoder (no closure per object); `value` is being encoded, so its index is
  // already interned.
  const plain = (value: object): TableEntry | undefined => attempt(value, objects.get(value)!);
  function attempt(value: object, index: number): TableEntry | undefined {
    const outer = journal,
      length = table.length,
      mine: Journal = (journal = []);
    try {
      build(value, index);
      outer?.push(...mine);
      return table[index]!;
    } catch {
      undo(mine);
      table.length = length;
      return undefined;
    } finally {
      journal = outer;
    }
  }
  function attemptRefs(values: readonly unknown[]): number[] | undefined {
    // Fast path: primitives (interning cannot fail) and objects already in the table need no undo log.
    let known = true;
    for (let i = 0; i < values.length && known; i++) {
      const value = values[i];
      known = value === null || (typeof value === "object" || typeof value === "function" ? objects.has(value) : typeof value !== "symbol");
    }
    if (known) {
      const refs: number[] = new Array(values.length);
      for (let i = 0; i < values.length; i++) refs[i] = ref(values[i]);
      return refs;
    }
    const outer = journal,
      length = table.length,
      mine: Journal = (journal = []);
    try {
      const refs = values.map(ref);
      outer?.push(...mine);
      return refs;
    } catch {
      undo(mine);
      table.length = length;
      return undefined;
    } finally {
      journal = outer;
    }
  }
  // A `j` tree's object referenced on its own: an `i` entry [parent, key] (parents first).
  function place(slot: number): number {
    const value = inner[slot]!,
      known = objects.get(value)!;
    if (known >= 0) return known;
    const parent = parents[slot]!;
    return keep(objects, value, add({ i: [parent >= 0 ? parent : place(-2 - parent), keys[slot]!] }));
  }
  // Whether `value` (an array / plain object, `special` passed on it) is a plain JSON tree (`jsonTree` below). On failure
  // (or a throw) none of its objects stay registered.
  const trees: JsonTrees = { objects, inner, parents, keys, opaque };
  function jsonTree(value: object, index: number): boolean {
    const from = inner.length;
    let ok = false;
    try {
      ok = Array.isArray(value) ? arrayTree(trees, value, index) : objectTree(trees, value as Record<string, unknown>, index);
    } finally {
      if (!ok) {
        for (let s = from; s < inner.length; s++) objects.delete(inner[s]!);
        inner.length = parents.length = keys.length = from;
      } else if (journal) for (let s = from; s < inner.length; s++) journal.push([objects as Map<unknown, number>, inner[s], undefined]);
    }
    return ok;
  }
  function build(value: object, index: number): number {
    if (typeof value === "function") throw new TypeError(DEV ? DEV.hint("function is not serializable", "function") : NOT_FN);
    const proto = Object.getPrototypeOf(value);
    const array = Array.isArray(value);
    // A non-empty plain tree: one `j` entry, serialized natively with the table (no entry per nested object).
    if (jsonOn && (array ? proto === arrayProto && value.length : proto === objectProto || proto === null) && jsonTree(value, index)) {
      if (array || !empty(value)) return ((table[index] = { j: value }), index);
    }
    if (array && proto === arrayProto) {
      if (value.length && plainArray(value)) table[index] = { l: value.slice() };
      else {
        const items: number[] = new Array(value.length);
        for (let i = 0; i < value.length; i++) items[i] = !(i in value) ? -1 : DEV ? DEV.at("[" + i + "]", () => ref(value[i])) : ref(value[i]);
        table[index] = items;
      }
    } else if (proto === objectProto || proto === null) {
      const keys = Object.keys(value);
      const kind = literalValues(value as Record<string, unknown>, keys);
      if (kind) {
        // Literals inline (no table entry of their own); with other values (kind 1) strings and the rest as `[ref]`.
        const pairs: (string | Literal | [number])[] = new Array(keys.length * 2);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i]!,
            v = (value as Record<string, unknown>)[key];
          pairs[2 * i] = key;
          pairs[2 * i + 1] = kind === 2 || (typeof v !== "string" && literal(v)) ? (v as Literal) : [DEV ? DEV.at(DEV.key(key), () => ref(v)) : ref(v)];
        }
        table[index] = { p: pairs };
      } else {
        const pairs: (string | number)[] = [];
        for (const key of keys)
          pairs.push(key, DEV ? DEV.at(DEV.key(key), () => ref((value as Record<string, unknown>)[key])) : ref((value as Record<string, unknown>)[key]));
        table[index] = { o: pairs };
      }
    } else if (value instanceof Date && proto === Date.prototype) table[index] = { d: value.getTime() };
    else if (typeof URL === "function" && value instanceof URL && proto === URL.prototype)
      table[index] = { h: origin && value.origin === origin ? flat(value.href.slice(origin.length)) : value.href };
    else if (value instanceof Map && proto === Map.prototype) {
      const pairs: number[] = [];
      if (DEV) {
        const dev = DEV;
        for (const [k, v] of value) {
          const label = typeof k === "string" ? JSON.stringify(k) : literal(k) ? String(k) : "…";
          pairs.push(
            dev.at(".keys()[" + label + "]", () => ref(k)),
            dev.at(".get(" + label + ")", () => ref(v)),
          );
        }
      } else for (const [k, v] of value) pairs.push(ref(k), ref(v));
      table[index] = { m: pairs };
    } else if (value instanceof Set && proto === Set.prototype) {
      const items: number[] = [];
      if (DEV) {
        const dev = DEV;
        let i = 0;
        for (const v of value) items.push(dev.at(".values()[" + i++ + "]", () => ref(v)));
      } else for (const v of value) items.push(ref(v));
      table[index] = { e: items };
    } else if (value instanceof RegExp && proto === RegExp.prototype)
      table[index] = { t: value.lastIndex ? [value.source, value.flags, value.lastIndex] : [value.source, value.flags] };
    else if (typeof URLSearchParams === "function" && value instanceof URLSearchParams && proto === URLSearchParams.prototype)
      table[index] = { U: value.toString() };
    else if (binaryKind(value, proto)) {
      // Typed arrays / DataView: the view's own bytes (a shared buffer's identity is not kept).
      const view =
        value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : new Uint8Array((value as ArrayBufferView).buffer, (value as ArrayBufferView).byteOffset, (value as ArrayBufferView).byteLength);
      let text = "";
      for (let i = 0; i < view.length; i += 0x8000) text += String.fromCharCode.apply(null, view.subarray(i, i + 0x8000) as unknown as number[]);
      table[index] = { b: [binaryKind(value, proto)!, btoa(text)] };
    } else if (value instanceof Error && ERRORS.includes(proto?.constructor?.name) && builtin(proto.constructor.name)?.prototype === proto) {
      // Errors: constructor, message and own data (enumerable keys, `cause`, AggregateError `errors`); no stack.
      const data: Record<string, unknown> = {};
      let some = false;
      for (const key of Object.keys(value)) (own(data, key, (value as unknown as Record<string, unknown>)[key]), (some = true));
      for (const key of ["cause", "errors"])
        if (Object.hasOwn(value, key) && !Object.hasOwn(data, key)) ((data[key] = (value as unknown as Record<string, unknown>)[key]), (some = true));
      const entry: (string | number)[] = [proto.constructor.name, value.message];
      if (some) entry.push(DEV ? DEV.at(".data", () => ref(data)) : ref(data));
      table[index] = { E: entry };
    } else throw new TypeError(notSerializable(value));
    return index;
  }
  // The encoder recurses per nesting level: data deep enough to overflow the stack (~1,400 levels in
  // Node) fails with an error saying so (DEV: with the path), not a bare RangeError (SEC10). Only the
  // outer call pays for the try; recursion calls `ref` directly.
  const encode = (value: unknown): number => {
    try {
      return ref(value);
    } catch (error) {
      if (!(error instanceof RangeError) || !/call stack/i.test(error.message) || error.message.startsWith(DEEP)) throw error;
      throw new RangeError(DEEP + " (" + error.message.slice(0, 400) + ")", { cause: error });
    }
  };
  return { ref: encode, table: table as TableEntry[] };
}
const empty = (value: object): boolean => {
  for (const _ in value) return false;
  return true;
};
const DEEP = "Resume data is nested too deeply to encode";

/** `registerClass` instances: `[serialize]()` returns the instance's data (when the registration has no `serialize` hook). */
export const serialize: unique symbol = Symbol.for("rivet.serialize") as never;
/** @internal A `registerClass` record. */
export interface ClassHooks {
  id: string;
  cls: object;
  serialize?(value: unknown): unknown;
  revive?(data: unknown): unknown;
}
/**
 * @internal The `registerClass` registry: a `Symbol.for("rivet.classes")` global, so the built-in decoders' chunk
 * (`resume-builtins.ts`) and `server-derived` read it without importing this module's chunk. `ids`: id → hooks; `of`: class → hooks
 * (a Map: registered classes live as long as their modules).
 */
export const _CLASSES = Symbol.for("rivet.classes");
export type ClassRegistry = { ids: Map<string, ClassHooks>; of: Map<object, ClassHooks> };
/**
 * Serialize / revive instances of a class you cannot edit (a package class whose state is private: bson `ObjectId`):
 * `id` names it on the wire (unique, no `#`), `revive(data)` rebuilds an instance from `serialize(value)`'s data (default:
 * the instance's own `[serialize]()`). Call it in a module both the server entry and the browser entry import — the
 * browser finds the reviver by `id` in its own registry. The same class registered again replaces its hooks; an `id`
 * taken by another class throws.
 */
export function registerClass<T>(cls: abstract new (...a: never[]) => T, hooks: { id: string; serialize?(value: T): unknown; revive(data: unknown): T }): void {
  const id = hooks.id,
    registry = ((globalThis as { [_CLASSES]?: ClassRegistry })[_CLASSES] ??= { ids: new Map(), of: new Map() });
  // A wire invariant (review T25 L1: dev + prod): a `cls` string without `#` is a registered id, with one a class symbol.
  if (typeof id !== "string" || !id || id.includes("#"))
    throw new TypeError("registerClass: `id` must be a non-empty string without `#` (got " + String(id) + ")");
  const had = registry.ids.get(id);
  if (had !== undefined && had.cls !== cls) throw new TypeError("registerClass: id `" + id + "` is already registered for another class");
  const record: ClassHooks = { id, cls, serialize: hooks.serialize as ClassHooks["serialize"], revive: hooks.revive };
  registry.ids.set(id, record);
  registry.of.set(cls, record);
}

/** The built-in entries' decoder (`resume-builtins.ts`): the entry, `get`, and `keep` (memoize before nested reads). */
export type BuiltinDecoder = (entry: EntryRecord, get: (index: number) => unknown, keep: <T>(value: T) => T) => unknown;
/**
 * @internal Where `@rivetjs/runtime/resume-builtins` installs its decoder when it loads (`globalThis[_BUILTINS]`). A
 * global, so that chunk imports nothing from this module's chunk (a shared import split the decoder into its own chunk:
 * one more request and +300 B on every page).
 */
export const _BUILTINS = Symbol.for("rivet.builtins");
/** @internal Whether a table holds built-in entries (`t` / `U` / `b` / `E`) whose decoders load on demand. */
export const _builtinKinds = (table: readonly unknown[]): boolean =>
  table.some((e) => e !== null && typeof e === "object" && ("t" in e || "U" in e || "b" in e || "E" in e || "cls" in e));
/**
 * @internal Decode wire data `{ t, r, x? }` (router data, form answers): `x` = the URL of the built-in decoders' chunk
 * (resume manifest `builtins`, set by the server when the table holds such entries), run first as a module script. Not
 * `import()`: Vite wraps every dynamic import in its preload helper, a static edge from every page's runtime chunk.
 */
export async function _decodeWire(text: string): Promise<unknown> {
  const { t, r, x } = JSON.parse(text) as { t: unknown[]; r: number; x?: string };
  // A failed load leaves the entries undecodable: the decoder throws.
  if (x)
    await new Promise((onload) => document.head.append(Object.assign(document.createElement("script"), { type: "module", src: x, onload, onerror: onload })));
  return createDecoder(t).get(r);
}

// Own data property. Plain assignment is equivalent (and much faster) for every key except
// "__proto__", the only inherited accessor on Object.prototype.
const own = (out: Record<string, unknown>, key: string, value: unknown): unknown =>
  key === "__proto__" ? Object.defineProperty(out, key, { value, writable: true, enumerable: true, configurable: true }) : (out[key] = value);
const BUSY = Symbol("busy");
/** Decode a parsed table lazily; malformed entries throw when read. */
export function createDecoder(table: readonly unknown[]): { get: (index: number) => unknown } {
  const memo: unknown[] = new Array(table.length);
  // `i` entries by parent ref (scanned on the first `j` / `i` decode, then as the table grows): a decoded `j` tree resolves
  // the objects other entries hold right away, as nested table entries decode with their parent.
  let scanned = 0,
    kids: Map<number, number[]> | undefined;
  const within = (index: number): void => {
    for (; scanned < table.length; scanned++) {
      const entry = table[scanned] as EntryRecord | null;
      if (entry !== null && typeof entry === "object" && "i" in entry) {
        const list = (kids ??= new Map()).get(entry.i![0]);
        if (list) list.push(scanned);
        else kids.set(entry.i![0], [scanned]);
      }
    }
    const list = kids?.get(index);
    if (list) for (const ref of list) get(ref);
  };
  // A failed decode rolls back its whole frame: the entry and every entry first decoded inside it, so nothing memoized keeps
  // the discarded, half-built objects (a container memoized before its children) — a retry rebuilds the whole subgraph.
  // `log[0 .. top)`: the entries decoded inside the running outermost `get` (`level` > 0), pushed on success; `top` is a
  // stack pointer (shrinking the array would free its storage on every outermost get). Nothing is logged for an
  // outermost entry.
  let level = 0,
    top = 0;
  const log: number[] = [];
  function get(index: number): unknown {
    // A table index: an integer in range (`>>> 0` rejects strings like "constructor", fractions, negatives).
    if (index >>> 0 !== index || index >= table.length) throw new RangeError("Invalid resume reference " + index);
    if (index in memo) {
      if (memo[index] === BUSY) throw new TypeError("Cyclic reference through a revived instance");
      return memo[index];
    }
    const mark = top;
    level++;
    try {
      const value = decode(index);
      if (--level) log[top++] = index;
      else top = 0;
      return value;
    } catch (error) {
      throw undo(index, mark, error);
    }
  }
  // Out of line (the rare path), so `get` stays small.
  function undo(index: number, mark: number, error: unknown): unknown {
    level--;
    while (top > mark) delete memo[log[--top]!];
    delete memo[index];
    return error;
  }
  function decode(index: number): unknown {
    const entry = table[index] as TableEntry;
    if (entry === null || typeof entry !== "object") return (memo[index] = entry);
    if ("j" in entry) return ((memo[index] = entry.j), within(index), entry.j);
    if ("i" in entry) {
      const [at, key] = entry.i!,
        parent = get(at) as Record<string | number, unknown>;
      // Decoding the parent resolved this entry already (its `j` root's `within`).
      if (index in memo) return memo[index];
      if (parent === null || typeof parent !== "object" || !Object.hasOwn(parent, key)) throw new TypeError("Invalid resume table entry");
      memo[index] = parent[key];
      within(index);
      return memo[index];
    }
    if (Array.isArray(entry)) {
      const array: unknown[] = (memo[index] = new Array(entry.length));
      for (let i = 0; i < entry.length; i++) if (entry[i] !== -1) array[i] = get(entry[i]!);
      return array;
    }
    if ("o" in entry) {
      const out: Record<string, unknown> = (memo[index] = {}),
        pairs = entry.o!;
      for (let i = 0; i < pairs.length; i += 2) own(out, pairs[i] as string, get(pairs[i + 1] as number));
      return out;
    }
    if ("p" in entry) {
      const out: Record<string, unknown> = (memo[index] = {}),
        pairs = entry.p!;
      for (let i = 0; i < pairs.length; i += 2) {
        const v = pairs[i + 1];
        own(out, pairs[i] as string, Array.isArray(v) ? get(v[0]) : v);
      }
      return out;
    }
    if ("l" in entry) return (memo[index] = entry.l!.slice());
    if ("u" in entry) return (memo[index] = undefined);
    if ("n" in entry) return (memo[index] = SPECIAL_NUMBERS[entry.n!]);
    if ("g" in entry) return (memo[index] = BigInt(entry.g!));
    if ("d" in entry) return (memo[index] = new Date(entry.d!));
    if ("h" in entry) return (memo[index] = new URL(entry.h!, globalThis.location?.href));
    if ("m" in entry) {
      const map: Map<unknown, unknown> = (memo[index] = new Map());
      for (let i = 0; i < entry.m!.length; i += 2) map.set(get(entry.m![i]!), get(entry.m![i + 1]!));
      return map;
    }
    if ("e" in entry) {
      const set: Set<unknown> = (memo[index] = new Set());
      for (const item of entry.e!) set.add(get(item));
      return set;
    }
    // Built-in entries outside the core decoder (`resume-builtins.ts`, loaded on demand).
    const builtins = (globalThis as { [_BUILTINS]?: BuiltinDecoder })[_BUILTINS];
    // A revived instance is BUSY while its data decodes: a cycle back to it throws (its reviver needs the data first).
    if (entry.rv) memo[index] = BUSY;
    if (builtins) return builtins(entry, get, (value) => (memo[index] = value));
    throw new TypeError(
      DEV && /^([tUbE]|cls)$/.test(Object.keys(entry)[0]!)
        ? DEV.hint("Resume table entry `" + Object.keys(entry)[0] + "` needs @rivetjs/runtime/resume-builtins (not loaded)", "manifest")
        : "Unknown resume table entry",
    );
  }
  return { get };
}

/** Make JSON safe inside a script element. */
// `indexOf` / `replaceAll` with a one-character string pattern are memchr scans: a 10 KB state with no `<` 2.5 -> 0.2 us,
// with one 2.8 -> 0.7 us (the regex replace is only for the rare U+2028 / U+2029; a one-byte string has neither).
export function escapeJSON(json: string): string {
  if (json.indexOf("<") >= 0) json = json.replaceAll("<", "\\u003c");
  return json.indexOf("\u2028") < 0 && json.indexOf("\u2029") < 0
    ? json
    : json.replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

// ---------------------------------------------------------------------------------------------------------------------
// Derived model (M2 lane A, `server-derived.ts`; plan docs/design/plans/2026-10-18-derived-client.md): the values-only
// tail `<script type="rivet/boundaries">` (and `data-patch="<marker>"` scripts after streamed segments).

/**
 * One boundary as the server's flush holds it (encoded by `server-tail.ts` into a `BoundaryTail` entry): `[id, parent id
 * (0 = page root), flags, component name, keyed values, props?]`. `flags`: 1 independent (props are values: `props`
 * present), 2 the element root carries `data-b` (else `<!--b<id>-->` … `<!--/b-->` around its output), 4 a keyed value was
 * not JSON data (left out: render, do not adopt), 8 independence demoted at render (props held a non-data value), 16 no
 * output (`_rBOut` never ran). Keyed values: a flat `[key, value, key, value, …]` list in creation order (key = module
 * prefix + site ordinal from the compiler, `#n` suffix for a repeated site); a `LIT` key still holding its literal init is
 * left out (the browser's own init).
 */
export type BoundaryRecord = [id: number, parent: number, flags: number, name: string, signals: unknown[], props?: object];

/** What one server flush produced (records by name, chunk per name `m`, listened types per name `e`, read-back props per
 * name `r`), before encoding. */
export interface FlushTail extends Omit<BoundaryTail, "v" | "n" | "u" | "b" | "l"> {
  b: BoundaryRecord[];
  m?: Record<string, string>;
  e?: Record<string, string>;
  r?: Record<string, string>;
  /** RT-DIET2 mixed lite: name → lite entry URL of the live records (wire: `l`, by name / URL index). */
  l?: Record<string, string>;
}

/**
 * Tail names table entry: boundary name, its chunk (index into `u`, -1: none), the event types its instances listen to
 * (D5 / ZERO R2, ruling R-30: space separated, `*` = any, the union over the name's instances; absent = listens to
 * nothing). An event adopts — and the loader holds / warms for — only the records around its target whose name listens
 * to its type (and what those need). While no entry lists types every record listens (a server without D5 facts); a
 * record the loader cannot find (streamed later) listens to everything. `read` (ZERO REGRESS; types `""` when it listens
 * to nothing): its props a record leaves out are read back from its markup, `"key=path …"` (path from the record's
 * `data-b` element: `f` firstChild, `n` nextSibling; the value = that element's `textContent`).
 */
export type TailName = [name: string, url: number, types?: string, read?: string];
/** A record on the wire: `BoundaryRecord` with the name as an index into `n`, keyed values left out when empty (no props). */
export type TailRecord = [id: number, parent: number, flags: number, name: number, signals?: unknown[], props?: object];
/**
 * A run of stateless records (no keyed value, no props) with consecutive ids: `count` repetitions of `tmpl` (period
 * `tmpl.length`, 1–4). Record `id + j` is `tmpl[j % period]`: `[parent, flags, name]`, parent `>= 0` absolute, `< 0`
 * relative to the record's own id (calendar cells: each cdk cell under its ui cell).
 */
export type TailRun = [id: number, zero: 0, zero2: 0, run: -1, count: number, tmpl: [parent: number, flags: number, name: number][]];
export type TailEntry = TailRecord | TailRun;

/**
 * The boundaries tail, wire format v2 (ZERO S2, 2026-10-25): names once (`n`), chunk URLs once (`u`), records by name index
 * with runs of stateless siblings — O(distinct record shapes), not O(instances). Entries ascend by (first) id. Plus the
 * wake lists (`"<id>.<key>"` → reader boundary ids; a patch re-sends a list whole when it grew).
 */
export interface BoundaryTail {
  v: 2;
  n: TailName[];
  /** Chunk URLs of `n` (entries without `/` are `data-ab` + entry + `.js`, resolved by the loader). */
  u?: string[];
  b: TailEntry[];
  w?: Record<string, number[]>;
  /** Framework islands the adopt runs hydrate (their keys). */
  i?: string[];
  /** Derived client: boundary id → the `keydown` keys its handlers hold while cold (space separated). */
  k?: Record<string, string>;
  /**
   * Derived client: document click listeners (`_rListen`, the router's link clicks): `[boundary id, selector]` — a click
   * outside every boundary whose target is inside a `selector` match is held for that boundary (loader: `data-g`).
   */
  g?: [id: number, match: string][];
  /**
   * Derived client (DERIVED-C2): the `Async` boundaries with a fallback whose load was pending (`<!--a<id>-->…<!--/a-->` on
   * the page): `[id, boundary, k]` while its content streams, `[id, boundary, k, 1, value]` settled with JSON data `value`,
   * `[id, boundary, k, 2, { t, r }]` settled with a value that is not JSON data, as its resume table (decoded by the table
   * decoder `_useTableDecoder` installs: the router's derived `Root` does; without one the browser renders it),
   * `[id, boundary, k, 0]` settled without one (failed, not encodable, the stream ended first: the browser renders it).
   * `boundary` = the record whose unit constructs it (0: none), `k` = its place among that unit's `Async`s with a fallback.
   * A patch re-sends an entry whole when it settles.
   */
  a?: DerivedAsync[];
  /**
   * Derived client (DERIVED-C4): per boundary whose numbered plain signals a wake key names (`"<id>.$<n>"`), how many its
   * unit made on the server — the browser's adopt run counts its own and wakes those keys' readers when it differs.
   */
  c?: Record<string, number>;
  /**
   * DOM data on derived (DERIVED-C5, resume builds unless `resume: { domData: false }`): list item arrays of a
   * record's props that the page shows, left out of the props (`0` at `path`) and rebuilt by the browser from the rows
   * after the list's anchor (`<!--r0<n>[-->`). `DerivedDom`.
   */
  d?: DerivedDom[];
  /**
   * RT-DIET2 mixed lite (`data-rt` = the lite runtime on a page whose other records only the full runtime adopts): name
   * index → URL index of the lite entry (`<Name>$a`) of each live record's name; `n` / `u` stay the ordinary chunks the
   * full runtime reads.
   */
  l?: Record<number, number>;
  /** RT-DIET2 mixed lite: the full runtime's URL first, then its fetch-ahead list (space separated; the lite runtime
   * preloads it and imports the first on a link intent or a fallback). */
  F?: string;
  /**
   * ROUTER-PRIME: the root record whose `ready` hook loads only modules on the page's fetch-ahead list (server: manifest
   * `ready`, the router's `Root` and the route's page chunk): the loader's prime runs that hook too, not only its chunk.
   */
  p?: number;
}
/**
 * One `BoundaryTail.d` entry: the record whose props hold the array, the list anchor number, the array's key path in the
 * props, its length, the item skeleton (leaves: 0 = the row's next literal, k ≥ 1 = the text at `paths[k - 1]` below the row
 * root, `#…` = a number), the literals of every row in turn, and rows kept whole (row index → item).
 */
export type DerivedDom = [
  record: number,
  anchor: number,
  path: (string | number)[],
  count: number,
  skeleton: unknown,
  paths: string[],
  literals: unknown[],
  whole?: Record<number, unknown>,
];
/** One `BoundaryTail.a` entry. */
export type DerivedAsync = [id: number, boundary: number, k: number, settled?: 0 | 1 | 2, value?: unknown];

// ---- Tail v2 decoder: `resume-tail.ts` (no dependency, so the lite runtime imports it alone); re-exported here. ----
export { eachRecord, recAt, nameOf, urlOf } from "./resume-tail.ts";
/**
 * The flush shape of a v2 tail (records by name with keyed value lists, `m` name → chunk URL, `e` name → listened types,
 * the other fields as they are): tests, tools and DevTools. The runtime reads the wire format in place (`eachRecord`).
 */
export function expandTail(t: BoundaryTail): FlushTail {
  const { v: _v, n, u: _u, b: _b, l, ...rest } = t;
  const out: FlushTail = { b: [], ...rest };
  if (l) {
    out.l = {};
    for (const i in l) out.l[n[+i]![0]] = t.u![l[+i]!]!;
  }
  eachRecord(t, (id, parent, flags, name, signals, props) => {
    const r: BoundaryRecord = [id, parent, flags, n[name]![0], signals.length ? signals : []];
    if (props !== undefined) r.push(props);
    out.b.push(r);
  });
  n.forEach((entry, i) => {
    const url = urlOf(t, i);
    if (url !== undefined) (out.m ??= {})[entry[0]] = url;
    if (entry[2]) (out.e ??= {})[entry[0]] = entry[2];
    if (entry[3]) (out.r ??= {})[entry[0]] = entry[3];
  });
  return out;
}
