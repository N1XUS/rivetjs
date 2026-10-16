// Ported from embla-carousel (packages/embla-carousel-fade/src/components/utils.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts, formatting; `'embla-carousel'` imports / module augmentation → `../../engine/` files; otherwise verbatim.
export function clampNumber(number: number, min: number, max: number): number {
  return Math.min(Math.max(number, min), max);
}

export function isNumber(value: number | null): value is number {
  return typeof value === "number" && !isNaN(value);
}
