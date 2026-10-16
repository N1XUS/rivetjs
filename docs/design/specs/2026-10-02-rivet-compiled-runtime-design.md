# Rivet compiled runtime and native SSR experiments

Date: 2026-10-02. Execution authorized by the user's request to work autonomously with subagents. This extends the approved SSR-first restart; the existing measured baseline stays intact.

## Intent

Developer-friendly JSX/TypeScript must support state, reactivity, context providers, routing, asynchronous functions, lazy functions/components/chunks, styles, and client-only code. Server/browser implementations are separate compiler targets. Generated code may be repetitive or unreadable when that demonstrably improves performance, delivery bytes, or tree shaking. Ordinary DOM is the default. gRPC belongs exclusively to the comparison fixture; applications choose their own data tooling.

The target is to beat the pinned ASP.NET baseline on CPU/request, memory, complete/first-byte response time, rendering cost, and delivery size. Report each metric independently with failures, variability, and generator/backend limits. Lighthouse 100 is a measured target for controlled examples, not a guarantee for arbitrary user content or hosting.

## Architecture

1. `@rivetjs/reactivity`: zero-dependency synchronous signals, lazy computed values, effects, batched invalidation, owner scopes, disposal, and synchronous scoped context. No browser or server transport imports. Explicit owner capture is required across async work.
2. `@rivetjs/compiler`: JSX/TSX lowering into hoisted static fragments and dynamic slots. Server output emits escaped HTML; browser output clones static templates and installs targeted reactive bindings. No browser DOM/observer graph on the server. A supported syntax subset is diagnosed rather than silently miscompiled. A JavaScript build-tool front end is acceptable initially; native parsing and lowering are separate measured optimizations.
3. `@rivetjs/runtime`: separate server, DOM, lazy, router, and resume entrypoints with accurate side-effect metadata and concise public JSDoc/type declarations. Authoring uses class-free functions. JSX props use ordinary expressions; reactive DOM expressions are evaluated in generated effects. Server functions retain JavaScript semantics and are evaluated in author order.
4. `@rivetjs/native-renderer`: native Rust escaping/emission, with cancellation/backpressure semantics at the integration boundary. Start with an isolated benchmark-native emitter before replacing generic compiled output. Compare Node + native emission separately from a Rust-owned HTTP/data pipeline. Native-template lowering is optional until supported constructs preserve semantics; unsupported arbitrary JavaScript stays JavaScript. Never promise Rust wins without measuring conversion, allocation, scheduling, and copies.
5. Browser features: mount returns a disposer; effects/listeners/async ownership end on route or component disposal. Context follows logical ownership, not a repeated DOM walk. Async results cannot mutate disposed/replaced regions. Lazy references cache in-flight imports, can retry failure, and never import browser-only code during SSR. Styles are ordinary CSS emitted from the app's toolchain (Tailwind/PostCSS/Sass are build integrations), without a mandatory styling runtime.
6. Resume: explicit stable module references, serializable captured values and signal/binding identities; no arbitrary closure or server-client serialization. Initial static HTML ships no loader. Hydration compatibility and true resumability remain distinct named modes. True resume requires tests proving component setup is not replayed.

## First contracts

- `signal(initial)` returns a callable getter with `set(value)` and `update(fn)`.
- `computed(fn)` returns a lazy tracked getter; `effect(fn)` returns a disposer; `batch(fn)` flushes once when the outer batch ends.
- `createRoot(fn)` returns `{ value, dispose }`; `fn(dispose)` executes in a fresh owner. `onCleanup(fn)` registers owner cleanup, and `untrack(fn)` reads without subscribing.
- `createContext(defaultValue)`, `provide(token, value, fn)`, `useContext(token)` provide synchronous logical-owner context. Async functions must explicitly retain/request their context; a global current owner must never span `await`.
- `getOwner()` returns an opaque current owner; `runWithOwner(owner, fn)` restores it only for the synchronous callback, allowing later work to explicitly capture context without a global owner surviving `await`. Disposed owners cannot acquire new live effects/cleanups.
- Compiler `compile(source, {target:'server'|'dom', filename})` returns `{code, diagnostics}`. Hoisted native markup should allocate per dynamic boundary, not per native element. Preserve JSX expression evaluation order. Spread attributes, URL/event contexts, void elements, boolean attributes, script/style content and raw HTML need explicit safe handling or diagnostics.
- Server `renderToString(value, options?)` and `renderToWriter(value, writer, options?)` accept compiler-generated output and component/async values; streaming propagates writer failures and aborts.
- Browser `mount(factory, container)` returns a disposer. Dynamic text updates do not replace unaffected elements. Keyed structural regions dispose removed owners and retain moved identity.
- Lazy module references are explicit import functions initially. Compiler closure extraction follows after correct manual lazy loading and stable manifest support.

## Acceptance

Test subscription switching, computed diamonds, batching, cleanup once, nested context shadowing, isolation, and errors. Compile and execute actual JSX fixtures, compare escaped output to expectations, and assert no per-native-element object graph. Browser tests cover localized updates, input/model bindings, context changes, keyed moves/removal, route cancellation, late async results, lazy retry/unmount, and client-only SSR fallbacks. Build reachability tests reject server transports/compiler dependencies in browser output. Record server and browser bytes independently.

Native experiments use the existing isolated Docker benchmark with equal quotas, strict semantic validation and saved failures. Builds/tests run outside timing intervals. Add pure-render/data-boundary controls before attributing whole-stack gains to rendering. Preserve the 2026-10-02 baseline and use longer warmup/repeated runs for optimization claims.
