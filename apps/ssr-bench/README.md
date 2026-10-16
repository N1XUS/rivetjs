# SSR benchmark

Every frontend fetches the same deterministic fixture with one native unary gRPC call per page. Channels are reused (Node lanes: one shared lean `node:http2` client, Razor: Grpc.Net.Client); pages and data are uncached; request logging is disabled. Rivet currently renders hand-written experimental emitter output. Solid 2 and Qwik 2 use pinned production compiler pipelines; Razor is compiled with .NET 10. This lane measures static SSR. It does not prove interactive equivalence or a complete-framework advantage.

```sh
npm run bench:ssr -- --quick
npm run bench:ssr -- --rows=100,1000 --concurrency=1,10,100 --duration=10 --warmup=3 --repeats=3
npm run bench:ssr -- --article --rows=0 --concurrency=1,10,100
npm run bench:ssr -- --frameworks=rivet,rivet-string --rows=1000 --concurrency=10 --skip-build
npm run bench:ssr -- --rate=500 --concurrency=100 --duration=10 --skip-build   # open loop, 500 arrivals/s
npm run bench:ssr -- --generator=python --quick --skip-build                     # legacy generator, A/B only
npm run bench:ssr:report
```

Defaults rotate frameworks between repeats and apply the same 1-CPU / 512-MiB quota to frontends. The backend gets 2 CPUs / 1 GiB; the isolated load generator gets `--generator-cpus` (default 2) / 512 MiB. Every request is saved (columnar `request_columns` in each `raw-*.json`), including failures. CPU/request uses cumulative whole-container counters; memory is observed working-set peak, not managed-heap allocation or a proof of no leaks. Phase times include backpressure wait and are wall time, not pure CPU time.

## Fair comparison rules (round-2 review B1–B5, RA3)

