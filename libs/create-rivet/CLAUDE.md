# create-rivet

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`npm create rivet@latest [dir]` (also `pnpm` / `yarn` / `bun create rivet`): copies a starter from the repo's `templates/`, rewrites its `@rivetjs/*` deps to this release, writes the `package.json` name, optionally installs + `git init`. Unscoped npm name `create-rivet` (npm maps `npm create rivet` → `create-rivet`). Zero dependencies: `node:util` `parseArgs` / `styleText`, `node:readline`. Node ≥ 24.

## Files

| File | What |
| --- | --- |
| `cli.ts` | bin `create-rivet` (shebang): `main(process.argv.slice(2), stdio)` → exit code. |
| `main.ts` | `main(argv, io)`: flags, questions, create, install, git, next steps. `HELP` text. Exit 0 / 1 (error) / 130 (cancelled). Questions only when stdin is a TTY and no `--yes`; otherwise defaults (`rivet-app`, `static`, install + git on). Non-empty target folder: refused without `--force` (non-interactive) or asked. |
| `index.ts` | Package export `.` (plain functions, no side effects): `TEMPLATES` (`id` → `templates/<dir>`, label, hint; order = prompt order), `createProject`, `rewriteManifest`, `templateFiles(from)` (sorted `{ path, source }[]` after `SKIP` + `RENAMES`; used by `copyTemplateDir` and `@rivetjs/nx` `utils/starter.ts`, so both write identical starters), `RENAMES`, `copyTemplateDir` (skips `SKIP`: `node_modules` / `dist` / `.rivet` / `.stackblitzrc`; `_gitignore` → `.gitignore`), `Overlay` + `overlayDir`, `detectPackageManager` (`npm_config_user_agent`), `commands`, `installDependencies`, `initGit` (skips inside an existing work tree; no git identity → init + staged, no commit), `toPackageName` / `validatePackageName`, `ownVersion` / `versionRange` (prerelease → exact, else `^x.y.z`), `templatesRoot` (bundled `./templates` else `../../templates`). |
| `deploy.ts` | Package export `./deploy` (also used by `@rivetjs/nx` `utils/deploy.ts`, so Nx apps get identical deploy files). `--deploy <target>` as an `Overlay`: `DEPLOY_TARGETS` (vercel, netlify, cloudflare, bun, deno; prompt order), `deployOverlay(target, pm)`, `addAdapter` (`adapter: "<t>"` first in `rivetRouter({ … })` / `rivetRouter()`; throws without the call or with an adapter already set), `deployProblem` (bun / deno = server template only). Edits: every target → vite.config adapter, `.gitignore` + `.vercel/` `.netlify/` `.wrangler/`, README "## Deploy: <label>" section; vercel `deploy` = `vercel deploy --prebuilt`; netlify `netlify.toml` (`command` = the pm's build, `publish = "dist/netlify"`); cloudflare devDependency `wrangler` `WRANGLER_RANGE` + `preview` `wrangler dev` / `deploy` `wrangler deploy` (never `nodejs_compat`: the router's generated wrangler.json sets the flags; workerd Buffer bug); bun / deno `start` = generated entry, `serve.js` / `Dockerfile` / `.dockerignore` removed. Router side: `libs/router/adapters/CLAUDE.md`. |
| `prompt.ts` | `text` / `confirm` / `select` (arrow keys + Enter in raw TTY mode, numbered answer otherwise) / `closePrompts`, one shared line reader per input stream (`PromptCancelled` on end of input / Ctrl+C in select). |
| `bundle.ts` | Package-time step (`publishConfig.bundle`, run by `scripts/package/build.ts` as `node bundle.ts <out>`): copies `templates/<dir>` of every `TEMPLATES` entry + every `templates/_<overlay>` folder into `<out>/templates`, `.gitignore` → `_gitignore` (npm never packs `.gitignore`). Not part of the published code. |
| `README.md` | npm page (shipped). |
| `tests/ai-files.test.ts` | vitest project `create-rivet`: every template's `templateFiles` include the generated AI instruction files (`AGENTS.md` = `CLAUDE.md`, Copilot, Cursor rules, Codex/Cursor `.agents` and Claude Code `.claude` skill bundles; source `libs/mcp/ai`), including all `rivet-ui-design` references and license. |
| `tests/create-rivet.test.ts` | vitest project `create-rivet`: helpers, every template created from the repo, overlays, bundle (+ overlay folders), prompts on PassThrough streams, CLI help / errors / non-interactive / TTY-fallback interactive (incl. the deploy question) / git, `--deploy` scaffold layout per target over the server starter (`LAYOUT`), deploy errors, adapter insertion. Captured stdout / stderr are compared with ANSI stripped (`styleText` follows `process.env`, so `FORCE_COLOR` from nx / CI colours them despite `env: { NO_COLOR }`). Build output per target: `scripts/package/create-e2e.ts` (`server+<target>`). |

## Flags

`[dir]` `-t/--template <static|server|ui|minimal>` `-d/--deploy <vercel|netlify|cloudflare|bun|deno>` (prompt "Deploy target:" after the template, `None` first; only targets valid for the template) `-n/--name` `-y/--yes` `--install/--no-install` `--git/--no-git` `--pm <npm|pnpm|yarn|bun>` `--rivet-version <spec>` (override the `@rivetjs/*` spec) `-f/--force` `-h/--help` `-v/--version`. With npm, flags go after `--`.

## Rules

- Templates: single source of truth is the repo's `templates/`; never copy them into this folder. New template = `templates/<dir>` + `TEMPLATES` row + `scripts/package/create-e2e.ts` `E2E_TEMPLATES` + `scripts/package/smoke.ts` `TEMPLATES` + docs (`apps/docs/content/start/quick-start.md`, `templates/README.md`).
- Version: every `@rivetjs/*` dep of a created project = this package's version (single-version releases, `scripts/release/`); `--rivet-version` overrides.
- Extension point: `createProject({ overlays: [{ name, dir?: overlayDir("<x>"), manifest?, edit? }] })` — files over the template, then a `package.json` edit, then in-place file edits. `--deploy` is the first user (`deploy.ts`, edits only); static overlay files would go in `templates/_<name>/` (bundled automatically, none yet).
- No runtime dependencies (installs in a second with `npm create`).

## Commands

- Run in-repo: `node libs/create-rivet/cli.ts <dir> --template <id> [--no-install --no-git]` (inside the repo the project resolves the workspace packages).
- Tests: `npx vitest run --project create-rivet`; typecheck `node scripts/tsc.ts -p libs/create-rivet` (tsgo); package `node scripts/package/build.ts libs/create-rivet`.
- End to end from tarballs: `node scripts/package/create-e2e.ts [template …] [--keep]` (vitest `scripts`: `scripts/tests/create-rivet-e2e.test.ts`).

## See also

`templates/CLAUDE.md` · `scripts/CLAUDE.md` (package, e2e, release) · `apps/docs/content/start/quick-start.md`.
