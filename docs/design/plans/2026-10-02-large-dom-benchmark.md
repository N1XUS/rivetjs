# Large DOM benchmark implementation plan

**Goal:** Measure substantial client pages and committed reactive updates in production Rivet, React DOM, and Solid, including retained heap after disposal.

**Architecture:** Three independent production bundles implement an identical native HTML tree and imperative benchmark contract. A Chromium runner rotates fresh-page trials and validates complete output outside timed sections. Shared data contains ten independently reactive fields per row; React uses field-local state rather than forced whole-page rerenders.

**Tech Stack:** Existing Rivet DOM compiler, pinned React DOM production, pinned Solid compiler, esbuild, Playwright Chromium/CDP.

**Spec:** Existing compiled-runtime design and user requirements: 100/1,000/5,000 components, substantial HTML, 1%/10%/100% updates, CPU/memory, production React/Solid baselines. Lighthouse is excluded from performance conclusions.

## Contract

`window.bench = { mount(rows), update(indices, revision), dispose() }`. Methods return only after the synchronous committed DOM operation. Fields have `data-field="<flat index>"`; rows have `data-row="<row index>"`; field value is `value-${index}-${revision}`. Mount resets revision to zero. Dispose releases adapter references and is idempotent. Each field has an actual click handler that increments its own revision. Identical skeleton: main > section per row > header(h2, p) + div.fields > ten label.field > span.caption + strong[data-field] + button[data-action] > span; footer > small. No virtualization, hidden subtrees or containment shortcuts.

## Constraints and review focus

- Same HTML elements/text/styles/viewport and update selection; framework comments may differ and are counted separately.
- Validate all values, unchanged text-node identities, clicks and empty DOM after disposal; malformed output invalidates a trial.
- Separate JS committed update wall time and Chromium task CPU from forced style/layout and frame-settle time; do not call frames paint time.
- Retained heap is forced-GC JS heap in Chromium, not process RSS or a proof of no leaks.
- Fresh pages, rotated framework order, repeated samples, source/bundle hashes and browser versions; no builds during timing.

## Tasks

- [x] Add failing contract tests and implement three adapters and production build; root owns shared package/lock/build files, adapter worker owns adapters.
- [x] Add runner tests first, then correctness-gated runner and repeated disposal/heap measurement; root implemented runner after agent thread capacity was reached.
- [x] Verify contract in Chromium, review fairness and measurement definitions, and commit runnable harness (`abea1bd`).
- [x] Run controlled large workload without concurrent tests/builds and record reproducible report with limits. The first run exposed the scheduler width cap; regression fix `b710b72` preceded the complete 27-trial rerun. See `docs/benchmarks/large-dom-comparison.md`.

User's existing autonomous implementation and delegation authorization applies; use the current checkout with disjoint file ownership. No additional plan approval is needed.
