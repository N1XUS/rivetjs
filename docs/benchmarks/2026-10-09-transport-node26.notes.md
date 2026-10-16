## Notes (hand-written; appended by `fair-report.ts --notes`)

### What changed in the harness (2026-10-09, every Node lane)

- **F0 — runtime:** `apps/ssr-bench/Dockerfile.node` moved from `node:24.14.1-bookworm-slim` (V8 13.6) to digest-pinned `node:26.11.1-bookworm-slim` (V8 14.6), for the build stage and every Node lane (Rivet, Solid, Qwik, router; Bun / Deno lanes copy the same bundles). Razor stays on .NET 10. The load generator image (`Dockerfile.loadgen`) stays on Node 24 so its source hash and provenance are unchanged.
- **F2 + F3 — data client:** `apps/ssr-bench/services/content.server.ts` no longer uses grpc-js / proto-loader. It is a lean unary gRPC client over `node:http2`:
  - one persistent session (16 MiB receive window), hand-framed `PageRequest`, `grpc-timeout` 15 s;
  - `grpc-status` / trailers-only errors, abort via `signal`;
  - the static `page-decoder.ts` runs once in the stream's close handler, outside any call-state object chain.
  - Same proto, same request contract, same wire bytes from the backend, same strict validation.
  - Same class of client as Razor's Grpc.Net.Client. `server.ts` and the router app both import this one module, so every Node lane gets it.
- **Rejected:** a Rivet-only byte-text representation of decoded strings (PERF-TRANSPORT F1). The harness gives no lane its own data path.
- Findings and prototype: PERF-TRANSPORT (scratchpad). The probe scripts and logs live in the IMPL-TRANSPORT scratchpad.

### Before / after A/B (Docker probes, interleaved)

**Method**
- The three images were built from one snapshot of the tree:
  - `before` = Node 24.14 + grpc-js;
  - `n26grpc` = Node 26.11 + grpc-js;
  - `after` = Node 26.11 + lean h2.
- Each sample is a fresh lane container (1 CPU / 512 MiB, tuned flags) plus the real dotnet ContentService backend (2 CPU) and loadgen v2 (2 CPU, strict validation every 32nd response). It runs 8 s warmup + 10 s measured.
- CPU/page = lane cgroup `usage_usec` / successful responses.
- 3 rounds, lane order reversed every other round. The table shows medians; there were 0 failed and 0 strict-failed responses.
- Host load (1-min) during the runs: 4–25 (other agents).

| page | c | rivet-compiled before | Node 26 only | after (Node 26 + h2) | gain | solid-stable-static before → after | gain |
|---|---|---|---|---|---|---|---|
| ints 1000 | 1 | 0.897 | 0.839 | **0.523** | 1.72× | 1.485 → 1.134 | 1.31× |
| ints 100 | 10 | 0.170 | 0.154 | **0.083** | 2.05× | 0.209 → 0.151 | 1.38× |
| text grid 1000 | 1 | 3.227 | 3.265 | **2.002** | 1.61× | 3.439 → 2.572 | 1.34× |
| ints 5000 | 10 | 3.547 | 3.566 | **3.242** | 1.09× | 10.31 → 11.34 | 0.91× |

- rivet-router `/page`: 1000 c1 1.216 → 1.012 ms (1.20×); 100 c10 0.307 → 0.257 ms (1.19×).
- rivet-resume `/resume`: 1000 c1 2.677 → 2.565 ms (1.04×). That page is render-bound.
- Node 26 alone (grpc-js kept) is worth ≤ 1.1× here. Most of the gain is the data client. Under grpc-js the decoded page stays reachable from old call state, so in-flight pages are promoted. Node 26's V8 copes with that better, but the fix is to drop grpc-js.
- Peak memory at c1 falls too: rivet-compiled 88 → 72 MiB at 1000 rows, solid-stable-static 134 → 99 MiB.
- Razor numbers from these probes are **not used**: a freshly started .NET container is 1.6–2.3× slower than in `benchmark.py`'s long-lived container, even after 30 s of warmup. The Node lanes match `benchmark.py` (rivet-compiled 1000 c1: 0.523 probe vs 0.52 benchmark).

### Canonical `benchmark.py` runs (after; tables above + two extra runs)

- These runs used the same `after` image for every Node lane (`RIVET_BENCH_NODE_IMAGE=tx-after:local`, `--skip-build`) and the unchanged dotnet images: 10 s × 3 repeats, 10 s prewarm, tuned GC.
- c=10 run `20261009T031441.267598Z-10987f57`, CPU/page in ms:

| lane | 100 rows | 5000 rows |
|---|---|---|
| Rivet static | 0.09 | 3.17 |
| Razor | 0.18 | 10.3 |
| Solid 1.9 static | 0.16 | 6.98 |

- Throughput, same run: 100 rows 10.5k vs 5.5k vs 6.0k rps.
- Text grid (`--grid`), 1000 rows c=1, run `20261009T031931.931591Z-a7a54b99`:

| lane | CPU/page (ms) | rps | peak (MiB) |
|---|---|---|---|
| Rivet static | **2.00** | 358 | 66 |
| Razor | 2.31 | 334 | 94 |
| Solid 1.9 static | 2.74 | 285 | 87 |

  - The Razor-adversarial page flips: Razor led 2.06–2.13 vs 2.80–2.84 ms on 2026-10-08 (`razor-adversarial.md`).
- `solid-stable-static-bun` is no longer in `apps/dom-bench/competitors.json`. Its Bun image is built from the lane image and was not rebuilt for this run. Re-measure it with a full build when needed.
