// Resume object table. Every value is interned into one flat table and referenced by index, so
// sharing and cycles survive and the client decodes lazily, one reference at a time.
// Wire-only compaction (the server table stays full): compact recipes (`full`), `{y}` repeats (`repeated`), `{w}` object
// shapes; `{R}` relocations (`Relocation`) and, in the state's `e` / `b`, repeated handler maps / bindings
// (`RepeatedHandlers` / `RepeatedBinding`) are rewritten by the inline repeat add-on before anything reads them.
import type { Context, Signal } from "@rivetjs/reactivity";
import { DEV } from "#dev";
import { BINARY, ERRORS, builtin } from "./resume-kinds.ts";
import { DOM_DATA } from "./dom-data.ts";

// Identified context tokens a resumed page may re-provide around a re-created region (opt in per
// token: only modules that call `resumableContext` pay for the registry).
const tokens = new Map<string, Context<unknown>>();
const placeholders = new Set<string>();
// The registered token objects (the encoder asks without reading a property of arbitrary values: no getter runs).
const registered = new WeakSet<object>();
/**
 * Register an identified context token (`createContext(value, { id })`) so a region rendered inside
 * one of its providers is re-created inside the same provision on a resumed page. Returns the token
 * to use: when a re-creation already provided this id before the module loaded, that placeholder
 * token (now carrying this default) — so content loaded later still reads the provision.
 */
export function resumableContext<T>(token: Context<T>): Context<T> {
  if (token.id === undefined) throw new TypeError("resumableContext: the token needs an id (createContext(value, { id }))");
  const existing = tokens.get(token.id);
  if (existing) {
    if (placeholders.delete(token.id)) (existing as { defaultValue: unknown }).defaultValue = token.defaultValue;
    return existing as Context<T>;
  }
  tokens.set(token.id, token as Context<unknown>);
  registered.add(token);
  return token;
}
/**
 * Run `fn` with resume recording suspended: nothing it renders registers ids, bindings, handlers or
 * region entries (output a pass only inspects and discards — cdk's collection build pass). In the
 * browser, or outside a resumable render, it is `fn()`. `server-resume` installs the real
 * implementation on import (`_setUnrecorded`), so this entry stays trivial where no recorder exists.
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
/** @internal `server-resume` hook. */
export function _setUnrecorded(run: <T>(fn: () => T) => T): void {
  unrecorded = run;
}
/** Resume ABI: a registered token by id, or (client re-creation) a placeholder the real registration adopts. */
export const _contextById = (id: string): Context<unknown> | undefined => tokens.get(id);
/** Resume ABI (server encoder): whether `value` is a registered token (`resumableContext`). */
export const _isContextToken = (value: object): boolean => typeof value === "object" && Object.isFrozen(value) && registered.has(value);
export const _placeholderContext = (id: string): Context<unknown> => {
  let token = tokens.get(id);
  if (!token) {
    tokens.set(id, (token = { defaultValue: undefined, id }));
    placeholders.add(id);
  }
  return token;
};

/** A JSON-exact primitive stored inline in `{l}` / `{p}` entries; in `{p}` a one-element array `[ref]` is a reference. */
export type Literal = string | number | boolean | null;
/**
 * One table entry. Primitives are stored as themselves, arrays as element refs (-1: hole); records:
 * `l` literal array, `p` object pairs of literals and `[ref]` references (some value literal), `o` object [key, ref] pairs (no literal value), `u` undefined, `n` special
 * number, `g` bigint, `d` date, `h` URL, `t` RegExp, `U` URLSearchParams, `b` binary, `E` error, `m` map ref pairs, `e` set refs, `s` signal (value ref, `q` comparator),
 * `x` context id, `r` element ref id (`z` its region id when inside one), `k` custom kind with `a`
 * argument refs (`ctx`: a registered context token held as a value, `a[0]` its id; `cell`: a `let` cell `{ v }` of `a[0]`, Function Bridge T7; `store`: a narrowed store `[root signal, nodes, kept paths (dev)]` → `{ ...nodes, v }`, its signals holding only the read / named paths, T12), `c`/`f` computed/function symbol with `a` capture refs (`q` comparator), `cls` data class instance (class symbol, `a[0]` its own fields object; T23).
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
  s?: number;
  q?: false | number;
  x?: string;
  r?: number;
  /** Region of the `r` element (omitted at the page root). */
  z?: number;
  /** Custom kind; wire compact form `[kind, ...argument refs]` (no `a`, see `full`). */
  k?: string | (string | number)[];
  a?: number[];
  /**
   * Plain JSON value (an object / array tree of JSON-exact literals with no object reachable twice): decoded as
   * the parsed value itself. Objects inside it that other entries reference are `i` entries.
   */
  j?: object;
  /** An object inside a `j` tree: [parent ref (a `j` or `i` entry), own key]; resolved when its `j` root decodes. */
  i?: [parent: number, key: string | number];
  /**
   * DOM-backed plain JSON tree (DOM-DATA, `DomTree`; builds with `resume.domData`): a `j` tree whose strings the page
   * renders as the whole text of an element are read back from the DOM on first decode. Its parsed `i` children resolve
   * as a `j` tree's. Only `dom-resume`'s `dom` hook decodes it (`DOM_DATA`).
   */
  D?: DomTree;
  /** Wire form only (DOM-DATA): a run of `D` entries (server-resume `domRuns`), expanded by the runtime before decoding. */
  Dr?: DomTree;
  /** Computed / function symbol: its id in the server's table, its page symbol index (`ResumeRecords.s`) on the wire. */
  c?: SymbolRef | number[];
  f?: SymbolRef | number[];
  /**
   * Data class instance (Function Bridge T23): its class symbol (`<module>#<Class>$class`, the page symbol index on the
   * wire; its factory returns the class: `fn` hook, no captures), `a: [own fields object ref]`. Decoded by
   * `resume-builtins.ts` (loaded on demand: pages without classes ship none of it), two-phase: `Object.create(Cls.prototype)`
   * is memoized first, then the fields are defined (inside a BUSY entry: once the outermost one is done, `later`), so
   * cycles through it decode; the constructor never runs.
   */
  cls?: SymbolRef;
  /**
   * Resource holder (Function Bridge T25): a `cls` entry rebuilt by its class's own reviver from `a: [serialize() data ref]`,
   * on first decode (lazy) — `static [revive](data)` when `cls` is the class symbol (page symbol index on the wire), the
   * `registerClass` hooks' `revive` when `cls` is a string: the registered id (no `#`, never a symbol: kept out of the page
   * symbols and needs). Decoded by `resume-builtins.ts` once the data (and every instance in it) is complete.
   */
  rv?: 1;
  /**
   * `c` entry: its last capture (`a`) is the list of identified providers that enclosed its creation on the server,
   * `[token id, value, …]` outermost first — the browser creates the computed under them (context reads while it evaluates).
   */
  v?: 1;
  /**
   * Wire form only (state / patch `t`): the `c` / `f` / `k` entry at index `y` again, its references past `y`
   * (`a`, numeric `q`) moved by the distance — repeated component instances capture their own values right
   * after their recipe (`repeated`).
   */
  y?: number;
  /**
   * Wire form only: an `o` / `p` entry holding values only, its keys (in order) those of the full `o` / `p` entry at
   * index `w` — objects of one shape spell their keys once per segment.
   */
  w?: number;
  /**
   * Wire form only (state / patch `t`, written when the page ships the repeat add-on `resume-repeat.ts`, server `rr`):
   * `[back, floor offset, delta, …]` = the entry at index `index - back` again (same segment; any wire form of a recipe
   * `c` / `f` / `k` — compact, `y`, `R` — or of an `o` / `{w, o}` object), its references relocated (`Relocation` with
   * floors `index + offset`: the recipe's captures and numeric `q`, the object's value refs); symbol / kind, flags and keys
   * copied. Collections (a table's rows and cells) record each row's recipes and props objects again with the row's own
   * values: a row repeats the previous row with constant offsets. The add-on rewrites these in place into the base's wire
   * form before the decoder runs (the decoder never reads `R`).
   */
  R?: number[];
}
export type TableEntry = Literal | number[] | EntryRecord;
/**
 * DOM-backed tree (`EntryRecord.D`, DOM-DATA): `[shape, anchor | null, ...stream]`. `shape` refs a `j` entry
 * `[skeleton, paths, subs]`: the tree with every leaf replaced by 0 (the next stream literal, depth-first in key / index
 * order), k ≥ 1 (the `textContent` of the element at `paths[k - 1]` = `tag:i.j` below the anchor element, by element child
 * index, its tag checked; `tag:i.j@name`: its attribute `name`; a leading `#`: the number it spells) or k < 0 (a rows node:
 * an array of trees of skeleton `subs[-1 - k]`, stream `first anchor, stride, count, n, n × (row, leaf k, value)`, then
 * each row's literals; row r sits below anchor `first + r * stride`; an exception: leaf k of row r is the value, not the
 * DOM's). Anchor: ≥ 0 the element of a `data-r` / path id (`w`), < 0 the root of row region `-1 - anchor` (the element
 * before its end marker); null: the tree's own leaves are all literals (only its rows nodes read the DOM).
 */
