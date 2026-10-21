# Changelog

## 0.1.0-alpha.1 (2026-10-21)

### Breaking changes

- **router,compiler:** route server exports are wrapper calls — `export const x = onGet(fn)`; magic names removed (SERVER-EXPORTS) (ab1aa596)

### Features

- **cdk:** ListBox and Table render inside CollectionVirtualizer (ui-docs table page 2.22 MB → 73 KB) (4d23c2fe)
- **cdk:** GridList, Menu, Tree and ListBox sections render inside CollectionVirtualizer (f045f405)
- **compiler:** keyed For rows get a lazy-row verdict, a row-function symbol and RV2105 / RV2106 (LAZY-ROWS T2) (2ad091cf)
- **docs-kit, scripts:** lazy-rows measurement harness — check-examples `rows:` column, probe, `RIVET_LAZY_ROWS=swap` (LAZY-ROWS T1) (d4d5ef14)
- **docs:** every diagnostic link lands — /errors/RVxxxx pages generated from codes.json + explain.json (ae25d5f7)
- **runtime:** lazy row region records on the server behind `RIVET_LAZY_ROWS=on` (LAZY-ROWS T4) (36ff6aff)
- **cdk:** ListBox and GridList render their rows through a built collection + keyed `For` (LAZY-ROWS T3) (8629b13b)
- **runtime:** dev warning for large values captured into resume state (STATE-WARN) (993be59c)
- **runtime:** lazy collection rows materialise in the browser behind a zero-cost build switch (LAZY-ROWS T5 + T5B) (3a0d09da)
- **router,compiler:** route server exports are wrapper calls — `export const x = onGet(fn)`; magic names removed (SERVER-EXPORTS) (ab1aa596)
- **runtime:** `resource()` — async data as a signal (RESOURCE) (ee983451)
- **runtime,compiler:** DOM-backed loader data behind `resume.domData` (DOM-DATA); default off (571cf3a3)
- **compiler,runtime:** `resource()` resumes in every `const` form; RV2016 for the rest (RESOURCE-COMPILER) (02619c52)
- **router:** the app handler's caller seeds `locals` — `context.locals` (SEEDED-LOCALS) (0a63cc04)
- **compiler:** derived model C1 boundary facts + C2 server target under `resume.model: "derived"` (M2-C) (b8713cab)
- **router,compiler,docs-kit:** server-only reach — computed document routes, RV3011, throwing stand-ins, client render-error fallback (SERVER-REACH) (16b34ca9)
- **runtime:** derived client R2/R3 — boundary adopt runtime, inline derived loader, `@rivetjs/runtime/dom-derived` (M2-R) (ee54276c)
- **compiler:** derived model C3 DOM lowering + Vite wiring + end-to-end (M2-C3) (543da6a7)
- **compiler,runtime,router:** derived model router integration — `Root` boundary, client navigation, JSX-only boundaries, RV2103/RV2104 = 0; re-measured, default stays serialized (M2-R5) (b11d8e8b)
- **router:** deferred loaders `load(fn, { defer: true })` — shell streams first, holes stream later; shell-cache T0 measured: GO (PPR-T01) (b957e6ec)
- **router:** shell cache — `shell: true` route rule with request-read tracking and H-replay; deferred-loader redirects become client redirects (PPR-T23) (8620bff1)

### Fixes

