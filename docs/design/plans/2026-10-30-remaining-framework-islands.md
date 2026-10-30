# Remaining framework-island adapters

**Goal:** implement Solid 1.9, Vue3.5 and Svelte5 adapter packages requested by the user, using the existing approved bridge design.
**Authority:** specs/2026-10-11-framework-bridges-design.md; original framework-bridges plan T9–T11. Existing React/Preact and bridge ABI remain the compatibility baseline.
**Architecture:** independent framework packages; shared core stays framework-free. Native framework SSR/hydration, live props, lifecycle, slot node identity, ids/head, ownership/plugins, JSX types and production/browser coverage. Root integrates shared head parsing, tooling, packaging, dependencies and public documentation.

## Constraints

- Preserve unrelated launch config and untracked lane-harness spec. AI-tester provider clarification remains separate; no model fallback/global config changes.
- Exact project-local dependency pins; update npm workspace lock only as required for the requested adapters. No host installs or dependency upgrades unrelated to these packages.
- One heavy browser/build/gate at a time; maxWorkers1, <=3GiB tree, Node26 host/Node24 validation.
- Existing source spec is the design approval; do not start another architecture approval round for T9–T11.
- Adapter delivery is the scope. New competitor benchmark lanes/performance claims are deferred; measure correctness costs and zero-cost/size effects. Original benchmark checkboxes stay open if not run.
- Framework adapters own separate files, shared registration/gates/release/docs are root-owned. Root commits through a temporary index with exact paths.

## Tasks

- [x] Solid package: SSR/async/head nonce/ids, hydrate/store reconciliation/deletions/disposal, slots, JSX/Vite ownership and actual delegation-collision behavior, node/type/build/browser tests.
- [x] Vue package: SSR/teleport head/ids, symmetric setup module, hydrate/reactive full snapshots/disposal, named slots, SFC ownership/scopedCSS, node/type/build/browser tests.
- [x] Svelte package: SSR/head/ids, shared raw snippets, rune props, hydrate/mount/recovery/disposal, SFC/runes ownership/CSS, node/type/build/browser tests.
- [x] Shared framework-free head parser extraction with React regression parity; Vitest/Nx/CI/package/release/zero-cost registration; exact dependencies and lock.
- [x] Serial integration gates, package smoke, updated guide/API notes and independent review; confirmed problems fixed.
- [x] Commit verified named paths through temporary index.

## Review focus

Unique hydration ids across islands; preserve actual existing Rivet slot nodes and state; callbacks fire once; deleted props disappear; rejected/failed async SSR and interrupted hydration dispose cleanly; static SFC CSS appears before client boot; client-only/live policies; foreign nested components; Solid1.9 never resolves root Solid2rc accidentally; unrelated pages include no optional adapter code; measure namespace-related compression changes separately.

## Ledger

- Starting HEAD 1efdcb157. User clarified islands means Solid/Vue/Svelte adapters, not other stabilization areas.
- Existing bridge core/React/Preact T3–T8 implemented; T9–T11 adapter work unimplemented. Three disjoint implementation agents launched under dispatching-parallel-agents; root retains shared state, install and heavy gates.
- Confirmed pins: Solid1.9.15 + vite-plugin-solid2.11.14 (existing stable toolchain); Vue/server-renderer3.5.43 + plugin-vue6.0.10 (supports Vite8); Svelte5.57.2 + vite-plugin-svelte7.3.1 (supports Vite8/Svelte>=5.46.4).
- Vue setup(app) remains per-island: direct createAdapter({setup}) and Vite setup module path exporting default hook, with virtual adapters on both sides. No function serialization/facade protocol extension.


## Integration findings

