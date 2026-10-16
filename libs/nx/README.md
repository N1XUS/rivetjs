# @rivetjs/nx

[Nx](https://nx.dev) plugin for [Rivet](https://github.com/rivetjs/rivet): a workspace preset, generators for apps,
libraries, routes and components, executors, and inferred `build` / `dev` / `preview` / `test` / `check` /
`typecheck` targets with Nx caching.

## Install

```sh
# New workspace with a first Rivet app
npx create-nx-workspace@latest my-org --preset=@rivetjs/nx --template=static

# Existing workspace: installs the plugin and runs its init generator
npx nx add @rivetjs/nx
npx nx g @rivetjs/nx:app apps/web
```

Node.js 24 or newer, Nx 23.

## Generators

| Generator | Alias | Creates |
| --- | --- | --- |
| `application` | `app` | A Rivet app from a create-rivet starter: `--template=static\|server\|ui\|minimal`, `--adapter=node\|static`, `--deploy=vercel\|netlify\|cloudflare\|bun\|deno` (create-rivet's deploy files; `deploy` / `preview` targets), `--tailwind`, `--unitTestRunner=vitest\|none`, `--tags`. |
| `library` | `lib` | A component library: source exports per subpath (`--subpaths=button,card`, `sideEffects: false`), Vitest, `--publishable` package build, `--importPath`. |
| `component` | `c` | A resumable component + test: `--kind=basic\|overlay` (render-function children), `--story` (a `/stories/<name>` page), `--directory`, `--export`. |
| `route` | `r`, `page` | A file route: `blog/[slug]`, `docs/[[lang]]/[...path]`, `(group)/page`; `--loader`, `--action`, `--guard`, `--layout`. |
| `layout` | | `src/routes/<dir>/_layout.tsx`, `--guard`. |
| `api-route` | `endpoint` | An endpoint route with `onGet` / `onPost` / … (`--methods=get,post`). |
| `ui-setup` | | `@rivetjs/ui` + Tailwind v4 + its styles (Rivet theme; other looks = `@rivetjs/ui/theme` presets). |
| `i18n-setup` | | `@rivetjs/i18n`: `i18n.config.ts`, catalogs, the Vite plugin (`--locales=en,de`, `--prefix`). |
| `init` | | Plugin in `nx.json`, shared tooling dependencies, `.rivet` in `.gitignore`. |
| `preset` | | `create-nx-workspace --preset=@rivetjs/nx`. |

All generators write through the Nx tree: `--dry-run` shows the files without writing them.

## Executors

| Executor | Runs |
| --- | --- |
| `@rivetjs/nx:build` | `vite build` (per locale with i18n) → `vite build --ssr` → prerender (static apps). |
| `@rivetjs/nx:dev` / `serve` | `vite` (continuous). |
| `@rivetjs/nx:preview` | The project's `serve.js`, the router's Node server, or `vite preview` (continuous). |
| `@rivetjs/nx:prerender` | `prerenderBuild()` over an existing build. |
| `@rivetjs/nx:check` | `rivet sync` + `rivet-check`. |
| `@rivetjs/nx:test` | `vitest run` with the project's `rivetTest()` config. |
| `@rivetjs/nx:typecheck` | `rivet sync` + `tsc --noEmit`. |
| `@rivetjs/nx:package` | Publishable library: `.js` / `.jsx` (JSX preserved) + `.d.ts`, mapped `package.json`. |

## Inferred targets

```json
{ "plugins": [{ "plugin": "@rivetjs/nx/plugin", "options": { "buildTargetName": "build" } }] }
```

Every folder with a `package.json` or `project.json` and a Rivet Vite config (`rivetRouter()` /
`@rivetjs/compiler/vite`) gets `build`, `dev`, `preview`; a Vitest config with `rivetTest()` adds `test`; a
`tsconfig.json` adds `check` and `typecheck`. Option names: `buildTargetName`, `devTargetName`, `previewTargetName`,
`testTargetName`, `checkTargetName`, `typecheckTargetName`, `deployTargetName`. A `rivetRouter({ adapter })` of
`vercel` / `cloudflare` adds `deploy` (`vercel deploy --prebuilt` / `wrangler deploy`); `cloudflare` / `bun` / `deno`
make `preview` run `wrangler dev` / Bun / Deno. `build`, `test`, `check`, `typecheck` are cached; `.rivet/`,
`dist/` and `coverage/` are never inputs; `build` outputs `{projectRoot}/dist`.

Docs: [Nx guide](https://github.com/rivetjs/rivet/blob/main/apps/docs/content/guides/tooling/nx.md).
