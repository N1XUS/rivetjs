# Language service / editor tooling (design)

Status: design only. Question answered: "vscode language service for jsx?" → Rivet TSX already gets a full TypeScript language service; what's missing is **the Rivet compiler's view of the file**. Ship that as a thin layer over one editor-agnostic core, delivered first as a tsserver plugin, later as a standalone LSP for TS 7.

Sources read: `libs/compiler/index.ts`, `libs/compiler/rust/src/{lib,compile,resume,facts,tree,strip}.rs`, `libs/compiler/vite.ts`, `libs/runtime/{jsx-runtime,resume-format}.ts`, `libs/router/{index.ts,build/*}`, `docs/{resumability,routing}.md`, router/resumability/i18n specs, all `tsconfig*.json`, `.vscode/settings.json`.

## Goal
- Every error the Rivet build reports shows in the editor first: same text, exact range, same file, while typing.
- Make the resume boundary visible: which closures become client symbols, what each captures (and so serializes), what runs on server / client / both.
- Typed file routes in the editor (route ids, params, hrefs) with no dev server running.
- Works in VS Code, WebStorm, Neovim/Zed (via typescript-language-server / vtsls) with one implementation; survives the move to TS 7 (tsgo).
- Fix the current "Cannot use JSX unless the '--jsx' flag is provided" (TS17004) setup problem.
- Non-goals: own TSX parser/type checker; replacing TS completions; formatter; Volar-style virtual files; Tailwind engine.

