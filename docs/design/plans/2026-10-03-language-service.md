# Language service (editor tooling) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [x]`) syntax.

**Goal:** compiler errors in the editor while typing (same text, exact range), quick fixes, resume-boundary inlay hints / hover, type-aware serializability warning, route features keyed off `<Link to>` — delivered as a tsserver plugin over an editor-agnostic core, plus `rivet check` CLI and a thin VS Code extension shell.

**Spec:** [docs/design/specs/2026-10-03-language-service-design.md](../specs/2026-10-03-language-service-design.md). Decisions: Q1 plugin first; Q2 rich diagnostics; Q3 `.rivet/editor.json`; Q4 `<Link to>` (built by route-transitions agent, not here); Q5 route types only after `vite dev`/build (editor never generates); Q8 both targets; Q9 errors, new checks warnings; Q10 tinting via protocol handler, off by default.

**Tech:** Rust/oxc compiler (WASM, Docker build with `rivet-ls-*` volumes), TypeScript 5.9.3 LanguageService API, esbuild 0.28.2 (CJS bundles), node:test.

## Global constraints

- Compiled output byte-identical: `compile` op JSON unchanged (oracle compares diagnostics exactly) → rich fields only on the new `check` op. Gates: runtime hashes, ssr-bench lanes, oracle 227/227, `npm run typecheck`, full nx test.
- `apps/playground/tsconfig.json`, `apps/playground/src/routes/_layout.tsx` untouched (user edits) → `.rivet/*.d.ts` reach app projects through plugin `getExternalFiles` instead of tsconfig include.
- Apps without resume/router: no new files written; plugin inert on projects without `jsxImportSource: "@rivetjs/runtime"`.

## Decisions (spec vs code)

- **Codes by message family, assigned in one table** (`diagnostics.rs::classify`), not at 80+ call sites; unknown → `RV9000`.
- **Fixes computed in language-core over the TS AST** from compiler spans (not Rust): same editor-agnostic core, simpler, testable. Compiler supplies code + span only.
- **`check` op** = per target: parse + analysis + JSX visit, no render/strip/codegen; sites returned even when diagnostics exist; targets merged and deduped.
- **Link (Q4):** generic hook — JSX element `Link` imported from configured modules (default `@rivetjs/router`, `@rivetjs/router/client`), literal `to`. When TS already narrows `to` (route union present) the plugin adds nothing (TS reports bad links); when `to` is plain `string`, plugin warns RV3101 on unknown routes and completes route paths. Go-to-definition / hover always. Routes come from `.rivet/editor.json` (`routes`), written by `rivetRouter`.
- **RV2101 callables skipped:** captured function values may be symbol functions or signals at runtime (statically indistinguishable); ref cells and local-function captures skipped (compiler marks capture kind).
- **VS Code extension:** shell only (plugin contribution, Doctor + status bar); no VS Code available → untested; VSIX packaging deferred.
- **Phase 4 (standalone LSP), region-tint decorations UI, i18n tables in editor:** deferred.

## File map

| File | Responsibility |
| --- | --- |
| `libs/compiler/rust/src/diagnostics.rs` | Code/severity table; byte→UTF-16 offsets |
| `libs/compiler/rust/src/compile.rs` | `Diagnostic` gains spans; `Options.check` early return with sites |
| `libs/compiler/rust/src/resume.rs` | `Site` anchor/closure spans, capture decl spans + kinds |
| `libs/compiler/rust/src/lib.rs` | `check` op (both targets, merged) |
| `libs/compiler/index.ts` | `check()` + `CheckResult` types |
| `libs/compiler/editor.ts` | `updateEditorManifest(root, patch)` (`.rivet/editor.json`) |
| `libs/compiler/vite.ts` | writes `resumeModules` when `resume` is configured |
| `libs/router/build/vite.ts` | writes `routesDir` + `routes` |
| `libs/language-core/*` | `createCore` (manifest, check cache, sites), fixes, routes matcher, serializability, `rivet check` CLI |
| `libs/typescript-plugin/*` | tsserver plugin + esbuild CJS bundle with WASM |
| `apps/vscode/*` | extension shell |

