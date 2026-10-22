---
title: Nx
description: Use Rivet in an Nx monorepo - the @rivetjs/nx preset, generators for apps, routes and components, and cached build, test and check targets.
template: guide
status: experimental
related: [start/quick-start, guides/tooling/vite, guides/tooling/testing, guides/tooling/language-service]
---

[Nx](https://nx.dev) runs the tasks of a monorepo: it knows which projects depend on which, runs only what changed and caches the results. `@rivetjs/nx` is the Nx plugin for Rivet. It creates Rivet apps and libraries, adds routes and components to them, and gives every Rivet project `build`, `dev`, `preview`, `test`, `check` and `typecheck` targets that Nx can cache.

After reading this page you can start an Nx workspace with Rivet or add Rivet to one you have, generate code with the plugin, and know what each target runs and caches.

:::note[Alpha release]
`@rivetjs/nx` is available on npm as `0.1.0-alpha.1`, together with the other `@rivetjs/*` packages. The commands below work in a new or existing Nx workspace. APIs may change.
:::

## Start a new workspace

```bash
npx create-nx-workspace@latest my-org --preset=@rivetjs/nx
```

The preset creates an Nx workspace with one Rivet app in `apps/my-org`, made from the same starter files as `npm create rivet`. Pass the app's options on the same line:

```bash
npx create-nx-workspace@latest my-org --preset=@rivetjs/nx --template=server --appName=web
```

| Option | Default | What it does |
| --- | --- | --- |
| `--appName` | the workspace name | Name of the first app. |
| `--directory` | `apps/<appName>` | Folder of the first app. |
| `--template` | `static` | Starter: `static`, `server`, `ui` or `minimal` (the [starters](../../start/quick-start.md#starters)). |
| `--adapter` | from the template | `node` (pages render per request) or `static` (pages become HTML files). |
| `--deploy` |  | Platform of the first app: `vercel`, `netlify`, `cloudflare`, `bun` or `deno` (see [application](#application)). |
| `--tailwind` | on, off for `minimal` | Tailwind CSS v4. |
| `--unitTestRunner` | `vitest` | `vitest` or `none`. |

The workspace uses package manager workspaces (`"workspaces": ["apps/*", "libs/*"]` in the root `package.json`): each app and library has its own `package.json`, and one `npm install` at the root installs everything.

## Add Rivet to an existing workspace

```bash
npx nx add @rivetjs/nx
```

`nx add` installs the plugin and runs its `init` generator. `init`:

- registers `@rivetjs/nx/plugin` in `nx.json`, so Rivet projects get [inferred targets](#inferred-targets),
- adds the shared tooling to the root `package.json`: `@rivetjs/compiler`, `@rivetjs/language-core`, `@rivetjs/typescript-plugin`, `vite`, `typescript` and `@types/node`,
- adds `.rivet` and `dist` to `.gitignore`.

Running `init` again changes nothing. Then create an app:

```bash
npx nx g @rivetjs/nx:app apps/web
```

## Generators

Run a generator with `nx g @rivetjs/nx:<name>`. Every generator only writes files when it is done, so `--dry-run` shows what it would create without touching anything. Generated files are formatted with the workspace's formatter.

| Generator | Alias | What it creates |
| --- | --- | --- |
| `application` | `app` | A Rivet app from a starter. |
| `library` | `lib` | A component library. |
| `component` | `c` | A component and its test. |
| `route` | `r`, `page` | A page in `src/routes`. |
| `layout` |  | A `_layout.tsx` for a routes folder. |
| `api-route` | `endpoint` | An endpoint (a `.ts` route with request handlers). |
| `ui-setup` |  | [`@rivetjs/ui`](../../ui/overview.md) with Tailwind v4 in an app. |
| `i18n-setup` |  | Compile-time [translations](../i18n/translating-text.md) in an app. |
| `init` |  | Workspace setup (see above). |
| `preset` |  | Used by `create-nx-workspace`. |

### application

```bash
npx nx g @rivetjs/nx:app apps/web --template=server
```

| Option | Default | What it does |
| --- | --- | --- |
| `directory` (first argument) |  | Folder of the app. |
| `--name` | the folder name | Project name. |
| `--template` | `static` | `static`, `server`, `ui` or `minimal`. |
| `--adapter` | from the template | `node` or `static`. `--adapter=node` on a static starter removes the prerender step and serves pages from a Node server. The server starter has a form action, so it needs `node`. |
| `--deploy` |  | `vercel`, `netlify`, `cloudflare`, `bun` or `deno`: the same files as `npm create rivet -- --deploy <target>` (see below). `bun` and `deno` need `--template=server`. |
| `--tailwind` | on, off for `minimal` | Tailwind CSS v4. The `ui` starter needs it. |
| `--unitTestRunner` | `vitest` | `vitest`: a `vitest.config.ts` with `rivetTest()` and a first test for the starter. `none`: no tests. |
| `--tags` |  | Comma-separated Nx tags. |
| `--rivetVersion` | the plugin's version | Version range for the `@rivetjs/*` dependencies. |

The app gets the starter's files, a `project.json`, and a "Nx" section in its `README.md`. The starter's npm scripts (`dev`, `build`, …) are removed: the Nx targets do the same work.

#### Deploy targets

`--deploy` makes the same changes as create-rivet: `rivetRouter({ adapter: "<target>" })` in `vite.config.ts`, the platform's folders in `.gitignore`, a "Deploy" section in the README, and `netlify.toml` for Netlify (its build command is `npx nx build <app>`). `nx build` then also writes the platform output. The npm scripts create-rivet would add become Nx targets:

| `--deploy` | `nx build` also writes | `nx preview` | `nx deploy` |
| --- | --- | --- | --- |
| `vercel` | `.vercel/output` | the Node server | `vercel deploy --prebuilt` (the Vercel CLI must be installed) |
| `netlify` | `dist/netlify`, `.netlify/v1` | the Node server | none: connect the repository in Netlify |
| `cloudflare` | `dist/cloudflare` (with `wrangler.json`) | `wrangler dev` | `wrangler deploy` (`wrangler` is added as a dev dependency) |
| `bun` | `dist/server/bun.js` | `bun dist/server/bun.js` | none |
| `deno` | `dist/server/deno.js` | `deno run … dist/server/deno.js` | none |

```bash
npx nx g @rivetjs/nx:app apps/web --template=server --deploy=vercel
npx nx deploy web
```

`nx deploy` builds first (it depends on `build`, so a cached build is reused). The inference plugin finds the `adapter` in `vite.config.ts`, so an app you set up by hand gets the same targets. Platform details: [Deploy](../deploy/overview.md).

### library

```bash
npx nx g @rivetjs/nx:lib libs/ui-kit --subpaths=button,card --publishable
```

| Option | Default | What it does |
| --- | --- | --- |
| `directory` (first argument) |  | Folder of the library. |
| `--name` | the folder name | Project name. |
| `--importPath` | `@<scope>/<name>` | Package name. The scope comes from the root `package.json` name. |
| `--subpaths` |  | Extra entry points: `--subpaths=button,card` gives `@scope/ui-kit/button` and `@scope/ui-kit/card`. |
| `--publishable` | off | Adds a `build` target that writes an npm package to `dist/<directory>`. |
| `--unitTestRunner` | `vitest` | `vitest` or `none`. |
| `--tags` |  | Comma-separated Nx tags. |

Inside the workspace, apps import the library's source files: its `package.json` `exports` point at `src/*.ts`, and the app's Rivet compiler compiles the components, so they resume like the app's own. Each subpath is a separate entry and `"sideEffects": false` is set, so an app that imports `@scope/ui-kit/button` bundles nothing else of the library.

The publishable build runs `tsc` with JSX kept as it is (`.jsx` files) and writes `.d.ts` files next to them, the way the `@rivetjs/*` packages ship: the app that installs the package compiles its components.

### component

```bash
npx nx g @rivetjs/nx:c UserCard --project=web
npx nx g @rivetjs/nx:c Disclosure --project=web --kind=overlay --story
```

| Option | Default | What it does |
| --- | --- | --- |
| `name` (first argument) |  | Component name. `user-card` becomes `UserCard`. |
| `--project` |  | App or library. |
| `--directory` | `components` (apps), none (libraries) | Folder under `src`. |
| `--kind` | `basic` | `basic`: a signal and a button. `overlay`: a trigger and a panel that opens. |
| `--test` | when the project has Vitest | Writes `<Name>.test.tsx`. |
| `--story` | off | Apps only: a page at `/stories/<name>` that shows the component's states. |
| `--export` | on for libraries | Adds the component to the library's `src/index.ts`. |

The generated code follows the rules that keep a page [resumable](../../learn/resuming.md): event handlers are inline arrow functions, and the overlay's content is a render function (`{() => <p>…</p>}`), so a closed panel's content is created only when it opens. See [function is not serializable](../../gotchas/function-is-not-serializable.md) for why.

### route

```bash
npx nx g @rivetjs/nx:route "blog/[slug]" --project=web --loader --layout
```

| Option | Default | What it does |
| --- | --- | --- |
| `path` (first argument) |  | Path under `src/routes`: `about`, `blog/[slug]`, `docs/[[lang]]/[...path]`, `(marketing)/pricing`, `blog/index`. See [file routes](../routing/file-routes.md). |
| `--project` |  | The app. |
| `--loader` | off | A `load(…)` and a typed `data` prop. |
| `--action` | off | `actions(…)` and a form that posts to it. Needs `--adapter=node`. |
| `--guard` | off | A `guard(…)`. |
| `--layout` | off | Also a `_layout.tsx` in the route's folder, if it has none. |

In a static app, a route with parameters also gets `entries(…)`, the parameter values to prerender. Put quotes around paths with brackets, so the shell leaves them alone. The command above writes:

```tsx title="src/routes/blog/[slug].tsx"
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { entries, load } from "@rivetjs/router";

/** Parameter values to prerender (static mode): one page per entry. */
export const paths = entries(() => [{ slug: "example" }]);

/** Data for the page, loaded on the server; removed from the browser build with everything only it uses. */
export const loader = load(({ params }: RequestEvent) => ({
  title: `Blog Slug: ${params.slug ?? ""}`,
}));

export const head = { title: "Blog Slug" };

/** Blog Slug (/blog/:slug). */
export default function BlogSlugPage({ data, params }: PageProps<typeof loader>) {
  return (
    <main>
      <h1>{data.title}</h1>
      <p>slug: {params.slug}</p>
    </main>
  );
}
```

### layout

```bash
npx nx g @rivetjs/nx:layout "(private)" --project=web --guard
```

Writes `src/routes/<directory>/_layout.tsx`; without a directory, the root layout. `--guard` adds a `guard(…)` that redirects to `/login` when there is no `session` cookie; it runs for every page and endpoint in the folder. See [layouts](../routing/layouts.md) and [guards](../routing/guards.md).

### api-route

```bash
npx nx g @rivetjs/nx:api-route "api/items/[id]" --project=web --methods=get,post
```

Writes an [endpoint](../routing/endpoints.md): a `.ts` file in `src/routes` with one request handler per method (`--methods`: `get`, `post`, `put`, `patch`, `delete`; default `get`). Endpoints need a server, so the generator refuses static apps.

### ui-setup

```bash
npx nx g @rivetjs/nx:ui-setup web
```

Sets up `@rivetjs/ui` the way the `ui` starter has it: the Tailwind plugin in `vite.config.ts`, `@import "tailwindcss";` and `@import "@rivetjs/ui/styles";` in `src/styles.css`, and the dependencies `@rivetjs/ui`, `@rivetjs/kit` and `lucide`. Other looks are `@rivetjs/ui/theme` presets (variables after the import). Running it twice changes nothing.

### i18n-setup

```bash
npx nx g @rivetjs/nx:i18n-setup web --locales=en,de
```

Writes `i18n.config.ts`, one catalog per language (`locales/en.json`, `locales/de.json`), puts `i18n(i18nConfig)` first in the Vite plugins and adds `@rivetjs/i18n`. Options: `--locales` (default first), `--defaultLocale`, `--prefix` (`as-needed`, `always` or `never`; see [locale URLs](../i18n/locale-urls.md)). The `build` target then runs one browser build per language.

## Executors

The targets run these executors. Each one starts the same tools the starters' npm scripts use, from the project's folder.

| Executor | Runs |
| --- | --- |
| `@rivetjs/nx:build` | `vite build` (once per language with i18n), `vite build --ssr`, then the prerender step for static apps (the project's `prerender.js`, or `prerenderBuild()`). |
| `@rivetjs/nx:dev` (also `serve`) | `vite`, the dev server. Keeps running. |
| `@rivetjs/nx:preview` | The project's `serve.js`; without one, the router's Node server (`start()` from `@rivetjs/router/node`), or `vite preview` for apps without the router. Keeps running. |
| `@rivetjs/nx:prerender` | `prerenderBuild()` over an existing build, for pipelines that build and prerender in separate steps. |
| `@rivetjs/nx:check` | `rivet sync`, then `rivet-check` (see [language service](language-service.md#check-in-ci)). |
| `@rivetjs/nx:test` | `vitest run` with the project's `vitest.config.ts`. |
| `@rivetjs/nx:typecheck` | `rivet sync` (apps), then `tsc --noEmit`. |
| `@rivetjs/nx:package` | The publishable library build. |

Options you can pass on the command line or set in `project.json`:

| Executor | Options |
| --- | --- |
| `build` | `config`, `mode`, `ssr`, `prerender`, `locales`, `outputPath` (default `dist`), `logLevel`, `env` |
| `dev` | `port`, `host`, `strictPort`, `open`, `config`, `mode`, `env` |
| `preview` | `port`, `host`, `outputPath`, `env` |
| `prerender` | `outputPath`, `script` |
| `check` | `tsConfig`, `types`, `manifest`, `sync`, `format` (`text` or `json`) |
| `test` | `config`, `watch`, `coverage`, `maxWorkers`, `passWithNoTests`, `update`, `project`, `testFiles`, `testNamePattern`, `reporters`, `env` |
| `typecheck` | `tsConfig`, `sync` |
| `package` | `tsConfig` (default `tsconfig.lib.json`), `outputPath` (default `dist/<project folder>`), `sourceRoot`, `assets` |

For example `npx nx dev web --port=4600` or `npx nx test web --watch`.

## Inferred targets

With `@rivetjs/nx/plugin` in `nx.json`, you do not write targets yourself. The plugin looks at every `vite.config.*` and `vitest.config.*` that sits next to a `package.json` or `project.json`, and reads it as text:

| The folder has | Targets |
| --- | --- |
| `rivetRouter()` or `@rivetjs/compiler/vite` in `vite.config.*` | `build`, `dev`, `preview` |
| `rivetRouter({ adapter: "…" })` in `vite.config.*` | `vercel`, `cloudflare`: also `deploy`. `cloudflare`, `bun`, `deno`: `preview` runs Wrangler / Bun / Deno |
| `rivetTest()` in `vitest.config.*` | `test` |
| a `tsconfig.json` (and one of the above) | `check`, `typecheck` |

A library with only a Vitest config gets `test`, `check` and `typecheck`. A library without tests gets `check` and `typecheck` in its `project.json` from the generator. Projects that use other Vite plugins only are left alone.

See the targets of a project, and where each came from:

```bash
npx nx show project web
```

Rename targets with the plugin options in `nx.json`:

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@rivetjs/nx/plugin",
      "options": {
        "buildTargetName": "build",
        "devTargetName": "dev",
        "previewTargetName": "preview",
        "testTargetName": "test",
        "checkTargetName": "check",
        "typecheckTargetName": "typecheck",
        "deployTargetName": "deploy"
      }
    }
  ]
}
```

To turn inference off, set `NX_ADD_PLUGINS=false` or `"useInferencePlugins": false` in `nx.json` before you generate: the generators then write the same targets into `project.json`.

## Caching

`build`, `test`, `check` and `typecheck` are cached. When nothing a target reads has changed, Nx prints the old output and restores the files instead of running it again:

```bash
npx nx build web
npx nx build web
```

The second run ends with `Cache: 1/1 hit`.

- **Inputs**: the project's files and the files of the projects it depends on. Generated files are not inputs: `.rivet/` (the build writes it, so it would otherwise make every build look changed), `dist/`, `coverage/`, `src/rivet-i18n.d.ts` and the platform folders `.vercel/`, `.netlify/`, `.wrangler/`. Test files and the Vitest config are not inputs of `build`. If `nx.json` defines a `production` named input, `build` uses it.
- **Outputs**: `build` stores `dist/` (`dist/client` and `dist/server`) plus `.vercel/output`, `.netlify/v1` or `.wrangler/deploy` for those adapters, `test` stores `coverage/`.
- `build` depends on `build` of the projects it uses (`^build`), and `preview` on `build`.
- `dev` and `preview` keep running (continuous targets) and are never cached; `deploy` is never cached either.

## Migrations

`nx migrate @rivetjs/nx@latest` updates the plugin like any Nx plugin. When a Rivet release changes an API, its migrations rewrite your code during `nx migrate --run-migrations`. There are none yet.

## Common mistakes

- **Brackets in a route path without quotes.** zsh and some other shells read `blog/[slug]` as a file pattern. Write `"blog/[slug]"`.
- **Running the npm scripts of a starter.** Apps made by the plugin have no `build` or `dev` scripts; run `nx build web` and `nx dev web`.
- **A Vite config the plugin cannot read.** The plugin looks for `rivetRouter(` or `@rivetjs/compiler/vite` in the file's text. A config that builds its plugin list in another module is not detected; add the targets to `project.json` with the executors above.
- **`check` or `typecheck` before the first build in a fresh clone.** Both run `rivet sync` first, so the generated route types are there. Plain `tsc` without it reports missing route types.

## See also

- [Quick start](../../start/quick-start.md): `npm create rivet` for a single app.
- [Vite](vite.md): the plugins the targets run.
- [Testing](testing.md): the Vitest setup the `test` target uses.
- [Language service](language-service.md): what `rivet-check` reports.
