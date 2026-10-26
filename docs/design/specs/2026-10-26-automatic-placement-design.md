# Automatic code placement (design, 2026-10-26)

Lane PLACE (moonshot "A", user-chosen 2026-10-26 with "B" = INCR). Status: **phase 1 prototype**: graph IR, legality, cost model, solver, calibration harness and explain output over the backends on main. One decision kind is live: per-call-site independence. Measured results: §8 (identity met; measured table wins bytes on 7 frames but first click only on 4 of them). Code:

- `libs/compiler/place.ts`: graph builder, apply, `explainText`.
- `libs/compiler/rust/src/place/*`: IR, legality, cost, solver, explain.
- `scripts/place/calibrate.ts`: calibration harness.
- `libs/compiler/place-table.json`: the cost table measured on the reference machine.

## 1. Problem

- Today each placement choice is a hand-made rule inside the pass that owns it:
  - ZERO A1 `static`: no markers when no adopt walk reaches a component.
  - fixpoint `independent`: props in the record when every site passes data.
  - ZERO CALLSITE `site` / `free`: independent + context-free at a proven site.
  - LITE-WIRE: lite runtime when every record has a residual.
  - COMPTIME: build-time literal / table / defer per call.
- Each rule assumes "more independence / more build time is always better". That is false at the margin:
  - CALLSITE grew 16 ui frames (button-custom-styles +616 B, card-with-images +280 B HTML) with no first-click gain;
  - COMPTIME tables cost +0.1…+4.5 KB on override pages.
- Goal: one whole-program graph. For every node the compiler picks among the backends that provably keep behaviour, by a cost model calibrated from measurements. Today's rules are one cost table (the heuristic table), so the default build is unchanged.
- Semantics are fixed. Legality comes only from proofs that the owning pass already computes. When no proof exists, the node keeps today's default.

## 2. Graph IR (`rust/src/place/ir.rs`)

Built once per build in `vite.ts` `derivedWalk`, after `boundaryFacts()`.

