// Rivet-only (no React Aria counterpart): live component props in the cdk (live props P5,
// docs/design/specs/2026-10-07-live-props-design.md §8). The compiler passes a prop whose value reads state as an own
// getter (`<Button aria-pressed={on()}>` → `{ get "aria-pressed"() { return on(); } }`); a static prop is a data
// property. A cdk part runs once, so it must not copy a getter's value at creation: these helpers keep getters
// unread (runtime `splitProps` forwards) and read them where React re-renders — inside bindings and at event time.
// Static props (no getter, every server render) take the copy path: same objects, same cost as before.
// A `.tsx` module (resume-compiled): the accessor `liveAt` returns is a resumable symbol over its narrow view.
import { untrack } from "@rivetjs/reactivity";
import { mergeProps as mergeLive, splitProps } from "@rivetjs/runtime/props";

type Bag = Record<PropertyKey, unknown>;

/** Whether `object[key]` is an own getter (a live prop; a proxied spread source reports getters too). */
export function isLive(object: object | null | undefined, key: PropertyKey): boolean {
  return !!object && Object.getOwnPropertyDescriptor(object, key)?.get !== undefined;
}

/** Whether any own enumerable key of `object` is a getter (live props present). */
export function hasLive(object: object | null | undefined): boolean {
  if (!object) return false;
  const keys = Object.keys(object);
  for (let i = 0; i < keys.length; i++) if (Object.getOwnPropertyDescriptor(object, keys[i]!)?.get !== undefined) return true;
  return false;
}

/**
 * A narrow view of `props` for the `keys` a part reads in bindings / handlers: a plain object of the present values
 * when none of them is live (static path: a small data copy, serializes like locals), else a `splitProps` part that
 * forwards every key to `props` unread (live path; on a resumed page it encodes as forwards, not values). Read
 * `view.key` inside the binding.
 */
export function liveView<T extends object, const K extends readonly (keyof T)[]>(props: T, keys: K): Pick<T, K[number]> {
  const out: Bag = {};
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const desc = Object.getOwnPropertyDescriptor(props, key);
    if (desc === undefined) continue;
    if (desc.get !== undefined) return splitProps(props as Bag, keys as never)[0] as never;
    out[key] = desc.value;
  }
  return out as never;
}

/**
 * A `MaybeAccessor` slot from a prop (cdk state factories / behaviour options read `read(v)` at use time): an
 * accessor `() => read(view[key])` when `view[key]` is live, else the value itself (static path unchanged). Pass a
 * `liveView` (narrow), not the whole props object: the accessor captures it.
 */
export function liveAt<T extends object, K extends keyof T>(view: T, key: K): T[K] | (() => Unwrap<T[K]>) {
  if (Object.getOwnPropertyDescriptor(view, key)?.get === undefined) return view[key];
  return () => {
    const value = view[key];
    return (typeof value === "function" ? (value as () => unknown)() : value) as Unwrap<T[K]>;
  };
}

/**
 * A string `class` attribute of a live `class` prop (parts that take a plain `class`, not a render-prop one): an
 * accessor over a narrow view (a function `class` is called), default `defaultClassName`. Goes into the element's
 * spread bag (a function attribute value outside a spread is not a server binding).
 */
export function liveClass(props: object, defaultClassName: string): () => string {
  const view = liveView(props as Bag, ["class"]);
  return () => {
    const value = view.class;
    return ((typeof value === "function" ? (value as () => unknown)() : value) as string | undefined) ?? defaultClassName;
  };
}

const isSignal = (v: unknown): boolean => typeof v === "function" && typeof (v as { set?: unknown }).set === "function";

type Unwrap<V> = V extends () => infer R ? R : V;

/**
 * The accessor boundary of a part (cdk accessor rule: state-like props are `T | (() => T)`, read with `read(v)` in
 * bindings / at event time): every live key of `keys` becomes an accessor data value (`liveAt`), so the part's
 * copies (`{ ...props }`, destructures, state factories, behaviour bags) carry the accessor instead of a snapshot.
 * `controlled` keys (a controlled value: `isSelected`, `value`, `isOpen`, …) become accessors only when defined at
 * creation — an `undefined` one stays uncontrolled (React: switching between controlled and uncontrolled is
 * unsupported); a controlled key holding a two-way Signal passes the Signal itself (stays two-way). Other keys forward unread. No live key → `props` itself (static path, 0 cost).
 */
