# templates/ — starter templates

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Self-contained user-facing starters; `create-rivet` (`libs/create-rivet`) copies them (bundled into its package at package time) — single source of truth. Outside the npm workspaces: each `package.json` depends on published `@rivetjs/*` (`experimental` tag) so they work from StackBlitz / `npm install`; inside the repo they resolve the workspace packages through the root `node_modules`.

## Layout

| Template | Mode | Files |
| --- | --- | --- |
| `starter-static` | `rivetRouter({ mode: "static" })`, Tailwind, `_layout.tsx` + `index.tsx` + `about.tsx`, `components/Counter.tsx` (resumes via `resume.appModules`). `prerender.js` (`prerenderBuild` → `dist/client/**/index.html`), `serve.js` preview. | its `src/styles.css` styles docs examples without their own; size-report stages docs examples on it |
| `starter-server` | Node server: `index.tsx` with `load(…)` + `actions(…)`, `serve.js` (`start` from `@rivetjs/router/node`, `PORT`/`HOST`), `Dockerfile` (node:24-slim, two stages; `npm ci` with the user's lockfile else `npm install`, runtime stage `npm ci --omit=dev` against the build stage's lockfile), `.dockerignore` (host `node_modules`/`dist`/`.rivet` never reach the Linux image). | |
| `starter-minimal` | One route, one signal, no Tailwind; `prerender.js`. | |
| `starter-ui` | `starter-static` layout with `@rivetjs/ui`: Tailwind v4 + `@import "@rivetjs/ui/styles"` (Rivet brand theme, the only shipped theme; README + styles.css point at `@rivetjs/ui/theme` presets for other looks), `index.tsx` (Card + Avatar + Chip + lucide `Icon` via `@rivetjs/kit/icon`), `components/LikeButton.tsx` (ui `Button` `onPress` + signal, resumes). Deps add `@rivetjs/ui`, `@rivetjs/kit`, `lucide` (ui peer). `prerender.js`, `serve.js` preview. | size-report app `starter-ui` (route `/` + one Like click) |

