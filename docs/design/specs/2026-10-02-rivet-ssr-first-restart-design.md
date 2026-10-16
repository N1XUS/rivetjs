# Rivet SSR-first restart — proposed design

Date: 2026-10-02

Status: approved architecture; first experimental SSR-emitter and Docker-benchmark milestone implemented. See [baseline evidence](../../benchmarks/ssr-foundation-results.md). JSX compilation, CSR, and resumability remain unimplemented architectural stages; broader performance advantages remain hypotheses.

## 1. Intent and scope

Restart Rivet around compiled JSX and server-side rendering. The default HTTP response contains complete usable HTML. Interactive regions load code lazily and resume from server state; an application can also render everything in the browser. Server services may use gRPC, RabbitMQ, databases, and other backend transports; browser services access remote data exclusively through REST APIs. Full CSR changes where rendering runs, not which backend transports become available to the browser. Ordinary components emit ordinary HTML elements. Custom elements are a future opt-in integration tool when they provide a concrete benefit.

The user's governing priorities are execution performance and optimization, bundle size and tree shaking, SSR CPU/memory efficiency, and lazy/resumable execution. Those priorities take precedence over the structure, abstraction style, or readability of generated AOT output. Authoring simplicity remains desirable. ASP.NET Core is both a competing SSR application and the shared dummy gRPC service. Every eligible framework's end-to-end SSR workload calls that service using the same protobuf contract. gRPC/protobuf are benchmark-only choices, not framework requirements: applications choose their own data-access tooling and pass prepared values to rendering. Browser/server service separation protects platform boundaries rather than mandating a specific transport. Minimal server/client service separation is included; DI, service containers, decorators, framework wrappers, routing abstractions, documentation migration, and publishing are outside this restart's first milestones.

The ambition is to lead every measured performance dimension. Reports must show individual wins, losses, and inconclusive comparisons; an overall score cannot establish that ambition. Small bundles, low server memory, and low first-interaction latency are distinct measurements.

This direction replaces the earlier web-component architecture. The user subsequently explicitly requested removing everything outside the new implementation: remove the legacy runtime, apps, docs site, browser harness, and obsolete tooling/dependencies. Keep the active design/plan and relevant raw benchmark evidence as research inputs; do not retain legacy implementation code as a compatibility layer.

### Governing optimization rule

Generated AOT code is a machine artifact. It may be imperative, flattened, inlined, specialized per template, repetitive, or substantially different between SSR and CSR. There is no requirement to preserve source component boundaries, introduce a uniform generic runtime, or make emitted code resemble JSX. Choose the output that demonstrates the best execution and delivery costs while preserving the defined observable behavior. Maintain understandable authoring APIs, diagnostics, and source maps instead of imposing readability constraints on production output.

Move work to compilation whenever it removes runtime work: static markup/attribute analysis, target locations, specialized update operations, unused-feature elimination, closure extraction, serialization reachability, and backend separation. Static server rendering must not import the browser signal scheduler, DOM renderer, event loader, or resumability serializer when those features are unused. Static browser content must not allocate reactive records solely to retain the original component hierarchy.

Measure compressed and uncompressed payloads, initial and deferred chunks, HTML/state metadata, parse/evaluation time, allocations, server CPU/request, and client update cost. Inlining or duplication can reduce execution overhead while increasing bytes; shared helpers can reduce bytes while adding calls. Resolve those tradeoffs with the declared workloads and report both costs. Generated-code aesthetics never decide the tradeoff.

## 2. Research and reproducibility

Read-only source checkouts were inspected; their scripts were not executed.

| Reference | Inspected revision | Relevant evidence |
| --- | --- | --- |
| Solid `next` | `9a213bbb514ca313bdefc5bfe33d072e94409c65` | Package identifies Solid `2.0.0-rc.13`; separate JSX DOM/SSR compiler backends, static markup lowering, grouped dynamic bindings, lean server owners and pull-based server signals |
| Qwik `@qwik.dev/core@2.0.0-rc.0` | `d3eace9df4f6830be368cf87e2c74a54075ada3a` | Optimizer extracts lazy closure modules and captures; SSR writer buffers chunks and tracks pending flushes; serializer emits referenced state and vnode metadata |
| PeakVentures.SitesPerformance `main` | `2602a691916b2764378e76a673276fdb613e39c0` | .NET gRPC service, ASP.NET MVC/Razor client, Qwik/Fastify client, per-request Markdown conversion, Docker Compose, Python invoking `hey` and `docker stats` |

