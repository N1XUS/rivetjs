# @rivetjs/language-core

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Editor-agnostic Rivet language features over source text + `.rivet/editor.json`: compiler diagnostics, quick fixes, resume sites, routes/links (RV3101, type-aware), Doctor, `rivet check` CLI. Hosts (tsserver plugin `libs/typescript-plugin`, `rivet check`, a future LSP) are thin adapters over this package.

## Stack (editor tooling, bottom → top)

- `libs/compiler` `rivet_compiler.wasm` → `check` op (diagnostics + resume sites), JSON protocol.
- `libs/language-core` (here) → loads the WASM synchronously, adds manifest/routes/TS-checker features. `@rivetjs/compiler` is a **peerDependency** (2026-10-12; dev dependency too, for the workspace): `index.ts` / `explain.ts` / `cli.ts` import `@rivetjs/compiler/codes` / `/format` and `compiler.ts` loads the app's compiler wasm — one compiler per app (every Rivet project has it); `scripts/package/smoke.ts` `REQUIRED_PEERS` checks the dist manifest.
- `libs/typescript-plugin` → tsserver adapter (`dist/index.cjs` bundle + WASM copy).
- `apps/vscode` → VS Code shell: contributes the plugin, Doctor command, status bar, tinting.

## Entry points

- `.` → `index.ts`: `createLanguageCore`, `analyzeFile`, re-exports every module below (`export *`).
- `./cli` → `cli.ts`: `checkProjects`, `format`, `main`; also bin `rivet-check`.
- Source-only package (`"types"`/`"default"` point at `.ts`); no build step.

## Layout (flat: one file per feature; consistent, keep it flat)

