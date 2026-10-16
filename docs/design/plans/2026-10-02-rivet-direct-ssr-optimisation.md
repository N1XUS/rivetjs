# Rivet direct SSR emission and ASP.NET comparison plan

Date: 2026-10-02

Status: in progress. Tasks 1–2 have diagnostic controls, prototypes and separate CPU/allocation profiles; their full retained-memory and decision gates remain open. Task 3 has a protocol draft and executable existing-backend oracles. No direct compiler backend or default switch has been implemented.

Evidence: [baseline controls](../../benchmarks/direct-ssr/direct-ssr-baseline.md), [validated prototype](../../benchmarks/direct-ssr/direct-ssr-prototype.md), [attribution profiles](../../benchmarks/direct-ssr/direct-ssr-profiles.md), [closed-data follow-up](../../benchmarks/direct-ssr/direct-ssr-trusted-prototype.md), and [protocol draft](../server-direct-protocol.md). These experiments do not replace the saved matched Razor comparison.

The [bounded idle post-GC experiment](../../benchmarks/direct-ssr/direct-ssr-retained-diagnostic.md) now records completion/cancellation at verified server concurrency four. Broader semantics and longer/larger-load gates remain open. A [representation-retaining traversal experiment](../../benchmarks/direct-ssr/direct-ssr-unroll-rejected.md) was slower in every paired trial and was rejected; its exact source and evidence are archived, and no experimental runtime overhead remains. Task 4 still needs genuine allocation-removing code generation and its eligibility proof.

## Goal

Compile supported JSX server regions into direct HTML-emission functions, removing request-time template records, slot arrays, and generic traversal where their behaviour can be preserved. Measure whether this closes the CPU and complete-response gap with the pinned ASP.NET Razor application. Investigate native-owned hosting only after controls establish the costs and limitations of the Node path.

Keep TypeScript/JSX authoring, correct escaping, async ordering, request ownership, cancellation, and real streaming backpressure. Generated code can be verbose or specialised. Improvements must appear in actual emitted distributions and end-to-end measurements, not just source-level simplification.

This extends the SSR optimisation work in [the compiled runtime plan](2026-10-02-rivet-compiled-runtime.md). It does not restart the browser architecture, change the framework's service-transport contract, or implement hydration/resumability, wrappers, or routing features. Historical plans and results remain unchanged.

## Evidence and starting point

The [latest saved matched comparison](../../benchmarks/batched-ssr-comparison.md) measures compiled Rivet image/source `e9aa38b`, an earlier Rivet image, and ASP.NET Razor. Its three-repeat group medians include:

| Rows | Implementation | CPU ms/valid page | Complete response p50 ms | Mean TTFB ms | Peak working set MiB |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1,000 | Batched Rivet | 6.734 | 3.874 | 2.850 | 46.934 |
| 1,000 | ASP.NET Razor | 1.596 | 1.321 | 1.099 | 76.277 |
| 5,000 | Batched Rivet | 25.780 | 16.834 | 7.990 | 93.086 |
| 5,000 | ASP.NET Razor | 13.405 | 9.836 | 8.954 | 97.992 |

At those group medians, matching Razor CPU would require approximately 76% less CPU at 1,000 rows and 48% less at 5,000 rows. These are planning calculations, not predictions or paired-repeat statistics. Peak working set is not retained heap. Closed-loop concurrency one is not maximum server capacity.

The [request profile](../../benchmarks/ssr-request-profile.md) identifies substantial GC activity, compiled traversal, scalar conversion, and escaping. A subsequent unowned-path adjustment improves an isolated discard-sink probe by about 3%; it has no new end-to-end result. Preserve both the last measured image and the actual current checkout as distinct baselines.

Current implementation facts:

- `libs/compiler/index.mjs` uses the TypeScript API and lowers server JSX to `compiledTemplate(fragments, slots)`.
- `libs/runtime/template.mjs` allocates and freezes compiler-owned template records and slot arrays per invocation.
- `apps/ssr-bench/adapters/rivet-compiled.jsx` eagerly constructs row output with `page.rows.map(...)` before `renderToWriter` consumes it.
- `libs/runtime/server.mjs` admits already-formed async values, then traverses regions and slots. Its batching reduces physical writes but retains the intermediate response graph.
- `libs/server-emitter/writers.mjs` accumulates strings, measures their UTF-8 byte lengths, and waits only when the Node sink signals backpressure. It already has a synchronous fast path; do not describe every write as an async operation.
- Rust currently provides a fixture-specific renderer behind a Node worker adapter. Normalisation, JSON, pipes, full output buffering, and FIFO queueing belong to that lane. It is not a native-owned server or a general JSX-to-Rust compiler.