Important inspected files:

- Solid: `packages/compiler/src/ssr/template.rs`, `packages/compiler/src/dom/static_template.rs`, `packages/compiler/src/dom/dynamics.rs`, `packages/solid/src/server/signals.ts`, `packages/web/src/server.ts`, `packages/signals/src/core/graph.ts`.
- Qwik: `packages/ts-optimizer/README.md`, `packages/qwik/src/server/ssr-render.ts`, `packages/qwik/src/server/ssr-stream-handler.ts`, `packages/qwik/src/server/ssr-container.ts`, `packages/qwik/src/core/ssr/ssr-render-jsx.ts`, `packages/qwik/src/core/shared/serdes/serialize.ts`.
- Example: `Protos/content.proto`, `ContentService/Services/FsContentService.cs`, `ContentSite/Controllers/HomeController.cs`, `ContentSite/Program.cs`, `ContentSiteJs/src/routes/[id]/index.tsx`, `Testing/benchmark.py`, `docker-compose.yml`.

The example's JS route constructs a gRPC client inside each invocation and logs timing per request; the .NET application registers a client through its client factory. These are different channel and logging policies. The new harness uses reusable channels and disables per-request console logging. Existing example results are historical observations, not evidence for the new architecture or pinned v2 competitors.

Docker Desktop's Linux arm64 engine is running locally; .NET 10 SDK and `hey` are installed. Docker results on this machine describe its Linux VM, not native Linux host performance. Each published run records that distinction.

## 3. Architectural choices

### Recommended: compiled SSR with explicit resumable boundaries

Compile JSX into separate server and browser outputs from a shared rendering representation. Server output writes static HTML chunks and escaped dynamic values directly, without constructing a browser DOM or a virtual node for every native element. Browser output creates/clones static DOM and attaches specialized signal bindings. Explicit interactive boundaries provide the serialization and lazy-module contract.

This combines Solid's compiled bindings, Qwik's lazy captured functions/state references, and Angular-style activation triggers. It does not require embedding any of those frameworks. Resumability increases server serialization work and HTML metadata; that cost must be measured from the first interactive fixture.

### Alternative: compiled SSR with selective hydration

Use the same efficient server emitter, but rerun boundary setup in the browser to attach bindings. This is easier to implement and supports a wider range of closures. It may be a useful explicitly labeled compatibility path; it does not satisfy the primary resumability goal on its own.

### Alternative: general runtime graph serialization

Build a generic component/reactive graph and serialize it to restore arbitrary supported computations. This provides broader runtime flexibility, but puts more graph allocation and serialization work on the server. It is a comparison candidate, not the default given the current memory findings.

### Compiler implementation and production packaging

Rust is explicitly permitted for the compiler and is the preferred candidate for its parsing/analysis/code-generation core, subject to measured build performance and integration cost. A thin TypeScript/JavaScript adapter may expose configuration and integrate with Vite/Nx. Native bindings or a CLI are build-time tooling; a WASM distribution is optional if portability justifies it. None of these compiler artifacts belongs in the browser runtime or the production SSR request path.

Benchmark compiler cold startup, warm transforms, incremental changes, throughput, peak memory, and install/distribution size independently from execution of its emitted code. Rust can improve the compiler's own costs; generated operations and runtime design determine SSR/client execution costs. Do not infer a runtime win merely from the compiler language. The first SSR emitter experiments still choose the desired output before a large compiler implementation is built around it.

Use a rendering representation that can carry static fragments, dynamic values, target locations, ownership/disposal, dependency/capture information, and optional feature requirements. Backend-specific passes can specialize, hoist, fuse compatible updates, remove unused branches/features, and prune transferred state. Do not fuse computations across observable evaluation/ownership boundaries without preserving their behavior. Chunking may group related lazy handlers rather than emit a request for every tiny closure; measure initial/deferred bytes and first-interaction delay together.

