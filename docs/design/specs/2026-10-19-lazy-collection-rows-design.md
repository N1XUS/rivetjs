# Lazy collection rows — the browser derives a row from (row function, item); the wire carries keys only (2026-10-19)

- Status: **design, round 1** (lane LAZY-ROWS). No code. Written on the user's question (2026-10-19, after the `table-virtualization` page weight report): *"why not just run on client to generate array instead of that huge json?"* and the ruling *"write the spec now, land state-diet after"*.
- Position in the plan: this is the **`For` rows slice of M2** of `../plans/2026-10-18-derived-client.md` (adopted layer, `../specs/2026-10-18-structural-resume-design.md` §3.1 "Lazy materialisation", §3.5 "`_for` in adopt mode"), specified here to implementation depth and ordered **first** inside M2's client track, because collection rows are where serialized resume costs O(rows × closures) and where a values-only wire wins the most per line of code. It does not change M2's wire for boundaries, keyed state or wake lists; it consumes them. R4′ of the plan (ROW-ABI / RESUME-ROWS-REMOVE paused) stands: this spec is the replacement for those lanes, not a continuation.
- Relation to the two diet lanes landed / landing today: TABLE-CELL-DIET (`ee759548`) and RESUME-STATE-DIET shrink the constant per row on the **serialized** wire (145 → 39 entries / row; chunk-list dedupe). They stay useful for rows this spec cannot make lazy (§3.3) and until M2 ships; they do not change the model. The ListBox per-item diet proposed by the CELL-DIET lane is **superseded** by this spec.

## 1. Problem, measured

ui-docs `table-virtualization` (cdk `Table`, 1000 rows × 3 cells; numbers below are the page as it was when this was written, every row rendered — since COLLECTION-VIRT landed the same evening the example renders inside `<Virtualizer layout={TableLayout}>` (11 rows in the DOM, HTML 73 KB, state 42 KB raw / 6.4 KB br). The per-row costs below still apply to every non-virtualized collection and to each materialised window):

| | HEAD before today | after CELL-DIET | per row |
| --- | ---: | ---: | ---: |
| `rivet/state` script, raw | 5,192,870 B | 2,695,185 B | 2,695 B |
| `rivet/state`, brotli 11 | 460 KB | 165 KB | 165 B |
| table entries (`t`) | 145,031 | 39,033 | 39 |
| frame HTML, raw / br | 6.66 MB / 482 KB | 3.53 MB / 192 KB | |

What the 39 entries per row are (CELL-DIET report): 35 handler entries in `e` (1,183 B; 8 per cell), 4 data objects (~105 B each), 4 `dom` `data-slot` objects, 14 signals, ~7 strings, the row provider list, 5 bindings. ListBox (`list-box-virtualization`, 1000 items): 40.5 entries / 901 B per item, 1.13 MB raw.

Every one of those entries is **a function of three things the page already has**: the row's render function (one per `For`, shipped as a symbol chunk), the item (the `items` array is loader data / a captured list, shipped once), and the collection's shared state (selection, focus, contexts — one region). The serialized wire ships the *result* of applying the function per row; the browser could apply it itself, for the one row the user touches.

Uniform rows already get this on the server side: an eligible native-element row renders from a compiled row plan (`$rows`, one template + compact rows `{i, d, a}`, `docs/guides/resumability.md` "uniform `For` rows"). Component rows — cdk `Row` / `Cell`, `ListBoxItem`, anything with contexts, render props or a `_c(child)` — are not eligible and pay per row. That is every collection component in cdk / ui.

### T1 baseline (2026-10-19, `node scripts/lazy-rows/probe.ts`, commit 2ad091cf = T2 landed)

Node v26.5.1, Chromium 153.0.8010.12, Apple M4 Pro ×14, load average ~5. Server: 5 warm-up + median of 20 in-process renders; click: median of 5 cold loads per CPU rate; first interaction = first body row clicked until its state changes (virtualizer-items: key `1` into the filter until the count changes). Rows = For groups by region symbol, share of `rivet/state` raw / br (saved = brotli bytes the share costs the page); `eligible` = compiler `forRows` verdict (T2) of the Fors in that component (groups whose For sits in another component carry none). Bytes equal f045f405 (before T2).

| page | HTML raw / br | state raw / br | server CPU / wall per render | first interaction ×1 / ×4 | recorded For shares |
| --- | ---: | ---: | ---: | ---: | --- |
| ui-docs `table-virtualization` | 71.7 KB / 11.4 KB | 41.0 KB / 6.2 KB | 26.7 / 14.5 ms | 20.6 / 28.6 ms | `Row` ×30 (cells) 8.5 KB / 1.3 KB br (saved 1.0 KB); `TableBody` ×10 5.3 KB / 920 B (774); `TableHeaderRow` (eligible) ×3 2.6 KB / 791 B; `VirtualizerRoot` (eligible) ×2 828 / 364 B; `TableHeader` (eligible) ×1 443 / 220 B |
| ui-docs `list-box-virtualization` | 106.4 KB / 10.9 KB | 83.0 KB / 6.2 KB | 10.1 / 4.9 ms | 42.6 / 64.1 ms | `VirtualizerRoot` (eligible) ×11 9.6 KB / 1.3 KB br (saved 1.3 KB) |
| ui-docs `table-selection` | 60.0 KB / 13.2 KB | 39.0 KB / 8.1 KB | 5.7 / 3.7 ms | 47.5 / 64.4 ms | `Row` ×20 17.5 KB / 2.9 KB br (saved 2.3 KB); `TableHeaderRow` (eligible) ×5 6.5 KB / 1.8 KB; `TableBody` ×4 2.1 KB / 574 B; `Table` ×2 615 / 306 B; `TableHeader` (eligible) ×1 202 / 122 B |
| cdk-docs `virtualizer-items` | 19.0 KB / 4.9 KB | 7.1 KB / 1.3 KB | 2.7 / 2.1 ms | 41.0 / 54.7 ms | `Virtualizer` (eligible) ×11 2.2 KB / 391 B br (saved 365 B) |

