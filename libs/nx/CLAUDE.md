# @rivetjs/nx

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Nx plugin (dev tooling, nx 23): generators (`generators.json`), executors (`executors.json`), inferred tasks (`@rivetjs/nx/plugin`, `createNodes` + `createNodesV2` alias), migrations (`migrations.json`). Mirrors @nx/vite conventions: `init` registers the plugin in nx.json, `NX_ADD_PLUGINS=false` / `useInferencePlugins: false` → generators write the same targets into project.json. Nothing in a runtime entry imports it (zero-cost). Deps: `@nx/devkit` (pinned = root `nx`), `create-rivet` (starter files + helpers); peer `nx`.

## Layout

| Path | What |
| --- | --- |
| `index.ts` | `.`: re-exports every generator / executor / migration + `rivetTargets`, `detectProject` (also puts them in the package build's TS program). |
| `plugin.ts` | `./plugin`: `createNodes` = `[CONFIG_GLOB, fn]` (`**/{vite,vitest}.config.{ts,mts,js,mjs}` next to package.json / project.json; vitest config defers to a sibling vite config), `createRivetProject`. |
| `utils/detect.ts` | Text-only detection (`ProjectFacts`: kind `app` (rivetRouter) / `spa` (compiler plugin) / `lib` (rivetTest only), `static` / `csr` (router `mode`), `test`, `tsconfig`, `locales` (i18n.config `locales: [...]`), `adapter` (`rivetRouter({ adapter: "x" | { name: "x" } })`, `routerAdapter`), `serveScript`, `prerenderScript`). Configs are never executed. |
| `utils/facts.ts` | Facts from disk (`projectFacts`) or an Nx Tree (`treeFacts`), `viteConfigPath`. |
| `utils/targets.ts` | `rivetTargets(facts, options, { production })`: the ONE target definition (inference + project.json). Inputs exclude `.rivet/`, `dist/`, `coverage/`, `src/rivet-i18n.d.ts` (build writes `.rivet/` → would bust its own cache); build also excludes tests; `production` named input used when nx.json has one. `build` outputs `{projectRoot}/dist`, `test` `{projectRoot}/coverage`; `dev` / `preview` `continuous`; `preview` dependsOn build. Platform adapter (`facts.adapter`): build outputs + `deployOutputs`; `deploy` (`deployTargetName`, vercel / cloudflare) and `preview` (cloudflare / bun / deno) = `nx:run-commands` `{ command: <create-rivet overlay script>, cwd: "{projectRoot}" }` (run-commands puts `node_modules/.bin` on PATH, like npm scripts); `.vercel/` `.netlify/` `.wrangler/` never inputs. |
| `utils/deploy.ts` | `--deploy` = create-rivet's own overlay (`create-rivet/deploy`): `applyDeploy(tree, root, template, target, project, pkg)` runs `overlay.manifest` on the package.json (scripts dropped) and `overlay.edit` on a scratch copy of the project, mirroring `written` / `removed` into the tree; then `npm run x` → `nx x <project>` in the README Deploy section and netlify.toml `command = "npx nx build <project>"`. `deployScripts(adapter)` (overlay scripts → targets), `deployOutputs(adapter)` (`.vercel/output`, `.netlify/v1`, `.wrangler/deploy`). Never re-implement a deploy edit here: change `libs/create-rivet/deploy.ts`. |
| `utils/starter.ts` | `writeStarter(tree, template, root, name, range)`: create-rivet `templateFiles` + `rewriteManifest` into the tree; `starterFile`. Never copy starter files into this lib. |
| `utils/versions.ts` | `RIVET_NX_VERSION` (own manifest), `rivetRange` (create-rivet `versionRange`), `toolVersion(name)` (ranges from `templates/*/package.json`), `VITEST_VERSION` / `HAPPY_DOM_VERSION` (= `@rivetjs/testing` peers; `tests/manifest.test.ts` pins them). |
| `utils/vite-config.ts` | Text edits: `addImport`, `addPlugin(first/last, idempotent)`, `removePlugin`, `setRouterOption` (top-level `rivetRouter({ … })` keys; throws on non-literal args). |
| `utils/workspace.ts` | `shouldAddPlugin`, `ensureLines` (.gitignore), `workspaceGlobs` / `isWorkspacePackage` / `addToWorkspaces` (npm/yarn/bun `workspaces`, pnpm-workspace.yaml), `offsetTo`. |
| `utils/project.ts` | `rivetProject` / `routedApp` (`--project` resolution), `routeSegments` / `routeParams` / `routeComponentName` / `relativeImport`. |
| `generators/<name>/` | `generator.ts` (default export + named), `schema.json` (every property described), `schema.d.ts`, `files/` (EJS `*.template`, `__var__` names; copied by the package build via `new URL("./files", import.meta.url)`). |
| `executors/<name>/` | `executor.ts` (default export; pure `*Step(s)` normaliser exported for tests), `schema.json` (`additionalProperties: false`), `schema.d.ts`. `executors/run.ts`: `Step` (`node <args>` child, no shell / PATH), `packageDir` / `binPath` (walk up `node_modules` from the project folder, realpath), `flags`, `start` / `runSteps` (SIGINT/SIGTERM forwarded to children). |
| `migrations/0.0.1/example-noop.ts` | Example migration (version below every release → never selected); template for future breaking releases. |
| `tests/` | vitest project `nx` (root `vitest.config.ts`): `generators` (every generator on `createTreeWithEmptyWorkspace`, snapshots in `__snapshots__/`), `plugin` (createNodes over temp folders), `executors` (normalisers), `manifest` (generators.json / executors.json / package.json wiring, version drift, vite-config edits), `migrations`, `e2e` (real Nx workspace). `helpers.ts`: `emptyWorkspace()` drops the tree's `.oxfmtrc.json` (oxfmt not installed → prettier formats). |

## Generators

`preset` (workspaces `apps/*`, `libs/*` + init + app), `init`, `application` (`app`; template static|server|ui|minimal, adapter node|static (server+static refused), tailwind (ui needs it), deploy vercel|netlify|cloudflare|bun|deno (create-rivet overlay; bun/deno need server; applied after adapter/Tailwind edits), unitTestRunner, tags, rivetVersion; npm scripts removed, README "Nx" section, project.json), `library` (`lib`; subpaths, lib `tsconfig.json` sets `noUncheckedSideEffectImports: false` (TS 6+ TS2882 on CSS side-effect imports), publishable → `build` = `@rivetjs/nx:package` + tsconfig.lib.json, importPath default `@<root scope>/<name>`; libs without vitest get check/typecheck in project.json), `component` (`c`; kind basic|overlay (`Slot` render-function children), test, story (apps: `src/routes/stories/<kebab>.tsx`), export (libs → src/index.ts)), `route` (`r`/`page`; loader, action (refused on static apps), guard, layout; static apps with params get `entries(…)`), `layout`, `api-route` (`endpoint`; methods; refused on static apps), `ui-setup` (idempotent), `i18n-setup`. Dependencies: package-manager-workspace projects keep their own package.json; otherwise deps also go to the root package.json. Install callback = one `installPackagesTask` unless `skipInstall`.

## Executors

`build`, `dev` (+ alias `serve`), `preview`, `prerender`, `check`, `test`, `typecheck`, `package` — thin `node <bin>` wrappers run from the project folder (bins resolved from the project, like `npm run`). Prerender / preview fallbacks run `node --input-type=module -e` code importing `@rivetjs/router/static` / `/node` (resolved from the project cwd).

## Rules

- Starter files come only from create-rivet (`templateFiles`, `rewriteManifest`, `templatesRoot`); tool versions only from `templates/*/package.json`.
- Application starter snapshots include complete generated `.agents` (Codex/Cursor) and `.claude` skill bundles with licenses and references, including `rivet-ui-design`; source `libs/mcp/ai`, sync before updating the application file-list snapshot.
- Generated code must be resumability-correct (inline-arrow handlers, render-function children for overlays) and use lucide via `@rivetjs/kit/icon` if it ever needs an icon (none today).
- Schema property added → `schema.json` description + `schema.d.ts` + docs page `apps/docs/content/guides/tooling/nx.md` + README.
- Implementation paths in generators.json / executors.json / migrations.json are extensionless (`.ts` in-repo, `.js` in the package).
- Type-only imports of `schema.d.ts` use `./schema.js` (nodenext resolves the `.d.ts`; the package build keeps it as is).

## Commands

```sh
export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run nx:typecheck --output-style=static --skip-nx-cache   # node scripts/tsc.ts -p libs/nx (tsgo)
NODE_OPTIONS=--max-old-space-size=3072 npx vitest run --project nx --maxWorkers=2                  # = nx run nx:test (~30 s incl. e2e)
NX_DAEMON=false npx nx run nx:package          # → dist/libs/nx
node scripts/package/smoke.ts create-rivet nx  # tarball import + d.ts smoke
```

## E2E (`tests/e2e.test.ts`)

Packages libs/nx into `.artifacts/nx-e2e/dist-<pid>/nx` (`buildPackage`), symlinks it as `node_modules/@rivetjs/nx` of `.artifacts/nx-e2e/ws-<pid>` (minimal package.json + nx.json); everything else resolves from the repo's `node_modules` (no install, no registry). Runs the repo's `node_modules/nx/dist/bin/nx.js` (`NX_DAEMON=false`, `NX_NO_CLOUD`, `NX_TUI=false`, Vitest env stripped): preset → `show project` → build (2 prerendered pages) / test / check / typecheck → `g route blog/[slug] --loader --layout` + `g component Greeting --kind=overlay --story` → rebuild (4 pages) → cached build (`Cache: 1/1 hit`) → server app + `api-route api/health` → build / test → `nx preview --port=<free ≥ 4510>` in its own process group, GET `/` + `/api/health`, group killed → `--deploy=vercel` server app: build writes `.vercel/output`, `nx deploy` runs a stand-in `vercel` bin (`node_modules/.bin/vercel` logging cwd + args) from the project folder → `--deploy=cloudflare` static app: build writes `dist/cloudflare/wrangler.json` (no `nodejs_compat`) + static pages, `show project` has `deploy` = `wrangler deploy`. Timings → `.artifacts/nx-e2e/timings.json`; `RIVET_NX_E2E_KEEP=1` keeps the workspace.

## Gotchas

- Nx loads `.js` implementations with `require()` (Node ≥ 22.12 `require(esm)`): no top-level `await` anywhere in the package.
- `createTreeWithEmptyWorkspace()` (nx 23) writes `.oxfmtrc.json` → `formatFiles` tries oxfmt; tests use `emptyWorkspace()`.
- Nx replays cached terminal output: assert cache hits on the `Cache: 1/1 hit` summary, not on missing tool output.
- Route paths with brackets need shell quotes in docs / commands (`"blog/[slug]"`).
- Not done (rulings 2026-10-08): `convert-to-rivet` generator; a separate `story` / `example` generator (`component --story` already writes a `/stories/<name>` route; a story for an existing component would need prop inference); netlify has no `deploy` target (create-rivet adds no script: Git-connected deploys).

## See also

`apps/docs/content/guides/tooling/nx.md` (user docs) · `libs/create-rivet/CLAUDE.md` · `templates/CLAUDE.md` · `scripts/CLAUDE.md` (package build, smoke, release ORDER).
