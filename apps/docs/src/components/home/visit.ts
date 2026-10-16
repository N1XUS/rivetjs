// "Measure my visit" (components/home/PerfLine.tsx): formats what the reader's own browser recorded for this page.
// Pure functions, unit-tested in tests/content.test.ts; the handler collects the inputs from the Performance APIs.

export interface Visit {
  /** Navigation Timing `responseStart` (ms from navigation start). */
  ttfb: number;
  /** Latest buffered largest-contentful-paint `startTime`, or null when the browser does not report LCP. */
  lcp: number | null;
  /** Script Resource Timing entries (external scripts only; the inline loader is in the HTML): sizes and `startTime`. */
  scripts: readonly { transferSize: number; decodedBodySize: number; startTime: number }[];
  /** Navigation Timing `loadEventEnd`: the page finished loading (0 = not yet). */
  loaded: number;
}

/**
 * JavaScript bytes the page fetched while it loaded: scripts started before the load event ended (over the network;
 * cache hits count their body size). Not "before the first click": the first-input entry is only recorded after the
 * click's handlers ran, and the loader prefetches a handler on hover, which is an interaction too.
 */
export function jsWithPage(visit: Visit): number {
  const end = visit.loaded || Infinity;
  let bytes = 0;
  for (const entry of visit.scripts) if (entry.startTime < end) bytes += entry.transferSize || entry.decodedBodySize;
  return bytes;
}

/** "Your visit: TTFB 42 ms · LCP 310 ms · JS loaded with the page: 0 B". */
export function visitLine(visit: Visit): string {
  const bytes = jsWithPage(visit);
  const lcp = visit.lcp === null ? "LCP not reported by this browser" : `LCP ${Math.round(visit.lcp)} ms`;
  return `Your visit: TTFB ${Math.round(visit.ttfb)} ms · ${lcp} · JS loaded with the page: ${bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} KB`}`;
}
