// Development façade of `@rivetjs/reactivity` (`development` export condition: Vite dev, development
// builds, `node --conditions=development`). Production resolution never reaches this file. Exports the
// same primitives as index.ts; with a devtools hook installed (`globalThis[Symbol.for("rivet.devtools")]`)
// creation, writes and runs are reported to it. No extra observers are ever added, so laziness and flush
// order are unchanged; without a hook every export behaves exactly like index.ts.
import * as base from "./index.ts";
import { _debug, devtoolsHook, type DevtoolsHook } from "./debug.ts";
import type { NotAsync, Context, Disposer, EqualsOptions, Signal } from "./index.ts";
export * from "./index.ts";

// Where a dev warning was triggered: `globalThis[Symbol.for("rivet.locate")]` (runtime dev/where.ts in the browser: the
// component chain; the compiler's Vite plugin on the dev server: app stack frames) → an indented line, or "".
const LOCATE = Symbol.for("rivet.locate");
function where(): string {
  const locate = (globalThis as { [LOCATE]?: () => string })[LOCATE];
  try {
    const text = typeof locate === "function" ? locate() : "";
    return text ? "\n  " + text : "";
  } catch {
    return "";
  }
}

// The devtools agent walks this copy's graph (it never imports framework code itself).
const installed = devtoolsHook();
if (installed !== undefined) installed.debug = _debug;

// Debug overrides (agent with `edit`): a computed reads its own pin signal (an internal source, created
// with it), so pinning re-evaluates it and its consumers see the pinned value until the pin is reset.
const pins = new WeakMap<object, Signal<{ value: unknown } | null>>();
// A unique value no `equals` treats as equal to app values (in-place mutation re-notify).
const NOTIFY: unknown = Object.freeze({ notify: Symbol("rivet.devtools.notify") });
if (installed !== undefined && installed.edit) {
  const table = (installed.pins ??= {});
  table.computed = (node, pin) => {
    const own = pins.get(node);
    if (!own) return false;
    own.set(pin);
    return true;
  };
  table.computedPin = (node) => {
    const own = pins.get(node);
    return own ? (base._inspect(own) as { value: { value: unknown } | null }).value : undefined;
  };
  // Mutated in place: set a value no equality skips, then the (same) value back, in one batch: its
  // observers run once, with the mutated value.
  table.notify = (getter) => {
    const info = base._inspect(getter);
    if (info?.kind !== "signal") return false;
    const value = info.value;
    base.batch(() => {
      getter.set(NOTIFY);
      getter.set(value);
    });
    return info.equals === Object.is || info.equals === null;
  };
}