- **GC profile, identical for every Node lane (B2):** `--gc tuned` (default) runs every Node container as `node --single-threaded-gc --max-semi-space-size=8 …` and Razor with `DOTNET_gcConcurrent=0 DOTNET_GCgen0size=0x1000000`; `--gc default` runs everyone with runtime defaults. Compose reads `SSR_BENCH_NODE_FLAGS` / `SSR_BENCH_DOTNET_GC_ENV` (unset = tuned). The container argv/env actually running is recorded in `results.json` `metadata.provenance.commands`.
- **Runtime + data client, identical for every Node lane (2026-10-09):** every Node lane runs on the digest-pinned `node:26.11.1-bookworm-slim` image (`Dockerfile.node`; V8 14.6 — Node 24.14's V8 13.6 promoted in-flight pages and mark-compacted every ~40 ms under the 512 MiB quota) and fetches through `services/content.server.ts`: a lean unary gRPC client over `node:http2` (one persistent session, 16 MiB receive window, hand-framed request, `grpc-timeout` 15 s, the static `page-decoder.ts` run once in the stream's close handler). No grpc-js / proto-loader at runtime. Same protocol, proto, request contract and validation as before; it is the same class of client as Razor's Grpc.Net.Client. Numbers measured before 2026-10-09 (Node 24 + grpc-js) are not comparable with later ones.
- **Provenance per number (B1):** `metadata.provenance` = generator + loadgen sha, duration, warmup, repeats, prewarm, GC profile, strings, rate. `apps/dom-bench/scoreboard.ts --ssr` reruns Rivet with the stored competitors' window/GC profile and refuses (n/a) a mismatch; `fair-report.ts` refuses to mix provenance inside one group.
- **Prewarm:** `--prewarm` seconds (default 10, `--quick` 0) of unrecorded load per lane before the matrix — .NET tiered JIT needed > 5 s (first repeats were 3× slower).
- **Like-for-like classes (B3/RA3):** static — `rivet-compiled` vs `dotnet` (Razor) and `solid-stable-static` (port 18114: Solid 1 compiled `hydratable:false` + `renderToString`, no hydration keys). Resumable/hydratable — `rivet-resume` (port 18115: router build on `/resume`, nested layout with state + `<Link>`, keyed `<For>`, per-row click handler + reactive attribute + `<Link>`, resume state) vs `solid-stable`, `solid` (hydratable) and `qwik-stable`, `qwik`. Peers carry no handlers, so the resumable ranking is conservative for Rivet. HTML bytes per lane = `load.mean_response_bytes`.
- **Escaping under load (B5):** `--strings` — rows carry `text_values` (proto field 3; `PageRequest.strings`), field 3 of each row = `<b>"N"</b> & 'é€漢字𝄞'` (`loadgen/validate.ts` `fieldText` = `FieldText` in `dotnet/ContentService/Program.cs`); the validator compares exact characters after HTML parsing (named/decimal/hex references and raw UTF-8 accepted; raw markup, wrong characters and double escaping rejected).
- **TTFB:** `load.p50_ttfb_ms` / `p99_ttfb_ms` (plus `mean_ttfb_ms`).
- **Runtimes (Bun / Deno):** `rivet-compiled-bun` (18116), `rivet-router-bun` (18117), `rivet-compiled-deno` (18118), `rivet-router-deno` (18119), `solid-stable-static-bun` (18120) run the **same** `dist/` bundles as the Node lanes (`Dockerfile.bun` / `Dockerfile.deno` copy `/workspace` from the built `rivet-compiled` image via `additional_contexts: { lane: "service:rivet-compiled" }`), same quotas, validation and backend. Images are digest-pinned official `oven/bun:1.4.2` and `denoland/deno:2.9.7`. GC profile: Deno tuned = `--v8-flags=--single-threaded-gc,--max-semi-space-size=8`; Bun (JavaScriptCore) tuned = `BUN_JSC_useConcurrentGC=0` (no semi-space knob); `--gc default` = runtime defaults. `/health` reports `runtime`. Deno runs with Compose `init: false` (its image already starts under tini).
- **CPU profile breakdown:** `node apps/ssr-bench/cpu-breakdown.ts <file.cpuprofile> [--requests N] [--json]` attributes self time to `rivet` (lane bundle, router build), `data` (shared gRPC client + page decoder), `http` (Node core response writing), `harness` (`dist/server.mjs` glue), `gc`. Profiles come from a lane container started with `--cpu-prof` outside measurement windows (lock held).
- **Report:** `node apps/ssr-bench/fair-report.ts --ssr <run dirs or results.json,…> [--dom …] [--resume …] [--scoreboard …] --out docs/benchmarks/<name> [--notes <file.md>] [--title <heading>] [--store-competitors]` → `<name>.md/.json` with per-metric tables, WIN/TIE/LOSE (≥3% + non-overlapping ranges, `apps/dom-bench/verdict.ts`) and a ranked loss list; `--store-competitors` rewrites `apps/dom-bench/competitors.json` with provenance.

```sh
npm run bench:ssr -- --frameworks=rivet-compiled,rivet-resume,dotnet,solid-stable-static,solid-stable,solid,qwik-stable,qwik --rows=100,1000 --concurrency=1,10,100 --repeats=3
npm run bench:ssr -- --gc=default --frameworks=… --skip-build      # default runtime GC for everyone
npm run bench:ssr -- --strings --frameworks=… --rows=1000 --skip-build
npm run bench:ssr -- --cores=4 --frameworks=rivet-router --skip-build   # scaling probe: 4-CPU quota for every node lane; only rivet-router runs 4 node adapter workers (512 MiB for all of them)
```

## Load generator

- **Default `--generator=node`:** `loadgen/` (`loadgen.ts`, `client.ts`, `validate.ts`), image `rivet-ssr-bench-load:v2` from `Dockerfile.loadgen`.
  - Base: digest-pinned `node:24.14.1-bookworm-slim@sha256:b506e7…` (the generator stays on Node 24 so its image / source hash and the stored provenance stay valid; the lanes moved to Node 26 in `Dockerfile.node`). No npm dependencies. Build context is `loadgen/` only.
  - `--generator-threads` worker threads (default `ceil(--generator-cpus)`), each owning a share of the keep-alive connections.
  - Raw-socket HTTP/1.1 client: Content-Length, chunked and close-delimited bodies. Parsing allocates nothing per chunk; body bytes are kept by reference and only copied when validated.
  - Image staleness check: before timing, the harness runs `loadgen.ts --hash` in the image and compares it with the checked-out sources. A mismatch aborts the run, so `--skip-build` can't time an old generator.
  - Cost: about 20–25x less CPU per request than load.py, measured on the host against the same local stub server at c10: 20 vs 384 µs/request at 100 rows, 107 vs 2,723 µs at 1,000 rows. Inside Docker Desktop both cost more (see the caveat below).
