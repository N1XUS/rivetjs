// mergeProps / chain / mergeRefs — THE prop-merging helpers of the package (`@rivetjs/cdk/utils`
// re-exports them). Ported from @react-aria/utils mergeProps, chain, mergeRefs (react-spectrum),
// Apache-2.0, © Adobe.
//
// Rules (react-aria): later keys win; `on[A-Z]*` handlers chain (earlier first); `class` /
// `className` / `UNSAFE_className` concatenate; `id`s merge with `mergeIds`; `ref`s merge with
// `mergeRefs`; `undefined` never overrides.
// Rivet: a `.tsx` module compiled for resume (R2), so the chained handlers / merged refs it returns
// are resumable symbols — a merged bag of resumable handlers stays resumable when spread on a native
// element. Deviation: class values may be accessors (signals); an accessor on either side yields an accessor.
// Live props (P5, docs/design/specs/2026-10-07-live-props-design.md §8): a source with an own getter (a live prop)
// is merged without reading it — the result is a runtime `mergeProps` object (same "later defined value wins"
// rule, getters forwarded unread) over the sources plus one bag of the keys that combine: handlers of a live key
// chain at call time, live classes join in an accessor (render-prop values passed through). `id` / `ref` with two
// holders are read once (identity props). Sources without getters take the copy path below unchanged.
import { mergeProps as mergeLive } from "@rivetjs/runtime/props";
import { mergeIds } from "../utils/id.ts";
import { hasLive } from "../utils/live.tsx";

type Bag = Record<string, any>;
type Fn = (...args: unknown[]) => unknown;
type PropsArg = Bag | null | undefined;
type TupleTypes<T> = { [P in keyof T]: T[P] } extends { [key: number]: infer V } ? (V extends null | undefined ? {} : V) : never;
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/** A Rivet / React ref: `ref()` signal object, callback (may return a cleanup) or `{ current }` object. */
export type RefLike<T> = ((value: T | null) => void | (() => void)) | { current: T | null } | null | undefined;

/** Call `a`, then `b` (either may be missing). The returned function is a resumable symbol. */
export function chain2(a: Fn | null | undefined, b: Fn | null | undefined): Fn {
  return (...args: unknown[]) => {
    if (typeof a === "function") a(...args);
    if (typeof b === "function") return b(...args);
  };
}

/** Calls all functions in the order they were chained with the same arguments (non-functions skipped; react-aria `chain`). */
export function chain(...callbacks: unknown[]): (...args: any[]) => void {
  let out: Fn | null = null;
  for (const callback of callbacks) if (typeof callback === "function") out = out ? chain2(out, callback as Fn) : (callback as Fn);
  return out ?? noop();
}

function noop(): Fn {
  return () => undefined;
}

const text = (v: unknown): string => (v == null || v === "" ? "" : String(v));

function joinText(a: unknown, b: unknown): unknown {
  if (typeof a === "function" || typeof b === "function") return joined(a, b);
  return [a, b].filter((v) => v != null && v !== "").join(" ");
}

function joined(a: unknown, b: unknown): () => string {
  return () =>
    [typeof a === "function" ? (a as () => unknown)() : a, typeof b === "function" ? (b as () => unknown)() : b].filter((v) => text(v) !== "").join(" ");
}

function setRef<T>(ref: RefLike<T>, value: T | null): void | (() => void) {
  // A Rivet `ref()` object is a signal: set it (calling it would only read it).
  const signalRef = ref as { set?: (value: T | undefined) => unknown } | null | undefined;
  if (typeof ref === "function" && typeof signalRef!.set === "function") {
    signalRef!.set!(value ?? undefined);
    return;
  }
  if (typeof ref === "function") return ref(value);
  if (ref != null) ref.current = value;
}

