// Build-time evaluation (COMPTIME, `comptime.ts`): runs allowlisted / `@comptime`-annotated functions on constant
// arguments in a worker thread (own globals: the determinism traps below never touch the build's process), with the
// real modules Node imports. Two adapters:
// - `value`: the result must be data (string / number / boolean / null / undefined / bigint, arrays, plain objects);
// - `tv`: the result is a tailwind-variants resolver; `buildTvTable` enumerates its finite input domain and proves a
//   lookup table (`@rivetjs/runtime/comptime-tv`) reproduces it for every enumerated combination.
// Refusals (non-deterministic, not data, unsupported definition, too large) keep the call at runtime.
// The worker is this module itself (`new Worker(import.meta.url)`): the same file in the source tree and the package.
import * as nodeModule from "node:module";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Encoded argument / result value: JSON with tagged objects (`{"\0": tag, …}`) for what JSON cannot hold. */
export type Spec = null | boolean | number | string | Spec[] | { readonly "\0": string; readonly [key: string]: unknown };

/** One build-time call: `file`'s export `name` (or the resolver a `$def` / nested call yields) applied to `args`. */
export interface Recipe {
  /** Absolute path of the callee module (Node-importable: `.js` / `.mjs` / `.ts` with erasable types). */
  readonly file: string;
  readonly name: string;
  readonly args: readonly Spec[];
  readonly adapter: "value" | "tv";
}

/** Paths the `tv` adapter needs: the runtime table helper (verification runs the shipped code) and tailwind-variants. */
export interface TvPaths {
  readonly helper: string;
  /** tailwind-variants' root module file (the evaluator's `cn` / `cx`). */
  readonly tailwindVariants: string;
  /** The id bundles import `cn` / `cx` from: tailwind-variants as resolved from the callee module (its query kept, e.g. ZERO B3's merge-only copy). */
  readonly twImport: string;
}

export type Flavour = "join" | "merge-cx" | "merge";

export type EvalResult =
  | { readonly ok: true; readonly value: Spec }
  | {
      readonly ok: true;
      readonly table: Spec;
      readonly slots: readonly string[] | null;
      readonly meta: Spec;
      readonly flavour: Flavour;
      readonly stats: { readonly combinations: number; readonly form: "separable" | "dense" };
    }
  | { readonly ok: false; readonly reason: string; readonly nondeterministic?: string };

// ---------------------------------------------------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------------------------------------------------

const isPlain = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** Data → `Spec`; `refs(value)` may encode non-data values (resolvers) as references; otherwise `null` = not data. */
export function encode(value: unknown, refs?: (value: unknown) => Spec | null, seen = new Set<object>()): Spec | null {
  switch (typeof value) {
    case "undefined":
      return { "\0": "u" };
    case "boolean":
    case "string":
      return value;
    case "number":
      if (Number.isNaN(value)) return { "\0": "nan" };
      if (Object.is(value, -0)) return { "\0": "-0" };
      if (!Number.isFinite(value)) return { "\0": value > 0 ? "inf" : "-inf" };
      return value;
    case "bigint":
      return { "\0": "big", v: String(value) };
    case "object": {
      if (value === null) return null;
      const ref = refs?.(value);
      if (ref) return ref;
      if (seen.has(value)) return null;
      seen.add(value);
      try {
        if (Array.isArray(value)) {
          const out: Spec[] = [];
          for (let i = 0; i < value.length; i++) {
            if (!(i in value)) return null;
            const item = encode(value[i], refs, seen);
            if (item === null && value[i] !== null) return null;
            out.push(item);
          }
          return out;
        }
        if (!isPlain(value) || Object.getOwnPropertySymbols(value).length) return null;
        const entries: [string, Spec][] = [];
        for (const key of Object.keys(value)) {
          const desc = Object.getOwnPropertyDescriptor(value, key)!;
          if (!("value" in desc)) return null;
          const item = encode(desc.value, refs, seen);
          if (item === null && desc.value !== null) return null;
          entries.push([key, item]);
        }
        return { "\0": "o", e: entries };
      } finally {
        seen.delete(value);
      }
    }
    case "function": {
      const ref = refs?.(value);
      return ref ?? null;
    }
    default:
      return null;
  }
}

