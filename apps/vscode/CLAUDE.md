# @rivetjs/vscode

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

VS Code extension shell around `@rivetjs/typescript-plugin`: contributes the plugin via `typescriptServerPlugins` (runs inside the TS server, bundled or workspace TS), plus Rivet: Doctor, status bar item (`Rivet: resume | dom | off`), plugin settings, optional region tinting. All language logic lives in `libs/language-core`.

## Layout

- `extension.ts` — `activate`/`deactivate`. Talks to the plugin only through `typescript.tsserverRequest` with `_rivet:sites` / `_rivet:doctor`; pushes settings via the TS extension API `configurePlugin`.
- `manifest.json` — the real extension manifest (name `rivet`, publisher `rivetjs`, commands, `rivet.*` settings, activation on TSX/JSX). Staged as `dist/extension/package.json`.
- `package.json` — workspace package `@rivetjs/vscode` (deps for building only; NOT the extension manifest).
- `build.ts` — `buildExtension()`, `extensionDir`: stages `dist/extension/` (unpacked VSIX root): `extension.cjs` (esbuild CJS, `vscode` external), manifest (+ root package.json `repository` when set), root `LICENSE` (manifest `license: "MIT"`; `vsce package` prompts without them), `node_modules/@rivetjs/typescript-plugin/{package.json,dist/index.cjs,dist/rivet_compiler.wasm}` (calls `buildPlugin()` from `../../libs/typescript-plugin/build.ts`).
- `tests/build.test.ts` — builds, asserts manifest contribution, that tsserver-style `require` from the extension root loads the plugin, and the MIT license + LICENSE file.

## Rules / invariants

- Settings/commands live in `manifest.json`; keep them in sync with `extension.ts` (`rivet.inlayHints` `client|all|off`, `rivet.typeAware`, `rivet.regions`, command `rivet.doctor`) and docs/guides/editor.md.
- Inlay hints: native `registerInlayHintsProvider` (tsx/jsx) from `_rivet:sites` `label`s, filtered by `rivet.inlayHints`; the plugin always gets `inlayHints: false` (avoids TS inlay settings gating them and duplicates).
- Plugin id `@rivetjs/typescript-plugin` must match in `manifest.json`, `extension.ts` (`PLUGIN`), and the staged `node_modules` path.
- Extension must work when the plugin doesn't answer (request returns `undefined` → status `off`, Doctor fallback finding).
- UI: status/output text only. If icons are ever added, use codicons / an icon library — never invented SVG paths or UTF symbols as icons (root rule).

## Commands

- Build: `NX_DAEMON=false npx nx run vscode:build` (= `node apps/vscode/build.ts`) → `apps/vscode/dist/extension/`.
- Try it: `code --extensionDevelopmentPath=apps/vscode/dist/extension <app folder>`.
- Test: `npx vitest run --project vscode`. Typecheck: `npx tsc -p apps/vscode`.

## Gotchas

- No VSIX packaging / Marketplace yet (private packages).
- Region tinting (`_rivet:sites` decorations) is VS Code only; refresh is debounced 300 ms on edit/save/editor change.

## See also

- [docs/guides/editor.md](../../docs/guides/editor.md) — setup (workspace TS, WebStorm, Neovim), features.
- [../../libs/typescript-plugin/CLAUDE.md](../../libs/typescript-plugin/CLAUDE.md), [../../libs/language-core/CLAUDE.md](../../libs/language-core/CLAUDE.md).
