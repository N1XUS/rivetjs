import { test } from "vitest";
import assert from "node:assert/strict";
import { brotliCompressSync } from "node:zlib";
import { minifiedDerived, minifiedDerivedLater, minifiedDerivedStream, minifiedDerivedVisible } from "../build-loader.ts";
import { DERIVED_LOADER, DERIVED_LOADER_LATER, DERIVED_LOADER_VISIBLE, DERIVED_LOADER_VISIBLE_LATER, DERIVED_STREAM } from "../resume-loader-derived.min.ts";

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
// ZERO ONDEMAND (2026-10-26): +239 B (1,583) — fetch-ahead timing `data-fw` (idle default / load / intent) + Save-Data / 2G
// skip, the whole `data-fo` list at high priority on the first intent (no import waterfall: ui median frame first click
// on Slow 4G, see docs/guides/resumability.md "Fetch-ahead timing"), keydown + 80 ms hover-dwell intent, on `intent` pages
// hover events held without booting and dropped once the pointer left, `pointercancel` held (a cold touch press that turns
// into a scroll is cancelled, not left pressed): budget 1,585 B. SLIDER-KEY (2026-10-27): +48 B (1,631) — a cold keydown
// is held for the keys of the target's nearest `data-rk` (cdk thumbs / spin fields / composites; read by nothing since
// M6-CUT: a cold slider PageUp stepped the native range), a text field without its own `data-rk` keeps its caret keys:
// budget 1,635 B. COLD-CTXMENU (2026-10-27): +5 B (1,636) — a cold `contextmenu` inside the nearest `data-cm` (cdk
// MenuTrigger `trigger="contextMenu"`) holds the browser's own menu (it showed over the replayed ui ContextMenu): budget 1,640 B.
// CX-KEY (2026-10-28): +19 raw / +12 B br (1,648): body keydowns join an already-started boot / adopt queue.
// No new wake trigger or per-boundary data; the existing replay reaches the window listener adoption installs.
test("shipped derived loader is current, inline-safe and fits 1,648 B brotli", async () => {
  assert.equal(DERIVED_LOADER, await minifiedDerived(), "stale resume-loader-derived.min.ts: run node libs/runtime/build-loader.ts");
  assert.ok(!/<\/script|<!--/i.test(DERIVED_LOADER));
  const size = brotliCompressSync(DERIVED_LOADER).length;
  assert.ok(size <= 1648, `minified ${size} B`);
  console.log(`derived loader brotli: ${size} B`);
});

// ZERO ABI-SPLIT visible-only boot: the loader of a `data-boot="<ids>"` page = the loader above with `derivedVisibleBoot`
// spliced in at its `data-boot` start (the other pages' loader is unchanged): 1,768 B brotli at landing (+184 B); 1,823 B
// with SLIDER-KEY's `data-rk` hold.
test("shipped visible-boot loader is current, inline-safe and fits 1,829 B brotli", async () => {
  assert.equal(DERIVED_LOADER_VISIBLE, await minifiedDerivedVisible(), "stale resume-loader-derived.min.ts: run node libs/runtime/build-loader.ts");
  assert.ok(!/<\/script|<!--/i.test(DERIVED_LOADER_VISIBLE));
  assert.ok(DERIVED_LOADER_VISIBLE.includes(".dataset.boot?(function("));
  new Function(DERIVED_LOADER_VISIBLE);
  const size = brotliCompressSync(DERIVED_LOADER_VISIBLE).length;
  assert.ok(size <= 1829, `minified ${size} B`);
  console.log(`derived visible-boot loader brotli: ${size} B`);
});

// IDLE-PREFETCH lazy-part loaders: the loader of a page with `data-fl` = the loader above with `derivedFetchLater` spliced
// in place of its fetch-ahead link loop (pages without lazy parts keep the plain loader): 1,719 B brotli at landing
// (+83 B over the 1,636 B loader), 1,894 B with the visible boot too.
test("shipped lazy-part loaders are current, inline-safe and fit 1,725 / 1,902 B brotli", async () => {
  assert.equal(DERIVED_LOADER_LATER, await minifiedDerivedLater(), "stale resume-loader-derived.min.ts: run node libs/runtime/build-loader.ts");
  assert.equal(DERIVED_LOADER_VISIBLE_LATER, await minifiedDerivedLater(true), "stale resume-loader-derived.min.ts: run node libs/runtime/build-loader.ts");
  for (const [loader, budget] of [
    [DERIVED_LOADER_LATER, 1725],
    [DERIVED_LOADER_VISIBLE_LATER, 1902],
  ] as const) {
    assert.ok(!/<\/script|<!--/i.test(loader));
    assert.ok(loader.includes(".dataset.fl.split("), "the lazy-part fetch is spliced in");
    assert.ok(!loader.includes('.split(" ").map(e=>l.head.append('), "in place of the plain link loop");
    new Function(loader);
    const size = brotliCompressSync(loader).length;
    assert.ok(size <= budget, `minified ${size} B`);
    console.log(`derived lazy-part loader brotli: ${size} B`);
  }
  assert.ok(DERIVED_LOADER_VISIBLE_LATER.includes(".dataset.boot?(function("));
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
