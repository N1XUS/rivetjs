// Lazy component children. The compiler lowers plain JSX children of a component element to a
// branded thunk (`children: _slot(() => …)`), evaluated where the component renders them (after
// its providers). `isSlot` tells such content from a user render function (`(item) => …`).
const SLOT = Symbol.for("rivet.slot");
/** Lazy content: a zero-argument thunk the compiler created for plain JSX children. */
export interface Slot<T = unknown> {
  (): T;
  readonly [SLOT]: 1;
}
// One branded function stays alive (made on first use): V8 holds the branded-function map only through live
// instances, and a full GC with none alive deopts every component that inlined `_slot` (server tree-1023 −7%).
let pin: (() => void) | null = null;
let made: (<T>(fn: () => T) => () => T) | null = null;
/** Resume ABI (`server-resume`): wraps each new slot (its content renders in the recorder region it was written in). */
export function _onSlot(fn: <T>(fn: () => T) => () => T): void {
  made = fn;
}
/** Compiler ABI: brand a children thunk (server target; the DOM target uses the twin in `dom.ts`, same brand). */
export function _slot<T>(fn: () => T): Slot<T> {
  if (pin === null) ((pin = () => {}), ((pin as { [SLOT]?: 1 })[SLOT] = 1));
  if (made !== null) fn = made(fn);
  (fn as { [SLOT]?: 1 })[SLOT] = 1;
  return fn as Slot<T>;
}
/** Is `value` compiler-made lazy content (not a user function such as a per-item renderer)? */
export function isSlot(value: unknown): value is Slot {
  return typeof value === "function" && (value as { [SLOT]?: 1 })[SLOT] === 1;
}
const COMPILED = Symbol.for("rivet.compiled");
/**
 * The primitive a slot's content stands for: on a resumed server page the lowering of `{expr}` is a text binding record
 * (server-resume `_rBind`: `<!--rN-->text<!--/-->`), on every other path the primitive itself. For components that treat
 * text children differently (`@rivetjs/ui` Chip / Badge wrap them in their `*Label`): server and client then agree.
 */
export function slotText(value: unknown): unknown {
  if (value !== null && typeof value === "object" && (value as { [COMPILED]?: true })[COMPILED]) {
    const { fragments: f, slots } = value as { fragments: readonly string[]; slots: readonly unknown[] };
    if (f.length === 3 && f[0] === "<!--r" && f[1] === "-->" && f[2] === "<!--/-->") return slots[1];
  }
  return value;
}
/**
 * Resolve `children`: lazy content is called; a user function gets `args` (a render prop); anything
 * else is the value itself. Call it once, where the content renders.
 */
export function renderSlot<T, A extends unknown[]>(value: T | Slot<T> | ((...args: A) => T), ...args: A): T {
  return isSlot(value) ? value() : typeof value === "function" ? (value as (...args: A) => T)(...args) : (value as T);
}