## Intended architecture

For eligible synchronous regions, generate functions that write hoisted static fragments and escaped dynamic values directly into a bounded writer. Generate a resumable cursor/state machine only where the writer can suspend. Preserve a synchronous path while writes are accepted.

The server backend has three representations:

1. **Direct synchronous regions:** known markup and eligible scalar/attribute operations, without generic template objects.
2. **Direct regions with continuation state:** the same emission interrupted by actual writer backpressure or a supported async boundary.
3. **Existing generic regions:** opaque expressions, public mutable templates, external component results, or unsupported analysis cases that require current semantics.

Mixed output must use the existing logical request ownership and finalisation rules. The fallback is a correctness mechanism and must not secretly reconstruct the whole graph for otherwise direct regions. Report how much of each fixture actually uses the direct backend.

An initial internal compiler option may select the backend for experiments; its name is settled during implementation. Keep the existing `target: "server"` and `target: "dom"` distinction. Do not introduce a new public authoring API solely to make one benchmark faster.

## Semantic constraints

- **Evaluation and coercion order:** JSX expression evaluation, property getters, function calls, attribute coercion, and exceptions have observable timing. Preserve once-only evaluation and its order relative to writer acknowledgments.
- **Eager versus streaming evaluation:** replacing `.map()` with deferred iteration can change when later rows execute or throw. Direct emission does not automatically permit this change. Preserve eager evaluation through minimal captured values where needed, fall back, or define an explicit streaming construct separately. Label a benchmark-only plain-data contract clearly; it is not proof that arbitrary JSX is safe to transform.
- **Conservative analysis:** names, TypeScript annotations, and apparent property reads do not prove purity or that a value is a primitive. Getters, proxies, external calls, aliasing, and user coercion require a safe fallback unless the compiler can establish a valid transformation.
- **Async admission:** already-created sibling promises must have rejections observed even when earlier output fails, suspends, or aborts. Reading a thenable's `then`, scheduling its invocation, and preserving its receiver must match the existing contract.
- **Ownership:** restore the logical owner around resumed work, attribute coercion, component callbacks, and relevant writer calls. Never retain a global owner across an await. Dispose request/branch scopes exactly once on success, failure, or abort.
- **Writer protocol:** accepted writes proceed synchronously; suspend at real acknowledgment boundaries and resume at the next uncommitted operation. Reused acknowledgment promises are still distinct waits per write. Stop on abort/failure without executing deferred user work or leaking drain listeners.
- **Public templates:** retain the public `template()` ordering and mutation semantics. Internal compiler-owned output may be specialised; do not optimise public mutable objects as if they were immutable.
- **Output:** keep text/attribute context escaping, unsafe-attribute checks, null/boolean rules, trusted raw boundaries, namespaces, Unicode/lone-surrogate behaviour, and all ten row fields. No final-page/data caching in competitive end-to-end lanes.
- **Memory:** buffers and concurrency queues have explicit bounds. State retained across suspension belongs to that request. Pools must not reuse storage while a sink still owns it or keep arbitrarily large responses alive after load.

## Implementation tasks

### Task 1 — Freeze baselines and separate the costs

**Files:** `apps/ssr-bench/{benchmark.py,load.py,report.py,build.mjs,server.mjs,compose.yaml}`, diagnostic fixtures/tests, new `docs/benchmarks/direct-ssr/direct-ssr-baseline.md` and machine-readable evidence.

- [ ] Preserve the measured batched image and current checkout/build as separate immutable identities. Record source revision or content hashes, image IDs, emitted modules, tool versions, Rust artifact, quotas, and benchmark configuration. Do not retag the historical `b01eba3` image as a new baseline.
- [ ] Add a pure-render control using deterministic prepared data and an accepting discard sink. Validate complete output separately with hashes and semantic assertions; prevent the timed sink from making emission unobservable.
- [ ] Add an HTTP control that serves a prepared body of equivalent length/chunking without RPC or template work. Clearly label synthetic prepared-body reuse; it is allowed only in this transport control, never as a competitive rendering result.
- [ ] Add a real gRPC-fetch/decode control that consumes/validates the returned fields and sends a small response without HTML rendering. Keep channels, request tokens, payloads, and deadlines comparable.
- [ ] Retain the full request path and the current hand emitter. Capture allocation profiles, CPU samples, writer call counts, output bytes, time to first actual response write, drain waits, and per-request setup work in dedicated diagnostic runs.
- [ ] Distinguish active CPU, wall time, waiting, and overlapping phases. Do not add overlapping counters or subtract wall time from CPU/request to estimate renderer CPU.