- `index.ts` — `LanguageCore` (per-file check cache keyed by text + manifest; LRU `CHECK_CACHE_SIZE` 500),  `analyzeFile` (compiler + RV3010 (route modules: files under the manifest `routesDir`) + RV3101; drops RV1000 when TS has syntax errors; line/column recomputed from `start` via `getLineAndCharacterOfPosition` — UTF-16, matches TS).
- `compiler.ts` — `loadCompiler` (sync WASM instantiate, probes `check` op), `workspaceCompilerWasm`, `findCompiler` (first loadable candidate).
- `manifest.ts` — `ManifestCache` (nearest `.rivet/editor.json`, mtime re-read), `moduleId` (root-relative posix id = resume symbol prefix), `viteRoot(file)` (nearest dir with `vite.config.{ts,mts,cts,js,mjs,cjs}`), `manifestStatus(root)` → `ManifestStatus` (`missing` | `stale` (config or a routes dir newer than editor.json) | `fresh`).
- `sources.ts` — `sourcePackagesOf`: imported packages with `"rivet": { "source": true }` → compiler `sourcePackages` (internal; not re-exported).
- `routes.ts` — `internalPath`, `matchRoute`, `routeCompletion` (router matching rules).
- `links.ts` — `LINK_MODULES`, `linkTargets`, `linkDiagnostics` (RV3101).
- `server-exports.ts` — `MAGIC_SERVER_EXPORTS` (former magic name → wrapper, default export name, message argument), `untaggedMessage`, `isRouteModule(root, routesDir, file)`, `untaggedServerExports` (RV3010, parser-only, same rule + text as the compiler's `server_split.rs` `untagged`: an exported `const`/`let`/function/class or `export { x as onGet }` named `load(…)` … `onOptions(…)` that is not a `const` initialized by a `@rivetjs/router` wrapper call — named imports, aliases, namespace members; type-only imports ignored). The build reports RV3010 through the compiler's `serverExports` pass; the editor compiles without it, so it comes from here. tsserver analyzes `.tsx`/`.jsx` only (`isRivetFile`): plain `.ts` endpoints get RV3010 from the build. Spec `docs/design/specs/2026-10-20-server-exports-design.md`.
- `explain.ts` + `explain.json` — `explainCode(code)` (`RV1016` / `rv1016` / `1016`) → `CodeExplanation` (codes.json entry + emitted `messages`, mechanical `fix`, `avoid` / `prefer` pair, applicable `quickFix`, `note`), `explainedCodes()`, `explanationMarkdown(e)`. One entry per `libs/compiler/codes.json` code (incl. retired); a new code needs one. Served by `@rivetjs/mcp` (`explain_diagnostic`, `check_code` fix lines) and the source of all prose on the docs pages `/errors/RVxxxx` (docs-kit `tools/errors.ts` → committed `apps/docs/content/errors/`: after editing an entry run `node libs/docs-kit/cli.ts errors apps/docs`; CI `errors --check`). Write `fix` / `note` as plain text with code inline (tags, `{…}`, calls become code spans on the page); `avoid` / `prefer` show as Avoid / Prefer fences (`prefer` imports are drift-checked by `check-snippets`, so they must name real exports). `./explain.json` is an export (package build copies it).
- `fixes.ts` — `FIXABLE_CODES`, `codeFixes`, `nodeAt`, `addNamedImport`, `applyEdits`, `preloadSuggestions`, `newLineOf`. Edits keep the file's line ending (CRLF stays), re-indent every line of a moved multi-line statement; RV1016 "Wrap handler in arrow function" → `(event) => (expr)?.(event)` (parameter `event` / `e` / `ev`, whichever the expression does not use). M6 (2026-10-22): the serialized-model fixes are gone with their codes (RV2002 ref, RV2003 / RV2102 `rivetReconstruct`, RV2016 `rivetResourceConst`); `fileChecker` (one-file checker: fresh parse, no lib, no imports) stays for RV3010. RV3010 `rivetWrapServerExport` "Wrap in `load(…)`": `export const serverLoad = init` → `export const loader = load(init)` (default names from `MAGIC_SERVER_EXPORTS`; taken module-scope name → `<name>Export`; `let` → `const`; `: T` → `load((init) satisfies T)`), exported function declaration → arrow (function expression named like the export when it uses `this` / `arguments` / `super`, is a generator or has type parameters), in-file references renamed by symbol (`fileChecker`; shorthand `{ onGet }` → `{ onGet: GET }`), wrapper imported via `addNamedImport` unless already imported (an alias is used as is); a module-scope local named like the wrapper → no fix; `export { x as onGet }` → no fix.
- `doctor.ts` — `doctor(DoctorInput)` → `Finding[]` (incl. `manifest` warning when stale; fix = `rivet sync`), `workspaceTypeScriptVersion`.
- `cli.ts` — `rivet check` (`[-p tsconfig.json|dir]... [--no-types] [--no-manifest] [--format text|json] [--help]`). Exit 0 clean/warnings, 1 errors, 2 usage/setup (`CheckSetupError`: no compiler wasm, missing tsconfig, non-`.json` `-p`, tsconfig `errors` other than 18002/18003; unknown flags). Follows `references` (solution configs: no skipped entry for the empty root). `manifestDiagnostics(roots)` → RV7101 (missing) / RV7102 (stale) per Vite root, first in output (`manifest: false` / `--no-manifest` skips). `CheckRun.skipped` lists projects not checked (unreadable tsconfig, other `jsxImportSource`, no Rivet files) — printed as `rivet check: skipped …`. Text output (DIAG-VERBOSE): tsc-style header `file:l:c - error RVnnnn: message`, then a code frame (`@rivetjs/compiler/format` `codeFrame`, file read from disk), `  fix: <explain.json fix>` and `  docs: <url>` (`remedyLines`). JSON: `{ files, errors, warnings, skipped, diagnostics }`, each diagnostic + `fix` (setup errors `{ error }`).
- `tests/` — `core.test.ts`, `cli.test.ts` (warnings do not fail: RV2104), `cli-setup.test.ts` (setup errors, `-p dir`, references, RV7101/RV7102), `server-exports.test.ts` (RV3010 rule, route-module scope, `analyzeFile`, `rivetWrapServerExport` shapes), `fixes.test.ts` (CRLF, multi-line re-indent, RV1016 handler arrow), `explain.test.ts` (one explanation per registered code; every Avoid emits its code and every Prefer compiles clean on both targets, except i18n / options / project-level codes; compile `warnings` count as triggers); `helpers.ts` (`compiler`, `tempApp` under `.artifacts/`).

## Rules / invariants

- Editor diagnostics must match the build: same compiler WASM (workspace's own first), same resume mode (manifest `resumeModules`), same `sourcePackages` rule as the Vite plugin.
- `ts` is always the host's TypeScript module, passed in (`typeof TS`, type-only import). Never `import ts from "typescript"` outside `cli.ts`; tsserver supplies its own.
- `fixes.ts` uses parser APIs (works on any `SourceFile`); only `rivetReconstruct` / `rivetWrapServerExport` build a one-file checker over a fresh parse of the text (binding resolution, no host program).
- Editor never generates `.rivet/*` files; they come from `vite` / `vite build` / `rivet sync` (`rivet({ resume })`, `rivetRouter()`). Staleness = editor.json mtime (writers bump it even when content is unchanged).
- RV2101 (type-aware capture check) removed with the serialized model (M6, 2026-10-22): captures are not serialized; `analyzeFile` `typeAware` / `rivet check --no-types` now gate the RV3101 route-link checks only. `FileCheck` has no `classes`.
- RV3101 stands down when `to` is typed narrower than `string` (generated route union) — TypeScript owns the check then.
- `rivet check` only checks tsconfigs with `jsxImportSource: "@rivetjs/runtime"` (others reported as skipped); exit 1 on errors only (warnings don't fail).
- Every diagnostic from `analyzeFile` carries `docs` (`docsUrl` from `@rivetjs/compiler/codes`); new language-service codes must be added to `libs/compiler/codes.json` (compiler `tests/codes.test.ts` scans this package for `"RVnnnn"` literals).
- `compiler.ts`: a wasm trap inside `check` (compiler panic) recreates the instance and returns an RV9001 diagnostic instead of killing tsserver.
- New fixable code: add to `FIXABLE_CODES` and a `case` in `codeFixes`; the plugin maps it to tsserver code `70000 + n`.

## Commands

- Test: `npx vitest run --project language-core` (or `NX_DAEMON=false npx nx run language-core:test --output-style=static --skip-nx-cache`).
- Typecheck: `npx tsc -p libs/language-core` (nx target `language-core:typecheck`; stays TypeScript 5.9 tsc — the package is a TS API user, unlike the tsgo targets in `scripts/tsc.ts`).
- Run CLI: `node libs/language-core/cli.ts -p apps/playground/tsconfig.json`; `npm run rivet:check` runs every `rivet-check` nx target.
- Publishable package: `NX_DAEMON=false npx nx run language-core:package` → `dist/libs/language-core` (`.ts` → `.js`, `.tsx` → `.jsx`, `.d.ts`, LICENSE, generated package.json); publish from there — this package.json stays the private workspace manifest (`publishConfig.directory`). Builder + tarball smoke: `scripts/package/` (scripts/CLAUDE.md).

## Gotchas

- Tests load `libs/compiler/rivet_compiler.wasm` (committed). After compiler Rust changes, rebuild it (see `libs/compiler/CLAUDE.md`) or editor/tests see old behaviour; `loadCompiler` throws on a WASM without the `check` op.
- `apps/playground/project.json` (`rivet-check` target) runs `libs/language-core/cli.ts` by path — don't move `cli.ts`.
- `ManifestCache.find` stats every directory level per call (cheap, intended: picks up a manifest written after editor start).
- `sources.ts` cache is process-global and never invalidated (package.json `rivet.source` changes need a restart).

## See also

- [docs/guides/editor.md](../../docs/guides/editor.md) — features, setup, RV code table, limits.
- [docs/design/specs/2026-10-03-language-service-design.md](../../docs/design/specs/2026-10-03-language-service-design.md) — design.
- [../typescript-plugin/CLAUDE.md](../typescript-plugin/CLAUDE.md), [../../apps/vscode/CLAUDE.md](../../apps/vscode/CLAUDE.md).