export type DomTree = (number | Literal)[];
/** DOM-DATA: what the encoder needs of a render's DOM registry (server-dom-data.ts `DomRegistry`): `items` (row items
 * with registered values) and `tree`, the `D` form of a plain JSON tree (undefined: stays `j`). `shapeRef(key, shape)`
 * interns a shape entry; `last` is the encoder's memo of the previous single tree's shape. */
export interface DomTexts {
  items: Map<object, number>;
  tree(value: object, shapeRef: (key: string, shape: unknown[]) => number, last: DomLast): DomTree | undefined;
}
/** The last single tree's shape (`DomTexts.tree`): list rows encoded one entry each share it, so the next one only compares. */
export interface DomLast {
  skeleton: unknown;
  paths: string[];
  ref: number;
}
/** Equality options a decoded signal/computed receives; `arm` enables a signal's comparator. */
export interface DecodedEquals {
  equals: false | ((a: unknown, b: unknown) => boolean);
  arm?: () => boolean;
}
/** Decoder hooks, each required only by the entry kinds that use it. */
export interface DecoderHooks {
  signal?: (index: number, options: DecodedEquals | undefined) => Signal<unknown>;
  custom?: (kind: string, args: unknown[]) => unknown;
  /** `scoped` (entry `v`): the last capture is the provider list `[token id, value, …]` to create it under. */
  computed?: (symbol: SymbolRef, captures: unknown[], options: DecodedEquals | undefined, scoped?: 1) => unknown;
  fn?: (symbol: SymbolRef, captures: unknown[], options: DecodedEquals | undefined) => unknown;
  context?: (id: string) => unknown;
  ref?: (id: number, region?: number) => unknown;
  /** DOM-backed tree (`D`, DOM-DATA builds): the decoded value; `get` decodes its shape. */
  dom?: (tree: DomTree, get: (index: number) => unknown) => unknown;
  /** After a failed cell's accessor decoded its value outside any decode (dom-resume arms the signals that decode made). */
  settle?: () => void;
}
/**
 * `special(value, ref, plain, refs)` may return a finished entry for a function or object. `plain(value)` tries
 * the value's ordinary entry: the entry, or undefined (everything the attempt added rolled back); `refs(values)`
 * tries references to `values` the same way (live props recipes: captures, else the props by value).
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

/** Name a value's type for diagnostics without invoking author code. */
// Function Bridge T26: the refusals name the fixes. A function inside a library object → `reconstruct`; a class instance →
// `reconstruct(() => new X(…))` (or `static [revive]`) for your own class, `registerClass` for one you cannot edit (T25).
const NOT_FN = "function is not serializable: build it inside the component, or a library object with reconstruct(() => …)";
const notSerializable = (value: unknown): string => {
  const name = typeName(value);
  // Built-ins (Promise, WeakMap, …: native constructors) keep the short message.
  if (!name.endsWith(" instance") || /\[native code\]\s*\}$/.test(Function.prototype.toString.call(Object.getPrototypeOf(value).constructor)))
    return name + " is not serializable";
  const cls = name.slice(0, -9);
  return (
    name +
    " is not serializable (your class: build it with reconstruct(() => new " +
    cls +
    "(…)) or give it a static [revive]; a package class: registerClass(" +
    cls +
    ", { id, serialize, revive }))"
  );
};
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
 * entries (switch per call with the returned `json(on)`: a streamed render allows them only in its last segment). */