| Part | Fields | Source |
| --- | --- | --- |
| `modules[]` | `id`, `bytes` (source bytes) | walk |
| `components[]` | `id` (`file?Name`), `module`, `elements` (native JSX elements written in it), `interactive`, `source` (own change source or `listens`), `live` (live props / context), `adopted`, `independent`, `free`, `root`, `siteCapable` (props object + `dependentBecause` `context` / `call-site`), `lite` | `moduleFacts` `boundaries` + fixpoint + call-site proof |
| `sites[]` | `caller`, `callee`, `index` (into the caller's `calls`), `bytes` (props source bytes), `data` (`calls[i].inputs`), `proof` (`proven` / `not-data` / `touch-top` / `above-top` / `overlap`), `demoted` (element children: the server demotes a `SITE` instance) | `moduleFacts` calls + `facts-callsite.ts` trace |
| `pages[]` | `id`, `root` (component), `weight` (traffic share, default 1) | route / derived roots + shell pages |

- Instances are expanded per page by `Graph::expand`:
  - owner tree: the caller that wrote the JSX is the parent;
  - preorder, so subtrees are contiguous ranges;
  - a component a third time on the path is recursion and is cut;
  - caps: depth 64, 20,000 instances (`truncated`).
- Node kinds, phase 1: component instances, and call sites as decision variables. Phase 2 adds:
  - expression / handler / effect / derived-value nodes from the Rust resume analysis (`Resumed.sites`);
  - context reads (`facts_refs.rs`);
  - loaders (router codegen);
  - comptime calls (`comptime.ts`).
- These are the same graph the INCR lane needs (§7).
- New facts in this change, all cost features and never verdicts:
  - `moduleFacts` boundaries `elements`;
  - `calls[i][5]` props bytes;
  - `calls[i][6]` element children.

## 3. Legality per backend (`legal.rs`)

| Backend | Node | Legal iff (proof owner) | Today's default |
| --- | --- | --- | --- |
| `static` (server only, no markers) | component | `!adopted` (ZERO A1 fixpoint) | used whenever legal (dominant: zero client cost) |
| `standalone` (independent record, props in state) | component | `independent` (fixpoint: props object, no context, data at every site) | used whenever legal |
| `standalone-ctxfree` | component | `independent && free` (call-site proof at every site) | used whenever legal (dominant: adopts less) |
| `site` (`_rS`, independent + context-free at one site) | call site | callee `siteCapable`, interactive, not root / independent; site proof `proven` | used whenever legal — **phase 1 variable** |
| `with-parent` (dependent: adopts with its kept ancestor) | component / site | always, for a boundary (every ancestor of a boundary is a boundary) | fallback |
| `lite` runtime | page | every kept record independent with a lite residual (`derived_lite.rs`) | picked by the server per page |
| comptime literal / table / defer | call | pure + deterministic (allowlist / `@comptime`, RV2108) | annotation |
| worker (OFFMAIN) | handler / effect | no DOM / sync-context access (phase 2, from OFFMAIN facts) | main thread |
| CSS automaton (STATESPACE) | state → attribute | finite state space, CSS-expressible (phase 2) | JS |
| specialised hook residual (SPECIALIZE) | cdk hook call site | constant / finite hook args (phase 2, board `place-specialize.md`) | generic hook |
| server native (NATIVE) | server render unit | no JS-only semantics (phase 2) | server JS |

- The bytecode VM is dropped: lane VM failed its kill criteria (`ZERO-VM-report.md`).
- A `site` at a call with element children is legal, because today's marks include it. The server demotes it, so the model prices it as `with-parent`.

## 4. Cost model (`cost.rs`) and calibration

### 4.1 Model

- Unit: expected milliseconds of client time per page view. Server µs are converted by `serverMsPerUs`.
- A page is simulated with the runtime's own rules:
  - **Independent / context-free:** an instance is independent when its component is, when it is a root, or when its site uses `site` (not demoted). It is context-free when `free` or `site`.
  - **Kept records:**
    - always kept: `source` (own source or listener), or `live` at a call that passes non-data (`calls[i].inputs` false; literal props are static, the server drops a `COND` instance otherwise);
    - else kept when a dependent kept boundary sits below (`COND`, `server-derived.ts`);
    - an independent child never keeps its parent.
  - **State bytes:**
    - independent kept records × `recordBytes`;
    - dependent ones × `dependentRecordBytes` (tail v2 sibling runs);
    - plus `propsRatio` × the site's props bytes for independent non-root records.
  - **JS:** module source bytes in the subtrees of top kept records (`data-fo` fetch-ahead of every adopted unit) × `jsMsPerByte`. Add the runtime (`runtimeLiteMs` / `runtimeFullMs`) when the page has records.
  - **First interaction:** targets are the source instances. From each target's record, climb to the nearest kept ancestor while the record is not independent + context-free (the intake-3 "enclosing records" rule, `dom-derived.ts` `around`). Cost = (`adoptMsPerElement` × subtree elements + `adoptMsPerRecord` × subtree records), averaged over targets, × `pInteract`.
  - **Server:** records × `serverUsPerRecord` + state bytes × `serverUsPerStateByte`.
- Objective = Σ pages weight × page cost − `siteBonus` × (number of `site` choices).
- **Heuristic table:** `{ kind: "heuristic", siteBonus: 1 }`. Everything else is 0, so every proven site uses `site`; this is the unique optimum.
  - The default build runs the solver with this table.
  - `place.ts` checks that Rust's legal set equals the call-site proof's marks. On a mismatch it warns and keeps today's lists, so the default build stays byte-identical by construction.
  - Measured byte-identical: §8.1.

### 4.2 What phase 1 does not price

- The runtime choice: no `site` decision changes whether a page has records. A `SITE` component is never lite-eligible (lite needs `INDEPENDENT` at compile time). So `runtime*Ms` = 0 in the measured table. The term exists for phase-2 variables (component independence, static vs adopted).
- Chunk grouping: modules are priced individually, while chunks are shared (`ChunkGroup`, merge budget).
- Lazy row adoption: subtree elements count every row.
- Request waterfalls: no RTT term per added file. CALLSITE measured +3 files on the `with-parent` side in several frames; RTT is not priced yet. A phase-2 term is `files × rttMs / parallelism`.

### 4.3 Calibration (`scripts/place/calibrate.ts`)

Each coefficient is a least-squares fit, with R² stored in `meta`. Profile: Lighthouse mobile (1.6 Mbps, 150 ms RTT, 4× CPU) or desktop.

- **JS:**
  - compiled DOM bytes per source byte, raw and gzip, over the 131 `@rivetjs/ui` component modules;
  - V8 parse + compile ms per raw KB from `vm.SourceTextModule` construction (the same engine as Chromium), × the CPU factor.
- **HTML / state:**
  - tail bytes = a + `recordBytes` × independent + `dependentRecordBytes` × dependent + `propsRatio` × props bytes, from server renders of a synthetic page (N parts × props size, `site` vs `with-parent`);
  - the compression of a state byte comes from `--ab` real frame builds (Σ |Δ gzip| / Σ |Δ raw| over frames whose fetched files did not change), or else from the synthetic page.
- **Server:** µs per render = a + b × records + c × state bytes, from the same renders (median of `--runs` × 200).
- **Browser:** Chromium (Playwright, runtime served by the resume test harness), first-click `ScriptDuration` = a + b × adopted elements + c × adopted records, over a parent with E ∈ {0, 200, 800} static elements around N ∈ {1, 40} parts, `site` vs `with-parent`.
- **Policy inputs (not measured):**
  - the network profile;
  - `pInteract` (default 0.5);
  - `serverMsPerUs` (default 0.001: server time counts like TTFB).

## 5. Decision algorithm (`solve.rs`)

- Variables: sites with two legal backends. The objective separates by page; a variable touches the pages that hold an instance of it.
- **Regions** are connected components of the variable–page incidence graph (union-find).
  - A region with at most 12 variables, where 2^k × its pages ≤ 2^18 page evaluations, is solved exactly by enumeration.
  - A larger region uses strictly improving local search:
    - single flips;
    - group moves (every variable of one caller, every variable of one callee, set together): the fixed charges of a parent record and of a callee's `SITE` code need a whole group at once;
    - two starts, today's assignment and the conservative one (no `site`); the cheaper end wins.
- **Guarantees:**
  - never costs more than today's assignment under the table (the result is checked and falls back to today's);
  - ties keep today's choice;
  - exact = brute force on small graphs (tests: 25 random graphs).