`RIVET_LAZY_ROWS=swap` (same commit and load; every For reports `lazy`, share 0):

| page | HTML raw / br | state raw / br | server CPU / wall | first interaction ×1 / ×4 |
| --- | ---: | ---: | ---: | ---: |
| `table-virtualization` | 47.4 KB / 7.1 KB | 20.0 KB / 2.6 KB | 20.2 / 12.1 ms | 66.2 / 67.1 ms |
| `list-box-virtualization` | 100.7 KB / 10.0 KB | 78.5 KB / 5.7 KB | 7.2 / 4.7 ms | 46.1 / 67.2 ms |
| `table-selection` | 41.7 KB / 9.8 KB | 21.9 KB / 4.9 KB | 3.7 / 2.6 ms | first click lost (create + swap replaced the target): ~1.0 / 4.1 s = probe retry timeout + second click |
| `virtualizer-items` | 16.1 KB / 4.4 KB | 4.8 KB / 896 B | 2.3 / 1.8 ms | 45.6 / 63.6 ms |

Reading: state br −58% (table-virtualization), −40% (table-selection), −8% (list-box: most of its state sits outside the rows), −31% (virtualizer-items) and server CPU −24% / −35% / −29% / −17% are the ceiling record suppression (T4) can take on these windows (rows still render; only recording + encode go). Create + swap costs the first interaction (×3 on table-virtualization, a lost click on table-selection): the adopt-mode materialisation (§3.4) is what has to keep it at today's numbers.

## 2. Principle

**Per-row wire = the row's key, and nothing else.** A row is `row(item, index)` evaluated against the collection's shared state. The server renders it (markup) and records nothing inside it. The browser materialises a row when something needs it: an event inside it, a signal it read changing, or a reconcile that keeps it. Materialising = running the row function **in adopt mode** over the row's existing server nodes (structural resume §3.1 "Adopt run": templates walk instead of clone, handlers attach, effects are created; no node is created, replaced or moved; focus / selection / scroll survive). Rows never touched cost their markers and their key.

This is structural resume applied at row granularity, inside a region that may still be serialized (today) or a boundary (M2). The row function is the boundary; the item is its props; the collection region is its spine.

## 3. Design

### 3.1 Server: a `For` records a row region, not rows

Today (`docs/guides/resumability.md` "`For` inside a region"): region entry `rows: [rowId, itemRef, flags, …]` per row, plus every site inside the row (handlers `e`, bindings, captures in `t`, provider lists `[12]`, `[13]` row reads).

Lazy: the region entry carries **one row-region record** `R = [forId, rowFnRef, itemsRef, byRef, flags]` and, per row, only what adoption needs:

As built (T4, 2026-10-19): the record is a top-level state list `L` (one `LazyRowsEntry` per lazy For: `[forId, region, rowFn, items, by, flags, chunks, reads?, state?]`, T5 appended `types?, providers?, effects?`; `libs/runtime/resume-format.ts`), not a region-entry slot: a lazy For may sit at the page root, streamed patches append to it, and old decoders ignore it. Format v2. Off by default: written only when the build opted in (`rivet({ resume: { lazyRows: true } })` → manifest `lazyRows`, LAZY-T5B: the build's browser runtime has the lazy rows code) AND the server env has `RIVET_LAZY_ROWS=on` (T5 gate failed, §4 "T5 measured"); contract in `libs/runtime/docs/resume.md` "Row functions".

| Per row | Today | Lazy |
| --- | --- | --- |
| Row markers `<!--rN[-->…<!--]-->` | yes | yes (unchanged; they bound the adopt walk and give the row index) |
| Row id in state | `[rowId, itemRef, flags]` | **none** — index = marker position; key = `by(items[index])` at materialise time (no `data-rk`, no key list; `by` is a resumable function or a key path, §3.3) |
| Handler records per element (`data-r`, `e[id]`) | per element | **none** inside the row |
| Bindings, captures, provider lists, `[13]` reads | per row | **none** inside the row |
| Row-local keyed state (`signal()` in the row function / its components, `_regionState`) | encoded per row when captured | **shipped only when present**, as `[index, values…]` (flag 4 on `R`); rows without own state (the common case: cdk rows read shared managers) ship nothing |
| Row's `createId` seeds | ids in markup + captured strings | the id scope is seeded per row from `(forId, index)` so an adopt run replays the same `rv…` ids (structural §3.6, applied per row) |

Recording: the server `For` row hook (`server-structural.ts` `_onForRow` / `_onForRows`) runs the row with recording **suppressed** (`_rUnrecorded`-style scope, the mechanism the cdk collection build pass already uses) and marks the For's site as a lazy row region. Sites inside the row that must be recorded even so (§3.3 non-eligible cases) turn the whole `For` back to today's per-row path — one decision per `For`, never a mix, so the browser has one rule per list.

Server cost: no per-row recorder objects, no per-row encode. Expected: the resumable 1000-row render drops toward the row-plan path's numbers (R-PLAN measured 2.46 → 1.85 ms wall / 4.99 → 3.47 MB alloc at 1000 rows for *uniform* rows; component rows today are far above that: the recorder graph per row is what the derived model's S1 measured at 3.04 ms vs 0.46 static). Measured at T6.

