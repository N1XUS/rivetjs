// Ported from embla-carousel (packages/embla-carousel/src/components/PercentOfView.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
export type PercentOfViewType = {
  measure: (n: number) => number;
};

export function PercentOfView(viewSize: number): PercentOfViewType {
  function measure(n: number): number {
    return viewSize * (n / 100);
  }

  const self: PercentOfViewType = {
    measure,
  };
  return self;
}