export interface EncoderOptions {
  special?: Special | undefined;
  /** DOM-DATA: the render's DOM registry — `j` trees holding its values encode as `D` entries (`DomTexts.tree`). */
  dom?: DomTexts | undefined;
  opaque?: ((value: object) => boolean) | undefined;
  json?: boolean;
  /** Same-origin `URL` values serialize relative to this origin (path, search, hash); the decoder resolves them
   * against the browser's location, so prerendered state never bakes the build's origin in. */
  origin?: string | undefined;
  /**
   * @internal Shell cache H-holes (`server-shell.ts`, PPR-T6): the state to start from (a sealed encoder's numbering:
   * its table copied, its interned values behind read-through maps), so a hit's references equal the fill's.
   */
  base?: (() => EncoderState) | undefined;
}
/** @internal An encoder's numbering: table entries and interned primitives / specials / objects. */
export interface EncoderState {
  table: (TableEntry | null)[];
  primitives: Map<unknown, number>;
  specials: Map<string, number>;
  objects: Map<object, number>;
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
export function createEncoder({ special, opaque, json: jsonOn = true, origin, dom, base }: EncoderOptions = {}): {
  ref: (value: unknown) => number;
  table: TableEntry[];
  json: (on: boolean) => void;
  /** @internal The live numbering (shell cache fills copy it, `server-shell.ts`). */
  state: () => EncoderState;
} {
  const start = base?.(),
    table: (TableEntry | null)[] = start ? start.table : [],
    primitives = start ? start.primitives : new Map<unknown, number>(),
    specials = start ? start.specials : new Map<string, number>(),
    objects = start ? start.objects : new Map<object, number>();
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
  // DOM-DATA: one `j` shape entry per distinct shape (`DomTexts.tree`).
  const shapeRef = (key: string, shape: unknown[]): number => intern("D" + key, { j: shape }),
    domLast: DomLast = { skeleton: undefined, paths: [], ref: -1 };
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
      if (dom !== undefined && dom.items.size !== 0) {
        const tree = dom.tree(value, shapeRef, domLast);
        if (tree !== undefined) return ((table[index] = { D: tree }), index);
      }
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
  return { ref: encode, table: table as TableEntry[], json: (on) => void (jsonOn = on), state: () => ({ table, primitives, specials, objects }) };
}
const empty = (value: object): boolean => {
  for (const _ in value) return false;
  return true;
};
const DEEP = "Resume data is nested too deeply to encode";

const BUSY = Symbol("busy");

/** Resource holders (Function Bridge T25): `[serialize]()` returns the instance's data, `static [revive](data)` rebuilds it in the browser. */
export const serialize: unique symbol = Symbol.for("rivet.serialize") as never;
/** Resource holders (Function Bridge T25): `static [revive](data)` returns a new instance from its `[serialize]()` data. */
export const revive: unique symbol = Symbol.for("rivet.revive") as never;
/** @internal A `registerClass` record. */
export interface ClassHooks {
  id: string;
  cls: object;
  serialize?(value: unknown): unknown;
  revive?(data: unknown): unknown;
}
/**
 * @internal The `registerClass` registry: a `Symbol.for("rivet.classes")` global, so the built-in decoders' chunk
 * (`resume-builtins.ts`) and server-resume read it without importing this module's chunk. `ids`: id → hooks; `of`: class → hooks
 * (a Map: registered classes live as long as their modules).
 */
export const _CLASSES = Symbol.for("rivet.classes");
export type ClassRegistry = { ids: Map<string, ClassHooks>; of: Map<object, ClassHooks> };
/**
 * Serialize / revive instances of a class you cannot edit (a package class whose state is private: bson `ObjectId`):
 * `id` names it on the wire (unique, no `#`), `revive(data)` rebuilds an instance from `serialize(value)`'s data (default:
 * the instance's own `[serialize]()`). Call it in a module both the server entry and the browser (resume) entry import —
 * the browser finds the reviver by `id` in its own registry. The same class registered again replaces its hooks; an `id`
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
export type BuiltinDecoder = (
  entry: EntryRecord,
  get: (index: number) => unknown,
  keep: <T>(value: T) => T,
  /** Run `fill` now, or — inside a BUSY entry — once the outermost one is done (two-phase entries: `cls`, T23). Call after `keep`. */
  later: (fill: () => void) => void,
  need: <K extends keyof DecoderHooks>(kind: K) => NonNullable<DecoderHooks[K]>,
) => unknown;
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

/** Decode references lazily. Hooks: signal(index), custom(kind, args), computed(sym, captures), fn(sym, captures), context(id), ref(id). */
// Own data property. Plain assignment is equivalent (and much faster) for every key except
// "__proto__", the only inherited accessor on Object.prototype.
const own = (out: Record<string, unknown>, key: string, value: unknown): unknown =>
  key === "__proto__" ? Object.defineProperty(out, key, { value, writable: true, enumerable: true, configurable: true }) : (out[key] = value);
