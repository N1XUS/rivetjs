# Razor-adversarial SSR scenario — 2026-10-07

Red-team: find a realistic SSR workload where ASP.NET Razor (.NET 10) beats Rivet on every metric. Cut short by usage cap: partial run set, hypotheses marked.

> **Update 2026-10-09:** after the shared-harness change (Node 24 → 26, grpc-js → lean `node:http2` client, every Node lane) Rivet wins the grid at 1000 rows c=1 on CPU/page (2.00 vs 2.31 ms), rps and peak memory. See "Transport + runtime update" at the end.

## Result

- **Scenario:** text grid (`--grid`, `/page?strings=2`): 1000 rows × 10 text fields, every field a 24–64 char ASCII string (admin/CRM grid: names, emails, order notes, URLs with `&`, `Name <email>`), 2 of 10 escape-bearing. Same DTO via gRPC, same HTML (1084 KB both lanes), exact parsed-text validation.
- **Not a full sweep.** Razor wins throughput, complete p50, TTFB p50, CPU/page; Rivet holds peak memory.
- Run: Docker ssr-bench, 1 CPU / 512 MiB per lane, 10 s × 3 repeats, 3 s warmup, 10 s prewarm, node loadgen v2. Host: 59ac2b5d + dirty tree (incl. a6d136c2), host load 6–10 on 14 cores (other lanes running). Format: median / q1 / min over 3 repeats (rps: median [min–max]).

### `tuned` GC, 1000 rows

| metric | c | Razor | rivet-compiled | winner |
|---|---|---:|---:|---|
| throughput rps | 1 | 282 [216–296] | 185 [179–187] | Razor ×1.52 |
| complete p50 ms | 1 | 3.05 / 3.01 / 2.97 | 4.73 / 4.70 / 4.68 | Razor ×1.55 |
| TTFB p50 ms | 1 | 2.53 / 2.52 / 2.51 | 3.58 / 3.55 / 3.52 | Razor ×1.42 |
| CPU ms/page | 1 | 3.53 / 3.06 / 2.58 | 4.09 / 4.07 / 4.05 | Razor ×1.16 (ranges overlap at max) |
| peak MiB | 1 | 98 / 98 / 97 | 88 / 88 / 88 | **Rivet** |
| throughput rps | 10 | 435 [254–461] | 253 [234–262] | Razor ×1.72 |
| complete p50 ms | 10 | 20.6 / 19.9 / 19.3 | 39.4 / 38.7 / 38.0 | Razor ×1.92 |
| TTFB p50 ms | 10 | 12.5 / 11.9 / 11.3 | 37.7 / 37.1 / 36.5 | Razor ×3.0 |
| CPU ms/page | 10 | 2.20 / 2.09 / 1.98 | 3.61 / 3.54 / 3.47 | Razor ×1.64 |
| peak MiB | 10 | 276 / 268 / 261 | 97 / 95 / 93 | **Rivet** ×2.8 |

### `default` GC (runtime defaults for both), 1000 rows

| metric | c | Razor | rivet-compiled | winner |
|---|---|---:|---:|---|
| throughput rps | 1 | 308 [244–308] | 164 [155–169] | Razor ×1.88 |
| complete p50 ms | 1 | 2.95 / 2.94 / 2.93 | 4.96 / 4.88 / 4.81 | Razor ×1.68 |
| TTFB p50 ms | 1 | 2.43 / 2.42 / 2.40 | 3.79 / 3.73 / 3.66 | Razor ×1.56 |
| CPU ms/page | 1 | 2.59 / 2.55 / 2.51 | 6.04 / 5.97 / 5.90 | Razor ×2.33 |
| peak MiB | 1 | 75 / 74 / 73 | 59 / 59 / 59 | **Rivet** |
| throughput rps | 10 | 253 [239–266] | 189 [189–192] | Razor ×1.34 |
| complete p50 ms | 10 | 37.3 / 37.2 / 37.0 | 52.4 / 51.1 / 49.8 | Razor ×1.41 |
| TTFB p50 ms | 10 | 24.9 / 24.6 / 24.4 | 47.4 / 46.0 / 44.6 | Razor ×1.90 |
| CPU ms/page | 10 | 3.88 / 3.77 / 3.66 | 5.25 / 5.22 / 5.19 | Razor ×1.35 |
| peak MiB | 10 | 122 / 119 / 117 | 70 / 68 / 65 | **Rivet** |