Publish separate tree-shakable ESM entrypoints for server emission, DOM updates, signals, resumability, and optional integrations. Imports pull in only the features actually used; compiler tooling and server transports stay out of browser dependency graphs. Registration/global setup must be explicit rather than an unavoidable root-import side effect. Declare package side effects accurately, preserving required loader behavior while allowing unused modules to be removed.

Verify built artifacts with static-only, one-signal, one-event, resumable, full-CSR, and unused-export fixtures. Check reachable inputs and compressed bytes, not only source-level export structure. Production output excludes debug instrumentation and compiler/parser dependencies. Server and browser artifacts have separate size budgets established from measured baselines, with uncached size checks and saved output hashes.

## 4. Execution contracts

### Server

- Native static markup is hoisted at build time. Dynamic text and attributes use context-correct escaping. JSX evaluation order and observable side effects are preserved.
- Pure static rendering allocates no DOM observers or update scheduler. Interactive state allocates only records needed by the declared resumable contract; it does not reuse the existing generic Web Components observer path.
- Request state is isolated across asynchronous work. No mutable module-global current-request object can survive an `await` and be shared accidentally by concurrent requests.
- Writers have a synchronous fast path while their bounded buffer accepts data. They suspend at flush/backpressure boundaries, not through one promise per HTML element. Compare string accumulation and buffered streaming experimentally before choosing hot-path layouts.
- Backpressure propagates into rendering. Client disconnect and deadlines cancel RPCs and release request buffers, state records, pending work, and listeners. Retained memory under slow clients is part of acceptance testing.
- Errors before headers produce an error response. Errors after streaming begins abort or use a documented boundary fallback; truncated or fallback-only output cannot count as a successful benchmark response.
- Static responses ship no interactive state and no Rivet client bootstrap. Interactive responses count bootstrap, state, binding metadata, and deferred modules in their payload measurements.

### Resume and lazy code

Resumability means attaching supported behavior to existing HTML without rerunning the component's initialization/template to reconstruct that behavior. It does not mean serializing an arbitrary JS stack or that lazy imports alone remove hydration.

The compiler extracts supported event/update functions into stable module exports. A boundary records initial state, references to shared state, necessary DOM targets, and captured serializable values. Shared records are deduplicated within the document. Static descendants do not each receive a reactive object or component instance.

Only explicit live/captured state is eligible for transfer; do not serialize a whole RPC response just because server rendering used it. Server-only objects such as gRPC clients, credentials, sockets, and streams never cross the boundary. Unsupported captures produce diagnostics rather than a silently different runtime mode.

Initial serialization support is intentionally narrow: finite primitives, arrays/plain records, and explicit state references. Broader types require their own documented codecs and benchmarks. JSON embedded in HTML must safely escape script-closing sequences. Binding/update modules may be shared by many instances, with small per-instance data records.

Activation can happen on interaction, visibility, idle, or explicitly. A small delegated loader resolves handlers and deduplicates module loads. Events that require synchronous cancellation, form behavior, input values changed before activation, repeated clicks during loading, failed imports, and removal during loading need defined semantics and browser tests. Do not label a boundary resumable until setup counters prove it does not replay setup.

Cross-boundary state must preserve identity and update all affected targets, including targets in regions whose main component module has not loaded. This requires either a small immediately available binding operation or loading the relevant updater; it must not require loading/rerunning all ancestor components. Conditional and keyed-list region updates need an explicit generated updater and ownership/disposal contract.

### Load only what the current view and interaction need

Qwik-style demand loading is a core requirement, not an optional optimization added after shipping an eager runtime. The default SSR page must display its content without downloading/running the application's component tree. Static pages need no Rivet browser runtime. Interactive pages start with only the minimal necessary delegated loader; handlers, updaters, optional integrations, and unrelated regions stay unloaded until their declared activation requirement is met.

