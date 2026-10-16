// Live component props (spec docs/design/specs/2026-10-07-live-props-design.md). The compiler passes a
// component's props as one object whose dynamic entries are getters (`{ get variant() { return v() } }`):
// a binding that reads `props.variant` tracks `v` itself, the component never re-runs. Copying such an
// object (`{ ...props }`, `Object.assign`) reads every getter once and freezes the copy; these helpers
// combine and split props without reading them (Solid `mergeProps` / `splitProps` semantics). Target-free
// (server, DOM, resume): no DOM, no recorder. Pay-per-use: its own module, imported only by code that uses it.
import { computed } from "@rivetjs/reactivity";

/** Brand of the Proxy-backed props objects (a reactive source: function sources, proxied input). */
const PROXY = Symbol.for("rivet.props");
type Key = string | symbol;
type Props = Record<Key, unknown>;
type Source = Props | (() => Props | null | undefined) | null | undefined | false;

// Resume hook (server-resume installs it; null elsewhere: one null check per forwarded getter): every getter a
// helper defines that forwards to source props — `target[key]` reads the last of `sources` (source order) whose
// `key` is not `undefined` — so a split / merged props object encodes as forwards to its sources, not as values.
type Forward = (target: Props, key: Key, sources: readonly Props[]) => void;
let forwarded: Forward | null = null;
/** Resume ABI (server-resume): observe forwarded getters (`splitProps`, `mergeProps`, `_spreadProps`, `_restProps`). */
export const _onForward = (hook: Forward): void => {
  forwarded = hook;
};
/** Resume ABI (compiler, live props recipes): the symbol of a component call's props returns `_c(_propsOf, props)`. */
export const _propsOf = <P>(props: P): P => props;

// A decoded forward box (resume state `{k:"m"}`, decoded by `dom-resume.ts` — its own copy of this rule): `[key, …sources]`, read as the last source whose
// `key` is not `undefined`. `Symbol.for`: dom-resume and symbol chunks may load separate copies of this module.
const FORWARD: unique symbol = Symbol.for("rivet.forward") as never;
/**
 * Resume ABI (compiler: member-capture prologues; dom-resume: live props objects): every forward box among
 * `object`'s own values becomes a getter over its sources (key order kept), so a resumed binding that captured
 * `props.a` keeps tracking the prop instead of a snapshot. Other values stay as they are.
 */
export function _members<T extends object>(object: T): T {
  for (const key of Object.keys(object)) {
    const value = (object as Props)[key];
    const box = value !== null && typeof value === "object" ? (value as { [FORWARD]?: Props[] })[FORWARD] : undefined;
    if (box)
      Object.defineProperty(object, key, {
        enumerable: true,
        configurable: true,
        get() {
          const name = box[0] as unknown as string;
          for (let s = box.length - 1; s > 0; s--) {
            const v = box[s]![name];
            if (v !== undefined) return v;
          }
          return undefined;
        },
      });
  }
  return object;
}

// ---- fast-mode getter objects ----
// An object literal with getters is a V8 dictionary-mode object (every literal evaluation makes new getter
// closures → no shared map): ~490 B, slow creation (one runtime call per accessor), slow reads. Instead a props
// object here is a plain `{}` (Object.prototype) carrying ONE hidden slot (a private field stamped through a
// return-override base constructor: invisible to `Object.keys` / `Reflect.ownKeys` / spread / descriptors) and
// own enumerable configurable accessors whose getter functions are SHARED (per index or per key) and read the
// slot through `this` — same AccessorPairs → one shared fast map per key layout. Node, 2 getters + 1 value:
// 168 B vs 496 B, create 100 vs 180 ns, read 4 vs 19 ns (props suite, `apps/dom-bench/props`).
class Base {
  constructor(object: object) {
    return object;
  }
}
const defineGetter = (Object.prototype as unknown as { __defineGetter__(key: Key, get: () => unknown): void }).__defineGetter__;
const envGetters: (() => unknown)[] = [],
  keyGetters = new Map<Key, () => unknown>(),
  lastGetters = new Map<Key, () => unknown>(),
  definedGetters = new Map<Key, () => unknown>();
