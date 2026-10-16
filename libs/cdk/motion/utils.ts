// Ported from embla-carousel (packages/embla-carousel/src/components/utils.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: the DOM-free math helpers the motion core needs (`isNumber`, `mathAbs`, `mathSign`, `deltaAbs`,
// `factorAbs`); the carousel engine's `utils.ts` re-exports them next to its DOM / array helpers.

export function isNumber(subject: unknown): subject is number {
  return typeof subject === "number";
}

export function mathAbs(n: number): number {
  return Math.abs(n);
}

export function mathSign(n: number): number {
  return Math.sign(n);
}

export function deltaAbs(valueB: number, valueA: number): number {
  return mathAbs(valueB - valueA);
}

export function factorAbs(valueB: number, valueA: number): number {
  if (valueB === 0 || valueA === 0) return 0;
  if (mathAbs(valueB) <= mathAbs(valueA)) return 0;
  const diff = deltaAbs(mathAbs(valueB), mathAbs(valueA));
  return mathAbs(diff / valueB);
}