- **Legacy `--generator=python`:** `load.py` / `Dockerfile.load` / `rivet-ssr-bench-load:local`, unchanged, for A/B checks of the harness itself.
  - GIL-bound at about one core. In run `20261004T110550.980833Z-eae180bd` it was the bottleneck for every Rivet/.NET c10 case: about 1.4–1.5 cores used, flat ~1,950 req/s (100 rows) and ~226 req/s (1,000 rows) for both frameworks.
  - It was also heavily loaded at c1 (0.5–0.76 cores).
  - Treat earlier c10/c100 numbers, and the c1 p99 numbers, as generator-limited.
- **Validation (node):**
  - Every response must be HTTP 200 with complete framing.
  - **Strict** validation is the exact load.py oracle: every row identity, every field value, the token, the completion marker and the article markers. It runs on the first 2 responses per connection, on every `--sample-every`th response (default 32), and on any response whose byte length or tail differs from a page that already passed strict validation.
  - Every other response must have the same byte length as a strictly validated page and end with `</html>`…`<!--complete-->`.
  - `summary.validation` records `strict`, `strict_failed`, `length_checked`, `strict_fraction` and the policy text. `--sample-every=1` validates everything strictly.
  - Limitation: a corruption that keeps the length the same and lands outside the sample isn't detected. A changed length always is.
- **Modes:**
  - Closed loop (default): each connection sends its next request when the previous one ends. Connections are opened before the window starts.
  - Open loop (`--rate=N`, wrk2-style constant arrival rate): arrival `i` is scheduled at `start + i/N`, independent of responses. Latency counts from the *scheduled* time, so queueing behind a slow server is included (coordinated-omission free). `--concurrency` is the connection cap.
  - Open-loop admission delay (`p99_admission_delay_ms`, `max_admission_delay_ms`) is the time spent waiting for a free connection plus generator lag. `generator.schedule_lag_p99_ms` isolates the generator's own timer/event-loop lag.
  - Drain cap: 15 s after the window. Arrivals still unsent at the cap count as failures (`ArrivalBacklog`, `summary.unsent`).
- **Generator headroom (per case, in `results.json` `generator`, `report.html`, `report.md`):**
  - `cpu_cores_used`: node process CPU over the load window only (start-up excluded). `cgroup_cpu_cores_used` keeps the container counter as a cross-check.
  - `capacity_cores`: the quota, or 1 core for Python because of the GIL.
  - Also `utilization`, `headroom_pct`, per-thread event-loop utilization (`worker_elu`, `max_worker_elu`), reconnects and source digest.
- **Warnings (node):** a case is not generator-independent when any of these fire.
  - `Generator CPU near quota` (utilization > 70%).
  - `Generator thread saturated` (any thread ELU > 0.85).
  - `Generator schedule lag` (p99 > 5 ms).
  - `Open-loop admission delay p99 … exceeds one interval`: offered rate above capacity, or too few connections.
  - `Open-loop arrivals unsent at drain cap`.
  - Python keeps its `>0.8 CPU (Python GIL)` warning.
- **Docker Desktop caveat:** syscalls and wakeups inside the VM cost several times more CPU than on the host, and much more on a busy machine. Example: an open loop at 600/s used ~0.4 cores for 100-row pages. Read headroom per case rather than assuming a fixed per-request cost. Avoid other builds, tests or workloads during measured intervals.

## Isolated smoke runs

