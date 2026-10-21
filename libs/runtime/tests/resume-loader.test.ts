import { test } from "vitest";
import assert from "node:assert/strict";
import { brotliCompressSync } from "node:zlib";
import { EXPAND, EXPAND_DOM, LAZY, LOADER, LOADER_KEYS, ROWS, STREAM } from "../resume-loader.min.ts";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "./resume/compile.ts";
import { minifiedDerived, minifiedExpand, minifiedLazy, minifiedLoader, minifiedRows, minifiedStream, minifiedStrided } from "../build-loader.ts";
import { DERIVED_LOADER } from "../resume-loader-derived.min.ts";
import { loader } from "../resume-loader.ts";

// Budget 2,329 B brotli: round 2 (lane SEC) added the state-script binding (U2), digit-only ids (SEC1) and the
// cold click-default hold (C8), +90 B over the previous 2,047 B (budget 2,144); gap round (G-APP, ORCH-approved)
// +24 B for the lazy router (Z1: link intent/click boots `n` chunks, followed links replay) and +2 B for held
// cold label clicks (G-PAR/K-rt-1); lane MATRIX +18 B (2,186; nested cold events + idle start, MATRIX-rt-1) so events a replayed handler
// dispatches (focus() → focusin, a link's synthetic click) run nested instead of queueing behind the cold chain;
// lane CDK-LEFT +3 B (2,189; keys variant +0) so do the events of microtasks it queued (a deferred focus()); lane REG
// +27 B (2,216; keys 2,274) so no listener sees a replayed click default again (a live label cancelled a cold checkbox toggle);
// lane RESUME-ROWS-2 +17 B (2,233) for path-addressed rows (`$rw` id lookups: −3.8 KB brotli on a 1,000-row page's ids);
// lane PRELOAD-VISIBLE +4 B (2,237): `v` preloads wait for a non-zero visible area (`intersectionRatio`), so a clipped
// visually-hidden control in a `position: fixed; top: 0` wrapper no longer prefetches its widget's chunks at load;
// lane STRUCT-PREFETCH +93 B (2,329; keys 2,377): deps modules (`data-deps`): an urgent hint of a symbol chunk / the
// runtime imports its `<chunk>.deps.js` and hints the static import closure at once (no import waterfall on first use),
// before the runtime started and not over HTTP/1.1 (cold DatePicker h2 −29%, Select −24%).
// Lane LOADER-DIET −483 B (1,846; keys 1,892): the inline loader is a stub (capture, hold, queue, intent hints + deps
// modules, boot). The cold replay chain moved into the runtime (dom-resume `on` / `cold`), scheduled / low-priority
// prefetch and idle evaluation into the hashed loader module (`resume-loader-module.ts`, state `data-ld`), row
// template expansion into the expand add-on (`resume-expand.ts`, only pages with compact row templates).
// Lane RESUME-PINS +64 B (1,910; keys 1,957): the capture pointerdown / keydown listeners record the last input modality
// in `window.__rvIM` for cdk focus-visible, and a cold event's state records the focused element (the runtime gives it
// focus back when a replayed handler canceled a cold mousedown) (resume fuzz T31 cold-press / cold-modality pins).
// RESUME-PINS 2026-10-13 −3 B (1,907; keys 1,967): a held click replays as a copy of the user's click (+9 B; `el.click()`
// was a virtual click to cdk focus-visible), the focused element read through the `document` alias (−12 B).
test("shipped loader is the current minified build and fits 1,912 B brotli", async () => {
  const shipped = await minifiedLoader();
  assert.equal(LOADER, shipped, "stale resume-loader.min.mjs: run node libs/runtime/build-loader.ts");
  assert.doesNotMatch(LOADER, /<\/script|<!--/i);
  const size = brotliCompressSync(LOADER).length;
  assert.ok(size <= 1912, `minified ${size} B`);
  console.log(`loader brotli: ${size} B minified (shipped), ${brotliCompressSync("(" + loader + ")()").length} B source`);
});

