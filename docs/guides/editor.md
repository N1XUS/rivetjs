# Editor tooling

Rivet TSX is plain TypeScript JSX: TypeScript already gives types, completions, rename and go-to-definition. The Rivet layer adds what only the compiler knows, as a TypeScript language service plugin (`@rivetjs/typescript-plugin`) over an editor-agnostic core (`@rivetjs/language-core`), plus `rivet check` for CI.

Design: [superpowers/specs/2026-10-03-language-service-design.md](../design/specs/2026-10-03-language-service-design.md).

## Setup

- Build the plugin once (and after compiler changes): `NX_DAEMON=false npx nx run typescript-plugin:build` → `libs/typescript-plugin/dist/{index.cjs,rivet_compiler.wasm}`.
- `tsconfig.base.json` lists the plugin (`compilerOptions.plugins`); `tsc` ignores it, editors load it with the **workspace TypeScript**.
- VS Code
  - Workspace TypeScript: `.vscode/settings.json` sets `typescript.tsdk`; accept the prompt or run "TypeScript: Select TypeScript Version" → "Use Workspace Version".
  - Or the extension shell (works with bundled TypeScript too): `NX_DAEMON=false npx nx run vscode:build`, then `code --extensionDevelopmentPath=apps/vscode/dist/extension <folder>`. Adds Rivet: Doctor, status bar `Rivet: resume | dom | off`, settings `rivet.inlayHints` (`client` | `all` | `off`), `rivet.typeAware`, `rivet.regions` (tinting, off by default). VSIX packaging / Marketplace: not yet (private packages).
- WebStorm: Settings → TypeScript → use the project's `node_modules/typescript`; the tsconfig plugin entry loads.
- Neovim / Zed / Helix: typescript-language-server or vtsls with the workspace `tsdk`; tsconfig plugins load automatically.
- Tailwind classes: official Tailwind CSS IntelliSense (recommended in `.vscode/extensions.json`).
- "Cannot use JSX unless the '--jsx' flag is provided": the file belongs to no tsconfig. Package tsconfigs include their TSX; the root `tsconfig.json` catches the rest (TypeScript ≥ 5.6). `npm run typecheck` runs `scripts/check-tsx-projects.ts` as a guard. Rivet: Doctor reports it.

## What the editor needs from Vite

- `.rivet/editor.json` (gitignored), written by `rivet({ resume })` (resume modules, preload rules) and `rivetRouter()` (route ids, patterns, page files) whenever `vite` / `vite build` resolves its config — or without a dev server / build: `rivet sync [--root dir] [--config file] [--mode mode]` (router bin; resolves the Vite config, regenerates `.rivet/`). Unchanged content only bumps the mtime (staleness clock for RV7102 / Doctor). Templates: `"check": "rivet sync && rivet-check"`; apps' nx `typecheck` / `rivet-check` depend on a `sync` target.
- Without it: compiler checks run in plain (non-resume) mode; no route features; Doctor says so.
- Route types (`.rivet/routes.d.ts`) also exist only after `vite` / `vite build` (decision: the editor never generates them). The plugin adds `.rivet/*.d.ts` to the app's project, so `RouteParams` (and the router's route-path union, when it ships) type-check in the editor even though app tsconfigs do not include `.rivet/`.

## Features