`SSR_BENCH_PROJECT` (Compose project, default `rivet-ssr-bench`; the older `RIVET_BENCH_PROJECT` spelling is still accepted) and `SSR_BENCH_PORT_PREFIX` (three digits, default `181`) let a run coexist with another stack. Backend/.NET/Node images are shared by explicit name, so `--skip-build` neither rebuilds nor retags them:

```sh
SSR_BENCH_PROJECT=rivet-ssr-bench-loadgen SSR_BENCH_PORT_PREFIX=192 \
  npm run bench:ssr -- --quick --skip-build --stop --frameworks=rivet-compiled,dotnet --concurrency=1,10,100
docker build -t rivet-ssr-bench-load:v2 -f apps/ssr-bench/Dockerfile.loadgen apps/ssr-bench/loadgen   # after loadgen edits
```

Endpoints (default prefix 181): Rivet 18101, Solid 2 preview 18102, Qwik 2 preview 18103, Razor 18104, Solid stable 18111, Qwik stable 18112 (optional `solid-stable-string` 18113); `/page?rows=100&token=example&article=1`, `/api/articles/performance`, `/health`, `/metrics`. Backend gRPC is 18100 and backend HTTP metrics are 18110. Ports bind only to loopback. The `rivet-string` optional variant uses 18105. Qwik's generated client assets and metadata are retained and served.

```sh
npm run test:ssr:integration
npx vitest run --project ssr-bench-all apps/ssr-bench/tests/browser.test.ts
docker compose -p rivet-ssr-bench -f apps/ssr-bench/compose.yaml --profile variants down
```

Use `--skip-build` after a successful build. `--stop` shuts down only this Compose project after the run. Each invocation writes a unique `.artifacts/ssr-bench/runs/<run-id>` directory. The root `report.html` indexes all retained runs and `latest.json` points to the newest. Raw result metadata records image IDs, image inspection, engine environment, exact dependency versions, phase counters, CPU/memory samples, OOM state, and errors. Durations are actual drain-inclusive load times; successful throughput excludes errors. Latency ends when the HTTP body is read; validation runs after that and costs generator CPU (counted in generator headroom). Report tables retain each repeat instead of hiding variability behind a single ranking.

The npm entrypoints probe for a working Python 3.12+ interpreter. Set `RIVET_BENCH_PYTHON` to an explicit executable if needed. Playwright browser tests require installed Chromium (`npx playwright install chromium`).

Server/browser service boundary: `services/content.server.ts` owns the reusable gRPC channel (lean `node:http2` unary client, shared by every Node lane); `services/content.client.ts` fetches public REST DTOs and imports no server transports. Future applications can select paired server/client modules at build time. RabbitMQ and DI are outside this milestone.

C# protobuf output is checked in to avoid a Linux ARM crash in the pinned Grpc.Tools compiler. Regenerate on a supported host with `dotnet build .../ContentService.csproj -p:GenerateProto=true` and the equivalent ContentSite command, then update `proto/generated.sha256`. The build rejects stale schema hashes. Runtime protobuf serialization remains native gRPC on every platform.

If Docker's credential helper stalls on public images, use a temporary Docker client configuration containing only `cliPluginsExtraDirs` and set `DOCKER_HOST` to your active local socket. This leaves the main Docker settings intact. No private registry credentials are needed by this benchmark.

Optional preparatory comparison lanes (no performance claim): `rivet-compiled` on 18106 uses actual JSX lowered by the Rivet server compiler/runtime. It is in the `variants` profile with the same 1 CPU / 512 MiB quota, `/health`, `/metrics`, REST DTO, no-store responses, and strict load-generator validation. Defaults include `rivet,solid,solid-stable,qwik,qwik-stable,dotnet`. The framework/compiler remains transport agnostic; gRPC belongs only to this comparison fixture.

The compiled fixture has ten literal field structures in each `Row` JSX return, producing one native template boundary per row rather than ten field objects. The dynamic main/row body is JSX; the shared head/style wrapper stays outside the compiler because style JSX is unsupported. Runtime attribute escaping additionally encodes apostrophes, preserving the same attribute values. Trusted Marked article HTML crosses an explicit trusted fragment boundary. No final page or data caching is introduced.