test("cold-key hold is pay-per-use: only pages with a keydown handler ship LOADER_KEYS", async () => {
  assert.equal(LOADER_KEYS, await minifiedLoader(true), "stale resume-loader.min.mjs: run node libs/runtime/build-loader.ts");
  assert.doesNotMatch(LOADER, /data-rk/);
  assert.match(LOADER_KEYS, /data-rk/);
  const extra = brotliCompressSync(LOADER_KEYS).length - brotliCompressSync(LOADER).length;
  assert.ok(extra > 0 && extra <= 96, `keys variant +${extra} B brotli`);
  const source = `
    import { signal } from "@rivetjs/reactivity";
    export function Click() { const n = signal(0); return <button onClick={() => n.update((v) => v + 1)}>{n()}</button>; }
    export function Keys() { const n = signal(0); return <div tabIndex={0} data-rk="ArrowDown" onKeyDown={() => n.update((v) => v + 1)}>{n()}</div>; }`;
  const server = await importServer<{ Click(): never; Keys(): never }>(compileResume(source, "server", "src/variants.tsx").code);
  const symbols = Object.fromEntries(compileResume(source, "dom", "src/variants.tsx").symbols!.map((symbol) => [symbol.id, "/c.js"]));
  const manifest = { hash: "t", runtime: "/rt.js", symbols };
  const click = String(await resumableToString(() => server.Click(), { manifest }));
  const keys = String(await resumableToString(() => server.Keys(), { manifest }));
  assert.ok(click.includes(LOADER) && !click.includes(LOADER_KEYS), "click-only page: plain loader");
  assert.ok(keys.includes(LOADER_KEYS), "keydown page: keys loader");
});

test("loader module and expand add-on are pay-per-use: data-ld from manifest `loader`, EXPAND only with row templates", async () => {
  const source = `
    import { signal } from "@rivetjs/reactivity";
    import { For } from "@rivetjs/runtime/server";
    export function Click() { const n = signal(0); return <button onClick={() => n.update((v) => v + 1)}>{n()}</button>; }
    export function Rows() {
      const items = signal([1, 2, 3, 4]);
      return <ul><For each={items()} by={(x) => x}>{(item) => <li><button onClick={() => items.set(items().filter((x) => x !== item))}>{item}</button></li>}</For></ul>;
    }`;
  const server = await importServer<{ Click(): never; Rows(): never }>(compileResume(source, "server", "src/addons.tsx").code);
  const symbols = Object.fromEntries(compileResume(source, "dom", "src/addons.tsx").symbols!.map((symbol) => [symbol.id, "/c.js"]));
  const click = String(await resumableToString(() => server.Click(), { manifest: { hash: "t", runtime: "/rt.js", symbols, loader: "/ld.js" } }));
  const rows = String(await resumableToString(() => server.Rows(), { manifest: { hash: "t", runtime: "/rt.js", symbols } }));
  assert.match(click, /<script type="rivet\/state"[^>]* data-ld="\/ld\.js"/);
  assert.ok(!click.includes(EXPAND), "no row templates: no expand add-on");
  assert.doesNotMatch(rows, /data-ld=/);
  assert.ok(rows.includes("<script>" + EXPAND + '</script><script type="rivet/state"'), "row templates: expand add-on right before the state script");
});