Worst case for Rivet: grid, `default` GC, c=1 — Razor 2.3× less CPU/page, 1.9× throughput, 1.7× faster p50. Same page with integer fields (existing fair comparison 2026-10-06): Rivet wins every metric.

- **Why Rivet keeps memory:** Node baseline + 8 MiB semi-space is smaller than the .NET heap; Razor's MVC `ViewBuffer` holds the whole 1 MB page per in-flight request before flushing (c=10 → 261–276 MiB tuned), Rivet streams 48 KiB chunks from pooled 128 KiB slabs.
- `rivet-resume` (resumable, not like-for-like with Razor): 92 rps / 10.4 ms p50 / 9.9 ms CPU / 155 MiB at c=1 — Razor sweeps it on all five metrics, but it ships handlers + resume state (1652 KB vs 1084 KB) and is ranked against hydratable peers, so it is not a valid Razor win.

## After fixes (2026-10-08)

- Fixes: fcdff611 (clean long strings stay raw), d25c3274 (`putText` native `utf8Write` > 16 units). Same scenario/settings as above (1000 rows grid, 1 CPU / 512 MiB, 10 s x 3 repeats, 3 s warmup, 10 s prewarm, median of 3), host load 4.7-7.7 (14 cores). Host was less loaded than the first run and Razor's absolute numbers also moved (e.g. tuned c1 282 -> 364 rps), so compare ratios, not absolutes. Raw: scratchpad `out-{tuned,default}`.
- Old = rivet-compiled before fixes (table above); New = after; Razor = this run.

| GC | c | metric | Rivet old | Rivet new | Razor (new run) | winner now |
|---|---|---|---:|---:|---:|---|
| tuned | 1 | rps | 185 | 257 | 364 | Razor x1.42 |
| tuned | 1 | p50 ms | 4.73 | 3.23 | 2.39 | Razor x1.35 |
| tuned | 1 | TTFB p50 ms | 3.58 | 2.50 | 1.88 | Razor x1.33 |
| tuned | 1 | CPU ms/page | 4.09 | 2.86 | 2.13 | Razor x1.34 |
| tuned | 1 | peak MiB | 88 | 88 | 134 | Rivet |
| tuned | 10 | rps | 253 | 311 | 467 | Razor x1.50 |
| tuned | 10 | p50 ms | 39.4 | 32.0 | 17.1 | Razor x1.87 |
| tuned | 10 | TTFB p50 ms | 37.7 | 30.9 | 10.3 | Razor x3.0 |
| tuned | 10 | CPU ms/page | 3.61 | 2.88 | 2.06 | Razor x1.40 |
| tuned | 10 | peak MiB | 97 | 103 | 313 | Rivet x3.0 |
| default | 1 | rps | 164 | 203 | 315 | Razor x1.55 |
| default | 1 | p50 ms | 4.96 | 3.87 | 2.50 | Razor x1.55 |
| default | 1 | TTFB p50 ms | 3.79 | 3.12 | 2.07 | Razor x1.51 |
| default | 1 | CPU ms/page | 6.04 | 4.89 | 3.16 | Razor x1.55 |
| default | 1 | peak MiB | 59 | 58 | 74 | Rivet |
| default | 10 | rps | 189 | 220 | 192 | **Rivet x1.15 (flipped)** |
| default | 10 | p50 ms | 52.4 | 37.9 | 46.3 | **Rivet x1.22 (flipped)** |
| default | 10 | TTFB p50 ms | 47.4 | 35.6 | 26.9 | Razor x1.32 |
| default | 10 | CPU ms/page | 5.25 | 4.54 | 5.21 | **Rivet x1.15 (flipped)** |
| default | 10 | peak MiB | 70 | 64 | 195 | Rivet |