- Compiler diagnostics while typing: same text as the build, exact range, both targets (server + DOM), resume mode per manifest. tsserver code = `70000 + n` for `RVn` (source `rivet`); TypeScript's own syntax errors win over compiler parse errors.
- Quick fixes: `preload` value → nearest valid; void element / textarea-with-model children → self-close; browser global in server render → wrap in `clientEffect(() => { … })` (+ import); `ns.Helper` → named import; bind-once handler (RV1016) → `(event) => (…)?.(event)`; signal self-write in an effect (RV1017) → `x.update((v) => …)`.
- Resume boundary: inlay hint at each browser-only closure (`client · count, step`; VS Code: native provider from `_rivet:sites` labels, other editors: tsserver `provideInlayHints`); hover on `onClick` / `clientEffect` / a local function shows the site id, where it runs and its captures; hover on a captured variable names the resumable code capturing it.
- Signal self-writes (RV1017, warning, `libs/language-core/self-write.ts`): `x.set(<expr reading x()>)` in the inline, non-async function of `effect` / `computed` (`@rivetjs/reactivity`) or `clientEffect` (`@rivetjs/runtime/dom`), also through `batch(() => …)`; the receiver must type as the reactivity `Signal`. Silent elsewhere (handlers, callbacks, `untrack`, JSX, component bodies: components run untracked). Editor + `rivet check` only (`.tsx` / `.jsx`); the build does not report it.
- Links: `<Link to="…">` from `@rivetjs/router` / `@rivetjs/router/client` / `@rivetjs/router/link` (plugin option `linkModules`).
  - `to` typed as a route union (generated): TypeScript checks and completes; the plugin adds go-to-route-file and hover only.
  - `to` typed `string`: plugin completes route paths, warns RV3101 for literal internal paths that match no route, plus go-to-route-file and hover (route id, file, params).
- `preload="…"` on elements is typed (`eager | idle | visible | intent | interaction`), so TypeScript completes and checks it.

## `rivet check`

- `node libs/language-core/cli.ts [-p tsconfig.json|dir]... [--no-types] [--no-manifest] [--format text|json]` (bin `rivet-check`; `--help` / `-h` prints usage; `-p <dir>` = `<dir>/tsconfig.json`; solution configs follow `references`); `npm run rivet:check` runs every `rivet-check` nx target (playground).
- Text output per diagnostic: header `file:line:col - error|warning RVxxxx: message`, then a code frame, `  fix: <explain.json fix>` and `  docs: <url>` (`@rivetjs/compiler/format`); plus `rivet check: skipped <tsconfig> (<reason>)` for projects not checked (unreadable tsconfig, other `jsxImportSource`, no Rivet files).
- `--format json`: one object `{ files, errors, warnings, skipped: [{ config, reason }], diagnostics: [{ …diagnostic, file, docs, fix }] }`.
- Exit codes: `0` clean / warnings only, `1` errors, `2` usage or setup error (unknown flag, bad `--format`, compiler wasm not found, missing / unparsable tsconfig); in JSON mode setup errors print `{ "error": "…" }`.
- Manifest check (off with `--no-manifest`): each Vite app root reached (nearest `vite.config.*` above a checked file) without `.rivet/editor.json` → RV7101 error; `vite.config.*` or a routes directory newer than it → RV7102 warning. Fix: `rivet sync`.
- Every diagnostic carries a `docs` URL (`docsUrl(code)` from `@rivetjs/compiler/codes`); Vite build errors print `[RVxxxx] file:line:col: message` with the same URL as `url`.

## Codes

Public reference: one page per code at `/errors/RVxxxx` on the framework docs site (`apps/docs/content/errors/`, generated from `libs/compiler/codes.json` + `libs/language-core/explain.json` by docs-kit `tools/errors.ts`). Internal summary:

