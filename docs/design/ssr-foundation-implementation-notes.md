# SSR foundation implementation record

This completes the first experimental emitter/benchmark milestone. The framework's JSX compiler, full CSR, browser state/disposal, lazy manifests, resumability, routing, DI, and wrappers are not implemented. The obsolete web-component implementation and docs app were removed under the user's explicit instruction. The implementation checkpoint is `95ca1a2` on the existing `main` branch; the evidence is a subsequent checkpoint. No publication, push, or PR was requested.

## Review and verification

One fresh-context reviewer examined the complete foundation. Four findings were treated as Important and fixed in one pass with failing-then-passing regression checks: validating every field and requested article, preserving unique benchmark runs, recording backend/generator failures and OOM state, and flagging generator CPU/missed arrivals. The Python regression suite ends at 11/11 passing. No Important review findings remain open.

Final verification is 29 passing Node tests plus 11 Python tests. It includes actual Docker-backed gRPC and HTTP, browser JavaScript on/off and REST-only data access, concurrent request isolation, malformed workload rejection, aborted RPC recovery, slow consumers, and repeated request ownership checks. Clean npm ci and the pinned/locked Compose image rebuild pass. Stress tests show recovery in these bounded runs, not a universal proof of leak freedom. Client/routing cleanup still needs future tests.

The pinned Qwik runtime creates a process-global MessagePort for its scheduler. Adapter tests use Node's test-force-exit because this resource keeps an isolated test process alive; Rivet emitter tests do not. It is not observed per-request growth. Compiler build workers also require process exit after awaited output generation. These are retained competitor/tooling behaviors rather than hidden renderer changes.

## Decisions and their costs

- Execute inline after the user's implementation approval. Cost: one final independent review, rather than a separate implementer/reviewer pair for every task.
- Initially preserve the non-Git workspace without initializing a repository; when Git appeared, keep working in place. The later user request for commits supersedes the earlier no-commit ruling. Cost: the milestone uses the existing main checkout rather than a feature worktree.
- Delete the old runtime/apps/docs/tooling and dependencies as explicitly requested. Keep relevant historical benchmark JSON as ignored research artifacts. Cost: legacy APIs and app compatibility are intentionally gone.
- Check in deterministic generated C# protobuf sources after the pinned Grpc.Tools Linux ARM executable crashed with exit 139. Regeneration is explicit and Node/combined benchmark builds check the schema hash. Cost: schema changes need regeneration on a compatible host; standalone .NET hash checking remains a deferred minor.
- Use Python verified-response workers rather than hey. Cost: Python validation/GIL and admission delays can restrict offered traffic; warnings and generator measurements must qualify throughput.
- Keep the generator container alive until final cumulative resource samples. Earlier smoke CPU counters were zeroed by Docker after exit and are superseded. Cost: a short hold after load; it is outside the measured workload.
- Probe a working Python 3.12+ executable and allow RIVET_BENCH_PYTHON after npm selected a broken local python3. Cost: startup probing outside measured intervals.
- Interrupt the first matrix after review findings, fix them, and rerun every published case. Cost: extra measurement time; superseded data is not used for comparisons.
- Use a temporary Docker client configuration when the credential helper stalls on public images. Cost: explicit local Docker socket/config selection; global settings and private credentials remain untouched.
- Keep streaming as the default based on measured first-byte behavior, retaining a string variant. Cost: the string variant has higher completion throughput in these short trials; memory is not universally lower with streams.
- Finish the authorized checkpoint in the existing checkout. Cost: no separate feature branch; no merge, push, or PR is performed.
- Keep Rust runtime work as a candidate after recording this baseline. Cost: this milestone delivers no native Rust renderer or claimed Rust speedup.

## Deferred minors

- Public rawArticleHtml JSDoc does not explicitly say the caller must provide trusted/sanitized HTML. The benchmark fixture is trusted.
- Standalone .NET builds do not enforce the Node build's protobuf hash check; combined benchmark builds do.
- Markdown result tables omit per-case warnings; HTML and JSON retain them.

## Transport independence

gRPC is only the benchmark fixture transport. Rivet must not require gRPC, protobuf, REST, or a specific service library. Applications own server data access and can use HTTP, databases, GraphQL, queues, local functions, or other tooling. Browser services use browser-accessible APIs and do not import server credentials/transports. The current REST module is an example of that separation, not a mandatory framework transport.

A candidate native renderer accepts prepared values and emits HTML plus optional resumable metadata. Benchmark-specific gRPC plumbing stays in apps/ssr-bench; the core renderer and compiler do not depend on it.

## Rust hybrid candidate, not an implemented contract

JSX/TypeScript authoring could produce a compiled Rust server emitter and compiled JavaScript DOM bindings for the browser. Compiler and renderer are separate choices: a Rust compiler that emits JavaScript does not make request execution native.