/** Merges refs (callback or `{ current }` objects) into one callback ref; cleanups are chained. */
export function mergeRefs<T>(...refs: RefLike<T>[]): RefLike<T> {
  if (refs.length === 1 && refs[0]) return refs[0];
  return (value: T | null) => {
    // One loop; the cleanups array exists only once a ref returns a cleanup (most refs return none).
    let cleanups: (() => void)[] | undefined;
    for (let i = 0; i < refs.length; i++) {
      const cleanup = setRef(refs[i], value);
      if (typeof cleanup === "function") (cleanups ??= [])[i] = cleanup;
    }
    if (cleanups) {
      const done = cleanups;
      return () => {
        for (let i = 0; i < refs.length; i++) {
          const cleanup = done[i];
          if (typeof cleanup === "function") cleanup();
          else setRef(refs[i], null);
        }
      };
    }
  };
}

/**
 * Merges props objects (react-aria `mergeProps`): `on[A-Z]*` handlers are chained, `class` /
 * `className` strings joined, `id`s merged with `mergeIds`, `ref`s merged with `mergeRefs`; any other
 * key: the last defined value wins.
 */
export function mergeProps<T extends PropsArg[]>(...args: T): UnionToIntersection<TupleTypes<T>> {
  for (let i = 0; i < args.length; i++) if (hasLive(args[i])) return live(args) as UnionToIntersection<TupleTypes<T>>;
  return mergeCopy(args) as UnionToIntersection<TupleTypes<T>>;
}

/**
 * The copy path of `mergeProps` for sources known to hold no getter (cdk `contextProps` after its own `hasLive`
 * checks): no per-key descriptor scan. `intoFirst`: `args[0]` is a fresh bag the caller owns and reads no more —
 * merged into in place (no copy of it).
 * @internal cdk parts
 */
export function mergeCopy(args: readonly PropsArg[], intoFirst = false): Bag {
  const out: Bag = intoFirst ? args[0]! : { ...args[0] };
  for (let i = 1; i < args.length; i++) {
    const bag = args[i];
    if (!bag) continue;
    for (const key in bag) {
      const a = out[key],
        b = bag[key];
      if (typeof a === "function" && typeof b === "function" && key[0] === "o" && key[1] === "n" && key.charCodeAt(2) >= 65 && key.charCodeAt(2) <= 90)
        out[key] = chain2(a as Fn, b as Fn);
      else if ((key === "class" || key === "className" || key === "UNSAFE_className") && a != null && b != null) out[key] = joinText(a, b);
      else if (key === "id" && a && b) out.id = mergeIds(a, b);
      else if (key === "ref" && a && b) out.ref = mergeRefs(a, b);
      else out[key] = b !== undefined ? b : a;
    }
  }
  return out;
}

/**
 * `mergeProps(first, ...rest)` merged into `first` itself (no copy of it): `first` must be a fresh bag the caller owns
 * and reads no more (a `liveOmit` / `globalDOMProps` result). Same result as `mergeProps`: a getter in any source (a
 * live `first`: a forwarding part) takes the live path, which leaves `first` untouched.
 * @internal cdk parts
 */
export function mergeInto(first: Bag, ...rest: PropsArg[]): Bag {
  if (hasLive(first)) return mergeProps(first, ...rest);
  return mergeOwned(first, rest) ?? mergeProps(first, ...rest);
}

/**
 * `mergeProps(literal, ...rest)` for an RA bag `literal` written in place (data only by construction: not scanned,
 * merged into), then `definedProps` on the static path. A getter in `rest` takes the live `mergeProps` path (all keys).
 * @internal cdk parts
 */
export function mergeDefined(literal: Bag, ...rest: PropsArg[]): Bag {
  const out = mergeOwned(literal, rest);
  return out ? definedProps(out) : mergeProps(literal, ...rest);
}

// The copy path into `first` when no bag of `rest` holds a getter, else null.
function mergeOwned(first: Bag, rest: PropsArg[]): Bag | null {
  for (let i = 0; i < rest.length; i++) if (hasLive(rest[i])) return null;
  rest.unshift(first);
  return mergeCopy(rest, true);
}