- **router:** node adapter precompression: one job per file, stale siblings ignored (7d97b2e0)
- **router:** Bun / Deno static index negotiates siblings by q (5d660c0b)
- **runtime:** derived recorder pay-per-use; zero-cost + size baselines re-based (be7f654f)
- **resume:** re-create a focus-change region from the window-bubble listener (423b46b6)
- **cdk:** radio items preset keeps focus on a clicked native radio (5e677f01)
- **resume:** cold replays reach listeners they attach and drop a press's native focus events (7ce1445d)
- **resume:** cold focus-back fires no handlers; virtualizer driver detached from its first caller (ffc60cb8)
- **cdk:** a cold press replayed within 50 ms counts as replayed (ui-docs showcase-kanban build) (bb3ca2a0)
- **cdk:** a Button's live isDisabled inside a TooltipTrigger no longer throws on a resumed page (78691bab)
- **runtime, cdk:** a decoded ref inside a re-created region no longer throws; resumed Drag rows are destroyed with their element (9a9c8183)
- **compiler, runtime, router:** diagnostic docs links point at rivetjs.severyn.pro (f50e50d6)
- **language-core:** RV3101 route-link checks cover `Link` imported from `@rivetjs/router/link` (a6dbfaf4)
- **compiler:** a lazy non-JSX `For` row keeps its nested sites (Masonry rows' `computed` registers again) (70dd145e)
- **runtime:** a failed cold-event chunk load stops the listener recording (SMELL review) (042995b2)
- **cdk:** ListBox renders rows inside a compiled Provider region; cdk-docs quarantine refreshed (CDK-EX) (b26f27f3)
- **cdk:** adopted collection rows re-render when their node changes (ROW-RERENDER); cdk-docs quarantine empty (8fc0ae25)
- **docs-kit:** `::api` cards render on client navigation — card data inlined by content generation (API-CARD) (5d611f11)
- **ui,cdk:** portaled overlays inherit the scoped theme attributes of their trigger (UI-THEME-PORTAL) (2a36dcfe)
- card overflow (f1091e4b)
- **cdk,scripts:** resumed virtualized rows survive the first click; fuzz pins re-triaged; size report ignores the headless cursor (CI-RED) (fe488ac2)
- **runtime:** cold press keeps the group's focus-within; cold click retargets to the loaded page's hit; ui fuzz route set deterministic (COLD-FOCUS) (b88b640f)
- **compiler,docs-kit:** chunk planner follows barrel imports for unowned modules and guards cycles on emitted chunks; docs search palette fetched ahead of the press (CHUNK-CYCLE) (e80dd8dc)
- **runtime,cdk,language-core:** cold press replays a label's queued focus; RV2016 quick fix; cdk collection rows register as DOM-data entries (SMALL-FIXES) (9604e4af)
- **reactivity,runtime,cdk:** selector fold timers no longer pin the server render until the timer phase; lazy-build table test counts effect chunks; /dom-data joins the createSlotId pin (VIRT-LEAK) (7c8a74e7)
- **scripts,testing:** release readiness for 0.1.0-alpha.1 — tarball smoke green again (`@rivetjs/testing/browser-env` is host-only), create-rivet e2e typechecks + compares AI files, Verdaccio guard names npm's path redaction, RV2148 shows the import path (RELEASE-READY) (b3d30103)

### Performance

- **cdk:** table rows and cells capture one data object each (resume state −48% raw / −63% br per row) (ee759548)
- **resume:** repeated handler / binding / table entries ship once per collection (state −49% raw / −38% br on 1000 rows) (671410c4)
- **runtime:** resume encoder stays on Node's fast JSON.stringify path; cheaper escaping and preload planning (RESUME-SMALL) (49e9a922)
- **compiler,runtime:** intent-only modules get their own route chunk; fetch-ahead skips declared-late chunks (DOCS-JS) (18cc4186)
- **runtime,cdk:** lazy rows — keyed selector wake, `For` `lazy` opt-out, cached adopt plans, virtualized table header fix (LAZY-T6); default stays off (5c3aedaa)
- **compiler,runtime,docs-kit:** named intent chunks, shell as a route root, search palette on light primitives, router table on link intent (DOCS-COLD) (e9bd5ff5)
- **docs:** home "click it" demo in its own intent chunk; panel splits fetched-for-click from prefetched (HOME-CLICK) (64b31bad)
- **runtime:** DOM-backed loader data T2 registry by reference + T3 strided `b` refs (DD-T2T3); default stays off (1985d522)
- **runtime:** lazy rows render from the list tape + wasm row emitter — 0.58–0.75× recorded rows server CPU instead of 4× (LAZY-COST) (f8966de1)
- **runtime,cdk:** lazy component rows written 32 at a time by one renderer; DOM-DATA registers lazy tape rows; plan-path browser test (LAZY-COST-2) (f021b2fe)

Not listed: 22 docs, 8 test, 6 spike, 10 m1, 1 resume, 1 router, 1 wip, 2 chore, 2 bench, 2 style, 2 refactor, 3 ci, 2 non-conventional.

## 0.1.0-alpha.0 (2026-10-16)

### Fixes

- **docs:** scope resume demo downloads to its dependencies (3f1f3de0)
- **release:** prepare the first npm release from this repository (f1762729)
- **release:** safely resume a partially published version (fa4b7d98)
- **release:** keep npm warnings out of recovery JSON (21ebffa1)

Not listed: 1 ci, 1 non-conventional.