// A shared getter reached without its slot: the accessor was copied off its props object (`Object.defineProperties(x,
// Object.getOwnPropertyDescriptors(props))`, Solid-1 `splitProps` style) or called with another `this`. The brand
// check costs nothing measurable (Node: read 4.5 ns, create 90 ns either way), so it ships in production.
const unslotted = (key: Key | number): never => {
  throw new TypeError(
    `Live prop ${typeof key === "number" ? `#${key}` : String(key)} read from a copy of a props object: copying property descriptors drops the props source — combine props with mergeProps / splitProps (or read the getter with \`this\` = the original props)`,
  );
};
class Slot extends Base {
  #slot: unknown;
  constructor(object: object, slot: unknown) {
    super(object);
    this.#slot = slot;
  }
  // A props object made here (`_p`, `splitProps`, `mergeProps`, `_spreadProps`, `_restProps`; not a Proxy).
  static is(value: unknown): boolean {
    return value !== null && typeof value === "object" && #slot in value;
  }
  // Compiler env: the slot is the call site's dispatcher `(i) => <getter i's expression>`.
  static env(i: number): () => unknown {
    return (envGetters[i] ??= function (this: Slot) {
      return #slot in this ? (this.#slot as (i: number) => unknown)(i) : unslotted(i);
    });
  }
  // Forward to one source (`splitProps`, `_restProps`): `source[key]` (a source getter runs with `this` = source).
  static key(key: Key): () => unknown {
    let get = keyGetters.get(key);
    if (get === undefined)
      keyGetters.set(
        key,
        (get = function (this: Slot) {
          return #slot in this ? (this.#slot as Props)[key] : unslotted(key);
        }),
      );
    return get;
  }
  // Object-spread forward (`_spreadProps`): the last source that has `key`.
  static last(key: Key): () => unknown {
    let get = lastGetters.get(key);
    if (get === undefined)
      lastGetters.set(
        key,
        (get = function (this: Slot) {
          if (!(#slot in this)) return unslotted(key);
          const sources = this.#slot as (Props | null | undefined | false)[];
          for (let i = sources.length - 1; i >= 0; i--) {
            const s = sources[i];
            if (s && Object.hasOwn(s, key)) return s[key];
          }
          return undefined;
        }),
      );
    return get;
  }
  // Defaults forward (`mergeProps`): the last source whose `key` is not `undefined`.
  static defined(key: Key): () => unknown {
    let get = definedGetters.get(key);
    if (get === undefined)
      definedGetters.set(
        key,
        (get = function (this: Slot) {
          if (!(#slot in this)) return unslotted(key);
          const sources = this.#slot as (Props | null | undefined | false)[];
          for (let i = sources.length - 1; i >= 0; i--) {
            const s = sources[i];
            if (s && Object.hasOwn(s, key)) {
              const v = s[key];
              if (v !== undefined) return v;
            }
          }
          return undefined;
        }),
      );
    return get;
  }
}
const slotted = (slot: unknown): Props => new Slot({}, slot) as unknown as Props;

/**
 * Compiler ABI (DOM v2 live props, per call site factory): a fresh props object whose getters read `env`
 * (`(i) => <expression of getter i>`). The call site adds keys in source order: values by assignment,
 * getter `i` by `_pg(o, key, i)`.
 */
export const _p = slotted;
/** Compiler ABI: install getter `i` of a `_p` object (own, enumerable, configurable; reads `env(i)`). */
export function _pg(object: Props, key: Key, i: number): void {
  defineGetter.call(object, key, Slot.env(i));
}

/**
 * Compiler ABI (F3, a member prop `key={local.name}` of a `_p` object): resolved once, at creation. When `source` is a
 * props object made by these helpers or the compiler and `name` is its own data property, the value is copied (props
 * objects never change a value — `splitProps` / `mergeProps` copy data entries the same way); a missing key is
 * `undefined` (their keys are fixed at creation). Anything else — an accessor (a live prop), an inherited key, a plain
 * or proxied object — installs getter `i` (`_pg`: re-reads `local.name` per access), as before.
 */
export function _pm(object: Props, key: Key, i: number, source: unknown, name: Key): void {
  if (Slot.is(source)) {
    const desc = Object.getOwnPropertyDescriptor(source, name);
    if (desc === undefined ? !(name in (source as object)) : !desc.get && !desc.set) {
      object[key as string] = desc?.value;
      return;
    }
  }
  defineGetter.call(object, key, Slot.env(i));
}

const isProxy = (value: unknown): boolean => value !== null && typeof value === "object" && (value as { [PROXY]?: 1 })[PROXY] === 1;
// "__proto__" / "constructor" are never props: copying them would change the result's prototype / shadow it.
const skip = (key: Key): boolean => key === "__proto__" || key === "constructor";

const traps: ProxyHandler<{ get: (key: Key) => unknown; has: (key: Key) => boolean; keys: () => Key[] }> = {
  get: (target, key) => (key === PROXY ? 1 : target.get(key)),
  has: (target, key) => key === PROXY || target.has(key),
  set: () => true,
  deleteProperty: () => true,
  ownKeys: (target) => target.keys(),
  getOwnPropertyDescriptor: (target, key) =>
    target.has(key) ? { configurable: true, enumerable: true, get: () => target.get(key), set: undefined } : undefined,
};
const proxy = (get: (key: Key) => unknown, has: (key: Key) => boolean, keys: () => Key[]): Props => new Proxy({ get, has, keys }, traps) as unknown as Props;

/**
 * Merge props objects, later sources first: a key resolves to the last source whose value is not
 * `undefined` (so `mergeProps({ size: "md" }, props)` is a default). Getters stay getters — nothing is
 * read while merging. A function source is a reactive object (`mergeProps(() => cond() ? a : b, …)`):
 * then the result is a Proxy whose keys follow it (Solid parity).
 */
export function mergeProps<T extends unknown[]>(...sources: [...T]): MergeProps<T> {
  let dynamic = false;
  // The rest array is ours: function sources become memos in place (no copy).
  const list = sources as unknown as (Props | null | undefined | false)[] | (() => Props | null | undefined | false)[];
  for (let i = 0; i < list.length; i++) {
    const s = list[i] as Source;
    if (typeof s === "function") {
      dynamic = true;
      (list as (() => unknown)[])[i] = computed(s);
    } else if (isProxy(s)) dynamic = true;
  }
  if (dynamic) {
    const at = (i: number): Props | null | undefined | false => {
      const s = list[i];
      return typeof s === "function" ? (s as () => Props)() : (s as Props);
    };
    return proxy(
      (key) => {
        for (let i = list.length - 1; i >= 0; i--) {
          const s = at(i);
          if (s) {
            const v = s[key];
            if (v !== undefined) return v;
          }
        }
        return undefined;
      },
      (key) => {
        for (let i = list.length - 1; i >= 0; i--) {
          const s = at(i);
          if (s && key in s) return true;
        }
        return false;
      },
      () => {
        const keys = new Set<Key>();
        for (let i = 0; i < list.length; i++) {
          const s = at(i);
          if (s) for (const key of Reflect.ownKeys(s)) if (!skip(key)) keys.add(key);
        }
        return [...keys];
      },
    ) as MergeProps<T>;
  }
  // Static key set (own enumerable string keys): a key resolves, last source first, to a getter (forwarded:
  // `Slot.defined`, re-resolved per read — earlier values behind it included) or to the first plain value that is
  // not undefined (settled). Key order is object-spread order (`{ ...a, ...b }`: first appearance, sources in
  // order), so a component spreading the result writes attributes in source order like the server.
  const target = slotted(list);
  for (let i = 0; i < list.length; i++) {
    const source = list[i] as Props | null | undefined | false;
    if (!source) continue;
    const keys = Object.keys(source);
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k]!;
      if (skip(key) || Object.hasOwn(target, key)) continue;
      // Sources before `i` lack `key` (first appearance), so `j` scans every source that has it.
      let getter = false,
        value: unknown = undefined;
      for (let j = list.length - 1; j >= i; j--) {
        const s = list[j] as Props | null | undefined | false;
        if (!s || !Object.hasOwn(s, key)) continue;
        const desc = Object.getOwnPropertyDescriptor(s, key)!;
        if (desc.get) {
          getter = true;
          break;
        }
        if (desc.value !== undefined) {
          value = desc.value;
          break;
        }
      }
      if (!getter) target[key] = value;
      else {
        defineGetter.call(target, key, Slot.defined(key));
        if (forwarded !== null)
          forwarded(
            target,
            key,
            (list as Props[]).filter((s) => s && Object.hasOwn(s, key)),
          );
      }
    }
  }
  return target as MergeProps<T>;
}

/**
 * Split props by key lists: `[picked₁, …, pickedₙ, rest]`. Every part forwards to `props` (getters stay
 * live, nothing is read). A key listed twice goes to its first list. Keys absent from `props` are absent
 * from the parts (a Proxy-backed `props` gives Proxy parts that follow its keys).
 */
export function splitProps<T extends Props, const K extends readonly (readonly (keyof T)[])[]>(props: T, ...keys: K): SplitProps<T, K> {
  if (isProxy(props)) {
    // key → index of the first list naming it (a key listed twice goes to its first list): one lookup per access.
    const owner = new Map<Key, number>();
    for (let i = 0; i < keys.length; i++) for (const key of keys[i] as readonly Key[]) if (!owner.has(key)) owner.set(key, i);
    const part = (owns: (key: Key) => boolean): Props =>
      proxy(
        (key) => (owns(key) ? props[key] : undefined),
        (key) => owns(key) && key in props,
        () => Reflect.ownKeys(props).filter(owns),
      );
    const out = keys.map((_, i) => part((key) => owner.get(key) === i));
    out.push(part((key) => !owner.has(key)));
    return out as unknown as SplitProps<T, K>;
  }
  // Key lists are short: `includes` beats building a Set per list per call.
  const groups = keys as unknown as readonly (readonly Key[])[];
  const out: Props[] = new Array(groups.length + 1);
  for (let i = 0; i <= groups.length; i++) out[i] = slotted(props);
  const keysOf = Reflect.ownKeys(props);
  for (let k = 0; k < keysOf.length; k++) {
    const key = keysOf[k]!;
    if (skip(key)) continue;
    const desc = Object.getOwnPropertyDescriptor(props, key)!;
    if (!desc.enumerable) continue;
    let g = 0;
    while (g < groups.length && !groups[g]!.includes(key)) g++;
    forward(out[g]!, props, key, desc);
  }
  return out as unknown as SplitProps<T, K>;
}
// A getter is forwarded as a read of `from[key]` (`to` = `slotted(from)`; author getters keep `this` = `from`); a value is copied.
const forward = (to: Props, from: Props, key: Key, desc: PropertyDescriptor): void => {
  if (desc.get) {
    defineGetter.call(to, key, Slot.key(key));
    if (forwarded !== null) forwarded(to, key, [from]);
  } else to[key as string] = desc.value;
};

/**
 * Compiler ABI (DOM v2 component spreads, `<C a={1} {...rest} b={x()} />` → `_spreadProps({ a: 1 }, rest,
 * { get b() {…} })`): object-spread semantics, the live twin of the server's `{ "a": 1, ...rest, "b": x() }` —
 * a key resolves to the LAST source that has it (an own `undefined` included, unlike `mergeProps` defaults),
 * key order = spread order (first appearance), getters forwarded unread. A function / proxied source → a
 * Proxy whose keys follow it.
 */
export function _spreadProps(...sources: Source[]): Props {
  let dynamic = false;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    if (typeof s === "function") {
      dynamic = true;
      sources[i] = computed(s) as never;
    } else if (isProxy(s)) dynamic = true;
  }
  if (dynamic) {
    const at = (i: number): Props | null | undefined | false => {
      const s = sources[i];
      return typeof s === "function" ? (s as () => Props)() : (s as Props);
    };
    return proxy(
      (key) => {
        for (let i = sources.length - 1; i >= 0; i--) {
          const s = at(i);
          if (s && Object.hasOwn(s, key)) return s[key];
        }
        return undefined;
      },
      (key) => {
        for (let i = sources.length - 1; i >= 0; i--) {
          const s = at(i);
          if (s && Object.hasOwn(s, key)) return true;
        }
        return false;
      },
      () => {
        const keys = new Set<Key>();
        for (let i = 0; i < sources.length; i++) {
          const s = at(i);
          if (s) for (const key of Reflect.ownKeys(s)) if (!skip(key)) keys.add(key);
        }
        return [...keys];
      },
    );
  }
  // A key ending as a getter forwards to the last source having it (`Slot.last`, resolved per read).
  const out = slotted(sources);
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i] as Props | null | undefined | false;
    if (!source) continue;
    const keys = Object.keys(source);
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k]!;
      if (skip(key)) continue;
      const desc = Object.getOwnPropertyDescriptor(source, key)!;
      // Redefining keeps the key's first position (spread order); a value over a getter needs defineProperty.
      if (desc.get) defineGetter.call(out, key, Slot.last(key));
      else if (Object.hasOwn(out, key)) Object.defineProperty(out, key, { enumerable: true, configurable: true, writable: true, value: desc.value });
      else out[key] = desc.value;
    }
  }
  // Resume: a key that ended as a getter forwards to the last source having it.
  if (forwarded !== null)
    for (const key of Object.keys(out))
      if (Object.getOwnPropertyDescriptor(out, key)!.get)
        for (let i = sources.length - 1; i >= 0; i--) {
          const source = sources[i] as Props | null | undefined | false;
          if (source && Object.hasOwn(source, key)) {
            forwarded(out, key, [source]);
            break;
          }
        }
  return out;
}