- Namespaced delegated callbacks consistently across full/lite/spread runtimes. Tests demonstrate foreign Solid handlers are ignored, lite handlers survive full-runtime handoff, and explicit handlers compose with/remain after spread updates.
- Native SSR CSS needs both static import closure and actual native async module reporting. Vue SSRContext.modules drives moduleCss lookup; links flush outside streamed templates. No CSS queue is allocated without CSS.
- Exact Vue/Svelte native head ranges preserve resource identity and per-island ownership. Server-only merge helpers fold out of browser builds (ordinary head and rankMerge output byte-identical to the starting HEAD). Native head requires Kit, an early head hold and one title author.
- Native-head pages add a nonced lifecycle bootstrap, including static native-head islands. Lean boot now retains handles and disposes disconnected roots, including late async results; synchronous moves retain roots. These are deliberate opt-in costs.
- Fixed missing Kit sink wiring in generated SSR definitions. Production Vue fixture verifies parser-created head nodes survive automatic-facade hydration.
- Independent review reproduced and verified fixes for namespace handoff/composition, native-head navigation cleanup, async Vue readiness/rejection cleanup and cursor-validation cleanup. Final review found no remaining actionable findings.
- npm lock adds required workspace/native dependencies. babel-plugin-jsx-dom-expressions 0.40.10→0.40.11 is required by the new native Solid preset (^0.40.11), rather than an unrelated direct dependency upgrade.
- Initial maintained-suite results: Solid node11/browser18; Vue node12/browser19 plus Node24 cursor-cleanup repro (permanent browser case added); Svelte node11/browser8; focused CSS7 and shared native head node14/browser5. Final root integration results follow below.

- Final Svelte protocol recheck caught missing nonce forwarding to the new native-head lifecycle callback and missing discard before fresh mount. Sync/async nonce regressions were RED→GREEN; browser fallback resource-preservation case added for root rerun.
- Svelte experimental runtime-dynamic child CSS is outside the promised static import closure. Native compile/render produced scoped child HTML/head-empty and separate CSS; public5.57 render has no module collector. Statically imported async/conditional children work; the guide documents static import as the SSR styling path. No injected private Svelte module collector is claimed.
- General gates:59 completed with no new reds; max treeRSS2.91GiB. Size check reported2 existing compression-noise fields within20B. Namespaced browser runtime min/raw byte counts are unchanged; frame Brotli shifts -66…+233B are deliberate compression changes. Server/CSS/native-head and lean lifecycle baselines are intentional updates. Lean boot1777→2141raw,837→990Brotli.
- Combined multi-project Vitest run was interrupted: it eagerly started several browser providers and sampled3148MiB. Replaced with separate one-worker projects, process-tree limit3072MiB, retained original failure log. Two stale core assertions (new exports and lean-tail byte budget) were updated; clean per-project bridge run passed75tests.

- Final per-project verification: core bridge75node; all adapter suites green, including React/Preact compatibility. Compiler508pass/1skip; runtime740pass; runtime-dev736pass/4skip; scripts106pass; docs64pass. Full router run439pass/1known document-links timingflake; unchanged isolated test then passed. Initial logs retained.
- Latest Svelte24tests (14node/10browser) pass, including shared settled readiness for native async body and preserved original-button intent replay once. Fresh mount waits for the same public readiness; no private Svelte collector is added.
- Node24.18.1 tarball smoke passes all packaged libraries:215plain imports in default/development (170further paths requirecompiler),246DOM/245server compiled imports,2router constant checks,471strict typed subpaths. No templates rerun in this smoke; real native production/browser fixtures cover newadapters. Single-process peak2.23GB; source tests managed per-project below3GiB.

- Root final totals:2877 passed checks across maintained projects after isolated retry of the unchanged known router timingflake;5 skipped (compiler1/development runtime4). Svelte final24, Solid29, Vue32. Reports retain initial failure/interruption and retry evidence rather than hiding them.
- After final API/Svelte edits,12 targeted gates passed (max1.81GiB), including regenerated committed API JSON, docs build/content/snippets/llms/MCP data and package hash update. Final source Svelte own-code hashes:server1059/client1377minB; ordinary browser head hooks still compile away.

- Final read-only ratchets: frame payload within ceilings; runtime+lanes identical; dev leaks none264entries; condition parity21entries; compiler corpus176/176. Native adapter benchmark lanes remain deferred.
