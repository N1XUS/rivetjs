# Rivet compiled runtime implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent owned tasks; TDD and scoped review are required. Steps use checkbox syntax.

**Goal:** Implement the compiled JSX runtime and native SSR experiment, then add browser delivery features and benchmark actual output against the retained .NET baseline.

**Architecture:** Signals/ownership, JSX/server lowering, and Rust emission have separate owned files and can proceed independently. Browser bindings and routing/lazy features depend on established runtime contracts. No application transport is required by the framework.

**Tech stack:** Node 24 ESM, JavaScript/TypeScript authoring, Rust native emission, existing Nx and Docker/Python benchmark, Playwright browser verification.

**Spec:** [Compiled runtime](../specs/2026-10-02-rivet-compiled-runtime-design.md).

## Global constraints

- Public functions/classes/methods have concise JSDoc, Rust documentation, and useful TypeScript declarations.
- Preserve expression order, escaping, abort/backpressure, request isolation and disposed-owner cleanup.
- Browser imports contain no compiler, native binary, credentials, or backend-only tooling.
- Keep benchmark transports under `apps/ssr-bench`; no final response/data cache in comparisons.
- Commit verified milestones. User explicitly requests autonomous execution; no additional plan/execution handoff.

## Review focus

- Conditional dependencies and computed diamonds must not observe stale values or retain old subscriptions.
- Attribute/text/raw HTML boundaries must not create executable content or reorder side effects.
- Client removal while async/lazy code is loading must release owners and ignore late results.
- Async SSR must never leak one request's context into another request.
- Native boundaries must count conversion/copy/stream costs and use the exact benchmark fixture.

### Task 1: Signals, logical ownership and synchronous context

Files: `libs/reactivity/{package.json,project.json,index.mjs,index.d.ts,tests/reactivity.test.mjs}`.
Produces the signal/computed/effect/batch/createRoot/onCleanup/untrack/context contracts in the spec.

- [x] Write behavioral tests and observe RED for switched dependencies, diamond coherence, nested batch, nested cleanup, thrown effects, context shadowing and isolated roots.
- [x] Implement dependency tracking and bounded owner disposal with zero dependencies and public JSDoc/types.
- [x] Run `node --test libs/reactivity/tests/*.test.mjs`; record GREEN and review before dependent browser work.
- [x] Commit the owned task after review; keep shared package-lock/root scripts for the coordinator.

### Task 2: JSX compiler and server runtime

Files: `libs/compiler/{package.json,project.json,index.mjs,tests/compiler.test.mjs}`, `libs/runtime/{server.mjs,template.mjs,server.d.ts,tests/server.test.mjs}`. Runtime package metadata is coordinated separately.
Produces `compile(source,{target,filename}) -> {code,diagnostics}`, compiled template/slot helpers, `renderToString` and `renderToWriter`.

- [x] Test actual JSX compilation/execution, nested components, arrays/conditions, boolean/void attributes, hostile values, observable expression order, async children, writer abort/failure; observe RED.
- [x] Hoist static fragments and emit dynamic boundaries without native-element VNodes; diagnose unsupported syntax explicitly.
- [x] Execute tests against emitted modules; assert static build excludes reactive/browser imports; record size and supported syntax.
- [x] Commit owned files after review.

### Task 3: Isolated native Rust emitter

Files: `libs/native-renderer/{Cargo.toml,Cargo.lock,src/lib.rs,src/main.rs,tests/*,README.md}` and private build utilities under that folder. Own no shared benchmark/root files yet.
Produces exact fixture-compatible native emission and a callable or CLI integration contract, with build/run instructions. Native code owns escaping and static fragments; benchmark data tooling remains external.

- [x] Write Rust tests for byte-identical fixture semantics, all ten fields, escaping, malformed rows and bounded output; observe RED.
- [x] Obtain a workspace-local or containerized toolchain; implement native emitter, preserve fixture output, and document crossing costs.
- [x] Run Rust tests and a deterministic comparison to JS output; provide native integration artifact and contract to coordinator.
- [x] Commit owned files after scoped review.

### Task 4: DOM compiler and reactive mounting

Files: `libs/runtime/{dom.mjs,dom.d.ts,tests/dom.test.mjs}`, compiler DOM backend and `apps/playground` fixtures.
Consumes Tasks 1/2; produces `mount(factory,container)->dispose`, targeted slot bindings and keyed structural ownership.

- [x] Browser RED tests for targeted text/attributes/events, models, preserved static identity, keyed moves/removal and owner cleanup.
- [x] Lower DOM templates with static cloning and specialized reactive effects; dispose all owned subscriptions/listeners.
- [x] Verify full CSR, TSX authoring/types and browser/server dependency separation; review/commit.

### Task 5: Async, lazy, router, styles and client-only boundaries

Files: runtime feature entrypoints and matching tests; playground route/async/style/lazy fixtures.

- [x] RED tests for context ownership across async requests, lazy import sharing/retry, route navigation cancellation, late async output, client-only fallback and style integration.
- [x] Implement explicit lazy function/component references, abortable async regions and minimal browser router; style imports stay build-time.
- [x] Browser tests prove route/unmount disposal and requested-only chunks; compare emitted payload; review/commit.

### Task 6: Explicit resumable boundaries

Files: runtime resume serializer/loader, compiler manifest/extraction passes and interaction fixtures.

- [ ] RED tests proving setup does not replay, shared signal identity, captured-state security, event semantics and pending-load removal.
- [ ] Generate narrow serializable boundary records/stable modules and delegated activation; diagnose unsupported captures.
- [ ] Measure eager/deferred/state bytes and first interaction; review/commit separately from hydration compatibility.

### Task 7: Native integration and measured optimization

Files: owned benchmark adapters/build/Compose controls, result summaries, root Nx/package integration.

- [ ] Validate compiled/native output through the existing semantic oracle and tests before measuring.
- [ ] Integrate Node/native emitter and native-server controls independently; measure pure render and whole gRPC fixture lanes.
- [ ] Run isolated Docker comparisons with matched quotas, warmup/repeats, CPU/memory/latency/failures and conversion costs. No builds/tests during trials.
- [ ] Run example-app Lighthouse/mobile delivery and browser update/disposal checks. Report remaining losses/limitations; optimize the measured bottleneck and commit evidence.

## Self-review and execution ruling

Each user feature maps to an owned task, with dependencies stated above. JSX, browser reactivity and native SSR are complementary targets rather than automatic language translation. The user expressly authorizes autonomous implementation and subagents, so the normal skill plan-approval/worktree prompts are superseded: continue in the existing clean checkout, with disjoint file ownership, scoped reviews and coordinated commits. Cost: concurrent integration requires coordinator-owned shared manifests and serialized Git mutations. Runtime context across async work is a separate server concern from synchronous owner tracking.
