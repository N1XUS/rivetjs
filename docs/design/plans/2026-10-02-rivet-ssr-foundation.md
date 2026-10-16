# Rivet SSR foundation implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver the approved first SSR milestone: a correct experimental HTML emitter and reproducible RPC-backed Docker benchmark against Solid 2, Qwik 2, and ASP.NET Razor.

**Architecture:** Remove the superseded runtime and applications, as requested. A zero-dependency experimental server package emits ordinary HTML through buffered or backpressured writers. A shared ASP.NET gRPC fixture service supplies every production SSR adapter; an explicit REST endpoint supplies browser reads. Python controls scoped Compose services, validates outputs, drives load, measures resources, and produces reports.

**Tech stack:** Node 24 ESM, Solid 2.0.0-rc.13, Qwik 2.0.0-rc.0, .NET 10, native gRPC/protobuf, Docker Compose, Python 3, verified-response HTTP load, Playwright for REST/HTML correctness.

**Spec:** [SSR-first restart](../specs/2026-10-02-rivet-ssr-first-restart-design.md).

## Global constraints

- SSR CPU/memory, runtime performance, compressed payload, and tree shaking govern emitted output.
- No compiler or browser reactive runtime in the server request path; no browser gRPC/RabbitMQ imports.
- Remove superseded core/docs/tooling. Retain relevant historical benchmark evidence in ignored artifacts. No publication or deployment.
- Concise JSDoc for public JS functions/classes/methods; XML summaries for C# public methods and Python docstrings.
- First milestone is explicitly experimental emitter output, not a completed JSX compiler or resumable runtime. Rust compiler/CSR/resumability remain subsequent approved architectural stages.
- Main measured lane: one real gRPC call per HTTP request, reusable channels, no final page/data caching, no per-request logs.
- Native/default production SSR metadata remains in competitors and is counted; static and interactive modes must not be mislabeled.

## Review focus

- Escaping hostile text/attribute values must preserve content without producing executable HTML.
- Slow response sinks must stop producer work and aborted requests release buffers/RPCs.
- Simultaneous requests must not mix fixture/token values.
- Failed/partial HTTP output must never enter successful throughput counts.
- Docker CPU/memory counters must include every worker and show backend/load-generator saturation.

### Task 1: Experimental server emitter and writers

Files: `libs/server-emitter/{package.json,project.json,index.mjs,writers.mjs,tests/emitter.test.mjs}`.

Interfaces: `escapeText(value)`, `escapeAttribute(value)`; `emitPage(page, writer, {signal, rawArticleHtml}) -> void|Promise<void>`; writers `write(string) -> void|Promise<void>`, `finish() -> string|Promise<void>`; `page={token,title,markdown,rows:[{id,values:number[]}]}`.

- [x] Write tests for hostile values, exactly ten fields, token identity, same string/stream output, stalled sink/cancellation, writer failure, and empty rows; run RED.
- [x] Implement hoisted static row fragments, direct scalar writes, bounded string/Node stream writers with cancellation and JSDoc.
- [x] Run `node --test libs/server-emitter/tests/*.test.mjs`; expect all green, including slow-writer and abort assertions.

### Task 2: Shared fixture service, .NET Razor adapter, REST boundary

Files: `apps/ssr-bench/proto/content.proto`, `dotnet/{ContentService,ContentSite}`, `services/{content.server.mjs,content.client.mjs}`, `tests/{grpc,rest,integration}.test.mjs`, Dockerfiles/Compose.

Interfaces: unary `GetPage({rows,token,article,delay_ms}) -> page`; backend `/health`, `/metrics` with calls/cancel/errors. Frontends `/page?rows=&token=&article=&delay_ms=`, `/api/articles/:id`, `/health`, `/metrics`. REST DTO `{id,markdown}`. Cancellation and bounded inputs yield explicit statuses.