/** Decode a parsed table lazily; malformed entries throw when read. */
export function createDecoder(table: readonly unknown[], hooks: DecoderHooks = {}): { get: (index: number) => unknown; decoded: (index: number) => boolean } {
  const memo: unknown[] = new Array(table.length);
  const need = <K extends keyof DecoderHooks>(kind: K): NonNullable<DecoderHooks[K]> => {
    if (typeof hooks[kind] !== "function") throw new TypeError("Resume table entry requires a " + kind + " hook");
    return hooks[kind]!;
  };
  // `q`: a signal's / computed's comparator — false (always notify) or a reference to its symbol,
  // resolved on first comparison (its chunk ships with whatever can write or re-run it).
  // A signal's comparator is armed after the decoder's initial write (never compared to undefined).
  const equality = (q: false | number | undefined, armed = true): DecodedEquals | undefined => {
    if (q === undefined) return undefined;
    if (q === false) return { equals: false };
    let fn: ((a: unknown, b: unknown) => boolean) | undefined;
    return { equals: (a, b) => armed && (fn ??= get(q) as (a: unknown, b: unknown) => boolean)(a, b), arm: () => (armed = true) };
  };
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
  // A function / computed / custom entry: BUSY while its arguments decode (a cycle back to it throws). `let` cells and two-phase
  // built-ins (class instances `cls`, T23: `BuiltinDecoder` `later`) reached meanwhile (`depth` > 0) are queued and get their value / fields once the outermost such
  // entry finishes (`drain`), so every cycle through a cell or an instance decodes. A cell whose value fails to decode (a chunk that does not load, an element that never streams)
  // becomes an accessor: reading `v` retries the decode and throws its error until it succeeds, a write replaces it — the
  // failure stays with the cell's readers, every other `get` keeps working.
  let depth = 0,
    draining = false,
    cells: [holder: unknown, at: number, index: number, fill?: () => void][] | undefined;
  const fill = (cell: { v: unknown }, at: number): void => {
    const own = (value: unknown) => void Object.defineProperty(cell, "v", { value, writable: true, enumerable: true, configurable: true });
    try {
      cell.v = get(at);
    } catch {
      Object.defineProperty(cell, "v", { get: () => (own(get(at)), level || hooks.settle?.(), cell.v), set: own, enumerable: true, configurable: true });
    }
  };
  const drain = (): void => {
    if (draining || depth || !cells?.length) return;
    draining = true;
    try {
      // A cell / two-phase built-in rolled back meanwhile (a failing entry decoded by an earlier fill) is skipped: nobody
      // holds it. A built-in fill that throws (a class instance's fields, T23) leaves through the outermost BUSY entry, whose
      // frame (every entry still queued here included: skipped by a later drain) rolls back.
      while (cells.length) {
        const [holder, at, index, run] = cells.shift()!;
        if (memo[index] === holder) run ? run() : fill(holder as { v: unknown }, at);
      }
    } finally {
      draining = false;
    }
  };
  const busy = (index: number, entry: EntryRecord): unknown => {
    const queued = cells ? cells.length : 0;
    memo[index] = BUSY;
    depth++;
    try {
      const custom = "k" in entry,
        hook = need(custom ? "custom" : "c" in entry ? "computed" : "fn") as (...args: unknown[]) => unknown,
        a = entry.a!.map(get);
      memo[index] = custom ? hook(entry.k, a) : hook(entry.c ?? entry.f, a, equality(entry.q), entry.v);
    } catch (error) {
      delete memo[index];
      // Cells queued inside the failed entry belong to its rolled-back frame (`get`): never filled.
      if (cells) cells.length = queued;
      throw error;
    } finally {
      depth--;
      drain();
    }
    return memo[index];
  };
  // A failed decode rolls back its whole frame: the entry and every entry first decoded inside it, so nothing memoized keeps
  // the discarded, half-built objects (a container memoized before its children, a signal before its value, a function or
  // cell capturing them through a cycle) — a retry rebuilds the whole subgraph. `log[0 .. top)`: the entries decoded inside
  // the running outermost `get` (`level` > 0), pushed on success; `top` is a stack pointer (shrinking the array would free
  // its storage on every outermost get). Nothing is logged for an outermost entry.
  let level = 0,
    top = 0;
  const log: number[] = [];
  function get(index: number): unknown {
    // A table index: an integer in range (`>>> 0` rejects strings like "constructor", fractions, negatives).
    if (index >>> 0 !== index || index >= table.length) throw new RangeError("Invalid resume reference " + index);
    if (index in memo) {
      if (memo[index] === BUSY) throw new TypeError("Cyclic reference through a reactive or function entry");
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
    let entry = table[index] as TableEntry;
    if (entry === null || typeof entry !== "object") return (memo[index] = entry);
    if ("j" in entry) return ((memo[index] = entry.j), within(index), entry.j);
    // DOM-backed tree (DOM-DATA builds only: other builds fold this away and never meet one).
    if (DOM_DATA && "D" in entry) return ((memo[index] = need("dom")(entry.D!, get)), within(index), memo[index]);
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
    if ("y" in entry) entry = repeated(table as readonly TableEntry[], index, entry.y!);
    else entry = full(entry as EntryRecord);
    if (Array.isArray(entry)) {
      const array: unknown[] = (memo[index] = new Array(entry.length));
      for (let i = 0; i < entry.length; i++) if (entry[i] !== -1) array[i] = get(entry[i]!);
      return array;
    }
    if ("w" in entry) {
      // Values of an object shaped like the full entry at `w` (its keys, in order).
      const base = table[entry.w!] as EntryRecord | null,
        keys = base !== null && typeof base === "object" && entry.w! < index ? (base.o ?? base.p) : undefined,
        values = (entry.o ?? entry.p) as unknown[] | undefined;
      if (!Array.isArray(keys) || "w" in base! || !Array.isArray(values) || keys.length !== values.length * 2)
        throw new TypeError("Invalid resume table entry");
      const out: Record<string, unknown> = (memo[index] = {});
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        own(out, keys[2 * i] as string, "o" in entry ? get(v as number) : Array.isArray(v) ? get(v[0]) : v);
      }
      return out;
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
    if ("s" in entry) {
      const options = equality(entry.q, false);
      const s = (memo[index] = need("signal")(index, options)) as Signal<unknown>;
      s.set(get(entry.s!));
      options?.arm?.();
      return s;
    }
    if ("x" in entry) return (memo[index] = need("context")(entry.x!));
    if ("r" in entry) return (memo[index] = need("ref")(entry.r!, entry.z));
    // `let` cell (Function Bridge): created before its value decodes, so a function in it may capture the cell; inside a
    // BUSY entry its value is set when the outermost one is done (`drain`); a failed value → accessor (`fill`).
    if (entry.k === "cell") {
      const cell: { v: unknown } = (memo[index] = { v: undefined });
      if (depth) (cells ??= []).push([cell, entry.a![0]!, index]);
      else fill(cell, entry.a![0]!);
      return cell;
    }
    if ("k" in entry || "c" in entry || "f" in entry) return busy(index, entry);
    // Built-in entries outside the core decoder (`resume-builtins.ts`, loaded on demand).
    const builtins = (globalThis as { [_BUILTINS]?: BuiltinDecoder })[_BUILTINS];
    // A resource holder (T25) is BUSY while its data decodes: a cycle back to it throws (its reviver needs the data first).
    if (entry.rv) memo[index] = BUSY;
    if (builtins)
      return builtins(
        entry,
        get,
        (value) => (memo[index] = value),
        (run) => (depth ? (cells ??= []).push([memo[index], 0, index, run]) : run()),
        need,
      );
    throw new TypeError(
      DEV && /^([tUbE]|cls)$/.test(Object.keys(entry)[0]!)
        ? DEV.hint("Resume table entry `" + Object.keys(entry)[0] + "` needs @rivetjs/runtime/resume-builtins (not loaded)", "manifest")
        : "Unknown resume table entry",
    );
  }
  /** Whether a reference was decoded already (a revived signal may hold a newer value than the server's). */
  const decoded = (index: number): boolean => index in memo;
  return { get, decoded };
}

/** The full entry a `{y}` wire entry at `index` repeats (`EntryRecord.y`). */
export function repeated(table: readonly TableEntry[], index: number, base: number): EntryRecord {
  const wire = table[base] as EntryRecord;
  const entry = wire !== null && typeof wire === "object" && !Array.isArray(wire) ? full(wire) : wire;
  if (!(base < index) || entry === null || typeof entry !== "object" || Array.isArray(entry) || !entry.a || "y" in entry)
    throw new TypeError("Invalid resume table entry repeat " + base);
  const by = index - base,
    out: EntryRecord = { ...entry, a: entry.a.map((ref) => (ref > base ? ref + by : ref)) };
  if (typeof entry.q === "number" && entry.q > base) out.q = entry.q + by;
  return out;
}

/**
 * A wire entry in its full form: the compact `{f | c | k: [symbol | kind, ...refs], q?}` (state / patch `t`, written by
 * server-resume `compactTable`) as `{f | c | k, a, q?}`; any other entry as is.
 */
export function full(entry: EntryRecord): EntryRecord {
  const list = entry.f ?? entry.c ?? entry.k;
  if (!Array.isArray(list)) return entry;
  const out: EntryRecord = { a: list.slice(1) as number[] };
  if (entry.f !== undefined) out.f = list[0] as SymbolRef;
  else if (entry.c !== undefined) out.c = list[0] as SymbolRef;
  else out.k = list[0] as string;
  if (entry.q !== undefined) out.q = entry.q;
  if (entry.v !== undefined) out.v = entry.v;
  return out;
}

/** @internal Whether a `cls` names a `registerClass` id (T25: a string without `#`) rather than a class symbol. */
export const _registeredId = (cls: unknown): boolean => typeof cls === "string" && !cls.includes("#");
/** The symbol of a computed / function / class instance entry (`c` / `f` / `cls`): its id in a server table (the wire holds page symbol indexes). */
export function symbolOf(entry: EntryRecord): SymbolRef {
  return (entry.c ?? entry.f ?? entry.cls) as SymbolRef;
}

/** Wire `s` (see `ResumeRecords.s`). */
export type SymbolList = (string | number)[];

/** Make JSON safe inside a script element. */
// `indexOf` / `replaceAll` with a one-character string pattern are memchr scans: a 10 KB state with no `<` 2.5 -> 0.2 us,
// with one 2.8 -> 0.7 us (the regex replace is only for the rare U+2028 / U+2029; a one-byte string has neither).
export function escapeJSON(json: string): string {
  if (json.indexOf("<") >= 0) json = json.replaceAll("<", "\\u003c");
  return json.indexOf("\u2028") < 0 && json.indexOf("\u2029") < 0
    ? json
    : json.replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

/** Symbol ids referenced by function/computed entries reachable from the given references; `signals` (optional Set) collects reachable signal entries. */
export function reachableSymbols(table: readonly TableEntry[], refs: Iterable<number>, signals?: Set<number>): Set<SymbolRef> {
  const out = new Set<SymbolRef>(),
    seen = new Set<number>(),
    stack = [...refs];
  while (stack.length) {
    const index = stack.pop()!;
    if (index === -1 || seen.has(index)) continue;
    seen.add(index);
    const entry = table[index];
    if (entry === null || typeof entry !== "object") continue;
    if (Array.isArray(entry)) stack.push(...entry);
    else if (entry.o) for (let i = 1; i < entry.o.length; i += 2) stack.push(entry.o[i] as number);
    else if (entry.p) for (let i = 1; i < entry.p.length; i += 2) Array.isArray(entry.p[i]) && stack.push((entry.p[i] as [number])[0]);
    else if (entry.m) stack.push(...entry.m);
    else if (entry.e) stack.push(...entry.e);
    else if (entry.E) entry.E.length > 2 && stack.push(entry.E[2] as number);
    else if (entry.i) stack.push(entry.i[0]);
    else if ("s" in entry) {
      signals?.add(index);
      stack.push(entry.s!);
      if (typeof entry.q === "number") stack.push(entry.q);
    } else if (entry.a) {
      // A registered class id (T25 `registerClass`: a string `cls`, no `#`) is not a symbol.
      if (entry.c !== undefined || entry.f !== undefined || (entry.cls !== undefined && !_registeredId(entry.cls))) out.add(symbolOf(entry));
      stack.push(...entry.a);
      if (typeof entry.q === "number") stack.push(entry.q);
    }
  }
  return out;
}

// Resume state wire format (written by server-resume, read by the loader, stream add-on and dom-resume).
/**
 * A resumed symbol: the page symbol index on the wire (`ResumeRecords.s`, page-wide, streamed patches continue it);
 * the server builds entries with symbol ids and swaps in the indexes when it writes a segment.
 */
export type SymbolRef = string | number;
/** Handler entry: [symbol, capture refs, chunks, extra chunks of bindings it can update]. */
export type HandlerEntry = [symbol: SymbolRef, refs: number[], chunks: number[], extra?: number[]];
/**
 * Wire only (state / patch `e[id]`, written when the page ships the repeat add-on `resume-repeat.ts`, server `rr`):
 * `[back, floor, delta, …]` = the handlers of element `id - back` (same segment, decoded first: ids ascend), each handler's
 * capture refs relocated (`Relocation`); symbols, types (in order) and chunk lists copied. Decoded into the full map
 * before anything reads the state (loader parse / stream merge, `$rx`); raw-state readers use `handlersOf`.
 */
export type RepeatedHandlers = number[];
/**
 * Wire only (state / patch `b`, repeat add-on): `[-1 - back, node delta, region delta?, floor, delta, …]` = the plain
 * binding (7 slots: no region data) `back` entries earlier in the same list, node [0] and region [6] moved by the deltas
 * (region delta present when the entry's length is odd, else the node's), refs [3] and signals [4] relocated
 * (`Relocation`). Recognized by [0] < -1.
 */
export type RepeatedBinding = number[];
/**
 * Piecewise ref relocation of a repeat: `floor, delta` pairs, floors ascending; a ref takes the delta of the last floor ≤
 * it, a ref below the first floor stays (refs shared by every element: contexts, props, page signals).
 */
export type Relocation = number[];
/** Decode a relocated ref (`Relocation` pairs in `map`). */
export const relocate = (ref: number, map: Relocation): number => {
  let k = map.length;
  while ((k -= 2) >= 0 && ref < map[k]!);
  return k < 0 ? ref : ref + map[k + 1]!;
};
/** A raw (not loader-decoded) state's handlers of element `id`, repeats (`RepeatedHandlers`) decoded; tools and tests. */
export function handlersOf(e: Record<string, unknown>, id: number | string): Record<string, HandlerEntry> | undefined {
  const value = e[id] as Record<string, HandlerEntry> | RepeatedHandlers | undefined;
  if (!Array.isArray(value)) return value;
  const from = handlersOf(e, +id - value[0]!),
    map = value.slice(1),
    out: Record<string, HandlerEntry> = {};
  for (const type in from) {
    const entry = from[type]!.slice() as HandlerEntry;
    entry[1] = entry[1].map((ref) => relocate(ref, map));
    out[type] = entry;
  }
  return out;
}
/** Compact templated list rows: ids `i + k * d` (else `ids`), items table array `a` (else refs `r`, or `rs`), `x` index flag. */
export interface CompactRows {
  i?: number;
  d?: number;
  ids?: number[];
  a?: number;
  r?: number[];
  /**
   * Wire form only (DOM-DATA builds, `resume.domData`; server-dom-data.ts `domStrided`): the item refs `r` as runs, flat
   * `[first, step, count, …]` (row items one table entry each: `[0, 0, 1, 2, 1, 999]` for refs 0, 2, 3 … 1000). The
   * expand add-on of those builds (`EXPAND_DOM`, resume-expand.ts `strided`) rewrites them back to `r` before anything reads them.
   */
  rs?: number[];
  x?: 1;
  /** Some row's own render read signals: the browser re-creates the rows with their region, unless the region entry's
   * row reads ([13], `RowReads`) all still hold their server values. */
  w?: 1;
}
/** List rows: flat [rowId, itemRef, flags] triples (1: read its index, 2: its own render read signals), or the compact templated form. */
export type RowsSpec = number[] | CompactRows;
/** Show/Switch branch region `w`: match index `k` (-1 fallback; null never adopted), value ref `v` when read; `s`:
 * direct Shows/Switches of the region read before it that have no adoptable branch (since the previous spec). */
export interface BranchSpec {
  w: number;
  k: number | null;
  s?: number;
  v?: number;
}
/** A region's adoptable branches in creation order: one spec, or an array (≥ 2). */
export type BranchesSpec = BranchSpec | BranchSpec[];
/** Row template binding: [offset, name, symbol, refs (-2 item, -3 index), signals, chunks]. */
export type TemplateBinding = [offset: number, name: BindingName, symbol: SymbolRef, refs: number[], signals: number[], chunks: number[]];
/** Binding name: null text, "#" region, an attribute name, `...names` spread; a number: the table string holding it (long names). */
export type BindingName = string | number | null;
/** A path-addressed list (`ResumeRecords.w`): [first row id, stride, rows, element paths `tag:i.j`, anchor]. Anchor 1: the
 * row root (path `tag:`, id row + 1) keeps its `data-r` (rows outside row regions); else the root precedes the row's end marker. */
export type RowPathsEntry = [first: number, stride: number, rows: number, paths: string[], anchor?: 1];
/** Row template of a uniform list: handlers by row offset and type, and bindings. */
export interface RowTemplate {
  e: Record<string, Record<string, HandlerEntry>>;
  b: TemplateBinding[];
}
/**
 * Binding entry: [node, name (null text, "#" region, else attribute), symbol, refs, signals, chunks,
 * enclosing region, mount trigger?, rows or branches?, row template (or 0)?, branches after rows?
 * (expanded rows: row id), `_regionState` locals?, providers?, row reads (`RowReads`)?]. Name "*" (node -1): inert
 * row-template host of a `For` that is no region (rows only expand; never activated). Name "+" (node -1): packed repeated bindings (`PackedBindings`).
 */
export type BindingEntry = [
  node: number,
  name: BindingName,
  symbol: SymbolRef,
  refs: number[],
  signals: number[],
  chunks: number[],
  region: number,
  mount?: string | null,
  rows?: RowsSpec | BranchesSpec | PackedBindings,
  tpl?: RowTemplate | 0,
  ...rest: (number | null | BranchesSpec | RegionLocals | RegionProviders | RowReads)[],
];
/** Region entry [13] (RESUME-KEEP-ROWS): signal refs the own renders of its rows (flag 2 / `w`) read ([12] null when the
 * region has no providers). While each holds its server value the browser For keeps those rows; it re-creates them once
 * one changes. */
export type RowReads = number[];
/**
 * Binding entry name "+" (node -1): repeated text / attribute bindings packed at [8] — sibling component instances
 * (`xs.map((x) => <Badge … />)`) record the same bindings at the same node offsets, differing only in some captures.
 * Row k expands template entry `[offset, name, symbol, refs, signals, chunks]` into
 * `[base_k + offset, name, symbol, refs (ref -1 - v → r[k * n + v]), signals, chunks, region]`, row bases `i + k * d`
 * (else `ids`), `k` rows. dom-resume expands them before registering (the loader skips them: no [9] template).
 */
export interface PackedBindings {
  i?: number;
  d?: number;
  ids?: number[];
  k: number;
  /** Varying capture slots per row. */
  n: number;
  r: number[];
  b: TemplateBinding[];
  /** Row regions: row k's bindings sit in region [6] + (row k's base − row 0's base) (For rows in their row regions). */
  g?: 1;
}
/** Region entry [11]: refs of the `_regionState` values its server read created (null: not serializable);
 * `n`: per value, how many of the following values its `create()` made (skipped when it is adopted). */
export interface RegionLocals {
  l: (number | null)[];
  n?: number[];
}
/** Region entry [12]: identified providers enclosing the site, [token id, value ref, …] (re-provided around the re-creation);
 * on the wire a number when the list is shared: the index of the table array holding it (token refs + value refs). */
export type RegionProviders = (string | number)[];
/**
 * Lazy row region record (`ResumeRecords.L`, LAZY-ROWS T4; spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md
 * §3.1 `R`): one per keyed `For` the compiler marked lazy (`$lazy`) whose rows rendered without records —
 * `[forId, region, rowFn, items, by, flags, chunks, reads?, state?]`:
 * - `forId`: the For's resume id; row k is the region marker pair `<!--r<forId + 1 + k>[-->…<!--]-->` (ids consecutive,
 *   so the writer's marker stride usually leaves them out), rendered under the id seed `_rowIdPrefix(forId, k)`
 *   (`@rivetjs/runtime/id`: `rvr<forId>_<k>_` + n);
 * - `region`: the enclosing recorded region id (-1: page root); `rowFn`: table ref of the row function (an `{f}` entry,
 *   called `(item accessor, index accessor)`); `items`: table ref of the rendered items array (row k's item = items[k],
 *   in DOM order); `by`: the key path string (`""` = the item itself) or the table ref of the `by` function (flag 2);
 * - `flags`: 1 a row reads its index, 2 `by` is a function, 4 `state` present, 8 the rows' signal reads did not encode
 *   (the browser treats every row as reading something that changed);
 * - `chunks`: chunk indexes of the row function's symbol + everything its captures, the items and `by` reach;
 * - `reads`: signal refs the rows' renders read (deduplicated; 0 when none) — no row has bindings of its own on the wire;
 * - `state` (flag 4; 0 when none): `[k, RegionLocals, …]` for the rows whose render created `_regionState` values (refs;
 *   null: not serializable), in creation order — the row function's re-run adopts them instead of calling `create()`;
 * - `types` (T5): the event types the rows handle, space separated ("" none) — an event of one inside a row materialises it
 *   (the lazy add-on `resume-lazy.ts` / `ResumeInstance.q` answer the loader's walk with the row's marker id);
 * - `providers` (T5): identified providers around the For, `[token id, value ref, …]` (re-provided around a materialised row);
 * - `effects` (T5): indexes of the rows holding a client effect / `clientEvent` listener — materialised at idle, so their
 *   effects run as a recorded effect would (and the page boots its runtime at load);
 * - `keyed` (T6): keyed selector reads, `[signal ref, kind, [k, key, …] | 1, …]` — rows k read `key` of a `selector(signal)`
 *   (`@rivetjs/reactivity` `_trackReads` keyed hook), so a change of the signal wakes only the rows whose key may have
 *   flipped: kind 0 the previous and next value (default `fn`), kind 1 `memberKeys` (Sets: their symmetric difference,
 *   else every listed row); `1` instead of the list: every row reads its own key (`_keyAt(items[k], by)`, key path `by`).
 *   A signal some row also reads plainly is in `reads` instead.
 * - `count`: the row count, when the `items` entry does not show it (an `i` child of a tree, a DOM-backed `D` tree).
 * No per-row id, key, handler, binding, capture or provider entry: keys are `by(items[k])`, everything else is recomputed by
 * re-running `rowFn` for row k in adopt mode (browser materialisation, T5: `dom-resume.ts`, `dom-adopt.ts` `_adoptRow`).
 * Trailing slots are left out when empty.
 */
export type LazyRowsEntry = [
  forId: number,
  region: number,
  rowFn: number,
  items: number,
  by: number | string,
  flags: number,
  chunks: number[],
  reads?: number[] | 0,
  state?: (number | RegionLocals)[] | 0,
  types?: string,
  providers?: RegionProviders | 0,
  effects?: number[] | 0,
  keyed?: (number | unknown[])[] | 0,
  count?: number,
];
/** Model entry: [kind, signal ref, extra chunks?]. */
export type ModelEntry = [kind: "value" | "checked", ref: number, extra?: number[]];
/** Client effect entry: [symbol, refs, when, chunks, region]. */
export type EffectEntry = [symbol: SymbolRef, refs: number[], when: string | null, chunks: number[], region: number];
/** clientEvent target: "w" window, "d" document, ["r", element id], or a media query string. */
export type ClientEventTarget = string | [kind: "r", id: number];
export interface ClientEventOptions {
  passive?: boolean;
  capture?: boolean;
  once?: boolean;
  when?: string;
  /** CSS selector: only events whose target is inside a match run the handler (and load its chunk). */
  match?: string;
}
/** Client listener entry: [symbol, refs, target, type, options, chunks, region]. */
export type ClientEventEntry = [
  symbol: SymbolRef,
  refs: number[],
  target: ClientEventTarget,
  type: string,
  options: ClientEventOptions | null,
  chunks: number[],
  region: number,
];
/** Streamed boundary entry: [marker, fallback region, region, status 0 pending | 1 content | 2 continue | 3 link].
 * An ErrorBoundary links its content scope to its region with status 3 (`[region, content, region, 3]`). */
export type AsyncEntry = [marker: number, fallback: number, region: number, status: number];
/** Preload plan entry: [url, "e" | "i" | "v", element ids?]. */
/** `e` eager, `i` idle, `v` visible (viewport only), `P` visible + background prefetch at idle (planner budget); `v` / `P` carry observed ids. */
export type PreloadEntry = [url: string, strategy: string, ids?: number[]];
/** Entries a shell or patch carries (`e` / `b` as decoded: on the wire they may hold `RepeatedHandlers` /
 * `RepeatedBinding` forms and compact row templates, which the repeat / expand add-ons decode before any reader). */
export interface ResumeRecords {
  /** Chunk URLs. */
  c: string[];
  /**
   * New page symbols, in index order (`SymbolList`): a number sets the chunk index of the ids after it; an id is
   * `module#Local`, `#Local` (the previous id's module) or `$a$b…` (one id per `$suffix`: the previous id's module
   * and component, `Local` = `Component$suffix`). Streamed patches append (indexes continue).
   */
  s: SymbolList;
  /** Lazy imports per chunk index. */
  l?: Record<string, string[]>;
  /** Chunk indexes intent must not prefetch. */
  x?: number[];
  /** Chunk group / route sibling chunk groups. */
  g?: number[][];
  t: TableEntry[];
  e: Record<string, Record<string, HandlerEntry>>;
  m: Record<string, ModelEntry>;
  b: BindingEntry[];
  fx: EffectEntry[];
  ce: ClientEventEntry[];
  /**
   * Path-addressed list rows (written without `data-r`): per list [first row id, stride, rows, paths, anchor?]. Row k
   * has id `first + k * stride`; its element j has id `row + 1 + j`, found from the row root by `paths[j]` = `tag:i.j`
   * (element child indexes below the root, its tag checked). The root: the element right before the row's end marker
   * (`<!--]-->`, row regions), or with anchor 1 the element `data-r` = row + 1 (rows outside row regions). Patches append.
   */
  w?: RowPathsEntry[];
  a?: AsyncEntry[];
  /** Lazy row region records (`LazyRowsEntry`), in render order; patches append (a segment's own Fors). */
  L?: LazyRowsEntry[];
  /** DOM-DATA: 1 when the table holds `D` entries (the runtime reads them back from the DOM at idle). */
  D?: 1;
}
/** A lazy row's key from its item and the For's key path (`LazyRowsEntry` `by` string: `""` the item, else dot-separated
 * properties), as `by` computed it on the server. */
export function _keyAt(item: unknown, path: string): unknown {
  if (path === "") return item;
  let value = item;
  for (const name of path.split(".")) value = value == null ? undefined : (value as Record<string, unknown>)[name];
  return value;
}
/** The `rivet/state` format version (`ResumeState.v`): 2 since lazy row region records (`L`, LAZY-ROWS T4 2026-10-19).
 * Breaking format changes bump it; the server writes it, the dev runtime warns on a mismatch (no compatibility decoding). */
export const RESUME_VERSION = 2;
/** The page's `rivet/state` script. */
export interface ResumeState extends ResumeRecords {
  /** Format version: `RESUME_VERSION`. */
  v: number;
  h: string | null;
  rt: string | null;
  /** Expanded row item / index consts (refs ≤ -10): a table ref, or [index]. */
  k?: (number | [number])[];
  /** Chunks of document / window `click` listeners that load on interaction (`preload: "intent" | "interaction"`):
   * the loader boots them on a cold same-origin link click (held, then replayed) and prefetches them on link intent. */
  n?: number[];
}
/** A streamed segment's state patch (`t0`: its first table index). */
export interface StatePatch extends Partial<ResumeRecords> {
  t0?: number;
  ev?: string[];
  p?: (string | PreloadEntry | null)[];
  boot?: 1;
}
/** Loaded chunk modules and the loader's chunk loader, shared with the runtime. */
/** A delegated hit: [[element, id, handler entry (resolved at dispatch: a later takeover must not orphan it)]…, chunks, extra chunks]. */
export type Hit = [targets: [element: Element, id: string, entry?: HandlerEntry][], chunks: number[], extra: number[], prefetched?: 1];
/** A cold event the loader held: the event, its hit, the held default's replay, the target's `[value, checked, files]` and the focused element at dispatch. */
export type ColdEvent = [event: Event, hit: Hit, replay: (() => void) | undefined, live: unknown[]];
export interface LoaderApi {
  done: Record<number, Record<string, unknown>>;
  ensure(chunks: number[]): Promise<unknown>;
  /** Chunk imports started (in flight or done). */
  p?: Record<number, Promise<unknown>>;
  /** The intent event (pointerover / focusin / touchstart) that booted the runtime, if any (Z1 lazy router replay). */
  i?: Event;
  /** Cold events held before the runtime started (it replays them first, in dispatch order). */
  q?: ColdEvent[];
  /** Report a resume failure (`rivet:resume-error`, else reload once). */
  f?: (error: unknown) => void;
  // ---- loader module (`resume-loader-module.ts`) hooks; the inline stub fills the rest ----
  /** Hint a module (`urgent` 0: low priority; `dep`: a static import, never evaluated on its own). */
  a?: (url: string, urgent?: number, dep?: number) => void;
  /** Hinted URLs: 1, or 2 for static imports. */
  h?: Record<string, number>;
  /** Run in an idle slice, never during scroll. */
  c?: (fn: () => void) => unknown;
  /** Start the runtime. */
  b?: () => Promise<ResumeInstance>;
  /** Import a module (one cache-busted retry). */
  m?: (url: string) => Promise<Record<string, unknown>>;
  /** The parsed (row-expanded) state. */
  P?: () => ResumeState;
  /** The page's state script. */
  x?: HTMLScriptElement;
  /** Interactions (chunks; intent 1: with extras) and preload plans recorded before the loader module ran. */
  U?: [chunks: number[], intent?: 1][];
  S?: (string | PreloadEntry | null)[][];
  /** Save-Data / 2G: no scheduled or sibling prefetch. */
  n?: boolean | undefined;
  /** Set by the loader module: a hint finished (`ok`: loaded) / chunks an interaction used / a preload plan. */
  w?: (url: string, ok: boolean, urgent?: number, dep?: number) => void;
  u?: (chunks: number[], intent?: 1) => void;
  s?: (plan: (string | PreloadEntry | null)[]) => void;
}
/** The client runtime instance (dom-resume's createResume) as the loader drives it. */
export interface ResumeInstance {
  start(state: ResumeState, doc?: Document, api?: LoaderApi): void;
  patch(delta: StatePatch): void;
  dead(region: number): boolean;
  /** Path-addressed row elements (`w`): the element of an id, or the id of an element (undefined: none). */
  q?(x: number | Element): Element | string | undefined;
  /** `live`: a cold event's target `[value, checked]` at dispatch (shown to its handlers during the replay). */
  dispatch(event: Event, target: Element, id: string, type: string, replaying?: boolean, entry?: HandlerEntry, live?: unknown[]): { prevented: boolean };
  /** A lazy row's synthetic entry `["L", [], chunks]` on a delegated event's path (LAZY-ROWS T5): materialise row `id`
   * (`next`: the next target's element, bounding a cold replay's delegation); true when a replayed handler canceled it. */
  L?(event: Event, id: number, next: Element | null): boolean;
  /** A delegated event: run its handlers now when nothing cold is queued and its chunks are evaluated (true), else false. */
  on(event: Event, hit: Hit): boolean;
  /** Queue a held cold event: replayed after every earlier one, once its chunks loaded. */
  cold(item: ColdEvent): void;
}
/** Loader hooks for the stream add-on (`document.$r`). */
export interface LoaderHooks {
  p: () => ResumeState;
  l: (type: string) => unknown;
  s: (plan: (string | PreloadEntry | null)[]) => unknown;
  b: () => void;
  r: () => ResumeInstance | undefined;
  f: (error: unknown) => void;
  /** The page's state script (the element right before the loader). */
  x: HTMLScriptElement;
}
/** The document as the loader and stream add-on extend it. */
export type LoaderDocument = Document & {
  $r?: LoaderHooks;
  $rp?: (state: ResumeState) => void;
  /** Expand / repeat add-ons (`resume-expand.ts`, pages with compact row templates; `resume-repeat.ts`, pages with repeated
   * entries): decode `list` (and `patch`'s handlers, merged into `state`; default the state itself) into full entries. */
  $rx?: (state: ResumeState, list: BindingEntry[], patch?: StatePatch | ResumeState) => void;
  /** Rows add-on (`resume-rows.ts`, pages with path-addressed rows): element of an id / id of an element. */
  $rw?: (x: number | Element, observer?: IntersectionObserver) => Element | string | undefined;
  /** Lazy rows runtime import (the lazy add-on's preload part, `resume-lazy.ts` `lazyPreload`: its `data-lz` chunk). */
  $rl?: () => Promise<Record<string, unknown>>;
};

// ---------------------------------------------------------------------------------------------------------------------
// Derived model (M2 lane A, `server-derived.ts`; plan docs/design/plans/2026-10-18-derived-client.md): the values-only
// tail `<script type="rivet/boundaries">` (and `data-patch="<marker>"` scripts after streamed segments). Nothing of the
// serialized state above appears in it: no table, no handler / binding entries.

/**
 * One boundary: `[id, parent id (0 = page root), flags, component name, keyed values, props?]`. `flags`: 1 independent
 * (props are values: `props` present), 2 the element root carries `data-b` (else `<!--b<id>-->` … `<!--/b-->` around
 * its output), 4 a keyed value was not JSON data (left out: render, do not adopt), 8 independence demoted at render
 * (props held a non-data value), 16 no output (`_rBOut` never ran). Keyed values: a flat `[key, value, key, value, …]`
 * list in creation order (key = module prefix + site ordinal from the compiler, `#n` suffix for a repeated site).
 */
export type BoundaryRecord = [id: number, parent: number, flags: number, name: string, signals: unknown[], props?: object];

/** The boundaries tail: records (new ones only in a patch) and the wake lists (`"<id>.<key>"` → reader boundary ids;
 * a patch re-sends a list whole when it grew). */
export interface BoundaryTail {
  v: 1;
  b: BoundaryRecord[];
  w?: Record<string, number[]>;
  /** Derived client (`derivedToString` / `renderDerived`): boundary name → its chunk URL (manifest `symbols`). */
  m?: Record<string, string>;
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
   * DOM data on derived (DERIVED-C5, builds with `resume: { model: "derived", domData: true }`): list item arrays of a
   * record's props that the page shows, left out of the props (`0` at `path`) and rebuilt by the browser from the rows
   * after the list's anchor (`<!--r0<n>[-->`). `DerivedDom`.
   */
  d?: DerivedDom[];
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