/**
 * Compiler ABI (destructured component params, `({ a, b = 1, ...rest })`): the `rest` object — every
 * own enumerable key of `props` not in `used`, forwarded like `splitProps`. One object, no picked parts.
 */
export function _restProps(props: Props, used: readonly Key[]): Props {
  if (isProxy(props)) return splitProps(props, used)[1] as Props;
  const out = slotted(props),
    keys = Reflect.ownKeys(props);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k]!;
    if (skip(key) || used.includes(key)) continue;
    const desc = Object.getOwnPropertyDescriptor(props, key)!;
    if (desc.enumerable) forward(out, props, key, desc);
  }
  return out;
}

// ---- types ----
type Simplify<T> = { [K in keyof T]: T[K] } & {};
type Resolved<S> = S extends (...args: never[]) => infer R ? Exclude<R, null | undefined | false> : Exclude<S, null | undefined | false>;
// B over A; a key B may leave undefined keeps A's type too (undefined falls through to earlier sources).
type Override<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? K extends keyof A
      ? undefined extends B[K]
        ? Exclude<B[K], undefined> | A[K]
        : B[K]
      : B[K]
    : K extends keyof A
      ? A[K]
      : never;
};
type MergeAll<T extends readonly unknown[], Acc> = T extends readonly [infer H, ...infer R] ? MergeAll<R, Override<Acc, Resolved<H>>> : Acc;
/** Result type of `mergeProps(...sources)`: later sources win, an optional later key keeps the earlier type too. */
export type MergeProps<T extends readonly unknown[]> = Simplify<MergeAll<T, {}>>;
/** Result type of `splitProps(props, ...lists)`. */
export type SplitProps<T, K extends readonly (readonly (keyof T)[])[]> = [
  ...{ [I in keyof K]: K[I] extends readonly (keyof T)[] ? Simplify<Pick<T, K[I][number]>> : never },
  Simplify<Omit<T, K[number][number]>>,
];
