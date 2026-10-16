## Notes (hand-written; appended by `fair-report.ts --notes`)

### Run caveats

- Host: 14-core Mac, Docker Desktop. Host load was recorded per trial (`host_load_1m`). It reached 70–106 during parts of the runs: the cdk-docs dev server, docs-kit example builds and Spotlight were running at the same time.
  - The worst-hit cases were rerun (rows=100 → `tuned-100`). Later inputs supersede earlier ones per (profile, rows, c, lane).
  - c=100 rows=1000 and rows=5000 carry host-load warnings in their `results.json`.
  - Prefer c=1/c=10 numbers for close calls. CPU/page is the most robust metric here, because it comes from cgroup counters.
- Qwik 2 rc at rows=1000 c=100 failed in run A (connection refused, plus 2–17 failed responses for both Qwik lanes). It is excluded and listed under Failed cases.
- krausest: the scoreboard printed `reference: null, drift: unknown` because `scoreboard.ts` read `published.chrome` instead of `published.source.chrome`. This is fixed (`verdict.ts` `publishedChrome`, plus a test). For this run the measured build was 154.0.8037.98, the same as the published build.
- The resume `paintLatency` (B7) for the click scenario is dominated by one ~55 ms long animation frame (LoAF) in Rivet and both Solid lanes (`loafMax` 55 ms; 4× CPU throttle). Qwik's click shows no LoAF. The click → DOM-mutation `latency` is a TIE (Rivet 4.5 ms vs Solid 1 3.7 ms vs Qwik 19 ms).

### Qwik / Solid lane audit (RPC + RPC, double fetch)

