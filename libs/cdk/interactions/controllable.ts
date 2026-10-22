// Ported from react-stately `useControlledState` (packages/react-stately/src/utils/useControlledState.ts),
// Apache-2.0, © Adobe.
// Controlled / uncontrolled component values with RAC prop names (`value` / `defaultValue` / `onChange`,
// `isOpen` / `defaultOpen` / `onOpenChange`, …).
// Rivet:
// - `value` is a plain value OR a `Signal` (decision 2). A Signal is two-way: setting writes it (the
//   caller's state IS the signal) and calls `onChange`. A plain value is controlled as upstream: setting
//   only calls `onChange`; the shown value changes when the caller re-renders with a new `value` (a prop
//   reading a signal re-creates the component).
// - a plain function (no `.set`) is an accessor (accessor rule): controlled, read live (`state.value()` tracks
//   it), never written — setting only calls `onChange`; the caller's state moves the value. Ambiguity: when `T`
//   itself is a function type, pass it wrapped (`value={() => fn}`) or as a Signal.
// - state = plain data (signals + JSON + the caller's `onChange`), so it serializes on resumed pages;
//   setters are free functions (`setControlledValue`). The uncontrolled signal is region state
//   (`_regionState`): a re-created region keeps it.
// - upstream `valueRef` (the latest value set during the current render, so several setState calls in one
//   event chain) = `pending`, reset after the current task (microtask) instead of after the next render.
// - controlled ⇄ uncontrolled switches cannot happen (a changed prop re-creates the component), so the
//   upstream switch warning has no trigger; instead DEV warns once for a plain controlled `value` without
//   `onChange` (read-only, like React's `<input value>` warning).
import { signal, _regionState, type Signal } from "@rivetjs/reactivity";
import { DEV, devWhere } from "#dev";

/** Controlled state of one value (serializable: signals + plain data + the caller's `onChange`). */
export interface ControlledState<T, C = T> {
  /**
   * The shown value (read `state.value()` in bindings). Do not `.set` it: use `setControlledValue`. For an
   * accessor `value` (`isAccessor`) it IS the caller's read-only accessor (typed `Signal` for compatibility; no
   * `set` / `update` — read it untracked with `untrack(state.value)`).
   */
  readonly value: Signal<T>;
  /** Whether the caller controls the value (passed `value`, plain or Signal). */
  readonly isControlled: boolean;
  /** Whether the caller passed a Signal (two-way). */
  readonly isSignal: boolean;
  /** Whether the caller passed a plain function (read-only accessor: controlled, never written). */
  readonly isAccessor: boolean;
  /** The caller's change handler. */
  readonly onChange: ((value: C, ...args: any[]) => void) | undefined;
  /** @internal upstream `valueRef`: the latest value set in the current task (`has` false: none). */
  readonly pending: { has: boolean; v: T | undefined };
}

const isSignal = <T>(v: unknown): v is Signal<T> => typeof v === "function" && typeof (v as Signal<T>).set === "function";
const isDev = (): boolean => (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NODE_ENV === "development";

/**
 * @deprecated Two-argument form (two-way Signal or region signal, no `onChange`): kept until the
 * `state/*` factories move to the three-argument form. Returns the signal itself.
 */
export function controllable<T>(value: Signal<T> | undefined, defaultValue: T): Signal<T>;
/**
 * react-stately `useControlledState`: `value` (plain, Signal or accessor `() => T`) controls, else an internal
 * signal starting at `defaultValue`. Read `state.value()`; change with `setControlledValue(state, next)`.
 * When `T` is itself a function type, wrap a plain value: `() => fn`.
 */
export function controllable<T, C = T>(
  value: T | Signal<T> | (() => T) | undefined,
  defaultValue: T,
  onChange: ((value: C, ...args: any[]) => void) | undefined,
): ControlledState<T, C>;
export function controllable<T, C = T>(
  value: T | Signal<T> | (() => T) | undefined,
  defaultValue: T,
  onChange?: ((value: C, ...args: any[]) => void) | undefined,
): Signal<T> | ControlledState<T, C> {
  // eslint-disable-next-line prefer-rest-params
  if (arguments.length < 3) return (value as Signal<T> | undefined) ?? _regionState(() => signal(defaultValue));
  const isControlled = value !== undefined;
  const sig = isSignal<T>(value);
  const accessor = !sig && typeof value === "function";
  if (DEV && isControlled && !sig && !onChange && isDev())
    console.warn(
      "[rivet:cdk] controllable: A component has a controlled value but no onChange handler; it is read-only. Pass a Signal or an onChange handler." +
        devWhere(),
    );
  return {
    // Upstream: `useState(value || defaultValue)` — a falsy controlled value still shows (controlled wins).
    value: sig || accessor ? (value as Signal<T>) : isControlled ? constantCell(value as T) : _regionState(() => signal(defaultValue)),
    isControlled,
    isSignal: sig,
    isAccessor: accessor,
    onChange,
    pending: { has: false, v: undefined },
  };
}

/** The server encoder's constant-getter brand (`server-structural.ts` `CONSTANT`): resumes as `{ k: "const" }`. */
const CONSTANT = Symbol.for("rivet.constant");

/**
 * A plain controlled value never changes in place (`setControlledValue` only calls `onChange`): a constant getter, no
 * reactive source in either environment. Typed as a Signal for the `ControlledState.value` shape; it has no `set`.
 */
export function constantCell<T>(value: T): Signal<T> {
  const get = (() => value) as Signal<T> & { [CONSTANT]?: T };
  get[CONSTANT] = value;
  return get;
}

/** The current value, including a value set earlier in the same task (upstream `valueRef.current`). */
export function controlledValue<T>(state: ControlledState<T, any>): T {
  return state.pending.has ? (state.pending.v as T) : state.value();
}

/**
 * upstream `setValue`: `next` (or `next(previous)`) differing (`Object.is`) from the latest value updates
 * an uncontrolled / Signal value and calls `onChange(next, ...args)`; a plain or accessor controlled value
 * only calls `onChange`. Several calls in one task chain on each other's result.
 */
export function setControlledValue<T>(state: ControlledState<T, any>, next: T | ((previous: T) => T), ...args: any[]): void {
  const previous = controlledValue(state);
  const value = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
  if (Object.is(previous, value)) return;
  const pending = state.pending;
  if (!pending.has) queueMicrotask(() => ((pending.has = false), (pending.v = undefined)));
  pending.has = true;
  pending.v = value;
  if (!state.isControlled || state.isSignal) state.value.set(value);
  state.onChange?.(value, ...args);
}
