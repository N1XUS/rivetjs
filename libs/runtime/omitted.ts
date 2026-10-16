import type { OmittedSlot } from "./server.ts";

// A private class carrying a registered prototype brand: recognised across duplicate runtime module
// instances (dev cache-busters), like the other Symbol.for brands — one allocation per slot, no global
// WeakSet entry (TRANSFORM-AUDIT X3: the WeakSet add + has were ~9% of cdk Button SSR).
const OMITTED = Symbol.for("rivet.omitted");
class Omitted implements OmittedSlot {
  readonly value: unknown;
  constructor(value: unknown) {
    this.value = value;
  }
}
(Omitted.prototype as unknown as Record<symbol, true>)[OMITTED] = true;
/**
 * Compiler-only evaluation slot: observe the value, emit no markup. A value with nothing to observe (`inert`:
 * absent handlers `c ? f : undefined`, plain event handlers, server refs) needs no slot at all: `null`, the
 * renderer's empty slot, which every walker skips by its first check (SSR-OMITTED-SLOTS: an `Omitted` record
 * cost an allocation plus 5–6 brand probes in `admit` and again in `visit`; Motion tags carry 9 per element).
 */
export function omitted(value: unknown): OmittedSlot | null {
  return inert(value) ? null : new Omitted(value);
}
/** Recognize private compiler evaluation slots without interpreting author objects. */
export function isOmitted(value: unknown): value is OmittedSlot {
  return value !== null && typeof value === "object" && (value as Record<symbol, unknown>)[OMITTED] === true;
}
/**
 * Nothing to observe in an omitted slot's value: a primitive, or a plain function (an event handler —
 * no own `then`, `Function.prototype` itself, untampered built-ins). The renderer neither admits nor
 * awaits it. Async / generator functions and functions with an own `then` still take the generic path.
 */
export function inert(value: unknown): boolean {
  if (typeof value === "function") return Object.getPrototypeOf(value) === Function.prototype && !Object.hasOwn(value, "then");
  return value === null || typeof value !== "object";
}