- Each Qwik and Solid adapter makes exactly one unary gRPC call per page, inside the shared `server.ts` request handler. The adapter receives the already-decoded page (`renderPage(page, …)`). There is no `server$`, `routeLoader$` or client refetch, and the Qwik client bundles are not executed during SSR.
- Backend calls ÷ successful responses in run A (backend `/metrics` counter delta over each lane's window):
  - every lane: 1.0000 ± 0.0005;
  - qwik: 0.9954;
  - qwik-stable: 1.0003.
  - The two Qwik deviations are window-boundary effects (calls in flight at the window edges).
- No change was needed, so there are no before/after numbers. The cost of the Qwik lanes is their own SSR: a per-row `component$` boundary and container-state serialization, which shows up as 945 KB of HTML at 1000 rows.

### CPU profile breakdown (rivet-compiled, rivet-router, rivet-resume) at 1000 rows, c=1

**Method**
- Lane container: same image and command as the bench (`--single-threaded-gc --max-semi-space-size=8`, 1 CPU / 512 MiB), plus `--cpu-prof --cpu-prof-interval 200`, against the compose gRPC backend.
- Load: a closed-loop c=1 keep-alive driver in a separate container, 5 s warmup + 20 s measured (resume: 30 s).
- Self time is attributed by `apps/ssr-bench/cpu-breakdown.ts`.
- Allocations come from a second run with the sampling heap profiler, counting objects already collected by minor and major GC (preload script, 16 KiB sampling interval). Bytes are per page.
- Profiles cover V8 self time only. Container CPU/page (from the table above: 0.98 / 2.34 / 28.8 ms) also includes kernel network time and profiler overhead.

**Owners**
- `rivet` = Rivet-owned code: the lane bundle (compiled template, runtime `NodeStreamWriter`), the router build (handler, resume renderer, node adapter, route modules).
- `data` = the shared bench data client: `@grpc/grpc-js`, `node:http2`, `services/page-decoder.ts`. All lanes use the same client.
- `http` = Node core response writing (`writev`, streams, `_http_outgoing`).
- `harness` = `dist/server.mjs` glue (shared).

| lane | V8 busy ms/page | rivet | data (shared) | http (Node core) | harness (shared) | GC | other |
|---|---:|---:|---:|---:|---:|---:|---:|
| rivet-compiled | 0.772 | 0.289 (37.5%) | 0.110 (14.2%) | 0.093 (12.1%) | 0.002 | 0.252 (32.7%) | 0.025 |
| rivet-router | 1.639 | 0.707 (43.1%) | 0.113 (6.9%) | 0.097 (5.9%) | – | 0.632 (38.5%) | 0.091 |
| rivet-resume | 23.5 | 15.0 (63.8%) | 0.209 (0.9%) | 0.330 (1.4%) | – | 7.33 (31.2%) | 0.635 |

| lane | allocated KB/page | rivet | data (shared DTO decode) | http | other |
|---|---:|---:|---:|---:|---:|
| rivet-compiled | 433 | 101 (23%: list tape `sn` 86 KB) | 270 (62%: `row` 219, `decodePage` 28) | 32 | 28 |
| rivet-router | 930 | 456 (49%: route `Record` per-row template + hole arrays 234 KB, resume `within` closures 89 KB) | 270 (29%) | 17 | 187 (promises / web-stream reads) |

**Hot frames**
- rivet-compiled:
  - `En`, the compiled list plan interpreter: 15.2% of busy.
  - `writeBytes`: 10.7%.
  - `writeInteger`: 8.3%.
  - `writev` (syscall): 7.5%.
  - `decodePage`: 5.3%.
  - grpc-js `makeUnaryRequest` / `onReceiveMessage`: 3.1%.
- rivet-router:
  - `compiledSequenceValue`: 8.0%.
  - `writeBytes` + `writeInteger`: 10.6%.
  - `admit` / `visit` / `visitValue`: 9.1%.
  - Route `Record`: 3.6%.
- rivet-resume:
  - `planPreload` + its `follow` closure: **28.3%** (≈ 6.6 ms/page).
  - `admit`: 4.7%.
  - `encodeRecords` / `stateJSON` / `reachableSymbols` / `needs`: 6.8%.

**Transport share (RSPIKE cross-check)**
- For rivet-compiled, shared data client + Node core writes = 0.203 ms of V8 time.
- Adding the GC share of the decoded DTO (62% of allocation ≈ 0.16 ms) and kernel/network time outside V8 (≈ 0.2 ms) gives about 0.56 of 0.98 ms/page, or **~57% transport**. This agrees with the rust-ceiling spike's ~60%.
- The Rivet-owned part is about 0.29 ms of render/writer plus about 0.06 ms of GC caused by its own allocations.

**Rivet-owned optimizations** (estimates are against container CPU/page at 1000 rows c=1; none of them touch the shared harness)

1. **rivet-resume: make `planPreload` linear.** `follow(refs, own)` runs once per handler (1000 rows means 1000 handlers that share one symbol). Each call re-walks `reachableSymbols` and then iterates every reader of every reached signal: `selected` is read by all 1000 row bindings, so the loop is O(handlers × readers), plus `own.includes`. This explains the superlinear scaling: CPU/page grows ×12.4 from 100 → 1000 rows and ×12.9 from 1000 → 5000 rows. Fix: memoize `follow` by handler symbol / reached-signal set and compute each signal's reader extras once (file `libs/runtime/server-resume.ts`, `planPreload`). Est. **−6 ms/page at 1000 rows (−25%)**, and the quadratic term disappears at 5000 rows (372 ms/page).
2. **rivet-router: same list lowering as rivet-compiled.** The router's resumable server compile emits `data.rows.map(row => Record({row}))`: per row a component call, a `compiledTemplate` object, an 11-hole array and an `attribute()` object (234 KB/page), walked by `compiledSequenceValue` / `admit` / `visit`. rivet-compiled lowers the same `.map` to a flat plan plus tape. Applying that lowering when rows carry no resumable state would remove most of the router-vs-compiled gap (2.34 vs 0.98 ms). Est. **−0.5 to −0.8 ms/page (−20–35%)**.
3. **rivet-router node adapter: skip the web stream for Node responses.** Render currently goes slab → `ReadableStream.enqueue` → `reader.read()` + `Promise.race` per chunk (187 KB/page of promise and stream objects). The slab is also a fresh `new Uint8Array(64 KiB)` per slab (`libs/router/server/render.ts`), without the slab pool `NodeStreamWriter` uses, so its external memory adds GC pressure. Writing straight into `res` through `NodeStreamWriter` (pooled slabs, write-callback recycling) when the node adapter serves a page would avoid both. Est. **−0.15 to −0.3 ms/page (−6–12%)**. This also lowers peak memory.
4. **rivet-compiled list tape.** The `.map` lowering (`sn`) materializes a per-page tape array of rows × holes (86 KB/page, 20% of all allocations) before emitting. Emitting row by row from the source, or reusing a pooled tape, removes it. Est. **−0.03 to −0.05 ms/page (3–5%)**, mostly GC.
5. **Fused row writer.** Each row makes 2·11+1 = 23 `writeBytes` / `writeInteger` calls (23k per page, 19% of V8 busy time). A compiler-specialized row emitter (static fragments and integer holes written in one function with the bounds check once per row), instead of interpreting the plan in `En`, would cut call and dispatch overhead. Est. **−0.06 to −0.1 ms/page (6–10%)**.
6. **Fewer, larger writes.** At the 16 KiB threshold a 688 KB page makes about 43 `sink.write` calls and `writev` batches (http 12% of busy). For pages rendered synchronously in one tick, use a 64 KiB threshold, or cork for the tick and uncork once. Est. **−0.02 to −0.04 ms/page (2–4%)**. TTFB is unchanged at c=1 because the first chunk still leaves immediately.
- Items 4–6 together put rivet-compiled at roughly 0.80–0.87 ms/page. The remaining ~0.56 ms is the shared transport (grpc-js, page decoder, DTO GC, kernel), which is the same for every lane and is not optimized here.

### Bun / Deno lanes

- Images and contexts:
  - `oven/bun:1.4.2` and `denoland/deno:2.9.7`, both digest-pinned.
  - Byte-identical `dist/` bundles and `node_modules`, copied from the built Node lane image via Compose `additional_contexts`.
  - Bundle sha256 is recorded per run.
- **Compatibility gaps: none found.** All five lanes pass strict validation (0 failures) on the same backend, using `node:http`, `@grpc/grpc-js` and `node:http2` through each runtime's Node compatibility layer. The only change was Compose `init: false` for Deno, whose image already runs tini.
- GC parity:
  - Deno runs with the same V8 flags as Node.
  - Bun (JavaScriptCore) has no semi-space knob; `tuned` = `BUN_JSC_useConcurrentGC=0` only.
- **Results** (see the Runtimes table):
  - Both runtimes use clearly less memory: peak 60–98 MiB vs 98–172 MiB on Node.
  - At 100 rows, Bun and Deno win most latency and throughput cells.
  - At 1000 rows, rivet-compiled on Bun **loses** to Node: CPU 1.25 vs 0.98 ms/page, 649 vs 868 req/s. Solid static on Bun gains (1.08 vs 1.34 ms/page). Rivet's byte-slab writer (`Buffer` subarray + `writev`) appears to be slower on JSC than Solid's string concatenation, so the writer path on Bun is a follow-up.
  - Deno runs rivet-compiled at Node parity (0.91 ms/page) and the router lane 30% faster than Node (1.65 vs 2.34 ms/page).
