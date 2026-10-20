// Helpers shared by the benchmark runners and spikes (apps/*-bench, apps/bridge-demo, scripts/lazy-rows): import by
// relative path (`../../scripts/bench/shared.ts`), no package. Node-only, no dependencies.

/** Median of `values` (the mean of the two middle values for an even count); NaN when empty. Never mutates `values`. */
export const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b),
    mid = sorted.length >> 1;
  return sorted.length ? (sorted.length & 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2) : NaN;
};

/**
 * Playwright `chromium.launch` browser target: `RESUME_BENCH_CHROME=<executable>` runs that pinned Chromium (cloud
 * containers: `/opt/pw-browsers/chromium`), else the installed Chrome channel. Spread into the launch options.
 */
export const chromeTarget = (): { executablePath: string } | { channel: string } =>
  process.env.RESUME_BENCH_CHROME ? { executablePath: process.env.RESUME_BENCH_CHROME } : { channel: "chrome" };
