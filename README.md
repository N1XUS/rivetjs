<p align="center"><img src="logo.svg" alt="Rivet logo" width="120"></p>

# Rivet

[Framework docs](https://rivetjs.severyn.pro) · [CDK docs](https://cdk.rivetjs.severyn.pro) · [UI docs](https://ui.rivetjs.severyn.pro)

Rivet is restarting as an SSR-first JSX framework with optional full browser rendering. The priorities are CPU, memory, rendering speed, small bundles, tree shaking, and demand-loaded resumable behavior. Components will use ordinary DOM by default. Applications choose their own data-access tooling; gRPC is only used by the benchmark fixture.

The current milestone includes an experimental JSX/TSX compiler, escaped streaming SSR, fine-grained signals and owned DOM bindings. Explicit async boundaries, lazy functions/components and client-only imports are implemented. Owned browser/server routing and a Vite compiler integration are also implemented. The Tailwind example serves resumable SSR pages with separate server/browser service adapters. Resumability remains in progress. The superseded web-component implementation has been removed.

Roadmap: [`ROADMAP.md`](ROADMAP.md) (now / next / later / not planned).

## Quick start

```sh
npm create rivet@latest my-app    # asks: template (static, server, ui, minimal), install, git
cd my-app
npm run dev
```

The packages are not on npm yet; until then, create a project inside a clone of this repository: `npm ci`, then `node libs/create-rivet/cli.ts my-app --template static --no-install --no-git` (see the docs quick start, `apps/docs/content/start/quick-start.md`).

## Documentation hosting

The main docs app is connected to Cloudflare Workers Builds from `N1XUS/rivetjs`, production branch `main`. CDK and UI hosting configurations are prepared for later; their deployments are not enabled. Keep the build root at the repository root and disable preview builds (the checked-in configs select production domains).

| Site | Build command | Deploy command |
| --- | --- | --- |
| Framework | `npm run docs:build:cloudflare -- apps/docs` | `npx wrangler deploy --config apps/docs/wrangler.jsonc` |
| CDK | `npm run docs:build:cloudflare -- apps/cdk-docs` | `npx wrangler deploy --config apps/cdk-docs/wrangler.jsonc` |
| UI | `npm run docs:build:cloudflare -- apps/ui-docs` | `npm run docs:deploy:ui:cloudflare` |

The build uses bundled Chromium and libraries on Linux for the existing example checks, without requiring root access, sets the three production origins, prerenders the site, builds its search index, and checks links. Node.js is pinned by `.node-version` and `.nvmrc`; Wrangler is pinned in the lockfile. Cloudflare manages deployment credentials through its GitHub integration.

Framework and CDK publish their `dist/client`. UI exceeds the Free plan's 20,000-file limit, so its checked output is partitioned into `dist/cloudflare/site` (pages) and `dist/cloudflare/assets` (JavaScript, CSS, media, fonts, and search). `rivetjs-ui-assets` serves `/assets/*` and `/pagefind/*` in front of the `rivetjs-ui` custom domain. File contents and URLs stay unchanged. The UI deploy script publishes the assets first, then pages; only the assets command clears the CI hint that normally restricts a build to one Worker name. Cloudflare account authentication and token permissions still apply to both deployments.

CDK's `examples/_quarantine.json` records three existing cold-interaction check failures approved for this deployment. Builds continue to report them; those examples have no successful size measurement until their checks are fixed.

## Workspace projects

| Project | Purpose |
| --- | --- |
| `libs/reactivity` | `@rivetjs/reactivity`: signals, computed values, effects, owners and disposal, `/store`, `/debug` |
| `libs/compiler` | `@rivetjs/compiler`: Rust/oxc JSX/TSX → server and DOM compiler (WebAssembly; rebuild `libs/compiler/rust/build.sh` in Docker, parity `nx run compiler:parity`), Vite plugin, `?image` |
| `libs/runtime` | `@rivetjs/runtime`: streaming SSR, compiled DOM bindings, resume, router runtime, Node writers, image, style, testing helpers |
| `libs/router` | `@rivetjs/router`: file routes, loaders, actions, guards, web-standard handler, node and static adapters ([docs](docs/guides/routing.md)) |
| `libs/forms` | `@rivetjs/forms`: Standard Schema forms, progressive enhancement, resumable ([docs](docs/guides/forms.md)) |
| `libs/i18n` | `@rivetjs/i18n`: compile-time ICU catalogs inlined per locale, locale resolution ([docs](docs/guides/i18n.md)) |
| `libs/kit` | `@rivetjs/kit`: document head (title, meta, links, scripts, JSON-LD, fonts), CSP, `<Transition>`, scoped styles |
| `libs/cdk` | `@rivetjs/cdk`: headless components and utilities, 1:1 ports of React Aria / React Stately / RAC / Angular CDK |
| `libs/devtools` | `@rivetjs/devtools`: dev-server DevTools — component tree, signals, updates, HMR/error log, performance (`Alt+Shift+R`) ([docs](docs/guides/devtools.md)) |
| `libs/testing` | `@rivetjs/testing` (dev-only): Vitest plugins, happy-dom/browser harnesses, user-event testers, Jest/Jasmine shims ([docs](docs/guides/testing.md)) |
| `libs/language-core` | Editor-agnostic language features (diagnostics, quick fixes, resume sites, route links) and the `rivet-check` CLI |
| `libs/typescript-plugin` | TypeScript language-service plugin over `language-core` |
| `libs/create-rivet` | `create-rivet`: `npm create rivet@latest` — copies a starter from `templates/`, installs, `git init` |
| `libs/docs-kit` | Shared docs-site engine (Markdown pipeline, examples, API docs, search, prerender) |
| `apps/docs` | Main docs site |
| `apps/cdk-docs` | cdk docs site (pages mirror upstream RAC / Angular CDK docs) |
| `apps/ui-docs` | `@rivetjs/ui` docs site (components, live examples, theme builder) |
| `apps/playground` | Tailwind resumable SSR example app ([README](apps/playground/README.md)) |
| `apps/ssr-bench` | Docker SSR benchmark: Rivet vs Solid / Qwik / ASP.NET Razor on the same gRPC fixture |
| `apps/dom-bench` | Browser DOM benchmarks and krausest |
| `apps/resume-bench` | Resume (click-to-interactive) benchmark lanes |
| `apps/bench-stable` | Isolated stable-release toolchains for the comparison lanes |
| `apps/vscode` | VS Code extension (TypeScript plugin + Rivet: Doctor) |

Requires Node 24+, Python 3.12+, and Docker with Compose. .NET 10 is needed only for local C# builds or regenerating protobuf sources.

```sh
npm ci
npm run build
npm test
npm run bench:ssr -- --quick
npm run bench:ssr:report
```

The report opens at `http://127.0.0.1:18120/report.html`. Complete result JSON, per-request measurements, and HTML/Markdown reports are written to `.artifacts/ssr-bench`.

Contributor gates (run before commits that touch runtime, router, compiler or kit code):

- `npm run zero-cost`: runtime entry hashes, ssr-bench lane hashes and the compiler oracle must match their baselines (`sh scripts/zero-cost/check.sh --update` for intended deltas).
- `npm run size-report -- --check` (optional): production-builds the playground, the kit fixture, the starters and a set of docs examples, loads each route in headless Chromium, and fails if any app's shipped bytes grew compared with `scripts/size-report/baseline.json`. Measured per route: HTML, resume state, inline script, module requests and JS before the first interaction, the runtime/page import closure, and JS loaded by the first scripted interaction. Also measures the ssr-bench lane server bundles. Readable table: `scripts/size-report/baseline.md`. `--update` rewrites the baseline (for intended deltas; list them in the commit). `--apps=playground,example:counter` limits the run, and `--tolerance=<bytes>` allows small growth.

See [the example app](apps/playground/README.md), [routing](docs/guides/routing.md), [forms](docs/guides/forms.md), [testing](docs/guides/testing.md), [Vite authoring](docs/guides/vite-integration.md), [DevTools](docs/guides/devtools.md), [large browser comparison](docs/benchmarks/large-dom-comparison.md), [runnable browser benchmark](docs/benchmarks/large-dom-benchmark.md), [latest batched SSR comparison](docs/benchmarks/batched-ssr-comparison.md), [earlier large-page SSR comparison](docs/benchmarks/optimized-ssr-comparison.md), [compiled/native SSR comparison](docs/benchmarks/compiled-ssr-comparison.md), [compiled runtime milestone](docs/design/compiled-runtime-milestone.md), [measured baseline and limitations](docs/benchmarks/ssr-foundation-results.md), [implementation notes](docs/design/ssr-foundation-implementation-notes.md), [benchmark instructions](apps/ssr-bench/README.md), the [approved architecture](docs/design/specs/2026-10-02-rivet-ssr-first-restart-design.md), and the [first implementation plan](docs/design/plans/2026-10-02-rivet-ssr-foundation.md).

Next stages: explicit resumable boundaries and measured rendering/delivery optimizations. Native compiler and server work must justify their crossing costs in measurements. DI and framework wrappers are deferred.

## Design skills for AI assistants

The portable [`rivet-ui-design` skill](skills/rivet-ui-design/SKILL.md) guides colors, spacing, typography, page structure, app layouts, component composition and interactions using `@rivetjs/ui` and `@rivetjs/cdk`. It supports Codex, Claude Code and Cursor and works without MCP. From your consumer project, install from a local clone:

```sh
npx skills add /path/to/rivet/skills --skill rivet-ui-design --agent codex claude-code cursor
```

See [installation and distribution](skills/README.md) for manual/global installation and the remote command once the bundles are pushed to the public repository. New starters include the skill.

## License

MIT — see [LICENSE](LICENSE). Ported upstream code keeps its original notices (`libs/cdk/NOTICE`).