## What stock TypeScript already covers (no work)
- Parsing, type checking, completions, rename, go-to-def, auto-imports for `.tsx` with `jsx: "preserve"` + `jsxImportSource: "@rivetjs/runtime"` (TS resolves `@rivetjs/runtime/jsx-runtime` → `JSX` namespace).
- Intrinsic element props from `libs/runtime/jsx-runtime.ts`: per-tag attrs, typed events (`Handler<E, V>` with typed `currentTarget`), `data-*`/`aria-*`, `model:value`/`model:checked` (`Signal<…>`), `window:onX`/`document:onX`, `ref` callback typing, `class` + `className`.
- Excess-property errors for unknown attrs (`innerHTML`, `style`, `onFoo`), since they're absent from the types.
- Component props / children ("slot") typing: `JSX.ElementChildrenAttribute = { children }`, `Children` union incl. `() => Children`, opaque `JSX.Element = CompiledElement`; `LayoutProps.children?: JSX.Element`. Named slots = ordinary typed props (`header: JSX.Element`) — no tooling needed.
- `RouteParams` / `RouteId` typing via generated `.rivet/routes.d.ts` module augmentation — **when that file is in the program** (it currently isn't, see Setup).
- Tailwind class completion: official Tailwind CSS IntelliSense handles `class="…"` by default and v4 CSS-first config (`@import "tailwindcss"` in `src/styles.css`). Only a recommendation in `.vscode/extensions.json` is needed.

## Gaps (what TS can't know)
- **Compiler diagnostics** (`compile.rs`, `resume.rs`) are invisible until Vite fails. TS accepts all of these:
  - unsupported syntax: spread attributes, spread children, namespaced tags, unsupported native tag, parser-repaired nesting (`<p><div>`), text directly in table structure, `<script>`/`<style>` JSX content, void element children, textarea/title non-scalar children, textarea `model` + children, unsupported `model:` binding.
  - unsafe attrs: `dangerouslySetInnerHTML`/`innerHTML`/`srcdoc`/`style` → "Unsafe or unsupported native attribute" (TS only says "property does not exist").
  - import-shape rules: helpers must be named imports, no namespace aliases, no re-exports, `clientOnly(...)` called directly with inline importer + inline selector, structural helper aliases.
  - directive values: `preload` must be one of `eager|idle|visible|intent|interaction`; `clientEvent` target must be window/document/ref-bound element/`"media:(query)"`.
  - resume-mode only: ref callbacks must assign a local; ref-bound locals assigned only by refs; capture-phase handlers not resumable; JSX inside handlers/effects/computeds; capturing `this`; capturing class instances (`new …`); browser globals (`window`, `document`, `navigator`, `localStorage`, `sessionStorage`, `location`) read during server render (server target only).
- **Type-aware serializability** — compiler is syntax-only (no checker). It catches `const x = new Foo()` but not `const x = makeFoo()` / a prop typed `Foo`. Runtime (`resume-format.ts`) supports primitives, arrays, plain objects, `undefined`, special numbers, bigint, Date, URL, Map, Set, signals, contexts, element refs, computed/function symbols; anything else (class instances, Promise, Symbol, WeakMap, DOM nodes, non-symbol functions) fails at request time. Only a checker-backed tool can warn at edit time.
- **Resume boundary visibility**: `ResumeSymbol` (`name`, `id`, `kind`, `component`, `captures`, `scope`) exists but has no source span; nothing shows it.
- **Resume membership is config, not source**: `rivet({ resume: { modules } })` / `rivetRouter` decides per file; the editor can't know whether to run resume-mode checks.
- **Diagnostic shape is too thin for an editor**: `{category: "error", message, filename, line?, column?}` — start only (1-based, UTF-16 column), no end/span, no stable code, no severity, no fix data; parse errors carry no position (`early.add(…, None)`); output stops at first parse panic.
- **Type drift risk**: `jsx-runtime.ts` intrinsic types are hand-written; compiler allowlist (`safe_attribute_name`, `event_info`, `is_native`) is separate. Example to verify: element-level `preload="…"` directive (`compile.rs:1118`) not in `Global<E>` → TS may reject code the compiler accepts.
- **Routes**: `routes.d.ts` only exists after the dev server/codegen ran (`.rivet/` gitignored); not in playground `include`; router spec promises typed `href()` + page props, but no `href()` exists in `libs/router` and `routes.d.ts` has params only (no `data`). `<a href>` is `string` — no completion, no broken-link check, no go-to-route-file.
- **CLI parity**: tsserver plugins don't run under `tsc`; CI typecheck (`tsc --noEmit`) never sees compiler diagnostics except via a full Vite build.

## Setup issue: "Cannot use JSX unless the '--jsx' flag is provided" (TS17004)
- Root cause (repo, not VS Code bug): tsserver gives each open file to the nearest `tsconfig.json` that **includes** it; else an *inferred project* with default options (no `jsx`) → TS17004 on every JSX node.
  - No root `tsconfig.json` (only `tsconfig.base.json`, which tsserver never opens as a project).
  - Package configs include only `*.ts` though `.tsx` lives there: `libs/router` (`"*/**/*.ts"` → `tests/fixture*/src/routes/*.tsx` orphaned), `libs/runtime` (`tests/**/*.ts` → `tests/{dom,dom-async,dom-router,resume}/*.tsx` orphaned), `libs/compiler` (`tests/compiler-dom/*.tsx` orphaned), `apps/resume-bench` excludes `lanes/rivet/*.tsx`.
  - Bundled vs workspace TS is secondary: both read the same tsconfig; the workspace pin (5.9.3) matters for identical diagnostics vs CLI and for TS ≥ 5.6 ancestor-config search (below). `.vscode/settings.json` (`typescript.tsdk`, `enablePromptUseWorkspaceTsdk`) exists but is untracked → teammates never get it; the prompt still needs one click ("Use Workspace Version").
- Fix (Phase 0, config only):
  - Each package `include` covers its TSX: `libs/router` add `"*/**/*.tsx"`; `libs/runtime` add `"tests/**/*.tsx"`; `libs/compiler` add `"tests/**/*.tsx"`; `apps/resume-bench` give `lanes/rivet/` its own tsconfig or include it.
  - Root `tsconfig.json` catch-all: `extends ./tsconfig.base.json`, `include: ["**/*.ts", "**/*.tsx"]`, `exclude: ["**/node_modules", "**/dist", "**/.build", "apps/resume-bench/lanes/{solid,qwik}"]`. TS ≥ 5.6 searches ancestor configs when the nearest one doesn't include the file → any stray TSX gets Rivet JSX settings instead of an inferred project. Not solution-style (`files: [] + references`): references require `composite` (TS6306) and add nothing here.
  - Non-Rivet TSX (solid/qwik lanes) keep their own tsconfig with their own `jsxImportSource` (qwik has one; add for solid) so nearest-config wins.
  - `apps/playground/tsconfig.json` include `".rivet/**/*"` → `RouteParams` augmentation + generated app types visible.
  - Commit `.vscode/settings.json` + add `.vscode/extensions.json` (`rivetjs.rivet`, `bradlc.vscode-tailwindcss`).
  - Guard: `nx run-many -t tsconfig-coverage` script — for every `git ls-files '*.tsx'`, resolve owning config (`ts.findConfigFile` + `parseJsonConfigFileContent`, walking ancestors like tsserver) and fail if none or effective `jsx !== preserve` / wrong `jsxImportSource` (allowlist for foreign lanes).
  - Extension command **Rivet: Doctor**: detects TS17004 / inferred project for an open `.tsx`, bundled TS ≠ workspace TS, plugin not loaded, missing `.rivet/routes.d.ts`; offers fixes (switch TS version, open owning tsconfig, run codegen).

## Options compared

| Option | Editors | Type info | TS 7 (tsgo) | Effort | Fit for Rivet |
|---|---|---|---|---|---|
| A. tsserver plugin (`compilerOptions.plugins` / VS Code `typescriptServerPlugins`) | VS Code, WebStorm, Neovim/Zed via ts-ls/vtsls, Sublime LSP-typescript | Full checker in-process | **Not supported**: tsgo doesn't load JS tsserver plugins; plugin API undecided | Low | Best today: decorate diagnostics/hints/hover/fixes/completions on real TSX; WASM call is sync |
| B. Volar-based language server | Any LSP client | Via Volar's TS integration | Volar's own tsgo migration pending | High | Wrong tool: Volar's value is virtual-code mapping for embedded languages (.vue/.astro/.svelte). Rivet files are plain TSX — nothing to map |
| C. Standalone LSP (Node) using WASM compiler, alongside the TS server | Any LSP client (multiple servers per doc) | None (syntax/compiler facts only), unless it hosts its own TS program (doubles memory) | **Works**: independent of TS server implementation | Medium | Right long-term host for compiler diagnostics, resume hints, route features; loses type-aware checks |
| D. Plain VS Code extension (DiagnosticCollection, decorations, no LS) | VS Code only | None | Works | Low | Only as packaging/UI shell (Doctor, decorations, settings); not as logic host |

- TS 7 impact:
  - TS 6.0 = last JS-based compiler/tsserver; TS 7 (Go, `@typescript/native-preview`, LSP-native) replaces tsserver; JS plugins don't load. Plugin API story for tsgo not settled → don't bet the core on either API.
  - Consequence: keep **all logic in `@rivetjs/language-core`** (pure functions over source text + config); plugin and LSP are thin adapters. Prefer **type-level solutions** (generated `.d.ts`, template-literal types) for anything TS itself can check — they work identically in TS 5, 6, 7, `tsc`, every editor.
  - Type-aware serializability is the only feature that truly needs the checker → plugin-only until tsgo exposes an API; LSP falls back to compiler's syntactic check.

## Recommendation
- Phase 0 now: config fix above (resolves TS17004 for everyone, zero code).
- MVP = **A (tsserver plugin)** + **D (thin VS Code extension shell)** over a shared core; compiler gains structured diagnostics.
- Phase 4 = **C (standalone LSP)** reusing the core, enabled automatically when the user runs TS Native Preview/TS 7 or an editor without plugin support.
- Reject **B** unless Rivet adds a non-TSX file format.
- Tailwind: no Rivet work; recommend the official extension.
- Add `rivet check` CLI over the core so CI and non-editor users see the same diagnostics.

## Architecture
- `libs/compiler` (Rust) — additive changes, no output change:
  - `Diagnostic` → `{ code: "RV1xxx", severity: "error"|"warning", message, filename, start, end (UTF-16 offsets), line, column, fix?: { title, edits: [{start, end, text}] } }`; keep `line`/`column` for Vite overlay; parse errors get spans from oxc labels.
  - Stable code table (`diagnostics.rs`): one code per message family (e.g. RV1001 spread attrs, RV1101 unsafe attr, RV2001 browser global in server render, RV2003 class-instance capture…). Code ranges: 1xxx syntax/attrs, 2xxx resume, 3xxx imports/helpers, 9xxx internal.
  - New op `check { source, filename, resume, targets: ["server","dom"] }`: runs both targets' analysis without codegen/strip/source-map; returns merged deduped diagnostics + resume `sites` (`kind`, `component`, `id`, `captures` with decl spans, closure span, `runsOn`). Cheaper than 2× `compile`.
  - `ResumeSymbol` gains `span` (closure) — also useful for dev overlay.
- `libs/language-core` (TS, no editor deps, ESM source + CJS bundle):
  - `ProjectModel`: root, resume membership, route manifest, compiler instance (one WASM instance per process, sync).
  - Resume membership source: `.rivet/editor.json` written by `rivet()` `configResolved` and `rivetRouter` codegen (`{ resumeModules, routesDir, outDir, preloadRules }`). Absent → non-resume checks only + Doctor hint.
  - `check(file, text) → Diagnostic[]` (debounced, cached by text hash); `resumeSites(file)`; `routes()` (reuses `libs/router/build` scanner in-process); `fixes(code, range)`.
- `libs/typescript-plugin` (`@rivetjs/typescript-plugin`, CJS bundle + `rivet_compiler.wasm`):
  - Decorates `getSemanticDiagnostics` (append compiler diags; TS `source: "rivet"`, `code` numeric part), `getCodeFixesAtPosition`, `getSupportedCodeFixes`, `provideInlayHints`, `getQuickInfoAtPosition`, `getCompletionsAtPosition` (route paths/ids, `preload` values), `getDefinitionAndBoundSpan` (href/route id → route file).
  - Only acts on files whose program has `jsxImportSource: "@rivetjs/runtime"`; skips `.ts` without JSX unless it imports runtime helpers (`clientEffect`/`clientEvent`/`clientOnly`).
  - Type-aware capture check: for each resume site capture, `checker.getTypeAtLocation(decl)`; warn (RV2101) if not assignable to the serializable set above (class instances, Promise, Symbol, WeakMap/WeakSet, Node, non-symbol functions).
  - Custom protocol handler (`info.session?.addProtocolHandler("_rivet:sites", …)`) so the VS Code extension can fetch region data for decorations via `typescript.tsserverRequest`.
- `apps/vscode` (`rivetjs.rivet` extension):
  - Contributes plugin via `typescriptServerPlugins` (`enableForWorkspaceTypeScriptVersions: true`) — works with bundled or workspace TS.
  - Decorations: server-only / client-only / both tinting (from `_rivet:sites`), toggle setting; Doctor command; status bar "Rivet: resume | dom | off" for the active file.
  - Phase 4: starts `@rivetjs/language-server` when TS Native Preview is active (plugin can't load) or `rivet.server.mode = "lsp"`.
- `libs/language-server` (`@rivetjs/language-server`, Phase 4): `vscode-languageserver` over stdio; diagnostics, inlay hints, hover, code actions, route completions from core; no type-aware checks.
- `rivet check` CLI (bin in `@rivetjs/compiler` or core): globs tsconfig files, runs `check`, prints `file:line:col RVxxxx message`, exit 1 on errors; nx target `rivet-check` per app/lib.

## Features by phase
- **Phase 0 — setup (config only)**
  - tsconfig includes, root catch-all tsconfig, playground `.rivet` include, committed `.vscode/{settings,extensions}.json`, `tsconfig-coverage` guard, short "Editor setup" doc section (VS Code / WebStorm / Neovim).
- **Phase 1 — MVP: compiler diagnostics in the editor**
  - Compiler: codes, spans, severity, `check` op (both targets, resume per manifest).
  - Vite plugins write `.rivet/editor.json`.
  - Core + tsserver plugin: diagnostics only, debounced; dedupe vs TS (drop compiler parse errors when TS reports syntax errors on same span).
  - Quick fixes (compiler-provided `fix` where mechanical):
    - namespace/aliased helper import → named import from the defining module (`@rivetjs/runtime/dom`).
    - re-exported helper → import from the source module.
    - invalid `preload` literal → replace with nearest valid value; completion of the 5 values.
    - void element with children → self-close / drop children; textarea `model` + children → drop children.
    - browser global read in server render → wrap statement in `clientEffect(() => { … })` (+ import) or move into handler.
    - ref callback not assigning a local → rewrite to `ref={(el) => (local = el)}` with declared `let local!: T`.
    - capture-phase handler in resume → switch to bubbling `onX` or `clientEvent(el, type, fn, { capture: true })` (verify supported).
  - VS Code extension shell + Doctor; `rivet check` CLI + nx target.
- **Phase 2 — resume boundary hints**
  - Inlay hint after resumable closure params: `client · captures count, titles` (kind label: event/effect/clientEvent/computed/fn/model/ref).
  - Hover on handler/effect: symbol id (`src/resume-demo.tsx#ResumeDemo$0`), kind, captures with serialized form (signal → state entry, Map/Set/Date/URL, plain JSON, symbol ref), chunk group + preload strategy with precedence source (element directive > module `preload` / `<ChunkGroup preload>` > vite rules > automatic).
  - Hover on a captured variable: "serialized into resume state (via `X$n`)".
  - Region tinting (VS Code only, via protocol handler): component body = server only (resume mode doesn't run it in browser), render regions/binds = both, handlers/effects/clientEvent/clientOnly importer = client.
  - Type-aware non-serializable capture warning (RV2101) + fix "move creation into the closure".
  - `jsx-runtime.ts` ↔ compiler allowlist parity test (or generate intrinsic attr/event lists from Rust tables) to remove type drift.
- **Phase 3 — file routes**
  - Core runs router scanner; writes `.rivet/routes.d.ts` (types only, no other codegen) on route add/remove/rename when no dev server owns `.rivet/` (lock file / mtime check).
  - Type-level (works without plugin, TS 5–7): generated `RoutePath` template-literal union (`"/" | "/items/${string}"`), `RouteData` (from `.server.ts` loader return via `Awaited<ReturnType<typeof import(…).load>>`), typed `href(id, params)` in `@rivetjs/router`, `Page<"items/[id]">` = `PageProps<RouteData[id], RouteParams[id]>`.
  - `<a href>` stays `string`; plugin adds: completion of route paths inside `href="/…"`, route ids in `href("…")`, opt-in warning RV3101 for literal internal href matching no route, go-to-def from href/route id → route file, hover with route file + params.
  - Quick fix in a route file: "type props from route" → insert `Page<"<id>">` / `LayoutProps<…>`.
- **Phase 4 — TS 7 / any-editor LSP**
  - `@rivetjs/language-server` from core; VS Code extension switches to it under TS Native Preview; docs for Neovim/Zed/Helix config.
  - Revisit type-aware checks once tsgo exposes an extension/API surface.
- **Later**: i18n key completion/hover/go-to-catalog (per i18n spec, typed keys come from generated types first); image import hints (per images spec).

## Packaging / publishing
- New workspace packages: `libs/language-core` (`@rivetjs/language-core`), `libs/typescript-plugin` (`@rivetjs/typescript-plugin`), `libs/language-server` (`@rivetjs/language-server`, Phase 4), `apps/vscode` (extension `rivetjs.rivet`). Nx projects with `build`, `test`, `package` targets.
- Bundling: esbuild (already a compiler devDep) → single CJS file per host (tsserver loads plugins via `require`; can't run the repo's `.ts`-source exports); copy `rivet_compiler.wasm` beside it, load with `readFileSync(join(__dirname, …))`.
- Version lock: plugin bundles its own compiler WASM but prefers the workspace `@rivetjs/compiler` when resolvable and versions match → editor and build agree; mismatch → Doctor warning.
- WebStorm / other editors: add `"plugins": [{ "name": "@rivetjs/typescript-plugin" }]` to `tsconfig.base.json` (ignored by `tsc`; requires workspace TS).
- VS Code: VSIX built by `nx run vscode:package` (`@vscode/vsce`); publish to Marketplace + Open VSX once packages leave `private: true` / `0.0.0-experimental`; until then local VSIX install documented.
- Extension size: WASM ~2.6 MB; one copy shared by plugin and server folders in the VSIX.

## Testing
- Compiler (Rust + `libs/compiler/tests`): every diagnostic code has a fixture asserting code, severity, exact `start/end`; `fix` edits applied → recompile clean; `check` ≡ union of `compile` server+dom diagnostics (property test over oracle corpus `oracle/corpus.jsonl`); compiled output byte-identical before/after (parity gate `npm run parity`).
- Core: unit tests over fixture projects (playground, router fixtures) — manifest loading, resume membership, route model, dedupe, caching.
- tsserver plugin: in-process `ts.server.ProjectService` harness, fourslash-style fixtures with `/*m*/` markers: diagnostics, fixes, inlay hints, hovers, completions; TS version matrix 5.9 (repo pin) + 6.x.
- LSP (Phase 4): stdio client tests (initialize → didOpen → publishDiagnostics/inlayHint/codeAction).
- VS Code: `@vscode/test-electron` smoke — open `apps/playground/src/resume-demo.tsx`, assert Rivet diagnostic on an injected spread attr, Doctor detects a deliberately orphaned TSX.
- Setup guard: `tsconfig-coverage` in CI; regression test reproducing TS17004 (orphan `.tsx` → inferred project) fails before Phase 0, passes after.
- Perf budgets: `check` p95 < 5 ms per playground file, plugin adds < 10 ms to `getSemanticDiagnostics`, < 20 MB RSS; measured in a bench script like `playground:latency`.

## Open questions (with recommended answers)
1. **MVP host: tsserver plugin vs standalone LSP?** Options: (a) plugin first, (b) LSP first, (c) both at once. **Rec: (a)** — repo is on TS 5.9; plugin reaches VS Code + WebStorm + ts-ls editors today and has the checker; core keeps (b) cheap later.
2. **Compiler diagnostic shape.** Options: (a) keep `line/column`, map in core heuristically; (b) add `code`/`start`/`end`/`severity`/`fix` in Rust. **Rec: (b)**, additive; Vite overlay keeps `line/column`.
3. **How does the editor know a file is resume-compiled?** Options: (a) evaluate `vite.config.ts`; (b) manifest `.rivet/editor.json` written by Vite plugins; (c) heuristic (imports `clientEffect`/`clientEvent`). **Rec: (b)**, fallback non-resume checks + Doctor hint; never execute user config in tsserver.
4. **Typed `<a href>`.** Options: (a) narrow `href` to route union (breaks external links / `mailto:`); (b) `string` + typed `href()` helper + plugin completion/warning; (c) `<Link to>` component. **Rec: (b)**; (c) only if the router wants a component anyway.
5. **`routes.d.ts` without a running dev server.** Options: (a) require `vite dev`/build; (b) language service runs types-only codegen; (c) commit `routes.d.ts`. **Rec: (b)** with a lock so it never fights the dev server; also include `.rivet/**/*` in app tsconfigs.
6. **TS17004 fix shape.** Options: (a) per-package includes only; (b) root catch-all `tsconfig.json`; (c) solution-style root with references. **Rec: (a) + (b)**; (c) needs `composite` everywhere and doesn't help editor ownership more than ancestor search (TS ≥ 5.6).
7. **TS 7 plan.** Options: (a) wait for tsgo plugin API; (b) LSP sidecar; (c) fork/patch tsgo. **Rec: (b)** in Phase 4, type-level features meanwhile; (c) never.
8. **Which targets does the editor check?** Options: (a) server only; (b) dom only; (c) both via `check` op. **Rec: (c)** — browser-global and `clientOnly` erasure rules are server-only; DOM-only rules exist too.
9. **Severity of compiler errors in editor.** Options: error vs warning. **Rec: error** (they fail the build); new type-aware checks (RV2101, RV3101) start as warnings.
10. **Region tinting.** Options: (a) VS Code decorations via protocol handler; (b) semantic tokens (TS plugin can't add token types); (c) skip, inlay hints only. **Rec: (a)** behind a setting, default off; inlay hints + hover are the portable baseline.
11. **Volar.** **Rec: no** unless Rivet introduces a non-TSX file format.
12. **Tailwind.** Options: (a) own class completion; (b) official extension. **Rec: (b)**; document `tailwindCSS.classFunctions` if a `cx()`-style helper appears.
13. **Publishing timing.** **Rec:** local VSIX + workspace plugin while packages are `private`; Marketplace/Open VSX together with first public npm release.


## Decisions — open questions resolved (user, 2026-10-03)
Unpicked questions take the recommended answer.
- language-service-1 · First editor host: TypeScript plugin first — Works today in VS Code, WebStorm and other TS editors with the checker included; standalone server added later cheaply.
- language-service-2 · Compiler error format: Add code, start/end, severity, fix — Additive change in the compiler; precise underlines and quick fixes.
- language-service-3 · Detecting resume-compiled files: Manifest file written by Vite — Vite plugins write .rivet/editor.json; editor falls back to basic checks plus a hint when missing.
- language-service-4 · Typed link hrefs: Dedicated typed `<Link>` component (user note: "<Link /> element, allows us to control prefetch and else"). Same component as route-transitions Q10: one `<Link to>` handling typed routes, prefetch, transitions, pending.
- language-service-5 · Route types without dev server: Require running vite dev/build — Simplest, but types are missing or stale until you run it. (user pick; recommended was a)
- language-service-6 · JSX flag error fix: Per-package includes + root catch-all — Each package lists its files and a root config catches the rest; works with TS 5.6+ editor lookup.
- language-service-7 · TypeScript 7 plan: Separate language server alongside — Built in phase 4; type-level features keep working meanwhile.
- language-service-8 · Which targets to check: Both server and browser — Catches every rule; slightly more work per check.
- language-service-9 · Editor error severity: Errors (new checks start as warnings) — Matches the build failing; new checks like RV2101/RV3101 begin as warnings.
- language-service-10 · Server/client region tinting: VS Code highlights, off by default — Optional tinting via a protocol handler; inline hints and hover are the portable baseline.
- language-service-11 · Use Volar framework: No, unless a new file format appears — Plain TSX does not need it; avoids an extra layer.
- language-service-12 · Tailwind class completion: Use official Tailwind extension — No work; document settings if a cx()-style helper is added.
- language-service-13 · Publishing timing: Local install now, stores at npm release — Local VSIX + workspace plugin until first public npm release, then Marketplace and Open VSX together.