- Flipped: `default` GC c=10 throughput, complete p50, CPU/page. Razor's default-GC c=10 got worse this run (192 rps vs 253 before), so part of the flip is Razor noise (its tuned/default gap is large); Rivet's own gain is real (CPU/page -9% to -29%, p50 -18% to -28%, rps +15% to +29% across cells).
- Not flipped: every `tuned` metric and all c=1 metrics except memory; TTFB at c=10 (Razor x1.3 default, x3.0 tuned). Razor still wins 13 of 20 cells; Rivet wins peak memory everywhere.
- `rivet-resume` (reference, not like-for-like): tuned c1 121 rps / 7.85 ms p50 / 7.4 ms CPU / 144 MiB; default c1 78 rps / 8.4 ms / 12.8 ms CPU / 71 MiB. Still slower than Razor on throughput, latency and CPU; memory c1 default 71 vs 74 MiB is the only edge.

## Root cause (Rivet)

Microprobe (Node 26, in-process, `writeText` into a slab, flat strings), ns per call:

| text length | inline `putText` (≤ 64) | native path (> 64: regex test + `utf8Write`) |
|---|---:|---:|
| 8 | 17 | — |
| 32 | 58 | — |
| 64 | 143 | — |
| 65 | — | 28 |
| 256 | — | 42 |
| 65 with one `&` | — | 116 (`String.replace` + callback) |

- .NET `HtmlEncoder` (UTF-8 out, vectorized): 40-char ASCII ≈ 10 ns (0.25 ns/char) vs Rivet ≈ 100 ns (2.5 ns/char); escape-dense code text 1.3 vs 3.6 ns/char.
- `libs/runtime/server-bytes.ts:51` `putText` — per-UTF-16-unit JS loop (charCodeAt + branch + byte store), ~2.3 ns/char; used for every string ≤ 64 units:
  - `libs/runtime/server-slab.ts:11` `TEXT_INLINE = 64` (`writeText`) and `libs/runtime/server.ts:270` `RAW_TEXT = 64` (raw rows / records, `rawRow` → `putText` at `server.ts:1241`).
  - The 64 cut-off is ~5× too high: the native path costs a fixed ~28 ns, so the loop only wins below ~12 chars.
- Strings > 64 with any `&<>`: `libs/runtime/escape.ts:16` `value.replace(TEXT_ESCAPE, fn)` — callback per match + new string + second encode.
- Plus per-string gRPC decode in JS (`services/page-decoder.ts` `buf.toString("utf8", …)`, 10k strings/page) — shared harness, real cost any Node app pays.
- `--cpu-prof` profile: NOT captured (usage cap). Next step: `node --cpu-prof` on `dist/server.mjs` under `loadgen` with `strings=2`, `cpu-breakdown.ts` to split `rivet` / `data` / `http`.

## Suggested fixes (fix 1 partly applied, see below)

1. **Lower `TEXT_INLINE` / `RAW_TEXT` to ~12–16**, longer strings: `SPECIAL.test` then `utf8Write` straight into the slab (raw rows: write in place, measure exact bytes). Estimate: 40-char field 100 → ~30 ns; grid page −0.6–0.7 ms CPU (~15–20%). Small change, needs raw-row sizing to use `utf8Write`'s return (Buffer slabs only; router `BodyWriter` needs `encodeInto`).
2. **Escape without `replace` callback** for > 64-char dirty strings: `indexOf`-chunked copy (`utf8Write` clean spans + entity bytes). Estimate: 116 → ~45 ns per dirty string; matters for code/forum pages.
3. **ASCII fast scan in `putText`** (fold the special-char check into a tight loop over a `Uint8Array` view via `latin1Write` + table) — needs measurement; likely 1.5–2× on the inline loop.
4. Longer term: native escape+encode (simdutf-style) is out of reach in pure JS; Bun/Deno lanes may behave differently — re-run grid there.

**Fix applied (2026-10-08, long strings only):** raw rows / records (`rawRow`, `rawPut`) no longer fall to the generic path for strings > 64 units when they have no `&<>`: `putLong` writes them straight into the slab (`utf8Write`, `encodeInto` on non-Buffer slabs). Dirty long strings and the sized `rawSize` fallback unchanged. In-process rivet-compiled, 1000 rows × 10 fields, 8 interleaved rounds: 65–200 chars CPU/page 1.06 → 0.93 ms (−11.5%, 8/8 rounds), 24–64 chars and int/short rows neutral (±0.4%). Threshold lowering (`RAW_TEXT` ~16) measured +22% worse, not done; fixes 2 and 3 open. Docker grid re-run not done.