The compiler/build manifest identifies each lazy boundary's actual dependency closure. Activating a child must not import all ancestor templates, the entire route, or unused framework features. Deduplicate concurrent imports and transfer only referenced live state. State decoding is boundary-scoped/lazy where dependencies permit it; one interaction must not eagerly materialize the whole document's state graph. Audit transitive imports, not merely whether an entrypoint contains a dynamic `import()`.

Prefetch is explicit or budgeted based on a measured interaction need, rather than a default download of every reachable chunk. Idle/visibility activation must not erase demand-loading benefits. Needed CSS, fonts, and primary images can be delivered eagerly when doing so improves first paint/LCP; offscreen assets and optional behavior are deferred. Avoid layout shifts from activation and preserve native links/forms while code loads. Full CSR downloads the code necessary to create the current view, while keeping unrelated views/features lazy.

Browser verification records requests and executed bytes before interaction, after one boundary activates, and after further interactions. Verify that unrelated modules remain unloaded and that existing SSR state avoids a duplicate REST fetch. Measure first-interaction delay, long tasks, and total transferred bytes with realistic network/CPU throttling so postponing a large cost until the first click cannot count as success by itself.

### Full client-side rendering

The browser backend can render the complete component tree into an empty root, using the same JSX source and fine-grained update semantics. This path creates state and runs component setup; there is no server state to resume. Browser services use REST through `fetch`; backend gRPC/RabbitMQ/database access stays inside server services. This contract also applies to resumed event handlers and client-side updates, not only full CSR. Native gRPC remains server-to-backend in SSR comparisons.

SSR, resume, and CSR share observable DOM behavior but have separate startup measurements. Forced eager activation is also distinct from rendering an empty root.

### Minimal server/client service boundary

Use plain paired modules and a shared TypeScript interface, with no service registry or DI. The initial application can import each implementation explicitly. When compiler integration is added, an optional configured alias selects the server or browser implementation at build time; there is no runtime environment branch that imports both transports. The alias must expose the same checked TypeScript contract in both builds.

| Concern | Server implementation | Browser implementation |
| --- | --- | --- |
| Module | `content.server.ts` | `content.client.ts` |
| Remote transport | Reused gRPC channel; optional RabbitMQ/database clients in application code | REST endpoint through native `fetch` |
| Credentials | Server-managed backend credentials; request-scoped identity where needed | Browser HTTP authentication policy; no backend credentials |
| Result | Shared plain DTO | The same DTO decoded from the REST response |
| Cancellation | Request abort/deadline mapped to the backend operation | `AbortSignal` passed to `fetch` |

For example, both implementations satisfy `ContentService.getArticle(id, options?) -> Promise<ArticleDto>`, where `options` accepts an `AbortSignal`. The server implementation calls gRPC directly during SSR. The client implementation requests `GET /api/articles/:id`. That REST handler calls the existing server implementation and returns the public DTO. For writes backed by RabbitMQ, the REST handler validates/enqueues the command and defines its acknowledgement/status response; a queue publish is not automatically equivalent to a completed operation.

Provide only the small reusable mechanics: a typed REST JSON helper that accepts cancellation and checks HTTP failures, build-time implementation selection when the compiler exists, and a diagnostic for runtime imports of server-only modules into browser output. DTO types are shareable through type-only imports. Helpers do not claim to validate arbitrary JSON at runtime; endpoint/DTO checks remain explicit application code. Do not generate REST endpoints implicitly from every service method, embed RPC clients in the browser, or serialize service objects into resumable state. Both entrypoints remain ordinary functions/objects and receive concise JSDoc when implemented.

SSR transfers only the public initial values needed by the page's live state; resuming does not automatically refetch them. Later browser reads/mutations use the REST implementation. Authentication, validation, error mapping, and cancellation belong to the explicit REST boundary. Process-level connection reuse does not permit storing mutable per-user state in a shared service object.

The first SSR benchmark includes one explicit article REST endpoint and browser `fetch` smoke check to prove the transport split. Its main timed SSR lane continues to call gRPC directly in every participant. Browser → REST → backend latency and bridge overhead are a separate workload; do not insert the REST hop into only Rivet's SSR path. RabbitMQ is an architectural example here, not an additional benchmark dependency or a broker adapter to implement now.