| Code | Meaning |
| --- | --- |
| RV1000 | Parse error |
| RV1002 | Spread children (RV1001 spread attributes: retired, spreads compile) |
| RV1003 / RV1004 | Namespaced / unsupported native tag |
| RV1005 / RV1006 | Parser-repaired nesting / text in table structure |
| RV1007 | `<script>` / `<style>` content |
| RV1008 / RV1009 / RV1010 | Void element children / textarea model + children / textarea-title non-scalar children |
| RV1011 / RV1012 / RV1013 | Unsupported model binding / unknown event / global event attribute |
| RV1014 | Retired (live props, 2026-10-07): `<For each={xs()}>` / `<Show when={c()}>` / `<Match when={c()}>` are getters and update |
| RV1015 | Event handler is a literal (`onClick="go()"`, `onClick={1}`): never callable — pass a function |
| RV1016 | Event handler reads state when it binds (`onClick={s() ? a : b}`, `onClick={getHandler()}`): handlers bind once (`f.bind(…)`, function literals, identifiers, member reads, call-free conditionals compile); quick fix wraps it as `(event) => (…)?.(event)` |
| RV1017 | Signal written from its own read in an effect / computed (`effect(() => x.set(x() + 1))`): the read subscribes the scope to its own write (warning; language service, type-aware); quick fix (effects) → `x.update((v) => v + 1)` |
| RV1101 / RV1102 | Unsafe attribute / `preload` value |
| RV2001 | Browser global read during server rendering (resume) |
| RV1103, RV2002, RV2003, RV2005–RV2016, RV2101, RV2102, RV2105, RV2106 | Retired (M6, 2026-10-22): serialized resume model deleted (captures, refs, `.bind`, module references, resources, lazy rows); RV2004 retired earlier (`onXCapture` resumes) |
| RV2103 / RV2104 | Resume modules (derived model, M2): a boundary's render reads `Date.now()` / `Math.random()` / `performance.now()` / `crypto.randomUUID()` / `new Date()` (error) / keyed state (`signal()` / `createStore()`) created inside a loop (warning; keys are per site, so conditional creation is fine) |
| RV3001–RV3006 | Helper import shape (re-exports, namespaces, aliases, `clientOnly`) |
| RV3007 / RV3008 / RV3009 | Route module server exports shape (`export *`, declarations) / server-only code reaching the browser / server-only code rendering JSX |
| RV3101 | Link matches no route (warning) |
| RV4001–RV4005 | Static calls (i18n): keys, params, arguments, tags, config |
| RV5001 / RV5002 / RV5003 | css`` syntax / css`` usage or unknown class / inline style rules (unsafe value, `style` strings, duplicate `class`) |
| RV6001 / RV6002 / RV6003 / RV6004 | `<slot>` outside a component / `r:name` `r:args` / `r:slot` placement / slot passed twice |
| RV7001 | Invalid compiler option (wrong option type, malformed `resume` / `styles` / `targets`) |
| RV7101 / RV7102 | `.rivet/editor.json` missing / stale (`rivet check`; run `rivet sync`) |
| RV9000 / RV9001 | Unclassified / internal (compiler panic or wasm stack overflow on too-deep nesting; the loader recreates its instance) |

Registry: `libs/compiler/codes.json` (`@rivetjs/compiler/codes`): severity, title, docs URL per code; RV2500–RV2599 reserved for `@rivetjs/runtime`, RV3102–RV3199 for `@rivetjs/router`.

## Limits

- TypeScript 7 (tsgo) loads no JS plugins: a standalone language server over the same core is planned (phase 4); until then use TypeScript 5.x/6.x in the editor.
- This repo: the typecheck gates run tsgo (`scripts/tsc.ts`, `@typescript/native-preview`), the editor stays on the workspace TypeScript 5.9 (`.vscode/settings.json` `typescript.tsdk` = `node_modules/typescript/lib`). Do not enable VS Code's `typescript.experimental.useTsgo` (TypeScript Native Preview): it replaces tsserver, so `@rivetjs/typescript-plugin` (RV diagnostics, quick fixes, resume hints, route links) and the Rivet extension's `_rivet:*` requests (status `off`, no inlay hints / region tinting) go away.
- Why `@typescript/native-preview` and not `typescript@7.x` GA (7.0.2, npm `latest` since 2026-07-08; same diagnostics on all 26 projects): the GA package's bin is `tsc`. Installed beside `typescript@5.9` under an npm alias (`typescript7@npm:typescript@7.0.2`) it relinked `node_modules/.bin/tsc` to TS 7 (a scratch install linked 5.9; npm's bin-clash choice is not deterministic). The preview (frozen 2026-07-07, the 7.0 code one day before GA) ships the bin `tsgo`, so it does not clash. Move to GA when the TS 5.9 API users (language-core, typescript-plugin, `scripts/package/build.ts` d.ts emit, `package/smoke.ts`, `check-tsx-projects.ts`) run on TS 7, or install 7.x outside the root `node_modules`; then point `scripts/tsc.ts` at it.
- Starters and generated libs set `noUncheckedSideEffectImports: false` (TS 6+ default true reports TS2882 on `import "./styles.css"`); repo projects get it from `tsconfig.base.json`.
- i18n static-call tables are not in the manifest: `t()` checks run only in the build.
- Region tinting decorations are VS Code only (protocol request `_rivet:sites`).