- [x] Write integration tests verifying gRPC and REST DTOs, parallel token isolation, escaping, article parse, invalid fixture rejection, and aborted delay; run RED before endpoint implementation.
- [x] Implement deterministic fixture generation, reused gRPC channel/client with deadlines and cancellation, .NET MVC/Razor equivalent markup, and explicit REST endpoint. Do not reproduce private example article contents.
- [x] Build/run project-scoped Compose; execute integration tests against actual processes; expect valid page contents and cancellation reflected in backend counters.

### Task 3: Production v2 adapters and frontend process

Files: `apps/ssr-bench/{package.json,package-lock.json,build.mjs,server.mjs,adapters/{solid.jsx,qwik.jsx,rivet.mjs},Dockerfile.node}`.

Interfaces: each built adapter `renderPage(page,{signal,articleHtml},sink) -> Promise<void>`; all use common Node HTTP/gRPC integration; Rivet selects string/stream variant. `build.mjs` records versions, output hash/raw/gzip/Brotli bytes and input paths. Default pages contain static fixture content; framework metadata is measured, not removed by string manipulation.

- [x] Write adapter fixture tests for all row fields, articles, request tokens, escaping, complete HTML, and adapter failures; watch RED.
- [x] Install exact isolated production/compiler dependencies and build Solid/Qwik using public compiler/server APIs. Compile JSX; never relabel Solid/Qwik 1 outputs as v2.
- [x] Verify all Node adapters plus Razor through the same Docker network, and run browser REST smoke with JS dependency request audit.

### Task 4: Python load/resource/report tool and Nx entrypoints

Files: `apps/ssr-bench/{benchmark.py,load.py,report.py,tests/test_benchmark.py,project.json,README.md}`, root scripts and README.

Interfaces: `benchmark.py --quick|--frameworks=... --rows=... --concurrency=... --duration=... --warmup=... --repeats=... --out=...`; scoped project `rivet-ssr-bench`. Raw run metadata/cases/resource samples/validation are JSON; reports HTML/Markdown include all failures.

- [x] Write Python tests for CLI validation, hey output parsing, correct CPU-time deltas, OOM/error status, report escaping, and failed response classification; run RED.
- [x] Implement build/start/stop controls scoped to owned services, sequential rotated framework trials, verified closed-loop raw request capture, fixed-arrival diagnostics with start delay reporting, Docker Engine cumulative CPU/memory sampling, backend/load-generator counters, and reports. No builds/test runs during measured intervals.
- [x] Add uncached Nx targets and runnable npm scripts. Run unit suites then quick benchmark; expect all four production adapters correct and raw results/report generated.

### Task 5: Evidence, review, and delivery

- [x] Run a meaningful repeated 1/10/100 concurrency benchmark with 100/1,000-row pages and an article workload; record machine/VM quotas, pinned images/versions, variability, and CPU/request/peak memory/latency.
- [x] Run cancellation, slow-client recovery, concurrent isolation, REST browser, and repeated-load memory checks. Choose emitter variant from measured output/runtime tradeoffs; report losses honestly.
- [x] Run current Node/Python/.NET integration checks. Review actual new code with one fresh reviewer as required by executing-plans; fix important findings with regression tests.
- [x] Write results and update this plan/ledger with exact evidence and limitations; show a runnable report link.

## Plan self-review and execution ruling

Task interfaces match the protobuf DTO and writer contract; Task 2/3 integration tests use real transports and Task 4 counts only complete successful responses. Rust/JSX/CSR/resume/load/Lighthouse goals are preserved in the spec as later stages, not falsely claimed in this emitter milestone. User explicitly said “go with implementation”; execute inline continuously rather than re-requesting the already supplied authorization. A Git repository appeared during execution; preserve the ledger and existing Git state without worktree or branch operations. The user subsequently requested regular commits; checkpoint commits are now authorized.

Evidence: [measured results](../../benchmarks/ssr-foundation-results.md); 124 exploratory trials, 40 passing behavior checks. JSX/CSR/resumability remain future milestones.