### 3.2 Browser: materialise on demand

1. **Event in a row.** The loader's capture walk (`composedPath()`) finds no `data-r` inside a lazy row; the first marker-bounded ancestor it meets is a row (`rN[` pair → `forId`, index by marker order; the runtime already pairs markers at idle, "Adoption cost" in the guide). It holds the event exactly as today (cold chain, live snapshot of value / checked / focus) and asks the runtime for `materialise(forId, index)`.
2. **Materialise.** The runtime revives the For's region as today (its captures: `rowFnRef`, `itemsRef`, `byRef`, collection contexts), then: `item = items[index]`, row owner via `_rootIn` under the For's owner (the same owner a client reconcile would give the row), `createId` scope seeded `(forId, index)`, and runs `rowFn(item accessor, index accessor)` with the DOM runtime in **adopt mode** over the nodes between the row's markers. Component children (`_c(Row, props)` — cdk `Row`, `Cell`) run in the same adopt run (they are dependent: their props are the row's locals). Delegated handlers attach; bindings are created and evaluate once (adopt-mode writers compare before writing, structural §3.5); `For` / `Show` inside the row adopt by their own markers (existing `AdoptedRow` / `AdoptedBranch`, recursive: sections, nested rows).
3. **Dispatch.** The held event goes through `_dispatch` to the now-attached handler: same path as a client-rendered page (first-mouse-click defer, batching, `undoing` / focus rules of `dom-resume.ts` unchanged).
4. **Shared state.** Selection, focus management, sort, expansion live in the collection's region / state objects as today (shipped once). Keyboard navigation across untouched rows: cdk managers move focus by key over the DOM (`data-key` on rows is in the markup); the `focusin` on the target row is an event → that row materialises before its handlers run. `pointerenter` / hover attributes (`data-hovered`) are JS-written → the first hover materialises the row (one row per pointer path, ~0.1 ms; T6 measures it on the 1000-row page at 4× CPU).
5. **Wake.** A server-read signal changing (today: region `changed` → `takeRows` → `_for` re-creates rows, RESUME-KEEP-ROWS): for a lazy For the write reaches the For's reconcile, which keys the server rows by `by(items[i])` (`_for` adopt mode: O(1) take, keys lazily), keeps rows whose item is unchanged **without materialising them**, materialises rows whose item changed (adopt if the markup is still valid for the new item, else create + swap as today), creates new rows client-side, drops removed rows (markers stay inert, RESUME-DROP-MARKERS). A *row-render* read (`[13]`, e.g. "selected" read inside the row's render) that changes for many rows at once — select-all on 1000 rows — materialises every row that read it on the first write: this is the **named loss budget** (structural spec R3: ≤ 1 frame at 1000 rows, 4× CPU; T6 measures; the cdk pattern of reading per-row selection through the keyed `selector` — one source per key — keeps the wake set to the rows whose key flipped).
6. **Filter / items change** (`table-virtualization`'s own test, `virtualizer-items`): the `items` accessor changes → `_for` reconcile as in 5. Nothing materialises for rows that stay; the first keystroke's cost is the reconcile and the removals, as today's adopted path (16.1 ms at 4× CPU for 1,000 → 100 rows after RESUME-DROP-MARKERS), minus the per-row region bookkeeping.

### 3.3 Eligibility (one decision per `For`)

A keyed `<For>` (structural `For` from `@rivetjs/runtime/dom`, or the cdk `CollectionRoot` / `CollectionBranch` row loop, §5) is lazy when:

- its row child is a resumable function: an inline arrow / local const the compiler registers as a symbol with serializable captures (Function Bridge rules, unchanged: `_rFn` + captures; a row arrow that captures a parent `let` cell, a store path or a module function is fine; one that captures a non-serializable value — a JSX content prop, an SDK object without `reconstruct` — is not);
- `items` serializes (today's requirement for row regions already) and `by` is a resumable function, a key path string, or absent (index keys);
- the row function is deterministic in the structural sense (§3.6 of the structural spec: no `Date.now` / `Math.random` / browser globals in render; diagnostic RV21xx applies to row bodies first);
- no site inside the row is of a kind adoption cannot replay: `clientOnly`, `Async` with streaming, `Portal` roots, `ref` into a captured holder read outside the row. These are rare in rows; when present the `For` falls back to today's per-row records and `check-examples` prints `rows: recorded (<reason>)` next to its `measure` line so the cost is visible.

Row-local state (a `signal()` in the row function or inside `Row` / `Cell`, `_regionState` in cdk interactions): shipped per row when it exists (§3.1 flag 4); a row with state is still lazy. The cdk rows after CELL-DIET create their derived state lazily in a module `WeakMap` and read shared managers — they ship nothing.

### 3.4 Adopt-mode lowering is the dependency

Materialising a row runs its compiled DOM function in adopt mode. That is structural spec §3.5 (C3 in the M2 plan: `_tpl` clone → `_adoptRoot()` walk, `_c` dependent children run, `_for` / `_show` adopt by markers, dev verifier §3.6). This spec does not need C3 for whole boundaries — **only for the row function and the components it calls** — but the lowering is the same code path, so the row slice is C3's first consumer and its first gate. Nothing here is throwaway when M2 lands: the row region record becomes the boundary record's `For` entry; the loader's "nearest marker → materialise" walk is the boundary walk restricted to rows; the serialized wire around it is what M2 deletes at M6.

Interim without C3 — *create + swap* (run the row function in create mode and replace the row's nodes, as today's region re-creation does) — is **rejected** as a shipping mode: the event target is replaced under the pointer, text inputs lose their value, focus moves (every `recreated` fuzz pin is this class). It is allowed only as a measurement harness for T1 (bytes, server CPU) behind the env-only `RIVET_LAZY_ROWS=swap` (dev server + `check-examples` / `scripts/lazy-rows/probe.ts` builds; no `rivet.config` / plugin option; runtime `server-lazy-swap.ts`, no package export: zero bytes in production bundles), never default. T1 lowers it without compiler changes: every For row under a recorder renders unrecorded and the enclosing region gets the `interaction` mount trigger (create + swap of the whole region, not per row).

## 4. Expected numbers (bounds; T6 measures)

| `table-virtualization`, 1000 × 3 | after CELL-DIET | lazy rows (bound) |
| --- | ---: | ---: |
| `rivet/state` | 2.70 MB raw / 165 KB br | collection region + one `R` record + items (already loader data) ≈ **2–5 KB raw / < 2 KB br** |
| HTML | 3.53 MB / 192 KB br | markup only ≈ 0.8–0.9 MB raw; brotli ≈ 25–40 KB (the markup repeats; no `data-r` ids) |
| Server CPU / page | recorder graph per row | toward the static render + marker pairs (S1 class) |
| First click in a row, warm | handler lookup, 0 render | adopt run of one row (3 cells, cdk `Row` + `Cell` components): estimate 0.1–0.4 ms desktop, ≤ 2 ms at 4× CPU; **no** page-level render |
| First keystroke in the filter | reconcile + removals (16 ms at 4× for 1000 → 100) | same or less (no per-row region bookkeeping) |
| Select-all first change | 1000 row bindings notified (resumed) | 1000 rows materialised: budget ≤ 1 frame at 4× CPU (loss budget; keyed selector keeps per-row wakes to flipped keys) |

ListBox / GridList / Menu / Tree scale the same way: the per-item 0.9–2.7 KB goes to the marker pair.

### T4 measured (2026-10-19, server records only; browser materialisation = T5)

`node scripts/lazy-rows/probe.ts --dist <d> --cpu 1 --loads 1`, then the same with `RIVET_LAZY_ROWS=on` into a second dist (the env reaches the prerender and the in-process handler). Snapshot = 2ad091cf + LAZY-T1 + T4; Node v26.5.1, Apple M4 Pro ×14, load average 3.4–5.6. Server CPU = median of 20 renders after 5 warm-up, wall in brackets.

| page | HTML raw / br, off → on | `rivet/state` raw / br, off → on | server CPU per render, off → on | Fors (on) |
| --- | ---: | ---: | ---: | --- |
| ui-docs:table-virtualization | 73.4 KB / 11.8 KB → 48.7 KB / 7.4 KB | 42.0 KB / 6.37 KB → 20.6 KB / 2.73 KB (−57% br) | 24.6 (14.2) → 21.6 (12.6) ms (−12%) | lazy `VirtualizerRoot` ×2 (`L` entry 41 B) |
| ui-docs:list-box-virtualization | 109.0 KB / 11.2 KB → 96.8 KB / 9.3 KB | 85.0 KB / 6.40 KB → 74.4 KB / 4.87 KB (−24% br) | 9.5 (5.4) → 8.5 (4.9) ms (−11%) | lazy `VirtualizerRoot` ×11 (37 B) |
| ui-docs:table-selection | 61.4 KB / 13.5 KB → same bytes | 39.9 KB / 8.31 KB → same bytes | 6.8 (3.9) → 12.1 (5.9) ms (+79%) | recorded: fallback, a client effect in the rows (cdk Table row checkbox) |
| cdk-docs:virtualizer-items | 19.4 KB / 5.05 KB → 16.7 KB / 4.62 KB | 7.32 KB / 1.31 KB → 5.11 KB / 0.94 KB (−28% br) | 2.5 (1.8) → 3.0 (2.2) ms (+22%, noise level: ±0.5 ms run to run) | lazy `Virtualizer` ×11 (28 B) |

- State against the T1 swap ceiling (−58% / −8% / −40% / −31% br): reached on table-virtualization, above it on list-box-virtualization (lazy rows also drop the row-local records the swap kept), 0 on table-selection (fallback), close on virtualizer-items.
- The lazy For on both ui-docs pages is the outer virtualizer loop: everything inside its rows (cdk Table / ListBox rows and cells) is row content, plain markup, inert until T5 materialises it.
- Fallback cost: a For that falls back renders its rows twice (the lazy attempt, then recorded). table-selection +79% server CPU with `on`. Default `off` never tries.
- Browser bytes, default `off`: runtime / page / eager JS unchanged in every size-report app; stream add-on 712 → 714 B br (patch `L` merge). Server bundles +1.6–3.5 KB min / +0.42–1.2 KB br (lazy row hooks, always installed; never run with `off`).

### T5 measured (2026-10-19, browser materialisation; default stays `off`)

Same probe, `--cpu 1,4 --loads 3`, two dists (off / `on`); snapshot = main 70dd145e + LAZY-T3 + T5; Node v26.5.1, Apple M4 Pro ×14, load average 11–18 (other lanes running: click medians ±10 ms). Click = first row click → painted frame, median of 3 cold loads.

| page | state raw / br, off → on | server CPU, off → on | first click ×1, off → on | first click ×4, off → on | Fors (on) |
| --- | ---: | ---: | ---: | ---: | --- |
| ui-docs:table-virtualization | 41.2 / 6.2 → 20.7 / 2.8 KB | 25.5 → 21.2 ms | 29.3 → 60.5 ms | 29.8 → 95.2 ms | lazy `VirtualizerRoot` (row = the whole cdk Table) |
| ui-docs:list-box-virtualization | 83.0 / 6.2 → 73.0 / 4.8 KB | 11.6 → 5.5 ms | 47.7 → 40.6 ms | 57.8 → 72.6 ms | lazy `VirtualizerRoot` ×11 |
| ui-docs:table-selection | 39.2 / 8.1 → 5.3 / 1.8 KB (−78% br) | 8.4 → 2.1 ms | 33.0 → 42.8 ms | 76.5 → 61.4 ms | lazy `Table` (was a fallback before R6 was lifted) |
| cdk-docs:virtualizer-items (key in filter) | 7.1 / 1.3 → 5.0 / 0.9 KB | 3.1 → 2.6 ms | 45.7 → 46.2 ms | 68.2 → 68.4 ms | lazy `Virtualizer` ×11 |

Synthetic 1000-row table (runtime harness, unminified sources; each row reads a shared `sel` signal in its class; median of 5 loads; pointerdown → painted frame after every row changed):

| | off | on | delta |
| --- | ---: | ---: | ---: |
| first row click ×1 / ×4 | 48.5 / 55.2 ms | 46.7 / 75.9 ms | −2 / +21 ms |
| select-all first change ×1 / ×4 (runtime warm) | 48.1 / 45.9 ms | 48.9 / 64.4 ms | +1 / +19 ms |
| `rivet/state` raw | 39.1 KB | 29.1 KB | −26% (uniform rows were already compact) |

- Gate (§8) fails on the first-click and select-all rows: a shared read (selection) wakes every row of the For, so the first change materialises all of them (≈ 1000 × probe + adopt ≈ +20 ms at ×4); on table-virtualization the lazy row is the whole Table (outer virtualizer loop), so the first click adopts every rendered row and cell (+65 ms at ×4). Bytes and server CPU pass. Default stays `off`; `RIVET_LAZY_ROWS=on` remains the A/B switch (on a build with `resume.lazyRows`, LAZY-T5B).
- What unblocks the flip: (1) the keyed selector wake (§3.2 item 5: per-key wake lists, so a selection change wakes the two rows whose key flipped); (2) the lazy For one level down on virtualized collections (rows of the cdk collection, not the virtualizer window); (3) adopt cost per row (two runs: probe + adopt) — a compiled adopt walk (structural C3) halves it.
- Bytes: loader add-on `LAZY` 717 chars / 439 B br, on pages with `L` only (loader stub unchanged). Resume runtime, every resumed page, per file minified (`DEV` false, unbundled): `dom-resume` +3,769 B min / +1,386 B br, `dom-adopt` +4,710 / +1,658 (`_adoptRow`), `dom-v2` +317 / +96, `dom` +157 / +47, `dom-v2-spread` +27 / +16 — as handed back by T5, paid with lazy rows off too. LAZY-T5B (2026-10-19) made it opt-in per build instead of a per-page chunk (a dynamic `import()` would race the first event and the wakes): build-time constant `LAZY_ROWS` (`libs/runtime/lazy-rows.ts`) around every hook + factory slot `lazy-rows-resume.ts`, both served opted-in by the compiler plugin for `resume: { lazyRows: true }`; other builds are byte-identical to pre-T5 (zero-cost runtime hashes: dom-resume unchanged; `/dom` entry +43 B for the `_materialise` export, `return !1`, not in apps). Opted-in builds: dom-resume 54,283 B min (+8,720) / 18,531 br (+2,773), dom 49,162 (+377) / 16,452 (+93); the server writes `L` only with the manifest flag (`RIVET_LAZY_ROWS=on` alone: dev warning, recorded rows). SMELL-FIX phase B (2026-10-20): the `_adoptRow` dev verifier (mismatch text, attribute check) is under `DEV`, so opted-in production builds carry none of it — dom-resume `[lazyRows]` 57,131 → 56,388 B min (zero-cost hash, after T6).

### T6 measured (2026-10-20, LAZY-T6; default stays `off`)

Changes: (1) keyed selector wake — `_trackReads` keyed hook; a lazy row's read of a `selector` with a known hint (`pairKeys`, reactivity `memberKeys`) over a plain signal ships per key in entry `keyed` [12] and wakes only the rows whose key flipped (cdk `selectionOf` / `isFocusedKey` use those hints); (2) lazy one level down — `For` prop `lazy={false | () => boolean}` (authored opt-out; a compile-time rule cannot see across components: `renderNodeAt` / virtualizer views): cdk `renderNodes` / virtualizer Fors are not lazy when a row holds a nested collection (section, tree children, Table root parts), Table header Fors never (a lazy virtualized header row lost its column views when it materialised mid-layout); (3) row plans — after one probe + align, rows of the same flat structure adopt from a cached plan without the probe run (`dom-adopt.ts` `RowPlanCache`; any mismatch drops the plan; DEV always probes and cross-checks).

Probe `--cpu 1,4 --loads 3`, two interleaved rounds (6 cold loads per cell, median), host load 7.6–7.9 at each start (`uptime`, quiet gate < 8; ±10 ms per sample at ×4); snapshot = main a3777735 + LAZY-T6; Node v26.5.1, Chromium 153, Apple M4 Pro ×14.

| page | state raw / br off → on | HTML br off → on | server CPU off → on | first click ×1 off → on (Δ) | first click ×4 off → on (Δ) |
| --- | ---: | ---: | ---: | ---: | ---: |
| ui-docs:table-virtualization | 42.2 / 6.4 → 23.5 / 3.5 KB | 11.8 → 8.6 KB | 28.3 → 21.9 ms | 24.0 → 22.0 (-2.0) | 37.9 → 55.4 (+17.5) |
| ui-docs:list-box-virtualization | 85.0 / 6.4 → 74.7 / 4.9 KB | 11.2 → 9.6 KB | 15.6 → 9.0 ms | 42.9 → 48.8 (+5.9) | 66.5 → 81.2 (+14.8) |
| ui-docs:table-selection | 40.2 / 8.3 → 7.3 / 2.3 KB | 13.5 → 7.3 KB | 8.4 → 3.8 ms | 50.3 → 44.5 (-5.8) | 86.2 → 67.1 (-19.1) |
| cdk-docs:virtualizer-items | 7.3 / 1.3 → 5.1 / 0.9 KB | 5.0 → 5.0 KB | 3.9 → 3.4 ms | 47.8 → 48.8 (+1.0) | 68.8 → 73.7 (+4.9) |

Synthetic 1000-row table (runtime harness; median of 5 loads; paint = pointerdown → painted frame, DOM = unquantized MutationObserver time):

| | off | on | delta |
| --- | ---: | ---: | ---: |
| shared read (`plain`), first row click ×4: paint / DOM | 54.8 / 53.1 ms | 70.7 / 66.1 ms (1000 rows materialised) | +16 / +13 |
| keyed selector, first row click ×1 / ×4: paint | 46.4–47.5 / 58.3 ms | 47.6 / 70.1 ms | 0 / +12 (frame quantum; DOM 56.2 → 49.0, 1 row materialised) |
| keyed selector, select-all ×4: paint / DOM | 46.3 / 30.6 ms | 55.8 / 49.4 ms (1000 rows) | +9.5 / +19 |
| `rivet/state` raw | 39.1 KB | 29.1 KB | −26% |

- Wake counts: keyed row click materialises 1 row (+ the deselected one), was 1000; select-all materialises all 1000 (every key flips; R5 budget: paint +9.5 ms ≤ 16, DOM +19 ms).
- Gate (§8, first click ≤ off + 2 ms): passes on table-selection (−6 / −19 ms) and table-virtualization ×1 (−2; ×4 was +65 in T5, now +17.5); fails at ×4 on table-virtualization (+17.5), list-box-virtualization (+14.8), virtualizer-items (+4.9, inside the noise). Remaining cause: virtualized rows read the virtualizer `views` signal (plain shared read) — the first engine update (focus / scroll) wakes the whole rendered window; per-row adopt cost × window size at ×4. Bytes and server CPU pass everywhere. Default stays `off`.
- Bytes: opted-in dom-resume [lazyRows] 54,283 → 57,124 B min (+2,841: keyed wake + row plans); every other runtime entry used by browsers unchanged (zero-cost); server: reactivity +551 B min (collector `key` hook, `memberKeys`), server-resume +947, server +11 (`For` `lazy`); app server bundles +1.0–1.5 KB min, client JS unchanged.
- What remains for the flip: per-key / per-view wake for the virtualizer window (`views` read keyed by view key, or the window rows recorded while the engine's first layout is pending), and a cheaper materialise for the woken window (compiled adopt walk, structural C3).

## 5. cdk collections

cdk rows are not a user `<For>`: `CollectionRoot` / `CollectionBranch` render built nodes through `renderNodeAt(collection, key)` (per-row `computed` keyed by `sameRender`, `node.render(node)` untracked; `libs/cdk/collections/CLAUDE.md`), and `Collection items` rows go through a `For` keyed by `itemId`. For this spec the row function of a cdk collection is **`(key) => renderNodeAt(collection, key)`**, a resumable function of the collection accessor — which is already what the server records as the row's item ref. Required cdk changes:

Update 2026-10-20 (ROW-RERENDER): kept (adopted) rows never re-run, so a node value change after resume needs a baseline: the server records one 4-char stamp per row (24-bit hash of the node's render inputs) in the For region's `_regionState`, the browser re-checks adopted rows and re-creates a changed one by boxing its For key (`resumedKeys`; `libs/cdk/collections/CLAUDE.md` "Resumed rows"). The row wire (key only) and the `$lazy` items stay as specified.

- `DefaultCollectionRenderer.CollectionRoot` / `CollectionBranch` render rows through the structural `For` with that row function and `by = key` (today a mix of `For` and `place()`); the row function's captures are the collection accessor + the renderer context (both resumable today).
- Collections built from **JSX children** (`<Table><Row>…</Row></Table>` static rows) are built on the server by the build pass; the browser needs the node for the touched key. Two options, decided at T3: (a) ship the built collection as data (nodes are data classes already: `CollectionNode` registered via `_rClass`; today the server ships it when captured) — bytes O(items) but ~60 B / node, no closures; (b) re-run the build pass on the client lazily at the first materialise (the build pass is the `_rUnrecorded` client-safe pass; cost O(items) once, ~2 ms / 1000). Recommendation: (b) when the children are static JSX, (a) never (it reintroduces per-item wire); `items`-driven collections need neither (the node is derived from `items[key]`).
  - Decided at T3 (2026-10-19): (b). ListBox / GridList build their collection in a component-body `computed(() => buildCollectionFrom(content))` (resumable computed with the host's provider frame), which the browser evaluates on its first read; Table / Tree / Select / ComboBox / virtualizers already did. Menu, TagGroup and Tabs stay live (content placed, no For) — Menu needs RAC's SubmenuTrigger children split first.
- `Row` / `Cell` after CELL-DIET already create their derived state lazily under no owner; under adopt mode the owner is the row's `_rootIn` root — `initRow` / `initCell` run eagerly there, which is the client-render path they already have.
- Per-row ids (`useId` for `aria-labelledby` of cells, row `id`): derived from the seeded id scope (§3.1), so the adopt run reproduces the markup's ids; a test asserts byte-equal ids for every cdk row kind (T3).

## 6. Interactions with the rest of the plan

- **STATE-DIET** (chunk-list dedupe in `e` / `b`): lands regardless; it is the non-row state's format. **CELL-DIET**: stays (fallback rows, client render cost, `WeakMap` pattern is the lazy-friendly shape). **ListBox diet**: superseded.
- **Virtualizer**: cdk ListBox / Table now render inside `<Virtualizer>` (COLLECTION-VIRT, 2026-10-19): the ui-docs examples ship the first window only. Lazy rows remain the fix for non-virtualized collections (any list the author does not window) and for the rows a window does render; the two compose (a virtualized collection's rows are lazy rows of its `For`).
- **M1 route bundles**: independent. The row function's chunk is the route chunk; `preload="visible"` rules for ≥ 3-row handler symbols (`docs/guides/resumability.md` loader rules) keep their meaning on the For's symbol.
- **M3 derived slices** (research Q4: "per-row edits are the row's writer with `i` as a parameter"): a row whose sites all have provable reads never materialises at all — the slice edits the row by path. Lazy rows are the adopted fallback for rows M3 cannot prove; both share the row region record and the marker-index addressing.
- **M6**: deletes the serialized per-row path (§3.3 fallback goes with it; non-eligible rows then render client-side in create mode as the `rendered` layer, with the diagnostic made an error).

## 7. Risks and open points

- **Determinism** of row renders (same class as hydration mismatch): dev adopt verifier per row (tag, static attrs, sole text), loud, with the component and key named; production trusts the markup. Resume fuzz stays the oracle: a resumed row and a CSR row now run the same code; `recreated` pins inside rows are void by construction.
- **Row-local state** that is captured by the parent (a row's `signal` read by a footer total): the signal is keyed per row (§3.1 flag 4) and revived before the parent's binding reads it — today's `_regionState` rule, per row.
- **Events before materialise that the markup answers itself** (native checkbox toggle, text typed into an input in a row): the cold hold keeps `checked` / `value` snapshots and replays them (unchanged); `preventDefault`-dependent handlers (link clicks, submits) follow the existing held-link / submit replay rules.
- **Streamed segments** that append rows (`Async` inside a For): each segment's rows are lazy rows of the same For; the segment patch carries only the For's extended marker range.
- **Memory**: a materialised row holds its owner + bindings as a client row would; 1000 materialised rows = a client-rendered table (the select-all case). Nothing is held for untouched rows beyond the marker index.
- **Chunks**: materialising a row needs the row function's chunk **and** the DOM chunks of the components it renders (cdk `Row` / `Cell` dom code), not only their handler chunks: the same graph `preload="visible"` fetches for cdk rows today (UI-COLD), so bytes before input are unchanged on non-lean pages; a `lean` page pays it at the first click (measured at T6, Fast 3G).

## 8. Gate (measured before the default moves)

Harness: `resume-bench` lanes (`click`, `keyClick`, `filter`, `scrollClick`, `hoverClick`), ui-docs `table-virtualization` / `list-box-virtualization` frames via `check-examples --measure`, the ssr-bench `/resume` rows page, resume fuzz on `/table`, `/listbox`, `/gridlist`, `/tree`, `/menu` stories (cdk + ui).

| Metric | Bar |
| --- | --- |
| `rivet/state` on `table-virtualization` | ≤ 10 KB raw (from 2.70 MB) |
| HTML brotli, same page | ≤ 60 KB (from 192) |
| Server CPU / page, 1000 rows resumable (ssr-bench, Docker) | ≤ 1.3× the static lane |
| First row click → paint, Slow 4G + 4× CPU | ≤ today's 33 ms + 2 ms |
| Select-all first change, 1000 rows, 4× CPU | ≤ 16 ms (one frame) |
| Filter first keystroke, 1000 → 100 | ≤ today's 16.1 ms |
| Fuzz | 0 new findings; every `recreated` pin inside rows removed |

## 9. Tasks

| # | Task | Owner | Depends on |
| --- | --- | --- | --- |
| T1 | Measurement harness: per-page `rows: lazy / recorded` column in `check-examples`, state / HTML / server-CPU probe on the four pages above; the `swap` interim flag for a bytes-only baseline | runtime, docs-kit | — |
| T2 | Compiler (Rust, root agent): row-function symbol for keyed `For` rows (register the row arrow as a resumable function with captures when the `For` is eligible; `by` as symbol / key path), eligibility facts per `For`, RV21xx determinism diagnostics on row bodies | compiler | — |
| T3 | cdk: collection rows through the structural `For` with `(key) => renderNodeAt(collection, key)`; client lazy build pass for JSX-children collections; seeded ids per row; byte-equal id test per row kind | cdk | T2 |
| T4 (done 2026-10-19, behind `RIVET_LAZY_ROWS=on`) | Server: lazy row region recording (`L` record, suppressed row scopes, per-row keyed state when present, seeded id scope per row), fallback to today's records on non-eligible Fors, `rivet/state` format bump for `R` | runtime (`server-resume`, `server-structural`, `resume-format`) | T2 |
| T5 (done 2026-10-19, behind `resume.lazyRows` + `RIVET_LAZY_ROWS=on` (LAZY-T5B: 0 bytes without the build option); gate fails, default `off`) | Browser: adopt-mode DOM lowering for row functions and the components they call (structural §3.5 restricted to rows = M2 C3's first consumer); loader marker walk → `materialise(forId, index)`; `_for` adopt-mode reconcile without materialising kept rows; row wake lists; dev verifier per row | compiler (C3, root agent) + runtime (`dom-adopt`, `dom-resume`, loader) | T2, T4 |
| T6 | Gate run (§8) on the bench host under the bench lock; loss budget for select-all; Fast 3G cold click on a `lean` page. Done 2026-10-20 (LAZY-T6): keyed selector wake, `For` `lazy` opt-out one level down, row plans; gate still fails at ×4 on the virtualized pages (§4 "T6 measured"), default `off` | runtime | T5 |
| T7 | Docs follow code: `docs/guides/resumability.md` rows rows, `apps/docs/content/learn/resuming.md`, cdk / runtime CLAUDE.md, llms / MCP / skills regenerated; `check-examples` column documented | docs | T6 |

Order: T1 ‖ T2 → T3 ‖ T4 → T5 → T6 → T7. T2 and T5's compiler parts are Rust: patch files to the orchestrator's queue, one Docker build per batch (repo rule).

## 10. Rulings proposed

Ruled 2026-10-19 (user delegated the call): R1–R5 accepted as proposed below. T1 may start.

R6 (T4 intake, 2026-10-19): a client effect or `clientEvent` inside a row is a fallback reason in T4 (the whole For records its rows: every cdk Table with selection checkboxes falls back). T5 lifts it: row effects run at materialise time, so the row-level effect stops being a reason once the adopt lowering lands; T6 measures table-selection on that path. Lifted at T5 (2026-10-19): `_rEffect` / `_rClientEvent` in a lazy row record nothing; the row is listed in the entry's `effects` and materialises at idle (its effects run as a recorded effect would; found by the resume fuzz: a column-resize width effect in a header row); table-selection is lazy with `on` (§4 "T5 measured").

- **R1 — rows first inside M2's client track.** Yes: build adopt-mode lowering for row functions (T5) before whole-boundary adoption; the row slice has the largest measured win and the smallest surface.
- **R2 — no shipping interim.** `create + swap` only as T1's measurement flag. Reason: it is the `recreated` failure class the fuzz pins today.
- **R3 — one rule per `For`.** A `For` is lazy or recorded, never mixed; non-eligible rows make the whole `For` recorded and visible in `check-examples`.
- **R4 — cdk JSX-children collections build on the client lazily** (option (b) in §5); `items`-driven collections ship nothing per node.
- **R5 — loss budget.** Select-all on 1000 rows ≤ one frame at 4× CPU is accepted as the cost of not shipping 1000 rows of closures; measured at T6, mitigated by the keyed selector wake. T6 (2026-10-20): paint +9.5 ms (within), DOM change +19 ms; the keyed wake helps single-row changes, not select-all (every key flips).

If R1 is declined, the fallback is to keep the two diet lanes' serialized wire and accept ~1.5–2.7 KB per component row as the floor (the lazy-state note's bound tables show no other lever below −40 %).
