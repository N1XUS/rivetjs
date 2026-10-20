/**
 * Elements one adapter row renders (`adapters/*` `Row`): section, header, h2, p, the fields div, footer, small, plus 10
 * fields × (label, span, strong, button, span).
 */
export const ROW_ELEMENTS = 57;
/** Elements under `#host` with `rows` rows mounted: the rows inside the adapter's one `<main>`. */
export const hostElements = (rows: number): number => rows * ROW_ELEMENTS + 1;

/** Select evenly distributed, unique field indexes for a percentage update. */
export function selectFields(total: number, percent: number): number[] {
  if (!Number.isSafeInteger(total) || total < 1 || !Number.isFinite(percent) || percent <= 0 || percent > 100)
    throw new RangeError("Expected positive field count and percentage <=100");
  const count = Math.max(1, Math.floor((total * percent) / 100));
  return Array.from({ length: count }, (_, index) => Math.floor((index * total) / count));
}

/** Order statistics of one sample set. */
export interface Summary {
  count: number;
  min: number;
  median: number;
  p95: number;
  max: number;
}

/** Summarize finite samples without pooling unrelated trials. */
export function summarize(samples: readonly number[]): Summary {
  if (!samples.length || samples.some((value) => !Number.isFinite(value)))
    throw new TypeError("Expected finite samples");
  const sorted = [...samples].sort((a, b) => a - b),
    n = sorted.length;
  return {
    count: n,
    min: sorted[0],
    median: (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2,
    p95: sorted[Math.ceil(n * 0.95) - 1],
    max: sorted[n - 1],
  };
}
