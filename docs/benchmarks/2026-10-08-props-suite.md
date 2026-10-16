# Props suite (component-heavy live props), 2026-10-08

- Suite: `apps/dom-bench/props/` (Rivet compiler DOM v2 vs Solid 1.9.15 stable, babel-preset-solid). 1000 rows × 6 components (`Row` → 2 × `Cell` → `Label`, `Badge`): getter props, one component spread (`{...props.badge}`), `mergeProps` defaults + `splitProps` + DOM spread of the rest. 7002 elements.
- Phases: mount (load rows + render), relabel (every row's label, one batch), select (10 single selections; every row's `selected` getter re-runs), bump (every 10th count, through spread → merge → split), dispose; heap = CDP used heap after 2 forced GCs with the table mounted.
- Machine: Apple M4 Pro (14 cores), Chromium 153.0.8010.12 headless (Playwright), cross-origin isolated (5 µs timer), load avg ~3 during runs. Lanes interleaved per sample (order alternates), 30 samples, medians (ms / KB).

## Baseline (HEAD b66d2e5a runtime + compiler)

| metric | rivet | solid-stable | ratio |
| --- | --- | --- | --- |
| mount | 7.855 | 9.472 | 0.83 |
| relabel | 1.060 | 4.532 | 0.23 |
| select | 1.242 | 3.650 | 0.34 |
| bump | 0.060 | 0.100 | 0.60 |
| dispose | 0.160 | 0.665 | 0.24 |
| heap KB | 2971 | 5366 | 0.55 |

- Rivet already wins every phase; the live-props layout cost is internal (V8 shape probe below).

## Layout work (lane PROPS-LAYOUT)

- V8 probe (Node 26, `%HasFastProperties`): any object literal with `get` is dictionary mode (~490 B: property dictionary + fresh getter closures + AccessorPairs + context; one runtime call per accessor). Shared getter functions + a per-object slot read through `this` keep one fast map per key layout.
- Node micro (3 keys / 2 getters, create + 1 read | read | bytes): literal 166–198 ns | 18–19 ns | 496 B; slot object (`{}` + private-field slot + `__defineGetter__`) 90–100 | 3.5–4 | 168; `defineProperty` frozen shared descriptors 111 ns; `Object.defineProperties` / `Object.create(proto, d)` 230–330 ns; class per call site (prototype getters, own keys lost — reference only) 5 | 1.8 | 56.
- Lanes: `rivet-base` = HEAD runtime; `rivet` = runtime c78b63b5 (helpers return slot objects, compiler output unchanged); `rivet-abi` / `rivet-patch` = + compiler emission prototyped by hand (`build.ts --lane`; `rivet-patch` = exact output of compile-rs patch `props-layout`).

Run 1 (load ~3, 30 samples):

| metric | rivet-abi | rivet | rivet-base | solid-stable |
| --- | --- | --- | --- | --- |
| mount | 7.333 | 7.647 | 7.855 | 9.472 |
| relabel | 0.865 | 0.930 | 1.060 | 4.532 |
| select | 1.153 | 1.210 | 1.242 | 3.650 |
| bump | 0.060 | 0.060 | 0.060 | 0.100 |
| dispose | 0.155 | 0.160 | 0.160 | 0.665 |
| heap KB | 1887 | 2498 | 2971 | 5366 |

Run 3 (load 8–10, other agents running, 40 samples; ratios match run 1):

| metric | rivet-patch | rivet | rivet-base | solid-stable |
| --- | --- | --- | --- | --- |
| mount | 8.580 | 8.840 | 9.597 | 11.282 |
| relabel | 1.228 | 1.542 | 1.645 | 5.848 |
| select | 1.257 | 1.565 | 1.543 | 4.530 |
| bump | 0.130 | 0.160 | 0.158 | 0.213 |
| dispose | 0.195 | 0.262 | 0.225 | 1.050 |
| heap KB | 1885 | 2497 | 2971 | 5360 |

- Helpers alone: mount −3–8%, relabel −6–12%, heap −16%; dispose +0–16% (0.03 ms; noisy, within one run's spread). With the compiler emission: mount −7–11%, relabel −18–25%, select −7–19%, heap −37% vs HEAD; vs Solid: mount 0.76–0.77, heap 0.35.
- Raw samples: `2026-10-08-props-suite.json`.

## Real build (props-layout patch applied, wasm rebuilt)

- Lanes: `rivet` = current compiler wasm (per-layout `__rivetPropsN` factories over `_p` / `_pg`) + runtime (slot objects, `#slot in this` brand check); `rivet-base` = HEAD b66d2e5a compiler (`build.ts --base` now compiles with `<dir>/libs/compiler/index.ts`) + runtime. Load 12–16 (other agents running); ratios match run 3.

| metric | rivet (30) | rivet-base (30) | solid (30) | rivet (40) | rivet-base (40) | solid (40) |
| --- | --- | --- | --- | --- | --- | --- |
| mount | 8.975 | 9.917 | 11.855 | 8.343 | 9.392 | 10.950 |
| relabel | 1.265 | 1.642 | 5.928 | 1.155 | 1.495 | 5.725 |
| select | 1.393 | 1.482 | 4.855 | 1.335 | 1.445 | 4.203 |
| bump | 0.127 | 0.140 | 0.208 | 0.105 | 0.102 | 0.190 |
| dispose | 0.198 | 0.200 | 1.000 | 0.190 | 0.190 | 0.950 |
| heap KB | 1886 | 2971 | 5360 | 1887 | 2971 | 5360 |

- vs HEAD: mount −10–11%, relabel −23%, select −6–8%, bump / dispose flat, heap −37%. vs Solid: mount 0.76, relabel 0.20, select 0.29–0.32, heap 0.35. Bundle: `rivet.js` 33103 B (12859 gzip) vs base 32294 B (12546 gzip): +809 B raw / +313 B gzip (factories + `_p` / `_pg` + brand check).

## Run

```sh
node apps/dom-bench/props/build.ts [--base <git-archive dir>] [--lane name=compiled.js] [--emit]
RIVET_BENCH_LOCK=<lock dir> node apps/dom-bench/props/run.ts --samples 30 --lanes rivet,rivet-base,solid-stable
```