**Exit:** reproducible current/batched/Razor baselines plus controls that identify rendering, conversion/decoding, transport, and allocation costs. Profile overhead is excluded from competitive timings.

### Task 2 — Handwrite the desired direct output

**Files:** new diagnostic fixtures under `apps/ssr-bench/experiments/direct/`, adapter tests, new `docs/benchmarks/direct-ssr/direct-ssr-prototype.md`.

- [ ] Implement a direct JavaScript emitter for the equivalent row page, then a small mixed sync/async fixture. Reuse the public writer contract and context-correct escaping.
- [ ] Compare against compiled regions and the existing hand emitter at 100, 1,000, and 5,000 rows. The existing hand emitter remains the control; merely duplicating it is not a compiler optimisation.
- [ ] Compare eager minimal captures with proven-safe incremental evaluation. Report allocation and first-byte differences as separate semantic modes if necessary.
- [ ] Exercise immediate writes, delayed drain, failed writes, aborted requests, malformed data, hostile strings, and concurrent request isolation. Validate output at every supported mode.
- [ ] Measure pure rendering, full Node requests, and retained memory under slow clients. Decide whether direct output offers enough headroom to justify a compiler backend.

**Exit:** a correct target output shape with measured costs. If the direct JavaScript control still cannot approach Razor, use Task 1 to identify the remaining floor before a broad compiler rewrite.

### Task 3 — Define direct-emission analysis and protocol

**Files:** `libs/compiler/index.mjs`, proposed internal `libs/compiler/server-direct.mjs`, compiler fixtures, a focused design record if the protocol requires one.

- [ ] Define a small server emission IR: trusted static write, text/attribute escape-and-write, evaluated capture, direct region call, generic boundary, and suspension/cleanup boundary.
- [ ] Specify which expressions can be fused, which must be evaluated eagerly, and which require generic fallback. Keep property names and known escaping context at build time while preserving dynamic value validation.
- [ ] Define direct/generic interoperation, request lifetime, and writer acknowledgment semantics before implementing the fast path.
- [ ] Establish generated continuation state and bounds. Avoid per-field async functions or promises on synchronously accepted writes.
- [ ] Define diagnostic visibility for fast-path coverage and fallback reasons. Unsupported optimisations must not change supported JSX behaviour.
- [ ] Add executable fixtures for evaluation/coercion order and all suspension positions, including thenables, mutation, exceptions, and owned regions.

**Exit:** a reviewable protocol whose equivalence can be tested independently of performance. No new general JSX semantics are assumed from the benchmark's ordinary data objects.

### Task 4 — Implement scalar direct code generation

**Files:** compiler server backend, proposed private `libs/runtime/server-direct.mjs`, `libs/runtime/{server.mjs,server.d.ts}`, compiler/runtime tests and package export metadata only if required.

- [ ] Emit direct functions for the supported scalar subset. Hoist immutable static fragments once per module; avoid per-invocation fragment validation/freezing where the private compiler protocol makes it unnecessary.
- [ ] Eliminate template records, generic slot arrays, per-slot brand dispatch, and admission scans from regions proven not to contain async/owned/generic values.
- [ ] Generate the smallest required captures and continuation state. Retain sync execution until actual backpressure; avoid accidental `async` wrappers around every row or write.
- [ ] Specialise known attributes without removing dynamic value escaping, URL restrictions, or observable coercion. Do not bypass safety because a fixture happens to contain ASCII.
- [ ] Differentially execute emitted modules against the existing backend for bytes, semantic DOM, side-effect logs, error ordering, and cleanup.
- [ ] Test the browser backend and runtime import graph to ensure the server backend does not alter DOM output or ship compiler/native code to browsers.

**Exit:** compiler-generated scalar output approaches the handwritten target and passes actual runtime tests. Report generated artifact size and runtime reachability; snapshots alone are insufficient.

### Task 5 — Add mixed components, iteration, and async boundaries

**Files:** compiler server analysis/codegen, runtime direct/generic bridge, structural/async/compiler tests, benchmark adapter.