**Fix 3 applied (2026-10-08):** `putText` writes clean strings > 16 units with one native `utf8Write` after a `TEXT_SPECIAL` test (Buffer slabs; per-char loop otherwise and for dirty strings). Micro (ns, clean): 24 chars 44 -> 27, 64 chars 154 -> 51, 200 chars 486 -> 63; dirty 24 chars 58 -> 72 (extra regex test). In-process rivet-compiled, 1000 rows x 10 fields, 20% dirty, 8 interleaved rounds: 24-64 chars CPU/page 1.52 -> 1.06 ms (-29.7%, 8/8); 65-200 chars and int/short rows neutral.

**Fix 2 tried, not kept (2026-10-08):** `escapeText` without the `replace` callback (`search` then per-char slice/concat <= 40 units, regex `exec` + slice/concat above). Micro (ns, 1-3 specials): 8 chars 83 -> 22, 24 chars 92 -> 49, 64 chars 93 -> 50, 200 chars 102 -> 52. In-process rivet-compiled 65-200 chars (20% dirty) CPU/page 1.60 -> 1.65 ms (+3.7%, 0/8 rounds better); 24-64 chars neutral (the raw path escapes those in `putText`, not `escapeText`). Reverted.

## Hypotheses

| # | hypothesis | status | result |
|---|---|---|---|
| 1 | Multi-core (Kestrel all cores vs one Node process) | **untested** (cap) | Harness gives every lane 1 CPU, fair. Probe prepared (compose override `cpus: 4` + `node:cluster` wrapper, not run). Expectation: Rivet needs a cluster → N× memory. |
| 2 | Escape-heavy / text-heavy pages | **confirmed** | Grid: Razor wins 4/5 metrics (above). Root cause = inline JS escape+encode loop. Non-ASCII: Razor's default `HtmlEncoder` emits `&#x…;` (cjk 5.7 ns/char, 8 bytes/char) — favours Rivet unless Razor is configured with `UnicodeRanges.All` (then 0.9 ns/char vs Rivet 2.1). |
| 3 | Huge mostly-static pages | not run | Code read: compiled static fragments are pre-encoded once per template (`server.ts:436` `encoded`); no per-request string→UTF-8. Low risk. |
| 4 | Intl / number / date formatting | untested | probe scripts written, not run |
| 5 | Deep nesting / partials | untested | — |
| 6 | Very large pages (MBs) | prior data | 5000 rows (3.5 MB): Rivet wins all metrics (fair comparison 2026-10-06). |
| 7 | GC tail under load | prior data | Razor p99 worse at 1000 rows c1 (28.8 vs 2.83 ms); not re-run. |
| 8 | Resumable vs Razor | measured (grid) | Razor sweeps `rivet-resume` on all five; not like-for-like (handlers + state, +52% bytes). |

## Side finding

- First grid run crashed `rivet-compiled` (`Error: Response stream closed`, unhandled rejection from the paused-render `void this.flush()` in `libs/runtime/node.ts` when a client closed mid-page). Already fixed concurrently by a6d136c2; numbers above are after the fix. Large text pages are a good regression check for it.

## Fixture

- `apps/ssr-bench`: proto `PageRequest.strings` bool → int32 (wire-compatible; 0 ints, 1 escaping, 2 grid), C# regenerated, `FieldText`/`GridText` (ContentService) mirrored by `loadgen/validate.ts` `fieldText`, `benchmark.py --grid`, `fair-report` key `+grid`, adapter + loadgen tests for every lane.
- Run: `npm run bench:ssr -- --frameworks rivet-compiled,dotnet --grid --rows 1000 --concurrency 1,10 --gc tuned` (and `--gc default`).
- Raw results: `.artifacts/ssr-bench/razor-adversarial/{grid-tuned,grid-default}/`.

## Grid profile 2026-10-08 (measured, nothing kept)