Build inside Docker:

```sh
docker build -f apps/ssr-bench/Dockerfile.node -t rivet-ssr-bench-node:local .
docker compose -p rivet-ssr-bench -f apps/ssr-bench/compose.yaml --profile variants up -d rivet-compiled
SSR_BENCH_ENDPOINTS=http://127.0.0.1:18106 npx vitest run --project ssr-bench-all apps/ssr-bench/tests/integration.test.ts
npx vitest run --project ssr-bench-all apps/ssr-bench/tests/compiled-adapter.test.ts
```

## `<For>` and router lanes

Coverage lanes for list and router overhead (all `variants` profile, the shared GC profile and quotas):

- `rivet-for` (18107): `adapters/rivet-for.jsx` = `rivet-compiled.jsx` with the row loop as keyed `<For each by>` instead of `.map` (Solid lanes use `<For>`). Delta vs `rivet-compiled` = server `<For>` cost.
- `rivet-router` (18109): `router-app/` file-routed app (root `_layout.tsx` with a loader, `page.tsx` with `serverLoad` doing the gRPC call + `head` title, `health.ts`/`metrics.ts` endpoint routes) built by Vite + `rivetRouter()` and served by the production `@rivetjs/router/node` `start()` (static lookup, Request bridge, CSRF/handler, loaders, head merge, nonce CSP, streamed resumable render). No `server.ts`. Delta vs `rivet-compiled` = router + resume overhead. `article=1` → 400 (no raw-HTML JSX sink); `/metrics` has memory only.
- `rivet-resume` (18115): same build and container command as `rivet-router`, measured on `/resume` (`router-app/src/routes/resume/{_layout,index}.tsx`): the interactive resumable page (see Fair comparison rules).

```sh
npm run bench:ssr -- --frameworks=rivet-compiled,rivet-for,rivet-router --rows=100,1000 --concurrency=1,10 --repeats=3 --skip-build
npx vitest run --project ssr-bench-all apps/ssr-bench/tests/router-lane.test.ts
```

## Historic compiled-image comparison

The optional `rivet-compiled-baseline` lane on loopback port **18108** runs the retained **b01eba3** compiled artifact from `rivet-ssr-bench-node:b01eba3-baseline`. It inherits the same 1 CPU / 512 MiB runtime limits and backend as the current `rivet-compiled` lane on 18106, but has **no build configuration**. It cannot rebuild current source under the old label. Defaults do not select it.

The benchmark rejects this baseline tag unless Docker reports image ID `sha256:1a6ae220bb5653b26d234de80899a5d5dd796b3ddf45b0abf5b2fc847707ada0`. The tag must already refer to that retained image; building current checkout does not recreate the historic baseline. Prepare/rebuild current images separately from timing, then select all three participants explicitly:

```sh
npm run bench:ssr -- --frameworks=rivet-compiled-baseline,rivet-compiled,dotnet --rows=1000,5000 --concurrency=1 --repeats=3 --warmup=3 --duration=10 --skip-build
```

This plan has 18 measured trials, with three rotating participant orders for each row count. `--skip-build` also passes Compose `--no-build` during startup, preventing an implicit build from entering a measurement invocation. The baseline health endpoint keeps the image's original compiled framework/version data; results use the separate service alias rather than relabeling current code. Image inspection includes the retained artifact, and `server_builds_by_framework` preserves each selected Node lane's own compiled artifacts. The legacy `server_builds` field uses current `rivet-compiled` when selected. Interpret current-versus-old CPU, memory and large HTML results with the same validation, quota/saturation and repeated-trial limits as other lanes; this setup itself makes no performance claim.

For isolated performance experiments, `RIVET_BENCH_NODE_IMAGE` selects the current Node image (default `rivet-ssr-bench-node:local`); combine it with `SSR_BENCH_PROJECT` / `SSR_BENCH_PORT_PREFIX` (see Isolated smoke runs). Backend and .NET images are shared by explicit name. Quotas, validation, retained-image checks, and workload defaults are unchanged.

## Stable and preview framework releases