- [ ] Specialise nested known component calls and supported iteration while preserving argument evaluation, eager error timing, owner creation, and cleanup. Arbitrary `.map()` remains ordinary JavaScript unless analysis proves the transformation.
- [ ] Support direct-to-generic and generic-to-direct output with rejecting promises, `Provider`, `For`, `Async`, lazy components, and client-only fallback.
- [ ] Preserve rejection admission for already-formed siblings and avoid creating a new eager whole-page graph at the direct/generic bridge.
- [ ] Verify writer reentrancy, repeated acknowledgment objects, cancellation during suspension, disposal before resumed work, and isolation under interleaved requests.
- [ ] Switch the actual compiled benchmark through the compiler option, retaining the previous backend under a distinct lane/image. Add mixed and adversarial fixtures beyond the uniform grid.

**Exit:** the benchmark result comes from genuine compiled JSX with equivalent semantics, and mixed programs retain the current async/ownership contract.

### Task 6 — Optimise encoding and buffering from profiles

**Files:** `libs/server-emitter/writers.mjs`, shared/private escaping helpers where appropriate, direct backend, writer/output tests.

- [ ] Profile the new output before choosing a byte representation. Compare bounded strings against Buffer/UTF-8 strategies, counting byte-length scans, escaping, encoding, copying, and allocations.
- [ ] Test pre-encoded static fragments and direct byte-oriented emission where useful. Do not assume many tiny Buffer writes beat string batching.
- [ ] Specialise primitive string paths only where proven, with correct generic coercion otherwise. Preserve no-double-escaping and text/attribute differences.
- [ ] Measure threshold choices for CPU, peak memory, first-byte time, complete response, and slow-client behaviour. Document whether a limit is bytes or UTF-16 code units and how oversized atomic fragments behave.
- [ ] Preserve abort/drain/error/close cleanup and bounded storage. Only introduce pooling where measured gains survive concurrency and idle-memory checks.

**Exit:** measured writer/encoding improvements without response corruption, partial-output duplication, unbounded buffers, or hidden first-byte regressions.

### Task 7 — Run the matched end-to-end decision experiment

**Files:** benchmark lane configuration/build/Compose/reporting, new `docs/direct-ssr-comparison.md` and JSON evidence.

- [ ] Compare preserved current compiled output, new direct compiled output, hand emitter, and pinned Razor using the same shared backend and fixture oracle. Preserve worker results as a separately labelled diagnostic, not a substitute for native hosting.
- [ ] Run 100/1,000/5,000 rows at concurrency one first; then controlled concurrency and fixed-arrival loads once the generator/backend are calibrated to keep up.
- [ ] Use at least five rotated independent repeats for the decision run. Start with 10 seconds warmup and 30 seconds measured admission per trial, extending warmup if counters or JIT activity have not stabilised. Finalise the protocol before comparing candidates.
- [ ] Report per-repeat CPU/valid page, complete p50/p95/p99, TTFB, valid throughput, failures, allocation diagnostics, idle/peak/recovery memory, and repeated-load memory slope. Keep memory definitions and phase-counter limitations explicit.
- [ ] Retain exact artifact/image identities, every failed trial, raw samples, quota/saturation flags, output lengths, representative bodies, and semantic validation. Do not run builds, profilers, correctness suites, or competing workloads during timing.

**Exit:** an evidence-based decision to adopt, revise, or reject direct emission, plus a concrete determination of whether native-host controls are warranted.

### Task 8 — Conditional native-owned hosting experiment

**Trigger:** direct Node emission remains materially behind Razor and the controls/profile show a plausible advantage from removing Node/native crossings or changing the server pipeline. This is a benchmark experiment before any product hosting commitment.

**Files:** proposed `apps/ssr-bench/native-server/`, native Docker/Compose lane, `libs/native-renderer` integration as needed, host/output/cancellation tests.

- [ ] Build a release native HTTP server that calls the same gRPC backend directly and passes decoded values to the native emitter without Node JSON/pipes. Reuse native channels and observe matching deadlines/cancellation.
- [ ] Stream through bounded output buffers with backpressure. Do not run the current blocking emitter directly on an async executor thread without an explicit, bounded execution/streaming design. Record worker count and aggregate CPU/memory under the same quota.
- [ ] Check exact/semantic parity, hostile Unicode, cancellation, slow clients, limits, repeated loads, and error responses. For the structured-page comparison, keep Markdown conversion out of scope; any later article comparison must identify parser differences.
- [ ] Compare native emission alone, native-owned HTTP with prepared data, native HTTP+gRPC, Node direct output, Node/Rust worker, and Razor under separately labelled controls.
- [ ] Quantify startup, binary/container size, steady/peak/recovery memory, CPU, latency, and operational complexity as well as throughput.
- [ ] State explicitly that a native fixture server cannot execute arbitrary TypeScript components. A production native target needs a separately designed supported source subset, state/async semantics, and JavaScript integration boundary.

