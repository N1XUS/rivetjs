---
title: Quick start
description: Create a Rivet project with npm create rivet, run it, and see a page resume in the browser.
template: guide
status: experimental
related: [start/project-structure, start/tutorial/index, gotchas/dev-and-production-differ]
---

After this page you have a running Rivet app: two pages, a layout and a button that counts. One command creates it.

:::note[Available on npm]
`create-rivet` and the `@rivetjs/*` packages are published as `0.1.0-alpha.1`. You can create an app outside this repository. Rivet is an alpha release; APIs may change.
:::

## You need

- Node.js 24 or newer (`node --version`).
- npm (comes with Node.js), or pnpm, Yarn or Bun.
- Git (optional), to initialise the new project’s repository.

## Option 1: create a project

```bash
npm create rivet@latest my-app
```

The command asks five questions; Enter keeps the default:

1. **Project name**: the folder and the `package.json` name (asked only when you leave out `my-app`).
2. **Template**: `Static site` (default), `Node server`, `UI components` or `Minimal`. See [starters](#starters).
3. **Deploy target**: `None` (default: a Node server or static files), Vercel, Netlify, Cloudflare Workers, and for the server template Bun or Deno. See [deploy targets](#deploy-targets).
4. **Install dependencies**: runs `npm install` (or the package manager you started it with).
5. **Initialise a git repository**: `git init` and a first commit.

Then:

```bash
cd my-app
npm run dev
```

The same with other package managers: `pnpm create rivet my-app`, `yarn create rivet my-app`, `bun create rivet my-app`. The tool notices which one started it and uses it to install.

### Without questions

Options skip the questions, for scripts and CI. With npm, put them after `--`:

```bash
npm create rivet@latest my-app -- --template server --yes
```

| Option | What it does |
| --- | --- |
| `-t`, `--template <id>` | `static`, `server`, `ui` or `minimal`. |
| `-d`, `--deploy <target>` | Set up a deploy target: `vercel`, `netlify` or `cloudflare` (any template), `bun` or `deno` (`server` template). See [deploy targets](#deploy-targets). |
| `-y`, `--yes` | Ask nothing; every missing answer takes its default. |
| `--no-install` | Do not install dependencies. |
| `--no-git` | Do not create a git repository. |
| `--pm <name>` | Install with `npm`, `pnpm`, `yarn` or `bun`. |
| `-n`, `--name <name>` | `package.json` name (default: the folder name). |
| `-f`, `--force` | Write into a folder that is not empty. |
| `--rivet-version <spec>` | Version range for the `@rivetjs/*` dependencies (default: the release the tool belongs to). |
| `-v`, `--version` | Print the `create-rivet` version. |
| `-h`, `--help` | List all options. |

The tool copies the starter, sets the `package.json` name, and points every `@rivetjs/*` dependency at the release it belongs to. TypeScript is always on.

### Deploy targets

`--deploy <target>` (or the third question) adds the platform to the project. `npm run build` then also writes that platform's output; nothing is deployed for you.

| Target | What the project gets | After `npm run build` |
| --- | --- | --- |
| `vercel` | `adapter: "vercel"` in `vite.config.ts`, a `deploy` script (`vercel deploy --prebuilt`) | `.vercel/output` |
| `netlify` | `adapter: "netlify"`, a `netlify.toml` (build command, `publish = "dist/netlify"`) | `dist/netlify`, `.netlify/v1` |
| `cloudflare` | `adapter: "cloudflare"`, `wrangler` as a dev dependency, `preview` (`wrangler dev`) and `deploy` (`wrangler deploy`) scripts | `dist/cloudflare` |
| `bun` | `adapter: "bun"`, `start` = `bun dist/server/bun.js` (no `serve.js`, no Dockerfile) | `dist/server/bun.js` |
| `deno` | `adapter: "deno"`, `start` = `deno run --allow-net --allow-read --allow-env dist/server/deno.js` | `dist/server/deno.js` |

Every target also adds `.vercel/`, `.netlify/` and `.wrangler/` to `.gitignore` and a "Deploy" section to the project's `README.md`.

### In an Nx monorepo

For a monorepo with several apps and libraries, the Nx plugin `@rivetjs/nx` creates the same starters as Nx projects, with cached `build`, `test` and `check` targets: `npx create-nx-workspace@latest my-org --preset=@rivetjs/nx`, or `npx nx add @rivetjs/nx` in an existing workspace. See [Nx](../guides/tooling/nx.md).

## Option 2: open the starter in StackBlitz

The static starter is a small site whose pages become HTML files at build time.

::starter{template=starter-static}

StackBlitz runs `npm install` and then `npm run dev`. The starter installs the published Rivet packages.

## Build and preview

From your new app:

```bash
npm run build
npm run preview
```

The dev server resumes pages like production until you edit a file, but it is not what your visitors get: code is not bundled or minified, the runtime runs with extra development checks, and the first edit switches the page to rendering in the browser (so hot reload keeps state). To see the real behaviour and size, build:

```bash
npm run build
npm run preview
```

`npm run build` runs three steps from `package.json`:

```json title="package.json"
{
  "scripts": {
    "dev": "vite",
    "build": "vite build && vite build --ssr && node prerender.js",
    "preview": "node serve.js"
  }
}
```

- `vite build` builds the browser files into `dist/client`.
- `vite build --ssr` builds the server code into `dist/server`.
- `node prerender.js` renders every page to an HTML file in `dist/client`.

`npm run preview` serves `dist/client` at `http://127.0.0.1:4173`.

## Check that it works

Open the preview address and the browser's developer tools, on the Network tab:

1. Reload the page. The text and the button are there right away: they are in the HTML.
2. Look at the scripts. After the page has loaded, a few files arrive at low priority: the page's own code and the part of the Rivet runtime it needs (the names depend on the page: a small page like this one gets `dom-lite-….js`, larger ones `derived-runtime-….js` and `dom-derived-abi-….js`). They are fetched ahead, but none of it runs yet.
3. Click the button. The runtime starts, runs the home page's code (`src/routes/index.tsx`) over the HTML that is already there, and the click reaches the counter's handler: the count goes up.

Nothing ran in the browser until you used the page, and the click reused the server's nodes instead of rendering new ones. [Resuming](../learn/resuming.md) explains how.

## Starters

The `templates` folder has four starters. `npm create rivet` copies the one you pick (`--template <id>`).

| Starter | `--template` | What it is | Commands |
| --- | --- | --- | --- |
| `starter-static` | `static` | Static site: pages become HTML files at build time. Tailwind, two pages, one interactive component. | `npm run dev`, `npm run build`, `npm run preview` |
| `starter-server` | `server` | Node.js server: pages render for each request; a loader and a form action. Has a Dockerfile. | `npm run dev`, `npm run build`, `npm start` |
| `starter-ui` | `ui` | Static site with [`@rivetjs/ui`](../ui/overview.md) components (Card, Avatar, Chip, Button) and Tailwind CSS v4, in the HeroUI default theme. | `npm run dev`, `npm run build`, `npm run preview` |
| `starter-minimal` | `minimal` | One page, one signal, no Tailwind. | `npm run dev`, `npm run build` |

`starter-server` serves the build at `http://127.0.0.1:3000` (`npm start` runs `node serve.js`).

Every starter also has:

- `npm run check`: runs `rivet sync`, then `rivet-check`, the Rivet compiler's checks for all `.tsx` files (for example a browser global read during server rendering), then `tsc` for the types, typed route links included. It exits with code 1 on an error, so you can run it in CI. See [language service](../guides/tooling/language-service.md#check-in-ci).
- `@rivetjs/devtools` as a dev dependency: `npm run dev` shows the [DevTools](../guides/tooling/devtools.md) panel (:kbd[Alt]+:kbd[Shift]+:kbd[R]). Builds never include it.
- `@rivetjs/typescript-plugin` in `tsconfig.json`: compiler errors in your editor while you type. See [editor setup](editor-setup.md).
- `"engines": { "node": ">=24" }` in `package.json`.

## Common mistakes

- **Options without `--` after `npm create`.** npm keeps options such as `--template` for itself. Write `npm create rivet@latest my-app -- --template ui`; pnpm, Yarn and Bun pass them on without `--`.
- **Judging speed in dev mode.** `npm run dev` resumes pages, but after your first edit the browser renders the whole page, code is not bundled, and development checks add work. Use `npm run build` and `npm run preview` to judge speed and size. See [dev and production differ](../gotchas/dev-and-production-differ.md).

## See also

- [Project structure](project-structure.md): what each file in the starter does.
- [Tutorial](tutorial/index.md): build a small app step by step.
- [Editor setup](editor-setup.md): TypeScript and JSX settings for your editor.
