---
title: Vite
description: Configure the Rivet Vite plugins, rivetRouter and rivet, with TypeScript, Tailwind, images, i18n and the build commands.
template: guide
status: experimental
related: [guides/tooling/dev-server-and-hot-reload, reference/config, guides/deploy/node, guides/deploy/static-hosts]
---

Rivet builds on [Vite](https://vite.dev). The Rivet plugin compiles your `.tsx` and `.jsx` files: one version for the server, one for the browser. Everything else, like CSS, assets and other plugins, works the normal Vite way.

After reading this page you can set up the plugins, connect TypeScript and Tailwind, and run the builds.

## Pick a plugin

There are two entry points:

| Plugin | From | Use it for |
| --- | --- | --- |
| `rivetRouter()` | `@rivetjs/router/vite` | Apps with file routes in `src/routes`. Most apps. |
| `rivet()` | `@rivetjs/compiler/vite` | Apps without the router, or libraries. |

`rivetRouter()` includes `rivet()` and configures it for you. Do not add both.

### With file routes

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"] }), tailwindcss()],
});
```

Options of `rivetRouter`:

| Option | Default | Meaning |
| --- | --- | --- |
| `routes` | `"src/routes"` | Folder with route files |
| `document` | `"src/document.ts"` | Module whose default export is the HTML shell |
| `styles` | `[]` | Stylesheets to build and link on every page |
| `mode` | `"server"` | `"server"`: render on each request. `"static"`: render to files at build time. `"csr"`: single-page app rendered in the browser |
| `resume` | | Resume options, see below. Route files are added to `modules` for you |
| `images` | off | Image processing, see [Images](../assets/images.md) |
| `devtools` | `true` | Rivet DevTools on the dev server, see [DevTools](devtools.md) |
| `outDir` | `".rivet"` | Folder for generated code |
| `adapter` | node only | Deploy target: `"vercel"`, `"netlify"`, `"cloudflare"`, `"bun"`, `"deno"` or `"fetch"`. See [Deploy](../deploy/overview.md) |

All options, including `base`, `trailingSlash`, `transitions` and `prefetch`, are in the [config reference](../../reference/config.md#rivetrouter).

The plugin writes generated files (route table, entries, route types) into `.rivet/`. Add it to `.gitignore`.

### Without the router

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivet } from "@rivetjs/compiler/vite";

export default defineConfig({ plugins: [rivet()] });
```

## Resume options

Pages from the server :term[resume]{id=resumability} in the browser: the browser picks up where the server left off, without running your components on load. With `rivetRouter`, route files and every app `.tsx`/`.jsx` component file a route imports are compiled this way (`appModules`, default `true`; `appModules: false` opts out and leaves only `modules`). With plain `rivet({ resume })`, only the files in `resume.modules` are. Other options:

```ts
rivetRouter({
  resume: { domData: false },
});
```

| Option | Meaning |
| --- | --- |
| `modules` | Root-relative source files compiled in resume mode |
| `appModules` | Every app `.tsx`/`.jsx` module a resume module imports resumes too (default `true` with `rivetRouter`) |
| `domData` | `<For>` items over data props are read back from the page (default `true`; `false` sends them with the props); see [data from the page](../../learn/resuming.md#data-from-the-page) |
| `roots` | Files whose default export is the page's root component (its props are sent as data) |

The full list, with types and defaults, is in [Config](../../reference/config.md#rivetresumeoptions).

If a component's buttons do nothing in production, check that it is resume-compiled: with `appModules: false` (or plain `rivet()`), its file must be in `modules`.

## TypeScript

Set these compiler options so the editor understands Rivet JSX:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@rivetjs/runtime",
    "noUncheckedSideEffectImports": false,
    "types": ["node"]
  },
  "include": ["src", "*.ts", ".rivet/routes.d.ts"]
}
```

This is what the starters use. `noUncheckedSideEffectImports: false` stops TypeScript 6 and later from reporting CSS side-effect imports such as `import "./styles.css"` (TS2882); Vite resolves them. `.rivet/routes.d.ts` holds the generated route types; it exists after the first `vite` or `vite build`. With `images`, add `"@rivetjs/compiler/images/client"` to `types`. For more editor help, see [Language service](language-service.md).

## Tailwind and CSS

CSS goes through Vite unchanged. Rivet has no CSS processor of its own. Tailwind uses its normal Vite plugin, next to Rivet's:

```css title="src/styles.css"
@import "tailwindcss";
```

List the file in `rivetRouter({ styles: ["src/styles.css"] })`, so every page links it.

## Other plugins

- `i18n()` from `@rivetjs/i18n/vite` must come **before** `rivetRouter()` or `rivet()`. See [Translating text](../i18n/translating-text.md).
- `rivet({ images: true })` and `rivetRouter({ images: true })` add the image plugin.
- Imports with `?raw` and `?url`, and files in `node_modules`, are not compiled by Rivet.

## Build commands

A server app has two builds: one for the browser and one for the server.

```bash
vite build          # browser files → dist/client
vite build --ssr    # server entry → dist/server
```

`rivetRouter` minifies the server build too (Vite leaves server output unminified by default): smaller deploys and faster cold starts. Pass `vite build --ssr --minify false`, or set `build.minify` in the config, for readable server stack traces; `build.sourcemap` maps minified traces back to your source.

A static app adds a prerender step that writes HTML files; see [Static hosts](../deploy/static-hosts.md). A CSR app (`mode: "csr"`) has only the browser build, which also writes `index.html`.

With images, use Vite's app builder (`vite build --app`, or `createBuilder({ builder: {} })` then `buildApp()`), so images used only in server code reach the browser output.

The starters wrap these in `npm run build`.

## Source maps

Compiled modules carry source maps in dev, and in builds when `build.sourcemap` is set. Stack traces and breakpoints then point at your source.

## Compiler errors

The plugin reports code it cannot compile with the file, line and column, for example a browser global read during server rendering:

```txt
Browser global `document` is read during server rendering; move it into a handler…
```

The same checks run in your editor with the [language service](language-service.md).

## See also

- [Dev server and hot reload](dev-server-and-hot-reload.md)
- [Config reference](../../reference/config.md)
- [Node](../deploy/node.md)
- [Static hosts](../deploy/static-hosts.md)
