// "Measure my visit" formatter (src/components/home/visit.ts).
import { strict as assert } from "node:assert";
import { test } from "vitest";
import { jsWithPage, visitLine } from "../src/components/home/visit.ts";

const script = (startTime: number, transferSize: number, decodedBodySize = transferSize) => ({ startTime, transferSize, decodedBodySize });

test("visit: JS loaded with the page = scripts started before the load event (cache hits by body size)", () => {
  assert.equal(jsWithPage({ ttfb: 10, lcp: 100, scripts: [script(900, 3000), script(950, 0, 1200)], loaded: 800 }), 0);
  assert.equal(jsWithPage({ ttfb: 10, lcp: 100, scripts: [script(100, 3000), script(200, 0, 1200), script(900, 500)], loaded: 800 }), 4200);
  assert.equal(jsWithPage({ ttfb: 10, lcp: 100, scripts: [script(100, 3000)], loaded: 0 }), 3000, "still loading: everything so far");
});

test("visit: one line, rounded milliseconds, bytes in B / KB, missing LCP said so", () => {
  assert.equal(visitLine({ ttfb: 41.6, lcp: 309.4, scripts: [], loaded: 500 }), "Your visit: TTFB 42 ms · LCP 309 ms · JS loaded with the page: 0 B");
  assert.equal(
    visitLine({ ttfb: 5, lcp: null, scripts: [script(1, 4321)], loaded: 10 }),
    "Your visit: TTFB 5 ms · LCP not reported by this browser · JS loaded with the page: 4.3 KB",
  );
});