Each: `README.md` (commands + Next steps (edit, add a page, deploy, docs pages) + Tooling section), `package.json` (`engines.node >=24`; `dev` = vite, `build` = `vite build && vite build --ssr [&& node prerender.js]`, `check` = `rivet sync && rivet-check` (sync: router bin, fresh clones have no `.rivet/`); devDeps `@rivetjs/compiler`, `devtools`, `language-core` (`rivet-check` bin), `typescript-plugin`, `@types/node` `^24` (= `engines`; `tsconfig` `types: ["node"]` must not rely on the repo root's copy)), `tsconfig.json` (same options as `tsconfig.base.json` incl. `noUncheckedSideEffectImports: false` (TS 6+ default true = TS2882 on CSS side-effect imports), `plugins: [@rivetjs/typescript-plugin]`, includes `.rivet/routes.d.ts`), `vite.config.ts`, `src/document.ts` (`headTags({ ...input.head, title: … }, input)`: the whole route head incl. `scripts`, plus `input`'s styles, nonce and kit `managed` marks — passing only title / meta / links silently dropped route `head.scripts`), `src/routes/`, `.gitignore` (`node_modules`, `dist`, `.rivet`).

## Consumers (keep them working)

- `apps/docs/tests/templates.test.ts` (vitest project `docs`; `TEMPLATES` lists all four): runs every template's `build` and `check` script steps in-repo (`vite …`, `node …` or a root `node_modules/.bin` package bin), `tsc -p` per template, `start` (server, `PORT=0`), `preview` (static) and `dev` (minimal) with HTTP requests.
- `libs/docs-kit/tools/content/generate.ts`: lists `templates/*` as "starters" for the docs sites ("Try in browser"/StackBlitz, `src/generated/starters.ts`); markdown that names an unknown starter fails the docs build.
- `libs/docs-kit/tools/examples.ts`: docs examples are pages of the docs apps (not builds of a starter); `starter-static/src/styles.css` is the stylesheet of examples without their own. `scripts/size-report.mjs` stages some docs examples on `starter-static` / `starter-server`.
- `libs/create-rivet`: `TEMPLATES` (`index.ts`) maps CLI ids (`static`, `server`, `ui`, `minimal`) → folders; `bundle.ts` copies them into the package (`.gitignore` → `_gitignore`; skips `node_modules`, `dist`, `.rivet`, `.stackblitzrc`); `createProject` rewrites every `@rivetjs/*` spec to the release version + writes `name`. A new template = a folder here + a `TEMPLATES` row + `scripts/package/create-e2e.ts` `E2E_TEMPLATES` + `smoke.ts` `TEMPLATES` + the docs table (`apps/docs/content/start/quick-start.md`).
- `libs/nx` (`@rivetjs/nx`): `application` generator writes a starter through create-rivet `templateFiles` + `rewriteManifest` (`utils/starter.ts`), removes npm scripts (Nx targets replace them), adds its own vitest config + tests per starter (`generators/application/files/tests/<template>/`); `utils/versions.ts` `toolVersion` reads tool ranges from `templates/*/package.json`. A new template = also an `application` `template` enum value + its test files; `libs/nx/tests/e2e.test.ts` builds the static + server starters through Nx.
- `scripts/package/create-e2e.ts` (vitest `scripts`, `create-rivet-e2e.test.ts`): creates every template from the packed create-rivet, installs from tarballs, builds, serves, fetches `/`. `scripts/package/smoke.ts` builds every template against the packed packages.
- `scripts/size-report.mjs`: stages the static, server, minimal and ui starters and records their shipped bytes in `scripts/size-report/baseline.json` — any byte growth fails `--check`.

## Rules

- Keep the templates minimal and idiomatic: they are what new users copy. Any API change in router/runtime/kit that affects them is incomplete until the templates, their READMEs and the size baseline are updated.
- Icons: no invented SVG paths, no UTF glyphs as icons — use lucide if a template ever needs an icon.
- Dependencies stay on published versions (`experimental`); never point them at workspace paths (create-rivet rewrites any `@rivetjs/*` spec anyway).
- `.gitignore` is renamed `_gitignore` in the create-rivet package (npm never packs `.gitignore`); keep using `.gitignore` here.
- Deploy targets: `create-rivet --deploy <target>` edits a starter in place (`libs/create-rivet/deploy.ts`: `adapter` added to the `rivetRouter({ … })` call in `vite.config.ts` — keep exactly one such call per template —, `.gitignore`, platform files / scripts; `@rivetjs/nx` `application --deploy` applies the same overlay). Static overlay files, if ever needed, live in `templates/_<name>/` folders (underscore: the docs starter list skips them), not inside a starter.
- Don't commit `dist/`, `.rivet/`, `node_modules/` (per-template `.gitignore`).
- AI instruction files are generated (never hand-edit): `AGENTS.md` + `CLAUDE.md` (same text), `.github/copilot-instructions.md`, `.cursor/rules/rivet*.mdc`, `.agents/skills/rivet-*/` (Codex/Cursor) and `.claude/skills/rivet-*/` (Claude Code) in every starter come from `libs/mcp/ai` (`node libs/mcp/ai/sync.ts`; CI `--check`). Skill bundles include references and MIT `LICENSE.txt`; `rivet-ui-design` covers UI/CDK design and works without MCP. A new starter gets them on the next sync. create-rivet copies complete bundles like any files (tests `libs/create-rivet/tests/ai-files.test.ts`).

## Commands

- Build one in-repo: `cd templates/starter-static && node ../../node_modules/vite/bin/vite.js build && node ../../node_modules/vite/bin/vite.js build --ssr && node prerender.js`
- Create from a template in-repo: `node libs/create-rivet/cli.ts <dir> --template <id> --no-install --no-git` (resolves the workspace packages when `<dir>` is inside the repo).
- Gate: `NX_DAEMON=false npx nx run docs:test` (includes `templates.test.ts`); `npx vitest run --project scripts scripts/tests/create-rivet-e2e.test.ts`; `npm run size-report -- --check --apps=starter-static,starter-server,starter-minimal,starter-ui --no-lanes`.

## See also

`templates/README.md` (human intro) · `libs/router/CLAUDE.md` (static/node adapters) · `libs/docs-kit/CLAUDE.md` · `scripts/CLAUDE.md`.
