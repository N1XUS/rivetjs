// Ported from React Spectrum (react-stately/src/virtualizer/utils.ts), Apache-2.0, © Adobe.

/** Returns whether two sets are equal. */
export function isSetEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const key of a) if (!b.has(key)) return false;
  return true;
}