## Tasks

### Task 1: rich diagnostics + `check` op (Rust)
- [x] Test first (`libs/compiler/tests/check.test.ts`): spread attr → `{code:"RV1001", severity:"error", start,end}` covering `{...p}`; parse error has span; browser global (server-only) + DOM-only rules merged/deduped; resume sites with closure/anchor spans, captures `{name,start,end,kind}`, `runsOn`; non-ASCII source → UTF-16 offsets; `compile` JSON unchanged.
- [x] `diagnostics.rs` classify; `Diags::add` records byte spans; parse errors take oxc label span.
- [x] `Options.check`; `check` op in lib.rs; `check()` in index.ts.
- [x] Build WASM (scratchpad build.sh, own volumes); oracle 227/227; compiler tests.

### Task 2: editor manifest
- [x] Test: `rivet({resume})` configResolved writes `.rivet/editor.json` (`resumeModules`), merge keeps other keys, no write when unchanged / no resume; router writes `routes` (`id`, `pattern`, `file`).
- [x] `libs/compiler/editor.ts`, hooks in both Vite plugins.

### Task 3: language-core
- [x] Tests: manifest lookup (nearest `.rivet/editor.json` upwards; mtime cache), resume membership, check cache, dedupe-ready output, route matcher (params, optional, splat, query/hash), fixes (preload nearest value, void self-close, textarea drop children, browser global → `clientEffect` wrap + import, capture handler → bubbling, ref callback rewrite), serializability classifier over a real ts Program.
- [x] Implement `libs/language-core/{index,compiler,manifest,routes,fixes,serializable}.ts`.

### Task 4: tsserver plugin
- [x] Harness: real `ts.createLanguageService` over fixture app (`libs/typescript-plugin/tests/fixture`), plugin `create(info)` applied.
- [x] Tests: diagnostics (source `rivet`, exact span, category), dropped parse errors when TS has syntax errors, inert without Rivet `jsxImportSource`, code fixes, supported codes not colliding with TS fixes, inlay hints, quick info on handler + captured variable, `preload` completions, Link: RV3101 / completions / definition / hover / no-op when narrowed, RV2101 warning, `_rivet:sites` handler, `getExternalFiles` adds `.rivet/*.d.ts`.
- [x] esbuild CJS bundle (`dist/index.js` + wasm; prefers workspace compiler wasm when it answers `check`); e2e test loads the bundle through `ts.server.ProjectService` plugin probing.

### Task 5: `rivet check` CLI + nx targets
- [x] Test: CLI over a fixture prints `file:line:col RVxxxx message`, exit 1 on errors, 0 clean; includes RV2101 warnings (non-failing).
- [x] `libs/language-core/cli.ts`; nx `rivet-check` target on playground; root `package.json` script.

### Task 6: VS Code extension shell + docs
- [x] `apps/vscode` manifest (`typescriptServerPlugins`, `enableForWorkspaceTypeScriptVersions`), Doctor command logic in core (`doctor()` tested), build target bundling plugin into the extension.
- [x] `.vscode/extensions.json` recommends `rivetjs.rivet`; `tsconfig.base.json` plugin entry (WebStorm / ts-ls); docs `docs/guides/editor.md`.

### Task 7: gates
- [x] runtime hashes, lanes, oracle, typecheck, full nx test.

## Implementation notes

- tsserver codes: `70000 + n` for `RVn` (bare `n` collided with TypeScript fixes, e.g. 1009); a test pins that TypeScript uses no 7xxxx code.
- `check` sites `runsOn`: client = event / effect / clientEvent / ref; computeds, local functions, bindings, regions = both.
- `preload` directive typed in `jsx-runtime.ts` (was an excess-property error in TypeScript); RV1102 dropped when TypeScript reports the same literal.
- Link checks and per-file analysis live in core (`links.ts`, `analyzeFile`) so `rivet check` matches the editor.
- Deferred: standalone LSP (phase 4), VSIX packaging/publishing, jsx-runtime ↔ compiler allowlist parity test, "move creation into the closure" fix for RV2101, i18n tables in the manifest, `@vscode/test-electron` smoke (no VS Code here).
