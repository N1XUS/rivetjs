<p align="center"><img src="logo.svg" alt="Rivet logo" width="120"></p>

# Rivet

[Framework docs](https://rivetjs.severyn.pro) · [CDK docs](https://cdk.rivetjs.severyn.pro) · [UI docs](https://ui.rivetjs.severyn.pro)

Rivet is a compiled, resumable JSX framework: SSR-first streaming output, fine-grained signals, compiled DOM templates, resumable pages (the browser adopts the server's nodes, no hydration re-render), file routing, and compile-time i18n, styles and slots. The compiler is Rust/oxc built to WebAssembly. Pages with nothing interactive ship no JS; interactive pages load only the code of the component a user touches. Goal: beat Solid, Svelte, React, Qwik and ASP.NET Razor on SSR (CPU/page, p50, TTFB, peak memory), DOM and resume benchmarks, published with losses ([latest SSR comparison](docs/benchmarks/2026-10-28-ssr-comparison.md)).

Around the framework: `@rivetjs/cdk` (headless components ported from React Aria / Angular CDK), `@rivetjs/ui` (styled components with a look and API similar to HeroUI v3, plus Pro-style data display, charts, scheduler and AI chat parts), `@rivetjs/motion`, `@rivetjs/forms`, `@rivetjs/i18n`, framework bridges for React and Preact islands, DevTools, an MCP server and editor tooling. Applications choose their own data-access tooling; gRPC is only used by the benchmark fixture.

Roadmap: [`ROADMAP.md`](ROADMAP.md) (now / next / later / not planned).

## Quick start

```sh
npm create rivet@latest my-app    # asks: template (static, server, ui, minimal), install, git
cd my-app
npm run dev
```

All 20 packages are available on npm (alpha releases; APIs may still change). Create an app with the command above.

## Documentation hosting

The framework, CDK and UI docs deploy through Cloudflare Workers Builds from `N1XUS/rivetjs`, production branch `main`, at `rivetjs.severyn.pro`, `cdk.rivetjs.severyn.pro` and `ui.rivetjs.severyn.pro`. Keep the build root at the repository root and disable preview builds (the checked-in configs select production domains).

| Site | Build command | Deploy command |
| --- | --- | --- |
| Framework | `npm run docs:build:cloudflare -- apps/docs` | `npx wrangler deploy --config apps/docs/wrangler.jsonc` |
| CDK | `npm run docs:build:cloudflare -- apps/cdk-docs` | `npx wrangler deploy --config apps/cdk-docs/wrangler.jsonc` |
| UI | `npm run docs:build:cloudflare -- apps/ui-docs` | `npm run docs:deploy:ui:cloudflare` |

The build sets the three production origins, prerenders the site, builds its search index, and checks links. It skips the Chromium example checks (CI gates every example on each push), so the "What loaded" paragraphs stay empty; `DOCS_CHECKS=1` in the build environment runs them, with bundled Chromium and libraries on Linux without requiring root access. The 3 GB memory budget is reported, not enforced, on the build runner (`DOCS_KIT_MAX_RSS_MB` overrides). Node.js is pinned by `.node-version` and `.nvmrc`; Wrangler is pinned in the lockfile. Cloudflare manages deployment credentials through its GitHub integration.

Framework and CDK publish their `dist/client`. UI exceeds the Free plan's 20,000-file limit, so its checked output is partitioned into `dist/cloudflare/site` (pages) and `dist/cloudflare/assets` (JavaScript, CSS, media, fonts, and search). `rivetjs-ui-assets` serves `/assets/*` and `/pagefind/*` in front of the `rivetjs-ui` custom domain. File contents and URLs stay unchanged. The UI deploy script publishes the assets first, then pages; only the assets command clears the CI hint that normally restricts a build to one Worker name. Cloudflare account authentication and token permissions still apply to both deployments.

The example quarantine lists (`examples/_quarantine.json`) of all three sites are empty (2026-10-28). A quarantined check (user approved) is still reported by the build and has no size measurement until it is fixed.

## Workspace projects

| Project | Purpose |
| --- | --- |
| `libs/reactivity` | `@rivetjs/reactivity`: signals, computed values, effects, owners and disposal, `/store`, `/debug` |
| `libs/compiler` | `@rivetjs/compiler`: Rust/oxc JSX/TSX → server and DOM compiler (WebAssembly; rebuild `libs/compiler/rust/build.sh` in Docker, parity `nx run compiler:parity`), Vite plugin, build-time evaluation, `?image` / `?svg` |
| `libs/runtime` | `@rivetjs/runtime`: streaming SSR, compiled DOM bindings, resume (server-node adoption), router runtime, Node writers, image, style, testing helpers |
| `libs/router` | `@rivetjs/router`: file routes, loaders, actions, guards, web-standard handler, node and static adapters ([docs](docs/guides/routing.md)) |
| `libs/forms` | `@rivetjs/forms`: Standard Schema forms, progressive enhancement, resumable ([docs](docs/guides/forms.md)) |
| `libs/i18n` | `@rivetjs/i18n`: compile-time ICU catalogs inlined per locale, locale resolution ([docs](docs/guides/i18n.md)) |
| `libs/kit` | `@rivetjs/kit`: document head (title, meta, links, scripts, JSON-LD, fonts), CSP, `<Transition>`, lucide `Icon`, scoped styles |
| `libs/cdk` | `@rivetjs/cdk`: headless components and utilities, ports of React Aria / React Stately / RAC / Angular CDK |
| `libs/ui` | `@rivetjs/ui`: styled compound components on cdk (Tailwind v4, one Rivet theme + presets) |
| `libs/motion` | `@rivetjs/motion`: Motion (motion.dev) on Rivet signals, Presence, layout animations, CSS entrances with no JS |
| `libs/bridge`, `libs/bridge-{react,preact,solid,vue,svelte}` | `@rivetjs/bridge` + adapters: React19, Preact, Solid1.9, Vue3.5 and Svelte5 components as server-rendered islands |
| `libs/mcp` | `@rivetjs/mcp`: MCP server for AI assistants (docs search, component reference, `check_code`, diagnostics) |
| `libs/nx` | `@rivetjs/nx` (dev-only): Nx plugin with generators, executors and inferred targets |
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
| `apps/ssr-bench` | Docker SSR benchmark: Rivet vs Solid / React / Qwik / ASP.NET Razor on the same gRPC fixture |
| `apps/dom-bench` | Browser DOM benchmarks, krausest and rendering-cost tools |
| `apps/resume-bench` | Resume (click-to-interactive) benchmark lanes |
| `apps/bench-stable` | Isolated stable-release toolchains for the comparison lanes |
| `apps/bridge-demo` | Same React 19 dashboard as a Next.js App Router app and as Rivet routes with bridge islands |
| `apps/editorial-bench` | Editorial-site benchmark: Rivet vs Astro / Eleventy / Hugo / Next / SvelteKit |
| `apps/island-bench` | Framework-islands benchmark: Rivet + bridges vs Astro + React / Preact and Next |
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

- `node scripts/gates/run.ts`: plans and runs every gate the changed files need (typecheck, tests, docs checks and builds, zero-cost, size report, format; `--list` shows the plan, `--all` runs everything) and prints one table; see `CONTRIBUTING.md`.
- `npm run zero-cost`: runtime entry hashes, ssr-bench lane hashes and the compiler oracle must match their baselines (`sh scripts/zero-cost/check.sh --update` for intended deltas).
- `npm run size-report -- --check` (optional): production-builds the playground, the kit fixture, the starters and a set of docs examples, loads each route in headless Chromium, and fails if any app's shipped bytes grew compared with `scripts/size-report/baseline.json`. Measured per route: HTML, resume state, inline script, module requests and JS before the first interaction, the runtime/page import closure, and JS loaded by the first scripted interaction. Also measures the ssr-bench lane server bundles. Readable table: `scripts/size-report/baseline.md`. `--update` rewrites the baseline (for intended deltas; list them in the commit). `--apps=playground,example:counter` limits the run, and `--tolerance=<bytes>` allows small growth.

See [the example app](apps/playground/README.md), [latest SSR comparison](docs/benchmarks/2026-10-28-ssr-comparison.md), [perf scoreboard](docs/benchmarks/perf-scoreboard.md), [routing](docs/guides/routing.md), [forms](docs/guides/forms.md), [testing](docs/guides/testing.md), [Vite authoring](docs/guides/vite-integration.md), [DevTools](docs/guides/devtools.md), [large browser comparison](docs/benchmarks/large-dom-comparison.md), [runnable browser benchmark](docs/benchmarks/large-dom-benchmark.md), [batched SSR comparison](docs/benchmarks/batched-ssr-comparison.md), [earlier large-page SSR comparison](docs/benchmarks/optimized-ssr-comparison.md), [compiled/native SSR comparison](docs/benchmarks/compiled-ssr-comparison.md), [compiled runtime milestone](docs/design/compiled-runtime-milestone.md), [measured baseline and limitations](docs/benchmarks/ssr-foundation-results.md), [implementation notes](docs/design/ssr-foundation-implementation-notes.md), [benchmark instructions](apps/ssr-bench/README.md), the [approved architecture](docs/design/specs/2026-10-02-rivet-ssr-first-restart-design.md), and the [first implementation plan](docs/design/plans/2026-10-02-rivet-ssr-foundation.md).

Next stages: [`ROADMAP.md`](ROADMAP.md); resumable boundaries (the derived model, [measured](docs/benchmarks/2026-10-20-derived-r5.md)) are the only resume model since plan M6; data from the page is on by default (`resume.domData: false` opts out). Native compiler and server work must justify their crossing costs in measurements. DI is deferred; framework components (React, Preact) render as islands through `@rivetjs/bridge`.

## Design skills for AI assistants

The portable [`rivet-ui-design` skill](skills/rivet-ui-design/SKILL.md) guides colors, spacing, typography, page structure, app layouts, component composition and interactions using `@rivetjs/ui` and `@rivetjs/cdk`. It supports Codex, Claude Code and Cursor and works without MCP. From your consumer project, install from a local clone:

```sh
npx skills add /path/to/rivet/skills --skill rivet-ui-design --agent codex claude-code cursor
```

See [installation and distribution](skills/README.md) for manual/global installation and the remote command once the bundles are pushed to the public repository. New starters include the skill.

## License

MIT — see [LICENSE](LICENSE). Ported upstream code keeps its original notices (`libs/cdk/NOTICE`).