/** `Spec` → value; `{"\0": "def" | "call"}` nodes go through `call`. */
export function decode(spec: Spec, call: (recipe: Recipe) => unknown): unknown {
  if (spec === null || typeof spec !== "object") return spec;
  if (Array.isArray(spec)) return spec.map((item) => decode(item, call));
  switch (spec["\0"]) {
    case "u":
      return undefined;
    case "nan":
      return NaN;
    case "-0":
      return -0;
    case "inf":
      return Infinity;
    case "-inf":
      return -Infinity;
    case "big":
      return BigInt(spec.v as string);
    case "o": {
      const out: Record<string, unknown> = {};
      for (const [key, item] of spec.e as [string, Spec][]) out[key] = decode(item, call);
      return out;
    }
    case "def":
    case "call":
      return call(spec.r as Recipe);
    default:
      throw new Error("comptime: unknown spec tag " + String(spec["\0"]));
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Determinism traps (worker only): time, randomness, locale, environment.
// ---------------------------------------------------------------------------------------------------------------------

let armed = 0;
let tripped: string | null = null;
// A read counts when user code made it (a module frame on the stack other than this file): Node's own loader reads the
// environment while importing (type stripping, hooks), which says nothing about the evaluated function.
const SELF = import.meta.url;
const userFrame = (stack: string): boolean =>
  stack
    .split("\n")
    .slice(1)
    .some((line) => /\((?:file:\/\/|\/)|at (?:file:\/\/|\/)/.test(line) && !line.includes(SELF) && !line.includes(fileURLToPath(SELF)));
const trip = (what: string) => {
  if (armed > 0 && tripped === null && userFrame(new Error().stack ?? "")) tripped = what;
};

function installTraps(): void {
  const g = globalThis as Record<string, unknown>;
  const random = Math.random;
  Math.random = () => (trip("Math.random"), random());
  const RealDate = Date;
  g.Date = new Proxy(RealDate, {
    construct(target, args, newTarget) {
      if (args.length === 0) trip("new Date()");
      return Reflect.construct(target, args, newTarget);
    },
    apply(target, self, args) {
      trip("Date()");
      return Reflect.apply(target, self, args);
    },
    get(target, key, receiver) {
      if (key === "now") return () => (trip("Date.now"), RealDate.now());
      return Reflect.get(target, key, receiver);
    },
  });
  const perf = globalThis.performance;
  if (perf) {
    const now = perf.now.bind(perf);
    perf.now = () => (trip("performance.now"), now());
  }
  const crypto = globalThis.crypto as { randomUUID?: () => string; getRandomValues?: <T>(a: T) => T } | undefined;
  if (crypto?.randomUUID) {
    const uuid = crypto.randomUUID.bind(crypto);
    crypto.randomUUID = () => (trip("crypto.randomUUID"), uuid());
  }
  if (crypto?.getRandomValues) {
    const values = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = <T>(a: T) => (trip("crypto.getRandomValues"), values(a));
  }
  const intl = globalThis.Intl as unknown as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(intl)) {
    const ctor = intl[key];
    if (typeof ctor !== "function") continue;
    intl[key] = new Proxy(ctor, {
      construct(target, args, newTarget) {
        trip("Intl." + key);
        return Reflect.construct(target as new (...a: unknown[]) => object, args, newTarget);
      },
      apply(target, self, args) {
        trip("Intl." + key);
        return Reflect.apply(target as (...a: unknown[]) => unknown, self, args);
      },
    });
  }
  const locale = (proto: object, key: string) => {
    const fn = (proto as Record<string, unknown>)[key];
    if (typeof fn !== "function") return;
    Object.defineProperty(proto, key, {
      configurable: true,
      writable: true,
      value: function (this: unknown, ...args: unknown[]) {
        trip(key);
        return (fn as (...a: unknown[]) => unknown).apply(this, args);
      },
    });
  };
  for (const key of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) locale(RealDate.prototype, key);
  for (const key of ["toLocaleString"]) (locale(Number.prototype, key), locale(Array.prototype, key), locale(BigInt.prototype, key));
  for (const key of ["localeCompare", "toLocaleUpperCase", "toLocaleLowerCase"]) locale(String.prototype, key);
  const env = process.env;
  process.env = new Proxy(env, {
    get(target, key) {
      if (typeof key === "string") trip("process.env");
      return Reflect.get(target, key);
    },
    has(target, key) {
      trip("process.env");
      return Reflect.has(target, key);
    },
  });
}

/** Runs `fn` with the traps armed; `tripped` names the first non-deterministic read. */
function guarded<T>(fn: () => T): { value: T; nondeterministic: string | null } {
  armed++;
  const before = tripped;
  tripped = null;
  try {
    const value = fn();
    return { value, nondeterministic: tripped };
  } finally {
    armed--;
    tripped = before;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// tailwind-variants table adapter
// ---------------------------------------------------------------------------------------------------------------------

type Resolver = ((props?: unknown) => unknown) & Record<string, unknown>;
type Helper = typeof import("@rivetjs/runtime/comptime-tv");
type TvTable = import("@rivetjs/runtime/comptime-tv").TvTable;
type ClassFn = (...classes: unknown[]) => unknown;

/** Evaluations the enumeration may spend on one definition (combinations × slots). */
export const TV_BUDGET = 3_000_000;
/** Dense tables hold at most this many cells per slot. */
export const TV_DENSE_CELLS = 4096;
const OTHER = "\0rivet-comptime-other";

const sameValue = (a: unknown, b: unknown) => a === b || (Number.isNaN(a) && Number.isNaN(b));

/** Key `key`'s enumerated values (no NaN; the three sentinels come after them). */
export function tvDomain(resolver: Resolver, key: string): unknown[] {
  const values: unknown[] = [undefined, null, false, true, "", 0, 0n];
  const add = (value: unknown) => {
    if (typeof value === "number" && Number.isNaN(value)) return;
    if (!values.some((have) => sameValue(have, value))) values.push(value);
  };
  const variants = (resolver.variants as Record<string, Record<string, unknown>> | undefined)?.[key];
  for (const name of Object.keys(variants ?? {})) {
    add(name);
    const n = Number(name);
    if (name.trim() !== "" && String(n) === name) add(n);
    if (/^-?\d+$/.test(name) && String(BigInt(name)) === name) add(BigInt(name));
  }
  add((resolver.defaultVariants as Record<string, unknown> | undefined)?.[key]);
  return values;
}

const sentinels = (n: number): unknown[] => [OTHER, {}, NaN].slice(0, n);
/** Token `t` of a key with `values` → a sample value. */
const sampleOf = (values: readonly unknown[], t: number): unknown => (t < values.length ? values[t] : sentinels(3)[t - values.length]);

/** The real resolver's output for `props`: one value per slot (`[value]` without slots). */
function realOutputs(resolver: Resolver, props: Record<string, unknown>, slots: readonly string[] | null, sp?: Record<string, unknown>): unknown[] {
  const result = resolver(props);
  if (!slots) return [result];
  const object = result as Record<string, (p?: unknown) => unknown>;
  return slots.map((slot) => object[slot]!(sp));
}

// tailwind-variants caches results by a props fingerprint in which `0n` and `0` share one entry ("0"), though uncached
// they differ (`0` selects a variant named "0", `0n` the "false" one, `values[key || "false"]`): after a `0` call a warm
// resolver answers `0n` with the `0` result. The table follows the uncached semantics (what a cold resolver computes,
// checked on cold samples): the warm resolver used for the enumeration is asked for `false` in place of `0n`, its
// uncached equivalent.
const canonicalProps = (props: unknown): unknown => {
  if (props === null || typeof props !== "object") return props;
  let out: Record<string, unknown> | null = null;
  for (const key in props as Record<string, unknown>)
    if ((props as Record<string, unknown>)[key] === 0n) (out ??= { ...(props as Record<string, unknown>) })[key] = false;
  return out ?? props;
};
function canonicalResolver(resolver: Resolver): Resolver {
  return ((props?: unknown) => {
    const result = resolver(canonicalProps(props));
    if (result === null || typeof result !== "object") return result;
    const slots: Record<string, (sp?: unknown) => unknown> = {};
    for (const key in result as Record<string, (sp?: unknown) => unknown>) {
      const slot = (result as Record<string, (sp?: unknown) => unknown>)[key]!;
      slots[key] = (sp?: unknown) => slot(canonicalProps(sp));
    }
    return slots;
  }) as Resolver;
}

interface Built {
  table: TvTable;
  slots: string[] | null;
  flavour: Flavour;
  combinations: number;
  form: "separable" | "dense";
}

/**
 * Builds (and proves) the lookup table for a real tailwind-variants resolver. `fresh()` makes another resolver of the same
 * definition (cold caches) for the cache-independence check. Throws with the refusal reason.
 */
export function buildTvTable(resolver: Resolver, fresh: () => Resolver, helper: Helper, tw: { cn: ClassFn; cx: ClassFn }): Built {
  if (typeof resolver !== "function") throw new Error("not a tailwind-variants resolver");
  if ((resolver.compoundVariants as unknown[] | undefined)?.length || (resolver.compoundSlots as unknown[] | undefined)?.length)
    throw new Error("compound variants / slots (not supported by the table adapter)");
  const keys = ((resolver.variantKeys as string[] | undefined) ?? []).slice();
  const domains = keys.map((key) => tvDomain(resolver, key));
  resolver = canonicalResolver(resolver);
  const probe = resolver({});
  let slots: string[] | null = null;
  if (probe !== null && typeof probe === "object") {
    slots = Object.keys(probe);
    for (const slot of slots) if (typeof (probe as Record<string, unknown>)[slot] !== "function") throw new Error("slot " + slot + " is not a function");
  } else if (probe !== undefined && typeof probe !== "string") throw new Error("resolver returned " + typeof probe);
  const nSlots = slots ? slots.length : 1;
  const radix = domains.map((values) => values.length + 3);
  const combinations = radix.reduce((a, b) => a * b, 1);
  if (combinations * nSlots > TV_BUDGET) throw new Error(`${combinations} combinations × ${nSlots} slots over the budget (${TV_BUDGET})`);
  const propsOf = (digits: readonly number[]): Record<string, unknown> => {
    const props: Record<string, unknown> = {};
    for (let i = 0; i < keys.length; i++) props[keys[i]!] = sampleOf(domains[i]!, digits[i]!);
    return props;
  };
  const check = (value: unknown) => {
    if (value !== undefined && typeof value !== "string") throw new Error("a variant output is " + typeof value);
  };
  // Full product (mixed radix), outputs kept per slot.
  const outputs: unknown[][] = slots ? slots.map(() => new Array(combinations)) : [new Array(combinations)];
  const digits = new Array(keys.length).fill(0) as number[];
  for (let at = 0; at < combinations; at++) {
    const values = realOutputs(resolver, propsOf(digits), slots);
    for (let s = 0; s < nSlots; s++) {
      check(values[s]);
      outputs[s]![at] = values[s];
    }
    for (let i = keys.length - 1; i >= 0; i--) {
      if (++digits[i]! < radix[i]!) break;
      digits[i] = 0;
    }
  }
  const indexOf = (d: readonly number[]): number => {
    let at = 0;
    for (let i = 0; i < d.length; i++) at = at * radix[i]! + d[i]!;
    return at;
  };
  const nullIndex = domains.map((values) => values.indexOf(null));
  // Separable: base (every key null) + one piece per key and token (other keys null).
  let table: TvTable | null = null;
  let form: "separable" | "dense" = "separable";
  {
    const base = nullIndex.slice();
    const bases: string[] = [];
    let ok = true;
    for (let s = 0; s < nSlots && ok; s++) {
      const value = outputs[s]![indexOf(base)];
      bases.push(value === undefined ? "" : (value as string));
    }
    const pieces: (string | string[])[][] = keys.map(() => []);
    for (let i = 0; i < keys.length && ok; i++)
      for (let t = 0; t < radix[i]! && ok; t++) {
        const d = nullIndex.slice();
        d[i] = t;
        const per: string[] = [];
        for (let s = 0; s < nSlots; s++) {
          const value = outputs[s]![indexOf(d)];
          const text = value === undefined ? "" : (value as string);
          const b = bases[s]!;
          let piece: string;
          if (text === b) piece = "";
          else if (b === "") piece = text;
          else if (text.startsWith(b + " ")) piece = text.slice(b.length + 1);
          else {
            ok = false;
            break;
          }
          per.push(piece);
        }
        pieces[i]!.push(slots ? per : per[0]!);
      }
    if (ok) {
      const candidate: TvTable = { k: keys, v: domains, ...(slots ? { s: slots } : {}), b: bases, c: pieces };
      ok = verify(candidate);
      if (ok) table = candidate;
    }
  }
  function verify(candidate: TvTable): boolean {
    const d = new Array(keys.length).fill(0) as number[];
    for (let at = 0; at < combinations; at++) {
      const props = propsOf(d);
      for (let s = 0; s < nSlots; s++) if (helper.tvSlot(candidate, props, s) !== outputs[s]![at]) return false;
      for (let i = keys.length - 1; i >= 0; i--) {
        if (++d[i]! < radix[i]!) break;
        d[i] = 0;
      }
    }
    return true;
  }
  if (!table) {
    form = "dense";
    // Token equivalence per key: tokens whose outputs agree for every combination of the other keys share a class.
    const signatures = keys.map((_, i) => new Array<string>(radix[i]!).fill(""));
    {
      const hashes = keys.map((_, i) => Array.from({ length: radix[i]! }, () => [0x811c9dc5, 0x01000193]));
      const d = new Array(keys.length).fill(0) as number[];
      for (let at = 0; at < combinations; at++) {
        let h = 0x9e3779b9;
        for (let s = 0; s < nSlots; s++) {
          const value = outputs[s]![at];
          const text = value === undefined ? "\u0001" : (value as string);
          for (let j = 0; j < text.length; j++) h = Math.imul(h ^ text.charCodeAt(j), 0x01000193) >>> 0;
          h = Math.imul(h ^ 0xff, 0x01000193) >>> 0;
        }
        for (let i = 0; i < keys.length; i++) {
          const pair = hashes[i]![d[i]!]!;
          pair[0] = Math.imul(pair[0]! ^ h, 0x01000193) >>> 0;
          pair[1] = (Math.imul(pair[1]!, 31) + h) >>> 0;
        }
        for (let i = keys.length - 1; i >= 0; i--) {
          if (++d[i]! < radix[i]!) break;
          d[i] = 0;
        }
      }
      for (let i = 0; i < keys.length; i++) for (let t = 0; t < radix[i]!; t++) signatures[i]![t] = hashes[i]![t]!.join(":");
    }
    const classes = signatures.map((row) => {
      const seen = new Map<string, number>();
      return row.map((sig) => {
        let c = seen.get(sig);
        if (c === undefined) seen.set(sig, (c = seen.size));
        return c;
      });
    });
    const counts = classes.map((row) => Math.max(...row) + 1);
    const cells = counts.reduce((a, b) => a * b, 1);
    if (cells > TV_DENSE_CELLS) throw new Error(`dense table of ${cells} cells over the limit (${TV_DENSE_CELLS})`);
    const strides = counts.map((_, i) => counts.slice(i + 1).reduce((a, b) => a * b, 1));
    const e: (string | null)[][] = Array.from({ length: nSlots }, () => new Array<string | null>(cells).fill(null));
    const filled = new Uint8Array(cells);
    const d = new Array(keys.length).fill(0) as number[];
    for (let at = 0; at < combinations; at++) {
      let cell = 0;
      for (let i = 0; i < keys.length; i++) cell += classes[i]![d[i]!]! * strides[i]!;
      if (!filled[cell]) {
        filled[cell] = 1;
        for (let s = 0; s < nSlots; s++) e[s]![cell] = (outputs[s]![at] as string | undefined) ?? null;
      }
      for (let i = keys.length - 1; i >= 0; i--) {
        if (++d[i]! < radix[i]!) break;
        d[i] = 0;
      }
    }
    const candidate: TvTable = { k: keys, v: domains, ...(slots ? { s: slots } : {}), m: classes, w: strides, e };
    if (!verify(candidate)) throw new Error("no table reproduces the definition (dense verification failed)");
    table = candidate;
  }
  const t = table;
  // Random inputs: arbitrary values outside the domain (strings, numbers, bigints, objects, symbols, functions).
  let seed = 0x2545f491;
  const rand = (n: number) => {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    return seed % n;
  };
  const wild = (values: readonly unknown[]): unknown => {
    switch (rand(12)) {
      case 0:
        return "x" + rand(1000);
      case 1:
        return rand(50) - 10;
      case 2:
        return BigInt(rand(20));
      case 3:
        return [rand(3)];
      case 4:
        return Symbol("s");
      case 5:
        return () => 1;
      case 6:
        return -0;
      case 7:
        return Number.NaN;
      case 8:
        return { a: 1 };
      default:
        return values[rand(values.length)];
    }
  };
  const randomProps = (): Record<string, unknown> => {
    const props: Record<string, unknown> = {};
    for (let i = 0; i < keys.length; i++) if (rand(5)) props[keys[i]!] = wild(domains[i]!);
    if (!rand(7)) props.extra = wild(["a"]);
    return props;
  };
  for (let n = 0; n < 3000; n++) {
    const props = randomProps();
    const values = realOutputs(resolver, props, slots);
    for (let s = 0; s < nSlots; s++) if (helper.tvSlot(t, props, s) !== values[s]) throw new Error("random input mismatch: " + describe(props));
  }
  // Cold caches: a fresh resolver per sample agrees.
  for (let n = 0; n < 60; n++) {
    const props = n % 2 ? randomProps() : propsOf(keys.map((_, i) => rand(radix[i]!)));
    const values = realOutputs(fresh(), props, slots);
    for (let s = 0; s < nSlots; s++) if (helper.tvSlot(t, props, s) !== values[s]) throw new Error("cold resolver mismatch: " + describe(props));
  }
  // Slot props overriding variant values (`slotProps[key] ?? props[key]`): every key's token pair, then random mixes.
  if (slots) {
    for (let i = 0; i < keys.length; i++)
      for (let a = 0; a < radix[i]!; a++)
        for (let b = 0; b < radix[i]!; b++) {
          const props = { [keys[i]!]: sampleOf(domains[i]!, a) };
          const sp = { [keys[i]!]: sampleOf(domains[i]!, b) };
          const values = realOutputs(resolver, props, slots, sp);
          for (let s = 0; s < nSlots; s++) if (helper.tvSlot(t, props, s, sp) !== values[s]) throw new Error("slot props mismatch: " + keys[i]);
        }
    for (let n = 0; n < 2000; n++) {
      const props = randomProps();
      const sp = randomProps();
      const values = realOutputs(resolver, props, slots, sp);
      const object = resolver(props) as Record<string, (p?: unknown) => unknown>;
      for (let s = 0; s < nSlots; s++) {
        const real = values[s];
        let hasVariant = false;
        for (const key in sp) if (key !== "class" && key !== "className" && sp[key] !== undefined) hasVariant = true;
        const mine = hasVariant ? helper.tvSlot(t, props, s, sp) : helper.tvSlot(t, props, s);
        if (mine !== real) throw new Error("random slot props mismatch: " + describe(sp));
        void object;
      }
    }
  }
  // Override behaviour: which real library function merges a non-empty `class` / `className` into the core.
  const flavour = detectFlavour(resolver, t, slots, helper, tw, propsOf, radix, rand);
  return { table: t, slots, flavour, combinations, form };
}

const describe = (props: Record<string, unknown>): string =>
  Object.entries(props)
    .map(
      ([key, value]) =>
        key +
        "=" +
        (typeof value === "symbol" ? "symbol" : typeof value === "bigint" ? value + "n" : typeof value === "function" ? "fn" : JSON.stringify(value)),
    )
    .join(",");

/** Override samples: conflicting utilities, whitespace, arrays / objects / numbers, empty values. */
export const OVERRIDE_SAMPLES: readonly unknown[] = [
  "p-2",
  "p-2 p-4",
  "  px-1   py-2 ",
  "text-red-500 text-blue-500",
  "hover:bg-red-500 hover:bg-blue-500 md:p-1 md:p-3",
  "w-96",
  "button button",
  "flex flex-col gap-2 p-4 p-6",
  "rounded-full rounded-lg shadow-md shadow-none",
  ["p-2", "p-4"],
  { "p-2": true, "p-4": false, flex: 1 },
  0,
  1,
  false,
  true,
  null,
  undefined,
  "",
  " ",
];

function detectFlavour(
  resolver: Resolver,
  t: TvTable,
  slots: readonly string[] | null,
  helper: Helper,
  tw: { cn: ClassFn; cx: ClassFn },
  propsOf: (d: readonly number[]) => Record<string, unknown>,
  radix: readonly number[],
  rand: (n: number) => number,
): Flavour {
  const candidates: [Flavour, (core: unknown, a: unknown, b: unknown) => unknown][] = [
    ["join", (core, a, b) => tw.cx(core, a, b)],
    ["merge-cx", (core, a, b) => tw.cn(tw.cx(core, a, b))],
    ["merge", (core, a, b) => tw.cn(core, a, b)],
  ];
  const hasOverride = (p: Record<string, unknown>) => (p.class != null && p.class !== "") || (p.className != null && p.className !== "");
  const cases: { props: Record<string, unknown>; sp?: Record<string, unknown> }[] = [];
  const pairs: [unknown, unknown][] = [];
  for (const a of OVERRIDE_SAMPLES) pairs.push([a, undefined], [undefined, a]);
  for (let n = 0; n < 12; n++) pairs.push([OVERRIDE_SAMPLES[rand(OVERRIDE_SAMPLES.length)], OVERRIDE_SAMPLES[rand(OVERRIDE_SAMPLES.length)]]);
  for (let n = 0; n < 8; n++) {
    const base = propsOf(radix.map((r) => rand(r)));
    for (const [a, b] of pairs) {
      const extra: Record<string, unknown> = {};
      if (a !== undefined || n % 2) extra.class = a;
      if (b !== undefined) extra.className = b;
      if (slots) cases.push({ props: base, sp: n % 3 === 0 ? { ...propsOf(radix.map((r) => rand(r))), ...extra } : extra });
      else cases.push({ props: { ...base, ...extra } });
    }
  }
  for (const [name, merge] of candidates) {
    let ok = true;
    for (const { props, sp } of cases) {
      if (!slots) {
        const real = resolver(props);
        const core = helper.tvSlot(t, props, 0);
        const mine = hasOverride(props) ? merge(core, props.class, props.className) : core;
        if (real !== mine) {
          ok = false;
          break;
        }
        continue;
      }
      const object = resolver(props) as Record<string, (p?: unknown) => unknown>;
      for (let s = 0; s < slots.length && ok; s++) {
        const real = object[slots[s]!]!(sp);
        let core: unknown = helper.tvSlot(t, props, s);
        for (const key in sp) if (key !== "class" && key !== "className" && sp[key] !== undefined) core = helper.tvSlot(t, props, s, sp);
        const mine = sp && hasOverride(sp) ? merge(core, sp.class, sp.className) : core;
        if (real !== mine) ok = false;
      }
      if (!ok) break;
    }
    if (ok) return name;
  }
  throw new Error("no known override behaviour (join / merge) matches the definition's class / className handling");
}

// ---------------------------------------------------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------------------------------------------------

interface Request {
  readonly id: number;
  readonly recipe: Recipe;
  readonly paths?: TvPaths;
}

// Stylesheet imports (a `@rivetjs/ui` definition imports its CSS: VCLS evaluates those definitions) load as empty
// modules: the evaluated code never reads them. `module.registerHooks` (Node ≥ 22.15 / 23.5).
const STYLESHEET = /\.(?:css|scss|sass|less|styl|stylus|pcss|postcss|sss)(?:\?|$)/;
function stubStylesheets(): void {
  const register = (nodeModule as { registerHooks?: (hooks: unknown) => unknown }).registerHooks;
  register?.({
    load(url: string, context: unknown, next: (url: string, context: unknown) => unknown) {
      return STYLESHEET.test(url) ? { format: "module", source: "", shortCircuit: true } : next(url, context);
    },
  });
}

function workerMain(): void {
  stubStylesheets();
  installTraps();
  const modules = new Map<string, Record<string, unknown> | Error>();
  const resolvers = new Map<string, unknown>();
  const recipes = new WeakMap<object, Recipe>();
  const load = async (file: string) => {
    let mod = modules.get(file);
    if (mod === undefined) {
      armed++;
      tripped = null;
      try {
        mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
        if (tripped) mod = new Error(`${file} reads ${tripped} while loading`);
      } catch (error) {
        mod = error instanceof Error ? error : new Error(String(error));
      } finally {
        armed--;
        tripped = null;
      }
      modules.set(file, mod);
    }
    if (mod instanceof Error) throw mod;
    return mod;
  };
  // Every module a recipe (with its nested calls / references) needs, loaded before the synchronous evaluation.
  const preload = async (recipe: Recipe): Promise<void> => {
    await load(recipe.file);
    const walk = async (spec: Spec): Promise<void> => {
      if (spec === null || typeof spec !== "object") return;
      if (Array.isArray(spec)) {
        for (const item of spec) await walk(item);
        return;
      }
      if (spec["\0"] === "o") for (const [, item] of spec.e as [string, Spec][]) await walk(item);
      if (spec["\0"] === "def" || spec["\0"] === "call") await preload(spec.r as Recipe);
    };
    for (const arg of recipe.args) await walk(arg);
  };
  const call = (recipe: Recipe, cached: boolean): unknown => {
    const key = JSON.stringify(recipe);
    if (cached && resolvers.has(key)) return resolvers.get(key);
    const fn = (modules.get(recipe.file) as Record<string, unknown>)[recipe.name];
    if (typeof fn !== "function") throw new Error(`${recipe.file} has no function export ${recipe.name}`);
    const args = recipe.args.map((arg) => decode(arg, (inner) => call(inner, true)));
    const value = (fn as (...a: unknown[]) => unknown)(...args);
    if (cached) resolvers.set(key, value);
    if (value !== null && (typeof value === "object" || typeof value === "function") && !recipes.has(value)) recipes.set(value, recipe);
    return value;
  };
  const refs = (value: unknown): Spec | null => {
    const recipe = value !== null && (typeof value === "object" || typeof value === "function") ? recipes.get(value) : undefined;
    return recipe ? { "\0": "def", r: recipe } : null;
  };
  parentPort!.on("message", async ({ id, recipe, paths }: Request) => {
    let result: EvalResult;
    try {
      await preload(recipe);
      if (recipe.adapter === "value") {
        const first = guarded(() => call(recipe, false));
        const second = guarded(() => call(recipe, false));
        const nondet = first.nondeterministic ?? second.nondeterministic;
        const encoded = encode(first.value);
        if (nondet) result = { ok: false, reason: "reads " + nondet, nondeterministic: nondet };
        else if (encoded === null && first.value !== null) result = { ok: false, reason: "the result is not data" };
        else if (JSON.stringify(encoded) !== JSON.stringify(encode(second.value)))
          result = { ok: false, reason: "two evaluations differ", nondeterministic: "result" };
        else result = { ok: true, value: encoded };
      } else {
        if (!paths) throw new Error("tv adapter without paths");
        const helper = (await import(pathToFileURL(paths.helper).href)) as Helper;
        const full = (await import(pathToFileURL(paths.tailwindVariants).href)) as { cn: ClassFn; cx: ClassFn };
        const made = guarded(() => {
          const resolver = call(recipe, true) as Resolver;
          const built = buildTvTable(resolver, () => call(recipe, false) as Resolver, helper, { cn: full.cn, cx: full.cx });
          const meta: Record<string, unknown> = {};
          for (const key of ["variantKeys", "extend", "base", "slots", "variants", "defaultVariants", "compoundSlots", "compoundVariants"])
            if (key in resolver) meta[key] = resolver[key];
          return { built, meta };
        });
        if (made.nondeterministic) result = { ok: false, reason: "reads " + made.nondeterministic, nondeterministic: made.nondeterministic };
        else {
          const { built, meta } = made.value;
          const table = encode(built.table);
          const encodedMeta = encode(meta, refs);
          if (table === null || encodedMeta === null) result = { ok: false, reason: "the definition's metadata is not data" };
          else
            result = {
              ok: true,
              table,
              slots: built.slots,
              meta: encodedMeta,
              flavour: built.flavour,
              stats: { combinations: built.combinations, form: built.form },
            };
        }
      }
    } catch (error) {
      result = { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
    parentPort!.postMessage({ id, result });
  });
}

if (!isMainThread && (workerData as { rivetComptime?: boolean } | null)?.rivetComptime) workerMain();

/** Main thread: a lazily started evaluation worker. `close()` ends it (the build's end). */
export function evaluator(): { evaluate(recipe: Recipe, paths?: TvPaths): Promise<EvalResult>; close(): Promise<void> } {
  let worker: Worker | null = null;
  let next = 0;
  const pending = new Map<number, (result: EvalResult) => void>();
  const start = (): Worker => {
    const w = new Worker(new URL(import.meta.url), { workerData: { rivetComptime: true } });
    w.unref();
    w.on("message", ({ id, result }: { id: number; result: EvalResult }) => {
      pending.get(id)?.(result);
      pending.delete(id);
    });
    w.on("error", (error) => {
      for (const done of pending.values()) done({ ok: false, reason: "evaluation worker failed: " + (error instanceof Error ? error.message : String(error)) });
      pending.clear();
      worker = null;
    });
    return w;
  };
  return {
    evaluate(recipe, paths) {
      worker ??= start();
      const id = next++;
      return new Promise((done) => {
        pending.set(id, done);
        worker!.postMessage({ id, recipe, paths } satisfies Request);
      });
    },
    async close() {
      const w = worker;
      worker = null;
      if (w) await w.terminate();
    },
  };
}