- In-process `--cpu-prof` (1000x10 text grid, 24-64 chars, 20% dirty, 2000 pages, 1.03 ms/page): `utf8Write` native call 37% (32.5% binding + 4.6%), `putText` 22.7% (`server-bytes.ts:56`), `rawPut` 13.5% (`server.ts:926`), `[&<>]` regex test 11.9%, `admit` 2%. ~57 scavenges / 2000 pages, no mark-compact: GC is not the cost.
- `NATIVE_TEXT` sweep (8, 16, 32, 48, 80, 0; 3 interleaved rounds): 16 and 8 equal within 1.5% (noise), 32 +3%, 48 +20%, 80 +40%. Kept 16.
- Real loopback HTTP, server CPU/page vs `NodeStreamWriter` threshold 16/64/128 KB: 1.08-1.12 ms, flat. Chunk handoff is not a cost; the Docker 2.86 ms/page is HTTP stack + GC + 1-CPU contention on top of ~1.0 ms render.
- Row-level concat (`frag + s0 + frag + ...` then one regex test + one `utf8Write`) is 3x faster on all-clean rows (0.23 vs 0.70 ms/page) but with 20% dirty fields 89% of rows contain one; per-field escape on dirty + concat measured 0.87 vs 0.63 ms/page (slower). Not kept; only a win for mostly-clean data and needs string fragments from the compiler.
- Floor for runtime-side work is the per-string native call (~38 ns) plus the scan. No compiler patch note: no compiler-output cost found in the profile.

## Where the Docker time goes (2026-10-08, HTTP / GC lane)

Probe: Docker, lane image `rivet-ssr-bench-node:local` (Node 24.14) with a mounted `dist/`, 1 CPU / 512 MiB, tuned GC flags, node loadgen v2 (2 CPUs), grid 1000 rows, c=1, CPU = container cgroup `usage_usec` per page. Probe variants are edited copies of the built `dist/`, never committed. Scripts: scratchpad `rh/drun.sh`.

| variant (rivet-compiled) | CPU ms/page | rps | p50 ms | minor GC ms/page |
|---|---:|---:|---:|---:|
| as benchmarked | 2.75–2.92 | 254–266 | 3.11–3.26 | 0.28–0.30 |
| page fetched once, reused (render + HTTP only) | 0.85–0.94 | 932–1036 | 0.85–0.88 | 0.003 |
| decode in the handler (gRPC returns raw bytes) | 2.28 | 295 | 2.93 | 0.024 |
| `page.rows = []` after the response (diagnostic) | 2.10 | 304 | 2.93 | 0.032 |

- **Rivet's own stack (render + `NodeStreamWriter` + node:http) is ~0.87 ms/page in Docker** (`--cpu-prof`: Rivet JS 0.46 ms, native `utf8Write` / `[&<>]` test 0.24 ms, node:http JS ~0.02 ms, `writev` syscall 0.10 ms). The HTTP stack is not the gap.
- Single write / fewer chunks (1 MiB slab, 512 KiB threshold, no share yields): CPU −5–10% (0.85 → 0.80 c=1, 0.92 → 0.83 c=10) but TTFB 0.19 → 0.72 ms and c=10 peak 121 → 157 MiB. Not kept. Content-Length is not available to the lane writer: `server.ts` (shared) appends `<!--complete-->` after `renderPage`.
- **The ~1.9 ms/page between Rivet's stack and the benchmarked lane is the shared Node data layer**: grpc-js 0.35 ms, JS protobuf string decode (`utf8Slice`, 10 k strings) ~0.5 ms, and GC ~1.0 ms (40% of profile samples).
- GC root cause: old-generation nepotism. The decoded page (~0.9 MiB: 10 k strings + rows) is referenced from per-call objects that are already old (promise / grpc-js call state that an earlier mark-compact promoted while in flight). Dead old objects keep the young page alive through scavenges, so every page is promoted (sampling heap profiler, objects that survived scavenges and died in mark-compact: 917 KiB/page, 90% `page-decoder` `row()`). Old space fills in ~10 pages and incremental marking runs constantly (mark-compact every ~40 ms, 2 interleaved scavenges each). Flags do not help: `--min-semi-space-size=8`, `--no-allocation-site-pretenuring`, `--minor-ms` all unchanged.
- Decoding outside grpc-js removes it for rivet-compiled (2.75 → 2.28 ms CPU, c=10 2.75 → 2.36) but **not for Solid** (`solid-stable-static` 2.98/3.07 → 3.18/3.23 ms, 2 paired runs: its own `renderToString` garbage dominates). A shared-harness change that helps Rivet and not a peer needs an orchestrator decision; **not applied**.
- Fairness: both lanes get `cpus: 1.0` (CFS quota 100000/100000, no cpuset, 512 MiB); `nproc` = 10 in both. .NET sizes `ProcessorCount` from the quota (1). Razor runs 14 threads (2 thread-pool workers + socket / timer / finalizer threads), Node 11 (main + libuv / V8 helpers), all under the same 1-CPU quota. The multi-core probe (`multicore/`) was not needed: neither lane is multi-core, so a Node cluster lane would not be like-for-like. Not pinned further.
- Kept (Rivet-owned): e7eee5be, router body slabs are `Buffer`s on Node / Bun, so text takes the native `utf8Write`. Before, `putText` used the per-char loop on `Uint8Array` slabs (24% of rivet-router CPU). Paired drun, c=1: rivet-router grid CPU 3.59 → 3.23 ms/page, p50 3.94 → 3.57 ms. Int 1000 rows 1.13 → 1.06 ms. rivet-resume int 1000 rows 4.18 → 3.81 ms. 100 rows neutral.