export function liveOptions<T extends object>(props: T, keys: readonly (keyof T)[], controlled: readonly (keyof T)[] = []): T {
  let over: Bag | undefined;
  let view: T | undefined;
  // `keys` then `controlled` by index: the joined list is built only for the live view (static path: no array).
  const n = keys.length,
    total = n + controlled.length;
  for (let i = 0; i < total; i++) {
    const key = i < n ? keys[i]! : controlled[i - n]!;
    if (!isLive(props, key)) continue;
    if (i >= n) {
      const now = untrack(() => props[key]);
      if (now === undefined) continue;
      // A forwarded two-way Signal (`isSelected={sig}` through a wrapper's getter) stays two-way: pass the Signal itself.
      if (isSignal(now)) {
        (over ??= {})[key] = now;
        continue;
      }
    }
    view ??= splitProps(props as Bag, (controlled.length ? [...keys, ...controlled] : keys) as never)[0] as T;
    (over ??= {})[key] = liveAt(view, key);
  }
  return over ? (mergeLive(props, over) as T) : props;
}

/**
 * A controlled collection-selection prop (`selectedKeys` / `expandedKeys`: `"all"` or an iterable of keys) for a
 * selection state: when live and defined at creation, an accessor that reads it and normalises it to a `Set` (or
 * `"all"`) — the state treats a plain function as a controlled, never-written value; a forwarded two-way Signal, an
 * `undefined` (uncontrolled) or a static value is returned as is (static path unchanged).
 */
export function liveKeys<T extends object, K extends keyof T>(props: T, key: K): T[K] {
  if (!isLive(props, key)) return props[key];
  const now = untrack(() => props[key]);
  if (now == null || isSignal(now)) return now;
  const view = splitProps(props as Bag, [key] as never)[0] as T;
  return (() => {
    const value = view[key] as unknown;
    return value === "all" || value instanceof Set ? value : new Set(value as Iterable<unknown>);
  }) as T[K];
}

/**
 * `props` without `keys` (a rest destructure `const { a, ...rest } = props`, which reads every getter): a `splitProps`
 * rest part when a prop is live (forwarding unread), else a plain copy (static path).
 */
export function liveOmit<T extends object, const K extends readonly (keyof T)[]>(props: T, keys: K): Omit<T, K[number]> {
  if (hasLive(props)) return splitProps(props as Bag, keys as never)[1] as never;
  const out: Bag = {};
  for (const key in props) if (!keys.includes(key as keyof T)) out[key] = props[key];
  return out as never;
}

/** `removeDataAttributes` (RAC) for live props: the `data-*` keys split off unread when a prop is live. */
export function liveWithoutData<T extends object>(props: T): T {
  if (hasLive(props)) {
    const data: string[] = [];
    for (const key in props) if (key.startsWith("data-")) data.push(key);
    return splitProps(props as Bag, data as never)[1] as T;
  }
  // Static path: stop at the first `data-*` key (no key list).
  let found = false;
  for (const key in props)
    if (key.startsWith("data-")) {
      found = true;
      break;
    }
  if (!found) return { ...props };
  const out: Bag = {};
  for (const key in props) if (!key.startsWith("data-")) out[key] = props[key];
  return out as T;
}

/** The current values of `keys`, read untracked (read-once props in a part body: no region dependency on a resumed page). */
export function readOnce<T extends object, const K extends readonly (keyof T)[]>(props: T, keys: K): Pick<T, K[number]> {
  return untrack(() => {
    const out: Bag = {};
    for (const key of keys) out[key] = props[key];
    return out as Pick<T, K[number]>;
  });
}

/** `{ ...base, ...extra }` without reading `base`'s getters when a prop is live (runtime `mergeProps`: a defined `extra`
 *  value wins), else the plain spread (static path). */
export function liveAssign<T extends object, U extends object>(base: T, extra: U): T & U {
  return (hasLive(base) ? mergeLive(base, extra) : { ...base, ...extra }) as T & U;
}