- **Why not min-cut or ILP now:**
  - The phase-1 objective is not pairwise submodular. The adopt climb couples a target with every record above it, and "parent kept iff some dependent child kept" is an OR fixed charge.
  - The binary fixed charges alone are a project-selection problem (s-t min-cut): `parent kept ≥ ¬site_i` and the parent's charge, lite reward ⇐ all records independent. The adopt term breaks that structure.
  - Regions on real builds are small: ui-docs 390 variables in 187 regions, largest 38, 67,120 instances over 1,201 pages, solved in ≈ 70 ms in wasm. Enumeration plus local search is exact where it matters and cheap elsewhere.
  - Phase 2 adds multi-label nodes (comptime / JS / worker / CSS automaton / specialised). Each region then becomes a small ILP (one-hot backend per node, linearised fixed charges with indicator variables, adopt work as a linear function of the "top kept" indicators along each target's ancestor chain). It needs an external solver only past ~100 variables per region. α-expansion over the min-cut core is the fallback for big regions.

## 6. Debuggability

- **`explain-placement`:**
  - Env `RIVET_PLACEMENT_EXPLAIN=<file>`, or `rivet({ resume: { placement: { explain: <file> } } })`.
  - The build writes `<file>` (JSON: result + graph) and `<file>.txt`. Example:

    ```
    placement: table measured, local-search, 390 variables in 187 regions (largest 38), 1201 pages, …
    cost (ms / all page views): today … chosen … conservative …
    * with-parent examples/x/src/routes/index.tsx?CustomStyles → <ButtonRoot> (call 0)  [legal: with-parent, site; proven]  if site: +0.4 ms (records -1, state 895 B, js src -2341 B, adopt … el) on 1 pages
    ```

  - `*` marks a decision that differs from today's.
  - Each line gives the legal set and the first reason a backend is missing, then the marginal "if other" delta per cost term over the variable's pages.
  - Component backends (`static` / `standalone` / `site` / `with-parent`) and per-page breakdowns are in the JSON.
- **Dev overlay (phase 2, devtools):**
  - the DevTools tree colours each instance by backend;
  - hovering shows the explain line;
  - "why not X" names the missing proof (the `legal.rs` reason, plus `RIVET_CALLSITE_WHY` chains for context overlaps).
- **Measured mispredictions:** `calibrate.ts --ab` compares predicted page deltas with a pair of frame builds.

## 7. INCR: one graph

- Board `place-incr.md`. Same nodes (component instances per page) and same edges.
- PLACE answers *where*; INCR answers *when* the server recomputes (every request vs a replayed segment, `server-segment.ts`).
- INCR contributes node facts:
  - request inputs reaching a node (route params, loader keys, headers, time, random);
  - `segmentable` (its legality proof);
  - replay vs render µs;
  - bytes held per segment.
- `recompute | replay` is then one more two-label variable on the same node, weighted by the request-frequency prior.
- A `static` node is the best segment candidate: no markers inside. A `site` record's props are re-emitted by a replay.
- SPECIALIZE (board `place-specialize.md`) joins as a call-site backend for cdk hooks, with group moves per constant-argument tuple.

## 8. Measurements (phase 1)

Raw files and commands: `$K/ZERO-PLACE-report.md`. Machine: Apple M4 Pro; profile mobile (1.6 Mbps, 150 ms RTT, 4× CPU).

### 8.1 Kill criterion 1: byte identity — met

- ui-docs frame build (26-frame subset; the walk holds 1,201 pages, 390 site variables, 187 regions), `RIVET_PLACEMENT=off` vs default (`heuristic`): `diff -r` of 2,462 client + server files empty (final wasm).
- Compiler tests 403/403, parity 176/176, zero-cost runtime + Rivet lanes identical (no `--update`).

### 8.2 Calibrated table (`place-table.json`)

| Coefficient | Value | Fit |
| --- | --: | --- |
| `jsMsPerByte` | 0.00119 | gz 0.240 / raw 0.816 per source byte, parse 0.006 ms/KB at 1× (R² 0.97) |
| `htmlMsPerByte` | 0.00160 | A/B gz ratio 0.327 over 7 frames (synthetic 0.092: Tailwind-like classes compress less on real pages) |
| `recordBytes` / `dependentRecordBytes` / `propsRatio` | 16.7 / 0.13 / 1.0 | R² 0.99999 |
| `serverUsPerRecord` | 0.45 | R² 0.998 |
| `adoptMsPerElement` / `adoptMsPerRecord` | 0.00074 / 0 | **R² 0.19**: synthetic first click 3–6 ms flat, noise > signal |

### 8.3 Kill criterion 2: measured win — partial

`measured` vs `heuristic`, same 26 frames: 98 site decisions differ; 7 frames change, every one JS-neutral (same files, same JS bytes):

| Frame | HTML B | HTML gz B | First click 4× ms (heur → meas, medians of runs) |
| --- | --: | --: | --- |
| theme-compare | −188 | −69 | 92 → 88 |
| scroll-shadow-with-card | −120 | −46 | 92 → 83 |
| card-with-images | −353 | −84 | 88 → 87 |
| showcase-storefront-product | −244 | −50 | 131 → 123 |
| theme-swap | −200 | −95 | 133 → 142 |
| button-brand | −200 | −55 | 99 → 105 |
| button-full-width | −53 | −29 | 100 → 130 (reproduced by the all-`with-parent` run: 102 → 127) |

- A win on the bytes (all 7) and, within noise, on first click for 4 (theme-compare, scroll-shadow-with-card, card-with-images, showcase-storefront-product).
- First click is worse on 3, and button-full-width is reproducibly +25–30 ms.
- Cause: the adopt cost. The synthetic browser fit gives ~0 ms per extra adopted record. Real frame pairs give ≈ +2 ms per adopted record (Δ first click / Δ records over the 7 pairs, noisy). At that slope the optimum with `pInteract` 0.5 is today's heuristic on these frames: the HTML saving is ≈ 0.1 ms per site, the adopt cost ≈ 1 ms.
- `measured` only beats today's choice when `pInteract` ≲ 0.05: mostly-read pages, as weighted by traffic.
- Model fix found by the A/B: the first graph forced `live` (possibly-live) callees kept. alert-basic then predicted 0 B of JS change for dropping `site`, but the measurement showed +13 files and +7.2 KB gz. Fixed by the `data` rule (§4.1).

### 8.4 Next (phase 1.5)

- Calibrate the adopt cost from real frame pairs, not the synthetic page: `calibrate.ts --click` over the A/B builds, fitting per record + per unit module executed.
- Add an RTT term per added file.
- `heuristic` stays the default; `measured` is opt-in until it also wins on first click.