The first useful control is the existing Node HTTP/gRPC/Markdown pipeline with a native Rust emitter. Data crosses the boundary in bounded batches; static template fragments stay native. Measure conversion/copying, escaping, allocations, and stream backpressure alongside pure emission. Avoid one callback across JavaScript/Rust per element. NAPI-RS provides native asynchronous integration, but its existence does not establish a performance advantage: [official async integration documentation](https://napi.rs/docs/concepts/async-fn).

A second benchmark control would let Rust own HTTP, native gRPC, parsing, and emission. This isolates whole-stack effects; gRPC remains test plumbing rather than a framework dependency. A native server cannot execute arbitrary TypeScript services by itself; define prepared-data boundaries or explicitly host/bridge JavaScript and measure those costs. General TypeScript expressions, closures, dynamic components, and observable evaluation order must not silently change when lowering templates. Unsupported native lowering needs a diagnostic or a clearly measured JavaScript execution path.

Resumable metadata remains a separate compiler/runtime contract: event references, captured state, and DOM bindings must survive server-to-browser transfer regardless of the server language. Qwik's [resumability explanation](https://qwik.dev/docs/concepts/resumable/) describes the listener/state requirements. Rust does not supply those automatically. Initial browser rendering and full CSR would use JavaScript, with ordinary DOM and lazy modules; the native server binary adds no browser download.

## Execution ledger

The original sequence below preserves initial rulings and their later superseding instructions. The decision list above supplies their costs and current interpretation.

# SDD ledger — plan: docs/design/plans/2026-10-02-rivet-ssr-foundation.md

Ruling: user explicitly authorized implementation after reviewing/amending the written design; execute inline without another approval handoff.
Ruling: no Git repository exists; implement alongside legacy files and preserve this ledger rather than initialize Git or create a worktree.
Pre-flight: Task 1 writer/page contracts feed Tasks 2/3; protobuf fields map to camelCase JS DTOs and PascalCase C# generated fields. Task 4 consumes common health/metrics/page endpoints; versions/variants and failed runs remain explicit.
Baseline: existing npm regression suite running; exact Solid/Qwik v2 artifacts are available from npm.

Task 1: complete — emitter tests RED (6 behavior failures) then GREEN 7/7. Existing baseline npm test passed before deletion.
Ruling: user explicitly requested deleting unrelated legacy implementation during execution; removed old core, apps/docs/counter/benchmarks, tooling/configs and obsolete docs. Preserved relevant old result JSON in .artifacts/ssr-legacy-baseline; legacy source compatibility/regression work is superseded.
Task 2: integration RED 16/16 missing endpoints with ECONNREFUSED outside sandbox. Service/site sources and REST boundary implemented; REST test GREEN 1/1. Razor compiler exposed two API/name issues; fixed using a real IAsyncResultFilter and fully-qualified gRPC StatusCode.

Ruling: a Git repository appeared during execution; preserve it and continue in place without branch/worktree/commit operations.
Ruling: pinned Grpc.Tools Linux ARM protoc crashed with exit 139; check in deterministic generated C# sources and verify the schema SHA before builds. Cost: schema edits require explicit regeneration on a supported host.
Task 2: complete — native Docker gRPC/Razor sources build; HTTP integration GREEN 16/16 includes invalid input, article/REST, token isolation, and abort recovery.
Task 3: complete — adapter tests RED missing artifacts/manifest, then GREEN 3/3; official Qwik Vite client/server pipeline with manifest and retained browser assets; browser audit GREEN 1/1 across four frontends with JS off/on. Native Solid Rust compiler uses public SSR API.
Ruling: Python verified-response workers replace hey so partial/wrong responses fail each request. Cost: generator CPU/queue delay can limit throughput; sample and flag them explicitly.
Task 4: initial unit RED missing modules; GREEN 6/6 including CPU reset regression RED→GREEN. Initial smoke output exposed Docker zeroing exited-container counters; retain load generator briefly until final sample and rerun measurements. Initial smoke CPU evidence is superseded.

Task 4: complete — documented npm/Nx tests GREEN (11 Node + 7 Python behavioral checks); Docker images pinned by digest; smoke rerun 8/8 trials had zero failed responses with nonzero generator CPU samples.
Ruling: npm prepended a broken /usr/local/bin/python3 ahead of working Homebrew Python; add a portable Python 3.12+ probe/fallback and RIVET_BENCH_PYTHON override. Cost: probing a broken candidate once adds small startup overhead, outside measured intervals.

Final review: fresh gpt-6-astra reviewer read code without interfering with timed loads. Four findings re-graded Important and fixed in one pass: full field/row/article oracle, unique run directories/index, all-participant OOM/failure evidence, conservative GIL and fixed-arrival warnings. Regression tests RED (1 failure + 3 missing-feature errors) → GREEN 11/11; full Nx suite GREEN. Interrupted initial repeated trials; final evidence is rerun after fixes.
Final: minor (deferred): rawArticleHtml public JSDoc should explicitly state trusted/sanitized input; current fixture is trusted.
Final: minor (deferred): standalone .NET builds do not enforce the Node build's protobuf hash guard; combined benchmark builds enforce it.
Final: minor (deferred): Markdown tables omit per-case warnings; HTML and JSON retain warnings.

Ruling: user subsequently requested periodic commits; committed reviewed foundation and cleanup as 95ca1a2, superseding the earlier no-commit ruling. No branch, push, or publication operations.

Task 5: complete — 124 post-review measured cases (72 grid, 36 article, 12 writer variants, 4 fixed-arrival); 105 Qwik timeout failures retained, no OOM. 29 Node + 11 Python checks pass; clean npm ci and final pinned/locked Docker rebuild succeed. Report index verified at http://127.0.0.1:18120/report.html. Raw arrays remain local; compact evidence and full results hashes committed.
Ruling: retain streaming as default based on earlier first bytes; string variant remains available. Cost: string completion throughput is higher in these short measurements; no universal writer win.
Ruling: current main checkout remains in place for the user's requested checkpoint commits; no integration menu, branch merge, push, or PR is needed for this in-place milestone. Cost: no separate feature branch exists for independent integration.
Ruling: Rust runtime is a candidate raised by the user after baseline collection; preserve current baseline and discuss native-renderer versus native-server controls before changing runtime semantics. Cost: no Rust runtime speedup is delivered by this milestone.