// Derived model loader (M2 lane R, R2; spec §3.2 budget ≤ 1 KB br): 1,023 B (2026-10-20) — the serialized loader's
// navigation-type reload fallback and the `mousewheel` passive type were left out to fit (see resume-loader-derived.ts).
// M2-R5 (2026-10-20): +20 B (1,043) for `data-g` (link clicks outside every boundary go to the router root): budget 1,048 B.
// DERIVED-C (2026-10-21): +79 B (1,122) for the fetch-ahead (`data-fo` modulepreloads after `load`; ssr-bench `/resume`
// 1000 rows first click 1×: latency 70.7 → 39.8 ms, 0 scripts on the click instead of 8); +38 B (1,160) for the cold press
// (default `data-events` hold pointerdown / pointerup / mousedown / mouseup / focusin / focusout, the focused element at
// dispatch in the held state: cdk fuzz PRESS pins): budget 1,160 B.
test("shipped derived loader is current, inline-safe and fits 1,160 B brotli", async () => {
  assert.equal(DERIVED_LOADER, await minifiedDerived(), "stale resume-loader-derived.min.ts: run node libs/runtime/build-loader.ts");
  assert.ok(!/<\/script|<!--/i.test(DERIVED_LOADER));
  const size = brotliCompressSync(DERIVED_LOADER).length;
  assert.ok(size <= 1160, `minified ${size} B`);
  console.log(`derived loader brotli: ${size} B`);
});

test("shipped stream add-on is current, inline-safe and fits 1 KB brotli", async () => {
  assert.equal(STREAM, await minifiedStream(), "stale resume-loader.min.mjs: run node libs/runtime/build-loader.ts");
  assert.doesNotMatch(STREAM, /<\/script|<!--/i);
  const size = brotliCompressSync(STREAM).length;
  assert.ok(size <= 1024, `minified ${size} B`);
  console.log(`stream add-on brotli: ${size} B`);
});

test("shipped rows add-on is current, inline-safe and fits 768 B brotli", async () => {
  assert.equal(ROWS, await minifiedRows(), "stale resume-loader.min.mjs: run node libs/runtime/build-loader.ts");
  assert.doesNotMatch(ROWS, /<\/script|<!--/i);
  const size = brotliCompressSync(ROWS).length;
  assert.ok(size <= 768, `minified ${size} B`);
  console.log(`rows add-on brotli: ${size} B`);
});

test("shipped expand add-on is current, inline-safe and fits 320 B brotli", async () => {
  assert.equal(EXPAND, await minifiedExpand(), "stale resume-loader.min.mjs: run node libs/runtime/build-loader.ts");
  assert.doesNotMatch(EXPAND, /<\/script|<!--/i);
  const size = brotliCompressSync(EXPAND).length;
  assert.ok(size <= 320, `minified ${size} B`);
  console.log(`expand add-on brotli: ${size} B`);
});

test("DOM-DATA builds' expand add-on (EXPAND + strided item refs) is current, inline-safe and fits 448 B brotli", async () => {
  assert.equal(EXPAND_DOM, EXPAND + (await minifiedStrided()), "stale resume-loader.min.mjs: run node libs/runtime/build-loader.ts");
  assert.doesNotMatch(EXPAND_DOM, /<\/script|<!--/i);
  const size = brotliCompressSync(EXPAND_DOM).length;
  assert.ok(size <= 448, `minified ${size} B`);
  console.log(`DOM-DATA expand add-on brotli: ${size} B (+${size - brotliCompressSync(EXPAND).length})`);
});

test("shipped lazy rows add-on is current, inline-safe and fits 512 B brotli", async () => {
  assert.equal(LAZY, await minifiedLazy(), "stale resume-loader.min.mjs: run node libs/runtime/build-loader.ts");
  assert.doesNotMatch(LAZY, /<\/script|<!--/i);
  const size = brotliCompressSync(LAZY).length;
  assert.ok(size <= 512, `minified ${size} B`);
  console.log(`lazy rows add-on brotli: ${size} B`);
});

test("loader is self-contained", () => {
  // Evaluated in a scope with no module bindings; a free reference would throw on parse/run.
  const run = new Function("document", "window", "location", "CustomEvent", "setTimeout", "clearTimeout", "(" + loader + ")()");
  assert.doesNotThrow(() => run({ querySelector: () => null }, {}, {}, class {}, setTimeout, clearTimeout));
});