## 5. Benchmark architecture

Python controls a project-scoped Docker Compose stack, drives a dedicated load-generator container, samples resource counters, validates responses, and writes raw data plus HTML/Markdown reports. Build images outside timed tests. Pin package versions, source SHAs where needed, container image digests, compiler output hashes, OS/CPU architecture, and Docker VM limits.

One ASP.NET Core gRPC service provides deterministic article and structured-page fixtures. The protocol includes bounded fixture selection and a request token echoed in the result. Each counted end-to-end request makes one real RPC; tokens vary so a cached final page cannot satisfy correctness. No application HTML/data cache is enabled in the main workload. Static compiled template chunks are allowed for every participant. gRPC-only controls use a null/small-response HTTP adapter to expose backend/transport limits separately.

Test one SSR application at a time. Backend and load generator have recorded separate resource budgets. Measure the backend too; if it saturates first, label the test backend-limited and do not infer renderer capacity. Use equal frontend limits: first one CPU and 512 MiB, then four CPUs and 2 GiB with an explicit deployment profile. A Node multi-process deployment and .NET's process model must be reported, including all worker memory; do not compare one Node event loop to unrestricted .NET cores.

All JS competitors use the same thin HTTP/gRPC integration where their public SSR API permits it. Native framework adapters remain idiomatic production SSR. Record unavoidable transport/adapter differences rather than hiding them. ASP.NET uses MVC/Razor as the primary comparison, with a separately labeled minimal direct-writer transport control.

### Participants

The first measured slice is Rivet's experimental SSR emitter, pinned Solid 2, pinned Qwik 2, and ASP.NET Core 10/Razor. Implement compatible exact versions/production builds; do not silently substitute existing Solid 1 or Qwik 1 adapters.

The same adapter contract subsequently covers React streaming SSR, Angular production AOT SSR, Svelte server compilation, and Lit Labs SSR. A render-only workload and an interactive-delivery workload are separate: do not compare stripped Rivet static output against a competitor's fully interactive response as the only result.

Lit template SSR and Lit custom-element SSR may require distinct modes and different shadow DOM structure. Verify current supported APIs before adding the adapter. Polymer requires identifying an actual supported SSR integration; until one is verified, show an explicit unsupported/unavailable row rather than inventing a renderer under its name. Build failures and unsupported modes remain visible in reports.

### Workloads

1. **Article:** the example's gRPC → Markdown → HTML flow, with identical input fixture bytes and separately timed Markdown conversion. JS uses the same parser/options across frameworks; .NET's parser/version and output differences are recorded. This measures the whole stack, not just template efficiency.
2. **Structured large page:** 100/1,000/5,000 rows with substantial nested native HTML, ten dynamic fields per row, conditional content, and later interactive controls. Structured protobuf fields avoid Markdown dominating the template comparison.
3. **Async/streaming:** identical delayed service data, complete content validation, first-byte and first meaningful-content time, final-byte time, slow consumers, and cancellation. An early empty shell alone is not a rendering win.
4. **Interactive SSR:** the same large page with a controlled proportion of resumable/hydratable regions. Measure serialized bytes, server state generation, eager/deferred JS, first interaction, update latency, and browser retained memory.

Use `hey` for concurrency-based capacity sweeps at 1/10/50/100/250 clients, fixed warmup and measurement intervals, and fresh repeated trials in rotated order. Default exploratory timing is 15 seconds warmup plus 30 seconds measurement, three trials; release evidence uses five trials and 60-second measurements. The example's five-minute, 100-client profile remains a selectable soak test.

`hey` is a closed-loop tool: slower responses reduce its offered request rate. Add a rate-controlled generator with explicit missed-start/queue reporting for matched-load tail-latency comparisons; a concurrency-only result cannot establish latency at the same offered traffic rate. Do not treat `hey -q` as a globally fixed independent arrival rate.

### Measurements and correctness