// A flush with several failures rethrows the first; development reports one AggregateError listing all.
base._flush.report = (errors) => {
  if (errors.length < 2) return;
  const lines = errors.map((error, i) => `  ${i + 1}. ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  const aggregate = new AggregateError(errors, `${errors.length} errors in one flush, run or dispose (the first is rethrown):\n${lines.join("\n")}`);
  if (typeof reportError === "function") reportError(aggregate);
  else console.error(aggregate);
};

/** A creation stack (formatted only when the devtools reads it), deep enough to pass framework frames. */
function stack(hook: DevtoolsHook): { stack?: Error } {
  if (!hook.stacks) return {};
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 30;
  const error = new Error("created");
  Error.stackTraceLimit = limit;
  return { stack: error };
}

// Runs report `node.run` while recording; the node is the current owner during its own run, and
// `hook.current` names it meanwhile (performance attribution: layout reads inside framework runs).
function timed<T>(hook: DevtoolsHook, fn: () => T): () => T {
  return () => {
    if (hook.level < 2) return fn();
    const node = base.getOwner(),
      start = performance.now(),
      outer = hook.current;
    hook.current = node;
    let error: unknown,
      failed = false;
    try {
      return fn();
    } catch (cause) {
      failed = true;
      error = cause;
      throw cause;
    } finally {
      hook.current = outer;
      hook.emit("node.run", { node, ms: performance.now() - start, ...(failed ? { error } : {}) });
    }
  };
}

// Unbound `set` / `update` (`const { set } = count; set(1)`) fail in production with an opaque
// TypeError (`this` is undefined); development fails the same way, with a readable message. The
// checked methods are shared (no per-signal closures) and installed on every development signal.
const probe = base.signal<unknown>(0),
  baseSet = probe.set,
  baseUpdate = probe.update;
function unbound(method: "set" | "update", self: unknown): TypeError {
  return new TypeError(
    `Rivet: signal.${method}() was called without its signal (this = ${self === undefined ? "undefined" : typeof self}). ` +
      `set/update are methods: call count.${method}(…), or pass (v) => count.${method}(v) / count.${method}.bind(count).`,
  );
}
const isSignal = (self: unknown): boolean => base._inspect(self)?.kind === "signal";
function checkedSet<T>(this: Signal<T>, value: T): T {
  if (!isSignal(this)) throw unbound("set", this);
  return baseSet.call(this as Signal<unknown>, value) as T;
}
function checkedUpdate<T>(this: Signal<T>, fn: (value: T) => T): T {
  if (!isSignal(this)) throw unbound("update", this);
  return baseUpdate.call(this as Signal<unknown>, fn as (value: unknown) => unknown) as T;
}

/** `signal`, reporting creation (level 1) and writes (level 2; `update` writes through `set`). */
export function signal<T>(): Signal<T | undefined>;
export function signal(initial: [], options?: EqualsOptions<unknown[]>): Signal<unknown[]>;
export function signal<T>(initial: T, options?: EqualsOptions<T>): Signal<T>;
export function signal<T>(initial?: T, options?: EqualsOptions<T>): Signal<T> {
  const created = base.signal(initial as T, options) as Signal<T>;
  created.set = checkedSet;
  created.update = checkedUpdate;
  const hook = devtoolsHook();
  if (hook === undefined || hook.level < 1) return created;
  // A method like the base one (`this` is the signal): called on another signal, it writes that
  // one (as in production); unbound, it throws.
  created.set = function (this: Signal<T>, value: T): T {
    if (this !== created || hook.level < 2) return checkedSet.call(this as Signal<any>, value) as T;
    const prev = (base._inspect(created) as { value: unknown }).value;
    // Reported before the flush it causes, so the effects it triggers follow it.
    const data: { sig: Signal<T>; prev: unknown; next: T; by?: "devtools"; skipped?: true; stack?: Error } = {
      sig: created,
      prev,
      next: value,
      ...stack(hook),
    };
    if (hook.writing) data.by = "devtools";
    hook.emit("sig.write", data);
    const result = baseSet.call(created as Signal<unknown>, value) as T;
    if (Object.is(result, prev) && base._inspect(created)!.equals !== null) data.skipped = true;
    return result;
  };
  hook.emit("sig.create", { sig: created, owner: base.getOwner(), ...stack(hook) });
  return created;
}

// A disposed computed no longer updates; reads return its last value. Development warns on the
// first such read. The returned getter wraps the base one and carries its internal symbol, so
// `_inspect`, `_trackReads`, graph views and resume treat it as that computed.
const COMPUTED: symbol = Object.getOwnPropertySymbols(base.computed(() => 0)).find((key) => key.description === "rivet.computed")!;
type ComputedGetter<T> = (() => T) & Record<symbol, { disposed: boolean }>;
function guarded<T>(getter: () => T): () => T {
  const get = getter as ComputedGetter<T>,
    node = get[COMPUTED]!;
  let warned = false;
  const read = (() => {
    if (node.disposed && !warned) {
      warned = true;
      console.warn(
        "Rivet: read of a disposed computed — it returns its last value and no longer updates. Create it in the scope that reads it, or keep its owner alive." +
          where(),
      );
    }
    return get();
  }) as ComputedGetter<T>;
  read[COMPUTED] = node;
  return read;
}

/** `computed`, registered at creation and timed per run while recording. */
/** @deprecated `computed` of an async function (or a Promise): see `AsyncFunctionNotAllowed`. */
export function computed<T extends PromiseLike<unknown>>(fn: () => T, options?: EqualsOptions<T>): NotAsync<T, () => T>;
export function computed<T>(fn: () => T, options?: EqualsOptions<T>): () => T;
export function computed<T>(fn: () => T, options?: EqualsOptions<T>): () => T {
  const hook = devtoolsHook();
  if (hook === undefined || hook.level < 1) return guarded(base.computed(fn, options));
  const owner = base.getOwner();
  let run = fn;
  let pin: Signal<{ value: unknown } | null> | undefined;
  if (hook.edit) {
    const own = (pin = base.signal<{ value: unknown } | null>(null));
    run = () => {
      const pinned = own();
      return pinned ? (pinned.value as T) : fn();
    };
    hook.emit("sig.internal", { sig: own });
  }
  const get = guarded(base.computed(timed(hook, run), options));
  const node = _debug(get)!.ref;
  if (pin) pins.set(node, pin);
  if (hook.level >= 2) hook.emit("node.create", { node, getter: get, owner, ...stack(hook) });
  return get;
}

/** `createContext`, reported (`ctx.create`) so the devtools can name and list its providers. */
export function createContext<T>(defaultValue: T): Context<T> {
  const token = base.createContext(defaultValue);
  const hook = devtoolsHook();
  if (hook !== undefined && hook.level >= 1) hook.emit("ctx.create", { token, ...stack(hook) });
  return token;
}

/** `useContext`, reporting the read (`ctx.read { token, owner, provider }`; provider null: the default). */
export function useContext<T>(token: Context<T>): T {
  const value = base.useContext(token);
  const hook = devtoolsHook();
  if (hook === undefined || hook.level < 1) return value;
  const owner = base.getOwner();
  let provider: object | null = null;
  for (let view = _debug(owner); view; view = view.parent())
    if (view.token === token) {
      provider = view.ref;
      break;
    }
  if (owner !== null) hook.emit("ctx.read", { token, owner, provider });
  return value;
}

// `effect` ignores a returned function (cleanups register with `onCleanup`); development warns once
// per effect, since a returned cleanup silently never runs.
function returnedCleanup(fn: () => unknown): () => void {
  let warned = false;
  return () => {
    const result = fn();
    if (typeof result === "function" && !warned) {
      warned = true;
      console.warn(
        "Rivet: an effect returned a function, which is ignored (it never runs as a cleanup). Register cleanups with onCleanup(() => …) inside the effect." +
          where(),
      );
    }
  };
}

/** `effect`, registered at its first run and timed per run while recording. */
/** @deprecated `effect` of an async function (or a Promise): see `AsyncFunctionNotAllowed`. */
export function effect<R extends PromiseLike<unknown>>(fn: () => R): NotAsync<R, Disposer>;
export function effect(fn: () => void): Disposer;
export function effect(fn: () => void): Disposer {
  return tracked(returnedCleanup(fn));
}
function tracked(fn: () => void): Disposer {
  const hook = devtoolsHook();
  if (hook === undefined || hook.level < 1) return base.effect(fn);
  const owner = base.getOwner(),
    run = timed(hook, fn);
  let first = hook.level >= 2;
  return base.effect(() => {
    if (first) {
      first = false;
      hook.emit("node.create", { node: base.getOwner(), owner, ...stack(hook) });
    }
    return run();
  });
}

/** @internal Development keeps every DOM binding effect available to graph inspection. */
export function _bindingEffect(fn: () => void): void {
  tracked(fn);
}

/** @internal Development: a closure-free binding is the same tracked effect, over `() => fn(a, b, c)`. */
export function _bindingEffect1<A, B, C>(fn: (a: A, b: B, c: C) => void, a: A, b?: B, c?: C): void {
  tracked(() => fn(a, b!, c!));
}

/** `batch`; while recording, `batch.start` / `batch.end` bracket its writes (the flush follows the end). */
export function batch<T>(fn: () => T): T {
  const hook = devtoolsHook();
  if (hook === undefined || hook.level < 2) return base.batch(fn);
  hook.emit("batch.start", {});
  return base.batch(() => {
    try {
      return fn();
    } finally {
      hook.emit("batch.end", {});
    }
  });
}

/** `_dispatch`; while recording, a trusted mouse click first emits `event.defer` (its flush may run one task
 * later: the devtools agent keeps that task's writes as causes until then). */
export function _dispatch(...args: Parameters<typeof base._dispatch>): void {
  const hook = devtoolsHook(),
    event = args[3];
  if (hook !== undefined && hook.level >= 2 && event.isTrusted && event.type === "click" && (event as PointerEvent).pointerType === "mouse")
    hook.emit("event.defer", {});
  base._dispatch(...args);
}

/** `catchError`; development warns when `fn` returns a promise: catchError is
 * synchronous, so that promise's rejection never reaches `handler` (handle it with `.catch`). */
export function catchError<T>(fn: () => T, handler: (error: unknown) => void): T | undefined {
  const value = base.catchError(fn, handler);
  if (value !== null && (typeof value === "object" || typeof value === "function") && typeof (value as { then?: unknown }).then === "function")
    console.warn(
      "Rivet: catchError(fn) returned a promise; its rejection does not reach the handler (catchError is synchronous). Use .catch() on it." + where(),
    );
  return value;
}