### `benchmark.py` after e7eee5be (tuned, 10 s × 3, median), host load ~10–20

| grid 1000 rows | c | Razor | rivet-compiled | rivet-router | winner |
|---|---|---:|---:|---:|---|
| rps | 1 | 380 | 258 | 229 | Razor ×1.48 |
| complete p50 ms | 1 | 2.33 | 3.28 | 4.08 | Razor ×1.41 |
| TTFB p50 ms | 1 | 1.87 | 2.58 | 3.95 | Razor ×1.38 |
| CPU ms/page | 1 | 2.06 | 2.84 | 3.43 | Razor ×1.38 |
| peak MiB | 1 | 105 | 87 | 97 | **Rivet** |
| rps | 10 | 459 | 320 | 286 | Razor ×1.44 |
| complete p50 ms | 10 | 18.1 | 31.2 | 34.7 | Razor ×1.72 |
| TTFB p50 ms | 10 | 10.7 | 30.2 | 34.6 | Razor ×2.8 |
| CPU ms/page | 10 | 2.12 | 2.80 | 3.13 | Razor ×1.32 |
| peak MiB | 10 | 291 | 96 | 116 | **Rivet** ×3.0 |

- rivet-compiled moved little (no lane-owned change; within noise of the 2026-10-08 fixes run). Razor still wins the 8 grid cells it won under `tuned` (every metric except peak memory). The rivet-router run did not have a `benchmark.py` before-run; its before/after is the paired drun above.
- Standard scenario, same session (ints, `--skip-build`): rivet-compiled beats Razor on rps / p50 / TTFB / CPU at 1000 rows: c=1 997 vs 640 rps, 0.77 vs 1.43 ms CPU; c=10 1406 vs 696 rps, 0.71 vs 1.42 ms CPU. At 100 rows: c=1 0.21 vs 0.27 ms CPU, p50 0.26 vs 0.29 ms; c=10 CPU 0.15 vs 0.15 ms, p50 1.42 vs 1.17 ms (Razor). Rivet peak memory 162–165 MiB vs Razor 99–209: the containers kept the grid run's heap (`--skip-build` reuses them), so memory is not comparable across these cells. rivet-router 1000 rows c=1 1.02 ms CPU, 0.93 ms TTFB.
- Raw: `.artifacts/ssr-bench/runs/20261008T051559.768638Z-90b087cb` (grid), `20261008T052059.677617Z-e06a8e53` (standard).

## Transport + runtime update (2026-10-09, every Node lane)