- Successful validated responses/second; HTTP/gRPC failures, timeouts, overload, and OOM separately.
- Response p50/p95/p99, TTFB, complete-response time, bytes transferred, and meaningful-content arrival. State the exact clock boundaries.
- Container CPU-time delta per completed successful request, total CPU during the interval, and CPU throttling. Include all frontend worker processes. Percent CPU alone is not efficiency.
- Idle/steady/peak container memory, peak process RSS, JS/.NET managed-heap diagnostics where available, post-load recovery, and repeated-cycle memory slope. Do not equate Docker working set, RSS, or managed heap. Tag unavailable counters explicitly.
- Separate RPC, parsing, template emission, resumability serialization, and stream waiting where instrumentable. Async wall time is not renderer CPU time; isolated renderer/allocator profiles supplement end-to-end runs and are labeled diagnostic controls.
- Report instrumentation overhead; aggregate/sample timing with monotonic clocks instead of logging each request. Late streaming phase timings require completion records/trailers/aggregates, not headers already flushed.
- Validate HTML semantics/field values, request-token correspondence, fixture/DOM size, complete-stream markers, escaping, and controls. Sample full-body validation during load plus verify every response status/transport completion; disclose validation coverage. Health checks and warmups do not enter success counts.
- Record raw request distributions and resource time series. Preserve each baseline by run ID. Every framework/mode has a pass/fail/unavailable status.

## 6. Delivery order and first milestone

Treat the restart as four linked projects, each with its own focused implementation plan:

1. **SSR evidence and emitter:** Docker/gRPC/load harness, competitor baselines, emitter experiments, and a measured server output decision.
2. **JSX compiler and CSR:** a small compiler producing the selected server output and direct DOM client output; benchmark a Rust compiler core with a thin build-tool adapter. Include functional components, state, basic bindings, conditional/keyed regions, errors, disposal, optional build-time selection of paired service modules, and artifact-level tree-shaking/size fixtures.
3. **Resumable boundaries:** closure extraction, serializable captures, state/binding payloads, lazy event loader, activation semantics, and proof that setup is not replayed.
4. **Competitive optimization:** expand adapters/workloads, profiles, matched-load experiments, soak/leak testing, and improvements selected from observed CPU/allocation/latency costs.

The first implementation plan covers project 1, with packages kept beside the legacy runtime. It must provide:

- A shared protobuf fixture service and ASP.NET Razor SSR app, reusable native gRPC clients, deadlines/cancellation, and equal frontend limits. A small explicit article REST endpoint plus a browser client smoke check demonstrates the server/client transport boundary separately from timed SSR requests.
- Runnable production Solid 2 and Qwik 2 SSR adapters pinned to compatible artifacts. Source-build requirements are explicit.
- A clearly labeled experimental Rivet server emitter implementing the **intended compiler output**, compared with a simple direct HTML writer control. Handwritten experimental output is not advertised as a completed JSX framework.
- Buffered-string and bounded-streaming candidates with identical escaping/output correctness. Measure render CPU/allocation plus full HTTP results before choosing a backend.
- Python/Compose commands, smoke correctness, CPU/memory/latency raw results, and a report showing losses as clearly as wins.
- Concurrent-request isolation, aborted RPC/render, slow-reader backpressure, malicious text/attribute fixture, failed-backend, and repeated-load recovery checks.

**First-milestone exit:** the four SSR participants run through the same RPC-backed fixture and reproducible stress harness; correct outputs and bounded cleanup are demonstrated; a server-emission strategy is chosen from evidence. This milestone does not claim JSX compilation or resumability is finished. Its findings feed projects 2 and 3 instead of forcing an unmeasured architecture into them.

## 7. Acceptance and limits on claims

The final competitive target is Pareto leadership on the declared workloads: at equal resources and traffic, no measured loss in CPU/request, steady/peak memory, latency, throughput, rendering cost, or delivered HTML/state/JS bytes against eligible competitors. Render-only and interactive-delivery results both matter. Unknown or statistically overlapping results remain inconclusive, not victories. Compiler execution/distribution costs are a separate reported dimension; output readability is not a release criterion.

