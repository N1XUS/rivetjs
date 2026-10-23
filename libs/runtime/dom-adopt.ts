// Adopted list rows (derived adopt runs, `dom-derived.ts` / `dom-adopt-run.ts`): server item vs fresh item equality.
// Data equality of a server row item and a fresh item of the same key (resume-encodable data: primitives, arrays,
// plain objects, Date, URL; anything else compares by identity). A refetched list (live page, revalidation) has new
// objects for unchanged rows: equal ones keep the adopted server row instead of re-creating it.
/** @internal Derived adopt runs (`dom-derived.ts`): installed as `_adoption.same` for their adopted lists. */
export function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const proto = Object.getPrototypeOf(a);
  if (proto !== Object.getPrototypeOf(b)) return false;
  if (Array.isArray(a)) {
    const y = b as unknown[];
    if (a.length !== y.length) return false;
    for (let i = 0; i < a.length; i++) if (!same(a[i], y[i])) return false;
    return true;
  }
  if (proto === Date.prototype) return (a as Date).getTime() === (b as Date).getTime();
  if (proto === URL.prototype) return (a as URL).href === (b as URL).href;
  if (proto !== Object.prototype && proto !== null) return false;
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  // `y`'s key count without a second keys array (plain / null-prototype objects: `for…in` = own enumerable keys).
  let count = 0;
  for (const _ in y) count++;
  if (keys.length !== count) return false;
  for (const key of keys) if (!Object.hasOwn(y, key) || !same(x[key], y[key])) return false;
  return true;
}