/**
 * A fresh copy of `bag` without its `undefined` entries (key order kept): for a data-only RA prop bag (no
 * getters — they would be read) that is merged / spread next. RA bags list every optional attribute (`aria-*`, `name`,
 * `form`, …), mostly unset; `undefined` never overrides in `mergeProps` and an unset spread key writes nothing, so the
 * element gets the same attributes while every later copy / merge / spread walks only the set keys.
 * @internal cdk parts
 */
export function definedProps(bag: Bag): Bag {
  const out: Bag = {};
  for (const key in bag) {
    const value = bag[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

const isHandler = (key: string): boolean => key[0] === "o" && key[1] === "n" && key.charCodeAt(2) >= 65 && key.charCodeAt(2) <= 90;
const isClass = (key: string): boolean => key === "class" || key === "className" || key === "UNSAFE_className";

// Live merge: runtime `mergeProps(...sources, combined)` — `combined` holds the keys two or more sources combine
// (handlers, classes, id, ref); every other key forwards to its last defined source (getters unread).
function live(args: PropsArg[]): Bag {
  const sources: Bag[] = [];
  for (const bag of args) if (bag) sources.push(bag);
  const combined: Bag = {};
  for (let s = 0; s < sources.length; s++) {
    const source = sources[s]!;
    for (const key of Object.keys(source)) {
      // Category once per key; a key is handled at its first holder (no `seen` set, no `filter` copy per key).
      const handler = isHandler(key),
        cls = !handler && isClass(key);
      if (!(handler || cls || key === "id" || key === "ref")) continue;
      let earlier = false;
      for (let j = 0; j < s; j++)
        if (Object.hasOwn(sources[j]!, key)) {
          earlier = true;
          break;
        }
      if (earlier) continue;
      let holders: Bag[] | undefined;
      for (let j = s + 1; j < sources.length; j++) if (Object.hasOwn(sources[j]!, key)) (holders ??= [source]).push(sources[j]!);
      if (holders === undefined) continue;
      let anyLive = false;
      for (let j = 0; j < holders.length; j++)
        if (Object.getOwnPropertyDescriptor(holders[j]!, key)!.get !== undefined) {
          anyLive = true;
          break;
        }
      if (handler && anyLive) combined[key] = liveChain(holders, key);
      else if (cls && anyLive) combined[key] = liveClass(holders, key);
      else {
        // Data holders (or id / ref): fold with the copy-path rules, reading each value once.
        let a: unknown = holders[0]![key];
        for (let i = 1; i < holders.length; i++) {
          const b = holders[i]![key];
          if (handler && typeof a === "function" && typeof b === "function") a = chain2(a as Fn, b as Fn);
          else if (cls && a != null && b != null) a = joinText(a, b);
          else if (key === "id" && a && b) a = mergeIds(a as string, b as string);
          else if (key === "ref" && a && b) a = mergeRefs(a as RefLike<unknown>, b as RefLike<unknown>);
          else a = b !== undefined ? b : a;
        }
        if (a !== undefined) combined[key] = a;
      }
    }
  }
  return mergeLive(...sources, combined) as Bag;
}

/** Handlers of a live key: every holder's current function, in source order, at call time. */
function liveChain(holders: Bag[], key: string): Fn {
  return (...args: unknown[]) => {
    let result: unknown;
    for (const holder of holders) {
      const f = holder[key];
      if (typeof f === "function") result = (f as Fn)(...args);
    }
    return result;
  };
}

/** Classes of a live key, joined at read time (an accessor; render-prop class functions get the render props). */
function liveClass(holders: Bag[], key: string): (renderProps?: unknown) => string {
  return (renderProps?: unknown) => {
    let out = "";
    for (const holder of holders) {
      const v = holder[key];
      const t = text(typeof v === "function" ? (v as Fn)(renderProps) : v);
      if (t !== "") out = out === "" ? t : out + " " + t;
    }
    return out;
  };
}