Correctness, complete content, cancellation, disposal, and no unbounded retained-memory trend are prerequisites. Five repeated trials and reported variability are required for release performance claims. Improvements in one metric cannot conceal regressions in another. Compiler and static-payload advantages must also survive the interactive SSR/CSR workloads.

Target Lighthouse **100/100 Performance** on controlled representative SSR applications in pinned mobile and desktop profiles, with separate Accessibility, Best Practices, and SEO scores targeting 100 as well. Pin Lighthouse/Chrome versions, production assets, hosting profile, and throttling; run five fresh-browser/cold-cache trials and report every score plus raw FCP/LCP/CLS/TBT/Speed Index values. Keep warm-cache and optional full-CSR measurements separately labeled. Load audits and first-interaction tests accompany Lighthouse, which is not a complete test of deferred interaction costs or server capacity.

An always-100 score for every application and environment is not a framework guarantee: content/assets, backend/hosting latency, device/network conditions, and application semantics affect the result. The requirement is to minimize Rivet's contribution to those costs and demonstrate the 100 target under the declared profiles. Investigate every shortfall rather than cherry-pick a favorable run, remove real content, or defer critical content merely to improve a score. Framework regressions have artifact/request/binding checks as well as noisy browser score measurements.

Every public function, method, and class in the replacement receives concise JSDoc. Performance checks are uncached Nx targets; build/type checks remain ordinary reproducible workspace targets. Existing docs migration starts only after the new execution contract is proven.

## 8. Primary references

- [Solid source branch requested by the user](https://github.com/solidjs/solid/tree/next/packages), pinned SHA above.
- [Solid server signals at the inspected revision](https://github.com/solidjs/solid/blob/9a213bbb514ca313bdefc5bfe33d072e94409c65/packages/solid/src/server/signals.ts).
- [Qwik release source requested by the user](https://github.com/QwikDev/qwik/tree/%40qwik.dev/core%402.0.0-rc.0/packages), pinned SHA above.
- [Qwik optimizer extraction](https://github.com/QwikDev/qwik/blob/d3eace9df4f6830be368cf87e2c74a54075ada3a/packages/ts-optimizer/README.md).
- [Qwik buffering/backpressure](https://github.com/QwikDev/qwik/blob/d3eace9df4f6830be368cf87e2c74a54075ada3a/packages/qwik/src/server/ssr-stream-handler.ts).
- [Qwik resumability concepts](https://qwik.dev/docs/concepts/resumable/); v1 conceptual documentation is not substituted for inspected v2 implementation.
- [Angular incremental hydration](https://angular.dev/guide/incremental-hydration); use version-matched docs when implementing its adapter.
- [React streaming SSR](https://react.dev/reference/react-dom/server/renderToPipeableStream).
- [Svelte server rendering](https://svelte.dev/docs/svelte/svelte-server).
- [Lit SSR status and limitations](https://lit.dev/docs/ssr/overview/).
- [ASP.NET gRPC clients and channel reuse](https://learn.microsoft.com/en-us/aspnet/core/grpc/client?view=aspnetcore-10.0).
- [hey load generator](https://github.com/rakyll/hey).
- [Lighthouse performance scoring and variability](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring).
- [User-provided performance example](https://github.com/Peak-Ventures-Group/PeakVentures.SitesPerformance); private source was inspected through authorized GitHub CLI access, not reproduced into product code.

## 9. Self-review

The proposal preserves SSR as default, optional full CSR, ordinary DOM components, JSX as the eventual authoring path, resumability as a tested contract, and ASP.NET in both requested roles. Server transports and browser REST services have distinct entrypoints and a shared DTO contract; minimal transport support is included while service containers/DI remain deferred. Performance, SSR efficiency, bundle size, and tree shaking govern AOT decisions; Rust is permitted/preferred for the compiler core and measured separately from generated runtime performance. The first milestone is intentionally evidence-producing rather than a full compiler/runtime rewrite. Compiler syntax and capture formats are not prematurely fixed before backend measurements. No benchmark win, implementation completion, or unsupported adapter availability is asserted.
