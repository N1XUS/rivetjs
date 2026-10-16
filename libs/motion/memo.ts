// Entrance lowering memo per distinct (initial, animate, transition, policy): lists render the same entrance per row
// with fresh object literals, so the cache keys on content (functions: an id per function), behind a last-call memo
// (equal one-level literals hit without building a key). Shared by the server (`server-on.ts`) and the client render
// (`entrance.ts`).
import type { ReducedPolicy } from "./css.ts";
import type { Target, Transition } from "./values.ts";

const fnIds = new WeakMap<object, number>();
let fnCount = 0;
/** Content signature of a value (functions: an id per function). */
export function sig(v: unknown): string {
  if (typeof v === "function") return "f" + (fnIds.get(v) ?? (fnIds.set(v, ++fnCount), fnCount));
  if (typeof v === "string") return '"' + v.length + ":" + v;
  if (v === null || typeof v !== "object") return String(v);
  let out = Array.isArray(v) ? "[" : "{";
  for (const k in v) out += k + ":" + sig((v as Record<string, unknown>)[k]) + ",";
  return out;
}
const rules = new Map<string, unknown>();
const last: { kind?: string; reduced?: string; initial?: unknown; animate?: unknown; transition?: unknown; value?: unknown } = {};
/** `make(initial, animate, transition, reduced, extra)`, cached on content; `kind` must encode `extra`. */
export function cached<X, T>(
  kind: string,
  initial: Target,
  animate: Target,
  transition: Transition | undefined,
  reduced: ReducedPolicy,
  extra: X,
  make: (initial: Target, animate: Target, transition: Transition | undefined, reduced: ReducedPolicy, extra: X) => T,
): T {
  if (last.kind === kind && last.reduced === reduced && same(last.initial, initial) && same(last.animate, animate) && same(last.transition, transition))
    return last.value as T;
  const key = kind + reduced + sig(initial) + "|" + sig(animate) + "|" + sig(transition);
  let value = rules.get(key) as T | undefined;
  if (value === undefined && !rules.has(key)) {
    if (rules.size > 512) rules.clear();
    rules.set(key, (value = make(initial, animate, transition, reduced, extra)));
  }
  // Snapshots: an object mutated and passed again must miss.
  ((last.kind = kind), (last.reduced = reduced), (last.initial = flat(initial)), (last.animate = flat(animate)), (last.transition = flat(transition)));
  last.value = value;
  return value as T;
}
const flat = (v: unknown): unknown => (v !== null && typeof v === "object" ? { ...v } : v);
/** Shallow equality of one-level objects whose values are primitives (anything nested: not equal, the key decides). */
function same(a: unknown, b: unknown): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) || Array.isArray(b)) return false;
  let n = 0;
  for (const k in a) {
    const v = (a as Record<string, unknown>)[k];
    if ((v !== null && typeof v === "object") || typeof v === "function" || v !== (b as Record<string, unknown>)[k]) return false;
    n++;
  }
  for (const _ in b) n--;
  return n === 0;
}
