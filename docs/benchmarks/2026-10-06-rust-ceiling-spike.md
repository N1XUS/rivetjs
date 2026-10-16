# Rust-native SSR ceiling spike (2026-10-06)

Throwaway spike, user-approved. Question: how much faster could the ssr-bench page get if server rendering ran natively in Rust instead of V8? This is the ceiling for a possible "native renderer" compile target. Code: `apps/ssr-bench/spikes/rust-ceiling/` (throwaway). Raw data: `2026-10-06-rust-ceiling-spike.json`, run `.artifacts/ssr-bench-rspike/runs/20261006T143749.360118Z-d599b4bb/`.

## Verdict

- **Kill criterion (single-threaded native < 3× Node CPU/page at 1000 rows): borderline fail.** Measured 3.27× at c=1, 2.88× at c=10, 2.93× at c=100.
- **The architecture the idea actually needs fails clearly.** Loaders stay in JS and hand data over as JSON, which brings it down to **1.75–2.16×**. An in-process native renderer inside Node (Node keeps HTTP + gRPC) works out to about **1.15×** (estimate below).
- **Recommendation: drop the native-target idea.** Template rendering is no longer the dominant cost in the Node lane. Even a perfect native renderer (14× faster render-only) only removes about 40% of Node's per-page CPU. The rest is the transport (gRPC/HTTP), which a native renderer can't touch.
- Where native clearly wins: **memory** (7–39 MiB vs 150–194 MiB Node vs 79–460 MiB Razor), and **p50/TTFB** (2.5–3× lower, mostly because there is less CPU per page under the 1-CPU quota).
- Compared with Razor (`dotnet`): native Rust uses 6.2–7.5× less CPU/page at 1000 rows. rivet-compiled already uses 1.8–2.6× less CPU/page than Razor.

## Setup

- Lanes, all run in one isolated Compose project (`rivet-ssr-rspike`, port prefix 182, own backend), same matrix:
  - `rivet-compiled` (Node 24, tuned GC, 1 CPU / 512 MiB)
  - `dotnet` (Razor .NET 10, tuned GC, 1 CPU / 512 MiB)
  - `rust-ceiling`: tokio `current_thread` = one OS thread, **1 CPU / 512 MiB**
  - `rust-ceiling-json`: same, but protobuf → JSON string → serde_json parse → render
  - `rust-ceiling-mt`: tokio multi_thread, 2 workers, **2 CPUs**. Not quota-equal; shows scaling only.
- Matrix: rows 100/1000 × c 1/10/100 × 3 repeats; 10 s measured, 3 s warmup, 10 s prewarm per lane.
- Load: node loadgen v2 (sha `e91b5246192e`), `--generator-cpus 4` (headroom ≥ 69% in every case), strict validation sampling (every 32nd + first 2 per connection + any length change). **0 failures, 0 strict-validation failures in every lane.**
- Rust lane:
  - Server: hyper 1.6 HTTP/1.1. gRPC: tonic 0.12 to the same backend, one unary call per page. Messages: prost 0.13, hand-written to match prost-build output.
  - Renderer is written the way a compiler would emit it:
    - static runs as pre-encoded `&[u8]` constants
    - holes go through `rt::text` / `rt::attr` (memchr escaping) and `rt::int` (itoa, typed-number hole)
    - the `.map` over rows is a resumable loop that yields 32 KiB chunks from a pooled `BytesMut` (backpressure = hyper polling the body)
  - Output is **byte-identical** to rivet-compiled (checked with `cmp` at 2 and 1000 rows, and in the strings variant). Toolchain is Docker-only, pinned image digests, `Cargo.lock`.
