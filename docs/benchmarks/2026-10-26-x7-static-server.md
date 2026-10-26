# X7 — server without JS for static parts (lane ZERO X7, 2026-10-26)

Question: can every static subtree of server output cost ~0 JS at request time — static child components, layouts,
icons, ui parts and docs prose inlined into the parent's precomputed constant (a), loops over build-time-constant arrays
precomputed (b), whole static routes / sections as one constant (c), no closure / call / concat per static element (d),
no resume markers / records for static parts (e)? Kill criterion: ≥ 1.5× server CPU on static-heavy pages (docs pages,
ui-docs frames) with no regression on dynamic pages.

**Verdict: no land of a compile-time precompute pass.** On main, static markup already is pre-encoded segments; what
remains per request on static-heavy pages is real (≈ 65 % of a docs page's render assembles bytes that never change), but
a sound compile-time proof covers almost none of it: the hot parts flow through live boundaries' props and cdk / ui
components with contexts and spreads, and the 36 fully static ui frames are 0.8 % of frame CPU. Both docs sites are
prerendered, so production already serves the constant. Landed instead: one hotspot found on the way (docs-kit
`chart-model` built an `Intl.NumberFormat` per label: `/about/benchmarks/` 4.3 → 0.8 ms, 5.2×, identical bytes).

Host: Apple M4 Pro (14 CPU, 48 GB), macOS, Node 26.5.1, shared with other lanes (load 3.5–5.3). Base = main `2b0b7c1db`.
Harness: `apps/ssr-bench/spikes/x7/` (README there).

## 1. The codex record, reproduced

Codex's "server-scale" diagnostic (`.superpowers/sdd/2026-10-25-universal-resume-demand/experiments/semantic-ui/server-scale/`
in the codex worktree): N instances of the docs examples two-way-input (`greeting`) / show-hide (`details`) under numbered
`<section>`s; "ordinary resumable" = production Vite build + router `renderDocument` + `Response.text()`, "bare" =
plain compile + `renderToString`; each page consumed as Buffer + SHA-256 inside the timer; median of 5 isolated
processes. `cold-build.mjs` + `cold-run.sh` rebuild the same pages from this tree (bare floor bytes / sha identical to
codex's, `8a386b45b8` / `60be9ce2ad` at N = 1000).

| N = 1000, CPU / wall ms, maxRSS | codex recorded | codex artifacts re-run today | main 2b0b7c1db |
|---|--:|--:|--:|
| greeting resumable | 5.59 / 2.37, 199 MiB | 6.05 / 2.66, 181 MiB | 4.35 / 1.83, 135 MiB |
| greeting bare | 1.42 / 0.73, 89 MiB | 1.71 / 0.83, 92 MiB | 1.78 / 0.88, 91 MiB |
| details resumable | 5.41 / 2.54, 199 MiB | 6.21 / 2.95, 210 MiB | 4.87 / 2.18, 132 MiB |
| details bare | 1.67 / 0.80, 90 MiB | 1.95 / 0.90, 93 MiB | 1.89 / 0.95, 92 MiB |

| main, CPU ms (wall) | N = 1 | N = 100 | N = 1000 |
|---|--:|--:|--:|
| greeting resumable / bare | 0.046 / 0.007 | 0.515 (0.226) / 0.199 (0.089) | 4.35 (1.83) / 1.78 (0.88) |
| details resumable / bare | 0.048 / 0.007 | 0.528 (0.246) / 0.192 (0.094) | 4.87 (2.18) / 1.89 (0.95) |

- Reproduced (their build today: 3.5× / 3.2× CPU). Main since: resumable −28 % / −22 % CPU, −25 % / −37 % RSS (lanes
  BE-RENDER, SEGMENTS, NATIVE tail fix, ...); the gap to bare is 2.4× / 2.6× CPU, 2.1× / 2.3× wall.
- The gap is not static assembly. Profile of main greeting N = 1000 (main thread): harness SHA-256 12.8 %, `admit`
  11.5 %, `writeBytes` 5.0 %, `putText` 4.3 %, `rawPut` 4.2 %, `_rB` 2.8 %, `flush` 2.5 %, `promiseOf` 2.2 %, `_rBEnd`
  1.7 %. CPU − wall ≈ 2.5 ms/page runs on other threads (GC: derived allocates 3.4 vs 1.8 MB/page,
  `.zbe`-style in-process `derivedToString`: 0.66 vs 0.35 ms greeting, 0.93 vs 0.47 ms details). Both pages are fully
  interactive (every instance is a boundary): nothing static to precompute beyond what the fragments already hold.

## 2. Where server CPU goes on static-heavy pages (main)

In-process handler (`pages.mjs cpu`, best of 5 × 200):

| page | µs / req | KB alloc | body B |
|---|--:|--:|--:|
| docs `/` | 232 | 362 | 50,165 |
| docs `/guides/components/lists/` | 482 | 632 | 88,788 |
| docs `/guides/deploy/node/` | 468 | 1,000 | 165,914 |
| docs `/about/benchmarks/` | 4,319 | 1,094 | 146,125 |
| docs frames tutorial-02 / resume-demo / computed-total / card-slots | 16 / 18 / 41 / 30 | 46–76 | 3–9 K |
| ui `/` | 669–712 | 666 | 32,766 |
| ui `/components/table/` | 2,228 | 2,615 | 329,232 |
| ui frame chip-variants | 397 | 701 | 96,507 |
| ui frame showcase-storefront / -product | 651 / 842 | 947 / 1,079 | 79 / 86 K |
| ui frame table-virtualization | 7,601 | 13,595 | 47,555 |
| ui frame range-calendar-year-picker | 3,632 | 6,360 | 79,226 |
| ui frame data-grid-selection / chain-of-thought / prompt-input / button-basic | 212 / 86 / 162 / 26–51 | 84–250 | 8–17 K |

All pages (`pages.mjs all`, min of 3 passes): docs 1,028 pages Σ 158 ms (median 112 µs); ui-docs 4,135 pages Σ 922 ms
(median 141 µs), frames 1,048 = Σ 296 ms. real-app-prof (`scripts/real-app-prof/run.ts`, 4000 req): playground 47.1,
routes-100 41.4, routes-500 41.0 µs/req (router floor dominated; static assembly a few %).

Self-time buckets (`prof.mjs`, non-minified builds):

| bucket | docs `/guides/deploy/node/` | ui chip-variants | ui storefront-product | ui `/` |
|---|--:|--:|--:|--:|
| record walk (runtime `server.ts`: `rawPut`, `admit`, `recordBytes`, attributes, lists) | 34.0 % | 54.3 % (`admit` 15.3) | 45.0 % | 36.2 % |
| output encode / write (`utf8Write` of hole strings, `writeBytes`) | 13.5 % | 4.3 % | 2.7 % | — |
| escape (attribute / text holes) | 10.7 % | ~1 % | — | — |
| derived record / tail | 8.3 % | 3.0 % | 10.8 % | 12.2 % |
| component functions | 6.8 % | 8.6 % (`chip`) + cdk | — | — |
| gc | 5.2 % | 4.6 % | 4.4 % | 7.5 % |
| harness body read | 7.0 % | 2.6 % | 2.1 % | 3.1 % |

So on a docs page ≈ 65 % (walk + encode + escape + component calls) assembles output identical on every request; the
ceiling of a perfect X7 is large (§ 3). The question is what a compile-time proof can reach.

## 3. Ceiling: synthetic static-heavy page (`ceiling.mjs`)

100 cards from a module-constant array (each: static icon component, header component with a title prop, prose with
`&` / `<`, link) + one counter boundary; µs/page, best of 7 × 500:

| | plain | derived | one constant |
|---|--:|--:|--:|
| as written | 31.5 | 33.9 | 0.4 |
| static child components inlined by hand ((a) alone) | 24.8 (−21 %) | 30.1 (−11 %) | 0.4 |

Cross-component inlining alone ≈ −11…−21 %; the ~70× is reachable only when the whole subtree incl. its data is constant.

## 4. Items (a)–(e) on main

- **(d) no closure / call / concat per static element: already true.** The Rust server lowering hoists frozen fragment
  arrays; static elements, attributes, text and the `<!--[-->` markers between them are one fragment; the runtime
  encodes each array to UTF-8 once (`encodedFragments` WeakMap). Per static *component* call: one call, a props object,
  a `Compiled` record (+ a tape function in list rows).
- **(b) loops over constant arrays: rows already share a plan.** `_listPlan` precomputes a row's fragments and inlines the
  fragments of static child components (`Card__rivetPlan` = Card + CardHeader + Icon), holes only for row data. A fully
  constant loop needs the row body (component calls, expressions) evaluated at build time.
- **(a) static subtrees across component boundaries: not provable where it matters.** docs pages: everything sits under
  live boundaries (SiteFrame, DocPage, MobileMenu); SideNav / TOC get their data via props from those components
  (`path`, nav data), so no call site has literal inputs; the prose is already literal JSX (one fragment per run) and
  lucide icons already compile to inline SVG (`static-icons.ts`). ui frames: the repeated parts are `@rivetjs/ui` / cdk
  components (contexts, `splitProps` / `mergeProps` spreads, tv tables); proving their bodies pure needs a whole-program
  effect analysis or build-time execution with tracking (context / id / boundary / style / module-state reads) — a
  partial evaluator, not a pass.
- **(c) whole static routes as one constant: coverage ≈ 0.** 36 of 1,048 ui frames have no boundary and no tail = 0.8 %
  of frame CPU; docs + ui-docs are prerendered (production serves constants already); server-mode routes that are
  static can use route-level prerender / shell cache (router).
- **(e) markers / records for static parts: not all removed.** docs `/guides/deploy/node/`: 136 `data-b`, 123 of them
  orphans (SideNav `Item`s: recorded as boundaries, elided from the tail — facts classify Item live because its
  expression props come from a live caller; W8 deferred); `<!--[-->` / `<!--]-->` pairs = 4.2 % of docs HTML bytes
  (90,390 opens over 1,028 pages), 3.2 % of ui-docs (240,625). tutorial-02 frame: 0 markers (fixed by STATIC-ZERO).
  Their server CPU is the "derived record / tail" bucket above (3–12 %).

## 5. Landed: docs-kit chart formatter cache

`/about/benchmarks/` spent 79.7 % of its render in `formatValue` (`Number#toLocaleString("en-US", { … })` builds an
`Intl.NumberFormat` per call). `chart-model.ts` keeps one formatter per digit count (tick formatter separate).

| | base | patched |
|---|--:|--:|
| `/about/benchmarks/` µs/req (two runs) | 4,242 / 4,542 | 822 / 842 (5.2–5.4×) |
| docs all 1,028 pages Σ ms | 157.8 | 158.9 (noise) |
| handler bodies (normalised asset hashes / nonces) | | 1,027 / 1,028 identical; `/examples/resume-demo/frame/` differs base vs base too (nondeterministic) |

Test: `libs/docs-kit/tests/chart-model.test.ts` compares the cached formatters with `toLocaleString` over edge values
(−0, NaN, ∞, 1e21, rounding ties) and keeps the RangeError for invalid digits.

## Step 2 (Rust / wasm hole engine): not run

The gap after step 1 is recording, `admit` and GC (§ 1), not hole filling; BE-RENDER (JS concat 5 fragments + 4 holes
3.4 ns vs `encodeInto` + wasm call 50 ns) and NATIVE (≤ 2.5× request win incl. router; lane report, its benchmark doc not on main)
already measured that direction.

## What would move these pages

- `admit` PURE skip (W7, BE-RENDER): 11.5 % (codex page) / 15.3 % (chip-variants) of render.
- facts: data props from a live caller need not make a component live (SideNav `Item`: 123 orphan boundaries per docs page).
- cdk / ui render cost (spreads, `mergeProps` `hasLive`, `CalendarDate` math): the slowest ui pages are flat profiles there
  (`/themes/` 12.2 ms, calendars 3.7–4.7 ms, color-swatch-picker-sizes 4.4 ms: `parse` color + i18n `formatString`).
- A comptime component prerender (build-time execution of a call subtree with literal inputs, refused on any context /
  id / boundary / style / module-state / non-deterministic read) is the only route to (a)–(c); it needs its own design.
