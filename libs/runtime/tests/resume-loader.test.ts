import { test } from "vitest";
import assert from "node:assert/strict";
import { brotliCompressSync } from "node:zlib";
import { minifiedDerived, minifiedDerivedStream } from "../build-loader.ts";
import { DERIVED_LOADER, DERIVED_STREAM } from "../resume-loader-derived.min.ts";

// Derived model loader (M2 lane R, R2; spec §3.2 budget ≤ 1 KB br): 1,023 B (2026-10-20) — the serialized loader's
// navigation-type reload fallback and the `mousewheel` passive type were left out to fit (see resume-loader-derived.ts).
// M2-R5 (2026-10-20): +20 B (1,043) for `data-g` (link clicks outside every boundary go to the router root): budget 1,048 B.
// DERIVED-C (2026-10-21): +79 B (1,122) for the fetch-ahead (`data-fo` modulepreloads after `load`; ssr-bench `/resume`
// 1000 rows first click 1×: latency 70.7 → 39.8 ms, 0 scripts on the click instead of 8); +38 B (1,160) for the cold press
// (default `data-events` hold pointerdown / pointerup / mousedown / mouseup / focusin / focusout, the focused element at
// dispatch in the held state: cdk fuzz PRESS pins): budget 1,160 B. ZERO R2 (2026-10-25, D5 listening records): +87 B
// (1,247) — tail `e` by boundary name: an event is held / boots / warms only inside a record whose name listens to its
// type (intent also on a `data-g` match: the router's links); static text and native controls nothing listens to stay
// native (no runtime, no chunk): budget 1,247 B. ZERO R7 (tail v2, S2): +58 B (1,305) — the name lookup reads `n[i][2]` and a run's member through its template.
// ZERO STATESPACE: +39 B (1,344) — native automaton controls (`data-nc`): no form-control hold, presses act natively, no replay.
test("shipped derived loader is current, inline-safe and fits 1,344 B brotli", async () => {
  assert.equal(DERIVED_LOADER, await minifiedDerived(), "stale resume-loader-derived.min.ts: run node libs/runtime/build-loader.ts");
  assert.ok(!/<\/script|<!--/i.test(DERIVED_LOADER));
  const size = brotliCompressSync(DERIVED_LOADER).length;
  assert.ok(size <= 1344, `minified ${size} B`);
  console.log(`derived loader brotli: ${size} B`);
});

// Derived stream add-on (DERIVED-C2): `$rD`, shipped once before a derived page's first streamed segment (the serialized
// stream add-on is 1 KB): 294 B brotli at landing.
test("shipped derived stream add-on is current, inline-safe and fits 400 B brotli", async () => {
  assert.equal(DERIVED_STREAM, await minifiedDerivedStream(), "stale resume-loader-derived.min.ts: run node libs/runtime/build-loader.ts");
  assert.ok(!/<\/script|<!--/i.test(DERIVED_STREAM));
  const size = brotliCompressSync(DERIVED_STREAM).length;
  assert.ok(size <= 400, `minified ${size} B`);
  console.log(`derived stream add-on brotli: ${size} B`);
});
