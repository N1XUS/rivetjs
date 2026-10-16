# @rivetjs/devtools

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Rivet DevTools (experimental, `private: true`): page agent + prebuilt panel UI for pages on the Vite dev server (`vite serve` only). Components, signals, contexts, updates, HMR, errors, performance, router / i18n / forms panes. Loaded by `rivet()` (`libs/compiler/vite.ts`, optional peer dep) and `rivetRouter()` (`libs/router/build/vite.ts`); `devtools: false` opts out.

## Entry points

| Subpath | File | For |
| --- | --- | --- |
| `./agent` | `agent/index.ts` | Page agent; side effect `start()` on import. Injected as first module script of every dev page (`agentScript(base)` → `<base>@id/@rivetjs/devtools/agent`). See [agent/CLAUDE.md](agent/CLAUDE.md). |
| `./server` | `server.ts` | Node / dev-server side: `uiMiddleware(base)` (serves `dist/ui` under `<base>__rivet/devtools/`, 503 + build hint when unbuilt; `<prefix>__build` → `{ v: VERSION, hash: sourceHash() }` for the panel's stale-build check; never rejects — malformed `%` path → 400, other failures → `next(error)`: connect does not await, an unhandled rejection would kill the dev server), `agentScript`, `_uiDir`, `UI_PATH`, `sourceHash(dir?)` (sha256/16 of `protocol.ts` + `ui/**/*.{ts,tsx,css,html}`; null without `ui/` — installed package — and the panel then skips the stale check), re-exports `nameSignals`. |
| `./protocol` | `protocol.ts` | Wire types + constants shared by agent and panel: `Envelope`, `Preview`, edit ops, panel DTOs, `VERSION`, `BATCH` (500), `REQUEST_TIMEOUT` (20 s), `UI_PATH`, `BUILD_PATH` / `BuildInfo`, `SOURCE`, `channelName`, `CLAIMS` (session-claim channel), `displayName`. |

Not exported: `build.ts`, `names.ts` (reached via `./server`), `ui/`.

## Layout

- `build.ts` — builds the panel (`ui/`, a Rivet app) with Vite + `rivet()` into `dist/ui/` (gitignored; production mode, relative `base: "./"`, minified, no sourcemaps; `define __RIVET_DEVTOOLS_BUILD__` = `sourceHash()`). `node libs/devtools/build.ts` or `nx run devtools:build`. Exports `buildUI()`, `_uiDir` (re-exported from `server.ts`).
- `server.ts` — see table. Imports only `protocol.ts` + `names.ts` (+ node builtins); never reaches a build.
- `names.ts` — dev transform `nameSignals(code, map, lang)`: `signal`/`computed`/`createContext` imported from `@rivetjs/*` and assigned to a binding → `__rivetName(call, "name")` + appended helper emitting `name` to the hook. Same-line edits; `shiftMappings` shifts source-map columns. Also `namedCalls`.
- `protocol.ts` — single source of wire shapes; change both sides together.
- `agent/` — in-page agent (hook, model, overlay, previews, edits, perf, sources). [agent/CLAUDE.md](agent/CLAUDE.md)
- `ui/` — panel app (own realm: iframe or pop-out). [ui/CLAUDE.md](ui/CLAUDE.md)
- `tests/` — node suites (vitest project `devtools`; `*.dev.test.ts` = project `devtools-dev`, `--conditions=development`: `island-recovered.dev.test.ts` = RV2149 `error.island` from `@rivetjs/bridge/adapter`): unit (`hook`, `preview`, `source`, `model`, `edit`, `context`, `causes`, `names`, `perf`, `requests`, `link` — panel transport with a fake BroadcastChannel + store stale-build / version checks, `session` — duplicate-tab session claims, `tree` — Components tree flatten / collapse / filter / windowing / keyed selection, `server` — panel middleware never rejects, build endpoint, built `dist/ui` hash = live sources), `zero-cost` (`DEV_STRINGS` incl. `resume.region`), Chromium e2e (`e2e*.test.ts`, Playwright + Vite dev server on copies of `libs/router|forms|i18n/tests/fixture`).

## Rules / invariants

- Zero production cost: production bundles of every `@rivetjs/reactivity` / `@rivetjs/runtime` entry contain no dev façades or devtools event strings (`tests/zero-cost.test.ts`; byte-hash gate vs main in CI). Instrumentation lives in `development`-condition façades in reactivity/runtime/router/forms, not here.
- Builds never include DevTools (production or development builds). `nameSignals` runs only on `vite serve` client modules; `compile()` output unchanged.
- Agent never imports app or framework code; its failures surface as `agent` errors, never thrown into the page.
- Previews never invoke user code (getters reported, not called); proxy trap errors contained.
- Overlay: shadow root, constructed stylesheet (strict CSP OK), DOM built without HTML parsing (Trusted Types OK).
- Hook key: `globalThis[Symbol.for("rivet.devtools")]`. Levels: 1 = structure (always), 2 = writes/runs/DOM updates (panel open). The hook retains no events (no rings): kept events go straight to the agent.
- Requests always get a response: handler result, or `error.request` (throw / unknown type) → panel rejects; panel also rejects after `REQUEST_TIMEOUT`. Event names/payloads typed by `Events` (agent `send` / `Outgoing`).
- Panel UI icons: never invent SVG paths, never UTF symbols as icons — lucide (`lucide` dep) via `ui/icon.tsx` `Icon`. `×` stays only as count text (`×3`), never as a control.

## Commands

```sh
export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH
node libs/devtools/build.ts                                                        # = nx run devtools:build → dist/ui
NX_DAEMON=false npx nx run devtools:typecheck --output-style=static --skip-nx-cache   # node scripts/tsc.ts -p libs/devtools (tsgo)
npx vitest run --project devtools                                                  # needs dist/ui; nx run devtools:test builds first
```
- Publishable package: `NX_DAEMON=false npx nx run devtools:package` → `dist/libs/devtools` (`.ts` → `.js`, `.tsx` → `.jsx`, `.d.ts`, LICENSE, generated package.json); publish from there — this package.json stays the private workspace manifest (`publishConfig.directory`). Builder + tarball smoke: `scripts/package/` (scripts/CLAUDE.md). `package` runs `build` first (ships `dist/ui`); `vite` is a peer (`names.ts` imports `parseAst` at runtime).

## Gotchas

- e2e suites need `dist/ui` built and Playwright Chromium; stale `dist/ui` = panel tests against old UI → rebuild after `protocol.ts` / `ui/` edits (`tests/server.test.ts` fails on a stale build; the panel shows a rebuild banner). Router/playground/cdk-docs tests opening the panel depend on it too.
- Resumed router dev pages have no component instances: tabs needing them trigger `rivet:devtools-inspect` → client render switch (see docs/guides/devtools.md "Use").
- Panel icons go through `ui/icon.tsx` (lucide `createElement`, real SVG namespace). A JSX `<svg>{icon.map(([tag, attrs]) => <path {...attrs} />)}</svg>` (docs-kit `Icon`) renders `<path>` in the HTML namespace on client renders (runtime bug, `libs/runtime/dom.ts` `parsed()` `"inherit"` context) → invisible icons; SSR output is fine.
- `libs/docs-kit/tools/tsconfig.api.json` excludes `libs/devtools/ui/**` by path — moving `ui/` breaks API docs extraction.

## See also

- [docs/guides/devtools.md](../../docs/guides/devtools.md) — usage, panels, how it works, limits.
- `docs/design/specs/2026-10-03-devtools-design.md`, `docs/design/plans/2026-10-03-devtools.md`.
- `libs/compiler/vite.ts` (`devtools` option), `libs/router/build/vite.ts`, `libs/reactivity/dev.ts`, `libs/runtime/dev/`.