**Exit:** measured evidence for or against native deployment. Do not replace the JavaScript product runtime merely because one native fixture wins, or claim a general native JSX backend from this experiment.

### Task 9 — Adopt the proven backend and document the result

**Files:** compiler defaults/options and declarations, backend docs, build fixtures, tests, benchmark reports.

- [ ] Make the direct backend default only for eligible regions after semantic and performance gates pass; keep supported generic behaviour for the rest.
- [ ] Document supported transformations, fallbacks, intentional limitations, output protocol/version assumptions, and the measured cost of mixed programs.
- [ ] Add deterministic checks for eliminated allocations/graph construction where appropriate and size/import regressions. Keep noisy timing checks on controlled benchmark infrastructure.
- [ ] Run full workspace tests and compiled distribution checks once integrated. Record per-workload wins, parity, and remaining losses against the exact Razor baseline.
- [ ] Preserve the previous evidence and distinguish this work from browser performance, resumability, and general framework rankings. Package publication/deployment is outside this plan.

**Exit:** a verified generated SSR path with reproducible results and a clear subsequent hosting decision.

## Measurement and acceptance gates

**Correctness precedes timing.** A response is counted only after full successful delivery and validation of the token, every row identity/value, expected article content when requested, and completion. Partial responses, dropped requests, failed cancellations, and cleanup failures remain visible. Validate full-output hashes for identical-output controls and semantic equivalence where framework shells legitimately differ.

**Direct-output gate:** compiled output must perform within a proposed 10% of the equivalent handwritten direct prototype in pure-render CPU and allocation volume. Investigate misses before expanding the compiler. Eligibility/fallback coverage must be reported alongside results.

**Adoption gate:** seek a repeatable, practically meaningful end-to-end CPU and complete-response improvement over the preserved current backend; use 10% as the initial significance target, also requiring improvement beyond observed noise. Investigate regressions above 10% in TTFB, memory, small pages, or mixed async workloads. Report explicit tradeoffs instead of aggregating away losses.

**Razor target:** lower CPU/valid page and complete-response latency on the matched structured fixtures with no correctness failures or concealed memory/TTFB regression. Winning one metric or size is reported as that specific win. Use paired repeat ratios and variability; do not claim statistical confidence from a handful of correlated requests.

**Feasibility gate:** let request CPU be active rendering work plus other active frontend work. If the measured non-rendering work alone approaches/exceeds the Razor total, renderer optimisation cannot by itself meet the full target. Use profiler attribution and matched controls to estimate this bound; separate controls are informative, not perfectly additive replacements for a full request.

**Resource controls:** begin with equal frontend limits of one CPU/512 MiB as in the existing comparison, explicitly recording Docker Desktop's Linux VM. Keep backend/generator budgets separate and unsaturated. Compare multi-core deployment only in a separate profile that counts all processes/threads and their memory. Compression, TLS, HTTP version, caching, and logging policies must match or be explicitly excluded.

## Validation commands and execution order

Existing commands, run as appropriate to the changed scope:

```sh
node --test libs/compiler/tests/*.test.mjs
node --test libs/runtime/tests/*.test.mjs
node --test libs/server-emitter/tests/*.test.mjs
node apps/ssr-bench/build.mjs
node --test apps/ssr-bench/tests/compiled-adapter.test.mjs
npm run test:ssr:integration
npm test
```

Add focused direct-backend and writer fixtures to the existing suites. Execute emitted modules, not only transform snapshots. Docker-backed integration requires built images and a running isolated benchmark stack; absent infrastructure is an unmet check, not a passing test. Native tests must execute the actual release binary for the target platform.

Existing baseline-only benchmark command:

```sh
npm run bench:ssr -- --frameworks rivet-compiled,dotnet --rows 100,1000,5000 --concurrency 1 --warmup 10 --duration 30 --repeats 5 --skip-build --out .artifacts/ssr-bench/direct-emission-baseline
```

Build and fingerprint images before timing. The command does not preserve today's image by itself. Task 1 must create an immutable lane for the current backend before rebuilding it. Add explicit new lane names and commands when implemented; never relabel a rebuilt image as the historical baseline.

Implementation order is Tasks 1–2, then 3–5, then profile-guided Task 6 and the matched experiment in Task 7. Task 8 is conditional on the measured hosting question. Task 9 integrates the proven outcome. The first milestone is a reproducible cost breakdown and a correct direct-output prototype, not another wholesale framework rewrite.