- Harness change, applied to every Node lane (Rivet, Solid, Qwik, router):
  - `Dockerfile.node`: Node 24.14 → digest-pinned Node 26.11 (V8 14.6);
  - `services/content.server.ts`: grpc-js → a lean unary gRPC client over `node:http2`. The page is decoded once in the stream's close handler, outside any call state, which removes the nepotism above.
  - Same proto, wire bytes and validation; Razor unchanged.
- Rejected (Rivet-only, unfair): a lane-owned byte-text representation of the decoded strings.
- `benchmark.py --grid`, 1000 rows c=1, 10 s × 3, tuned. Run `20261009T031931.931591Z-a7a54b99`, all Node lanes on the same image:

| metric | Razor | rivet-compiled | solid-stable-static | winner |
|---|---:|---:|---:|---|
| CPU ms/page | 2.31 | **2.00** | 2.74 | **Rivet** ×1.16 |
| rps | 334 | **358** | 285 | **Rivet** ×1.07 |
| peak MiB | 94 | **66** | 87 | **Rivet** ×1.43 |

- Paired Docker probes (fresh containers, real dotnet backend, interleaved, 3 rounds, median) for the grid page at c=1:
  - rivet-compiled 3.23 ms/page (Node 24 + grpc-js) → 3.27 (Node 26 + grpc-js) → **2.00** (Node 26 + lean h2);
  - solid-stable-static 3.44 → 2.57.
- The data client is the lever. Node 26 alone does nothing for the grid in Docker.
- Full before/after tables: `2026-10-09-transport-node26.md` (notes section).


## WebAssembly row emitter (2026-10-09, runtime-only, generic)

- Change: `libs/runtime/server-rows.ts` — compiled list rows (`_listPlan` plans, byte writers) go through a 943-byte WebAssembly + SIMD emitter generated by `scripts/gen-row-wasm.mjs`. One native `utf8Write` per string into wasm memory, one wasm call per ≤ 128 KiB chunk (fragments, text / attribute escaping, int32 digits), one copy into the slab. Same JS strings from the shared decoder, no lane or harness change. Rows it does not take (URL-checked string attributes, null / boolean attributes, objects, non-int32 numbers) and hosts without WebAssembly (Workers) keep the per-row path; bytes identical (`libs/runtime/tests/server-rows.test.ts`).
- In-process render only (decode excluded, 300 pages × 7 interleaved rounds, median; host load 4.1–4.9):

| page | HEAD ms | emitter ms | |
|---|---:|---:|---|
| grid 1000 rows (`strings=2`) | 0.793 | 0.462 | ×1.72 |
| ints 1000 rows | 0.281 | 0.140 | ×2.00 |
| ints 100 rows | 0.071 | 0.035 | ×2.06 |
| escaping 1000 rows (`strings=1`) | 0.485 | 0.407 | ×1.19 |

- Docker single lane (`tx-after:local` image, real dotnet backend, 1 CPU / 512 MiB, 8 s warm + 10 s measure, CPU = cgroup `usage_usec` / responses; 2 rounds, order swapped; host load 5–15). CPU ms/page, rounds 1 / 2:

| cell | HEAD | emitter | Δ | rps HEAD → emitter |
|---|---:|---:|---:|---|
| grid 1000 c=1 | 2.19 / 2.04 | 1.80 / 1.64 | −18 to −20% | 319–350 → 367–410 |
| grid 1000 c=10 | 2.63 / 2.41 | 2.36 / 2.14 | −10 to −11% | 375–406 → 415–456 |
| ints 1000 c=1 | 0.582 / 0.563 | 0.372 / 0.373 | −34 to −36% | 1037–1107 → 1476–1490 |
| ints 100 c=10 | 0.0814 / 0.0817 | 0.0699 / 0.0690 | −14 to −16% | 10561–10990 → 12968–12970 |
| escaping 1000 c=1 | 1.23 / 1.29 | 1.20 / 1.19 | −2 to −8% | 554–584 → 590–595 |

- vs Razor (stored 2026-10-08/09: grid c=1 2.31, c=10 2.06–2.12 ms CPU/page): grid c=1 ×1.28–1.41, c=10 ×0.90–0.99 (Razor still ahead at c=10: shared decode + GC, not row emission). Not a `benchmark.py` run; re-run the grid matrix to restate the tables above.