The comparison keeps the existing `solid` (2.0.0-rc.13) and `qwik` (2.0.0-rc.0) preview lanes and adds `solid-stable` (Solid 1.9.15) and `qwik-stable` (@builder.io/qwik 1.20.1). These were the current stable/preview npm releases checked on 2026-10-04. The stable lane dependencies live in `apps/bench-stable`; the SSR build resolves their compiler and runtime there, so Solid 2 cannot enter the Solid 1 bundle. Stable Qwik uses its supported Vite 7 toolchain, with its own generated client manifest and assets retained in `dist/client-stable`.

Adapter safety checks parse the returned DOM and require the original hostile token attribute, exact field text, and no injected executable script. This accepts valid differences in attribute encoding (Solid 1 escapes quotes but can retain `<` inside a quoted attribute) while keeping Qwik’s legitimate bootstrap and state scripts intact. Stable bundle checks inspect compiler/bundler input provenance as well as the installed version.

All six default frontends receive the same native gRPC DTO, ten explicit fields per row, article HTML, per-request token, validation, 1-CPU quota and 512-MiB limit. The adapters only bridge the different public streaming APIs: Solid 1 closes a private WritableStream wrapper while the shared HTTP server retains ownership of the response; Qwik 1 uses its v1 chunk-size option names and serializes transport writes behind backpressure because its writer callback returns `void`. Both Qwik lanes retain the same 16-KiB streaming thresholds. No rendered pages or row data are cached. `dist/builds.json`, `/health`, raw result metadata and report version columns identify the exact installed framework release. The stable services bind to loopback ports `<prefix>11` and `<prefix>12` (default 18111 and 18112).

```sh
npm run bench:ssr -- --frameworks=rivet-compiled,solid,solid-stable,qwik,qwik-stable,dotnet --rows=1000,5000 --concurrency=1 --repeats=3 --skip-build
SSR_BENCH_ENDPOINTS=http://127.0.0.1:18111,http://127.0.0.1:18112 npx vitest run --project ssr-bench-all apps/ssr-bench/tests/integration.test.ts apps/ssr-bench/tests/browser.test.ts
```


## Solid stable synchronous static control

The optional `solid-stable-string` lane on loopback port **18113** calls Solid 1.9.15's public `renderToString` API. It imports the exact `Page` JSX used by `solid-stable`, with the same isolated stable compiler/runtime, production hydratable compilation, DTO, field structure, attribute semantics, article HTML, and 1-CPU / 512-MiB limits. `NodeStreamWriter` applies the shared transport backpressure and cancellation contract; the HTTP server still owns the completion marker and response end. Build metadata, `/health`, and reports label this mode `buffered-renderToString`.

This fixture fetches all data and parses article Markdown before rendering; it has no asynchronous JSX children or Suspense work. Solid 1's public streaming `pipe` and `pipeTo` APIs defer the first write with a timer even when the whole page is ready. The separate synchronous control measures the static API without that initial delivery scheduling. It buffers the whole HTML response and cannot demonstrate progressive streaming behavior. The existing `solid-stable` lane and all prior streaming results remain unchanged; neither API's throughput advantage is assumed before measurement.

The control belongs to the `variants` Compose profile and is selected explicitly; the six default participants are unchanged. Build the images outside a measurement interval, then run:

```sh
npm run bench:ssr -- --frameworks=solid-stable,solid-stable-string,rivet-compiled,dotnet --rows=100,1000,5000 --concurrency=1 --repeats=3 --skip-build
SSR_BENCH_ENDPOINTS=http://127.0.0.1:18113 npx vitest run --project ssr-bench-all apps/ssr-bench/tests/integration.test.ts apps/ssr-bench/tests/browser.test.ts
```

Adapter checks include exact hostile-token and field semantics, stable version/runtime provenance, a held large-response write, cancellation during that write, and caller ownership of response completion. Complete-response validation and resource accounting stay the same for both Solid 1 modes.

Measured results for the stable/preview lanes and buffered Solid control are in the [2026-10-04 performance comparison](../../docs/benchmarks/performance-next-comparison.md), including the limits of Rivet before/after HTTP evidence.