- Caveat: host load hit 16–106 on 14 cores during part of the run (other lanes' builds). It was worst at rows=1000 c=10. The c=1 cases are the cleanest. CPU/page comes from whole-container cgroup counters, which are less sensitive to this than latency.

## Results (median of 3 repeats)

CPU/page = whole-container CPU ÷ successful responses. Render = in-process render time per page from `/metrics` (wall time, including backpressure for Node).

| rows | c | lane | req/s | p50 ms | p99 ms | TTFB p50 ms | CPU ms/page | peak MiB | render µs/page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | 1 | rivet-compiled | 2,894 | 0.29 | 1.50 | 0.28 | 0.231 | 160 | 37 |
| 100 | 1 | dotnet | 2,724 | 0.32 | 0.85 | 0.31 | 0.297 | 79 | 102 |
| 100 | 1 | rust-ceiling | 4,849 | 0.19 | 0.49 | 0.18 | **0.077** | 5.9 | 7 |
| 100 | 1 | rust-ceiling-json | 4,415 | 0.21 | 0.49 | 0.20 | 0.094 | 6.0 | 7 (+12 parse) |
| 100 | 1 | rust-ceiling-mt (2 CPU) | 4,717 | 0.19 | 0.48 | 0.19 | 0.091 | 4.9 | 7 |
| 100 | 10 | rivet-compiled | 5,383 | 1.65 | 6.97 | 1.64 | 0.185 | 150 | 38 |
| 100 | 10 | dotnet | 5,475 | 1.33 | 26.6 | 1.14 | 0.179 | 94 | 617 |
| 100 | 10 | rust-ceiling | 17,808 | 0.52 | 0.98 | 0.52 | **0.044** | 7.1 | 7 |
| 100 | 10 | rust-ceiling-json | 12,929 | 0.72 | 1.28 | 0.71 | 0.063 | 7.1 | 7 (+12) |
| 100 | 10 | rust-ceiling-mt (2 CPU) | 19,781 | 0.48 | 0.98 | 0.47 | 0.072 | 5.8 | 8 |
| 100 | 100 | rivet-compiled | 5,327 | 17.0 | 36.9 | 17.0 | 0.188 | 184 | 43 |
| 100 | 100 | dotnet | 4,330 | 18.9 | 86.6 | 15.8 | 0.229 | 231 | — |
| 100 | 100 | rust-ceiling | 21,394 | 4.59 | 7.15 | 4.59 | **0.041** | 8.8 | 7 |
| 100 | 100 | rust-ceiling-json | 15,163 | 6.49 | 10.2 | 6.48 | 0.060 | 8.7 | 7 (+11) |
| 100 | 100 | rust-ceiling-mt (2 CPU) | 27,598 | 3.50 | 6.69 | 3.49 | 0.063 | 10.9 | 8 |
| 1000 | 1 | rivet-compiled | 723 | 1.12 | 3.87 | 0.84 | 1.083 | 183 | 437 |
| 1000 | 1 | dotnet | 484 | 1.30 | 22.3 | 0.92 | 2.049 | 103 | 961 |
| 1000 | 1 | rust-ceiling | 1,408 | 0.59 | 1.29 | 0.51 | **0.331** | 7.1 | 69 |
| 1000 | 1 | rust-ceiling-json | 1,158 | 0.76 | 1.34 | 0.68 | 0.502 | 7.5 | 68 (+117) |
| 1000 | 1 | rust-ceiling-mt (2 CPU) | 1,457 | 0.58 | 1.19 | 0.50 | 0.335 | 9.9 | 68 |
| 1000 | 10 | rivet-compiled | 805 | 10.6 | 37.8 | 10.3 | 1.173 | 155 | 497 |
| 1000 | 10 | dotnet | 467 | 18.5 | 67.5 | 9.72 | 2.106 | 227 | — |
| 1000 | 10 | rust-ceiling | 1,786 | 4.87 | 15.0 | 4.70 | **0.407** | 8.9 | 100 |
| 1000 | 10 | rust-ceiling-json | 1,352 | 6.72 | 13.6 | 6.54 | 0.607 | 9.3 | 82 (+134) |
| 1000 | 10 | rust-ceiling-mt (2 CPU) | 2,265 | 4.00 | 10.7 | 3.80 | 0.588 | 14.8 | 112 |
| 1000 | 100 | rivet-compiled | 1,091 | 91.6 | 264 | 91.3 | 0.913 | 194 | 483 |
| 1000 | 100 | dotnet | 429 | 225 | 415 | 103 | 2.329 | 460 | — |
| 1000 | 100 | rust-ceiling | 2,934 | 33.7 | 48.6 | 33.6 | **0.312** | 38.9 | 74 |
| 1000 | 100 | rust-ceiling-json | 1,900 | 51.9 | 70.7 | 51.8 | 0.523 | 33.0 | 79 (+118) |
| 1000 | 100 | rust-ceiling-mt (2 CPU) | 3,562 | 26.4 | 56.8 | 26.2 | 0.463 | 42.5 | 100 |

- At rows=100 c=1 the Rust lanes are latency-bound by the backend round trip (37–43% CPU utilisation). At c≥10 the single-thread Rust lane runs at 73–95% of its quota. The backend (2 CPUs) caps the 2-CPU `-mt` lane.
- `-mt` at c=1 has the same CPU/page as current_thread. Under load it costs 1.4–1.5× more CPU/page (work-stealing and cross-thread wakeups) for 1.1–1.3× more req/s on twice the CPU. It isn't worth it for this workload.
- Razor's render column includes its async response writes (filter wall time), so it isn't comparable as render-only.

### Ratios at 1000 rows (CPU/page)

| c | Node ÷ rust (proto) | Node ÷ rust-json | dotnet ÷ rust (proto) | dotnet ÷ Node |
| --- | --- | --- | --- | --- |
| 1 | **3.27×** | 2.16× | 6.19× | 1.89× |
| 10 | **2.88×** | 1.93× | 5.17× | 1.80× |
| 100 | **2.93×** | 1.75× | 7.46× | 2.55× |

## Micro-bench (in-process, single thread, `--cpus 1`, median of 15 × ≥50 ms batches)

| rows | variant | Rust render | Node rivet-compiled render | render ratio | Rust protobuf decode | Rust serde_json parse | Rust simd-json parse | Rust JSON serialize | Node JSON.stringify | Node JSON.parse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | ints | 6.2 µs | 84 µs | 13× | 8.6 µs | 10.4 µs | 16.8 µs | 5.8 µs | 8.9 µs | 18 µs |
| 1000 | ints | 63 µs | 889 µs | 14× | 89 µs | 103 µs | 189 µs | 58 µs | 104 µs | 178 µs |
| 100 | strings | 7.3 µs | 224 µs | 31× | 25 µs | 41 µs | 36 µs | 7.2 µs | 23 µs | 27 µs |
| 1000 | strings | 74 µs | 2,232 µs | 30× | 343 µs | 421 µs | 459 µs | 72 µs | 313 µs | 271 µs |

- The Node render includes NodeStreamWriter → `Writable` (discarding sink). Rust render includes chunking into frozen `Bytes`. HTML is 688 KB at 1000 rows: Rust emits it at about 11 GB/s, which is mostly memcpy of the static runs.
- **Native render is 14× (ints) to 30× (escaping-heavy strings) faster than V8.** But at 1000 rows, render is only 63 µs of Rust's 331 µs/page. The rest is protobuf decode (89 µs), tonic/h2 gRPC, the hyper write path and syscalls.
- **Parse share (JSON boundary):**
  - serde_json parse costs 1.6× the render itself (103 vs 63 µs). In the lane, parse is 117–134 µs/page = 23–26% of the json lane's CPU/page; serialize + parse = 35%.
  - simd-json is slower here: tiny int arrays and per-row allocation, no wide strings.
  - Strings variant: parse (421 µs) is 5.7× the render, because each value is an owned `String`. Borrowed `&str` deserialization would help, but the data still has to cross the boundary.

## Why the realistic shapes fail

- **Fully native server with JS loaders.** The JS side must stringify (Node `JSON.stringify` 104 µs at 1000 rows) and ship the JSON over IPC, and Rust must parse it (103 µs). Measured end to end: 1.75–2.16× vs Node, below the 3× bar before even counting the JS loader process's own HTTP/IPC CPU.
- **Native renderer inside Node (napi addon), Node keeps HTTP + gRPC.**
  - Node's non-render CPU at 1000 rows ≈ 1.083 − 0.437 ≈ 0.65 ms/page.
  - The hybrid costs 0.65 + boundary (stringify 0.104 + parse 0.103, or protobuf bytes passed through unparsed: decode 0.089) + render 0.063 + buffer handoff ≈ 0.80–0.92 ms.
  - That's **≈ 1.15–1.35×**, and the addon adds a platform-specific binary to every deploy target.
- **Where the remaining Node cost is:** about 60% of rivet-compiled CPU/page at 1000 rows is transport (grpc-js + the static decoder + `http` writes + GC of the decoded DTO), not template code. That is where the next Node-side wins are (B-lane / server.ts work), not a new compile target.

## If ever revisited (not recommended now)

These are the conditions under which the idea would make sense:
- A translatable subset: static JSX, text/attribute holes over typed `number | string | boolean`, `.map`/`<For>`, `<Show>`, and pure component calls. Everything else (closures, signals, `template()` raw HTML, user functions) falls back to a JS boundary per subtree. That fallback costs a round trip per hole, so it only pays if whole pages are translatable.
- Data passing as protobuf/FlatBuffers bytes straight from the backend, never via JSON.
- Parity through the oracle corpus: native output compared byte for byte against the JS server compiler, as this spike did with `cmp`.
- Ceiling for that best case is about 3× CPU/page and about 20× less memory, and only if the HTTP and gRPC stacks are native too (i.e., a separate server, not a Node addon).

## Reproduce

See `apps/ssr-bench/spikes/rust-ceiling/README.md`. The bench needs `locks/bench`, the existing node/dotnet/loadgen images, and Python 3.12. Micro: `docker run --rm --cpus=1 rivet-ssr-bench-rust-ceiling:spike rust-ceiling bench`. Node micro: `apps/ssr-bench/spikes/rust-ceiling/node-micro.mjs`. Mount it into `rivet-ssr-bench-node:local` and run it with `--single-threaded-gc --max-semi-space-size=8`.
