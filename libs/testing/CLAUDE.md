# @rivetjs/testing

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Dev-only test toolkit (`private: true`, never a runtime dep): Vitest plugins/setup, Jest + Jasmine compat globals for ported upstream suites, ported react-aria testers, ported Angular CDK fake events. Real `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` are dependencies — use them, don't port them.

## Entry points

| Subpath | File | For |
| --- | --- | --- |
| `./vite` | `vite.ts` | `rivetTest({ target?, cleanup?, serializer? })` Vite plugin: `.tsx`/`.jsx` through the Rivet compiler (DOM target; server target for `*.server.test.*` + their transitive `.tsx` imports and relative `.ts`/`.mts` imports (`index.ts` barrels), tagged `?rivet-target=server`; package specifiers never tagged; same rule as `@rivetjs/runtime/testing/register`; compile `warnings` → `this.warn(formatDiagnostic(…))` once per site and message, origin `compiler`); its `config()` hook adds Vitest `test.setupFiles` `cleanup.ts` and `test.snapshotSerializers` `serializer.ts` (opt out: `cleanup: false` / `serializer: false`). `nodeConditions()`: clears Vite resolve conditions so workers don't silently run `development` façades. |
| `./cleanup` | `cleanup.ts` | Setup file: `afterEach(() => cleanup())` (`@rivetjs/runtime/testing`) — unmounts every `render`, restarts the id counter. Registered by `rivetTest()`; add by hand for configs without it. |
| `./serializer` | `serializer.ts` | `rivetSerializer` (default export too): Element / DocumentFragment snapshots print a deep clone with every comment (anchors, resume markers) dropped and text normalized; clone nodes go to a WeakSet so the default DOM printer takes over (no recursion). |
| `./node-env` | `node-env.ts` | Vitest `setupFiles` entry: unset `NODE_ENV=test`, source maps off (plain-`node` behaviour); headless cursor guard in every Playwright browser context (a `module.registerHooks` load hook on `playwright-core/index.js` calls `installPlaywrightGuard` — suites without a browser never import Playwright). |
| `./browser-env` | `browser-env.ts` | Vitest browser-mode `setupFiles` entry (root `browser()` projects): `guardOriginPointer()` in the tester frame. Browser only (touches `window` on import): `scripts/package/smoke.ts` `HOST_ONLY` (types only). |
| `./headless-cursor` | `headless-cursor.ts` | CI parity (CI-RED-2 2026-10-21): Linux headless Chromium dispatches trusted pointer / mouse over / enter / move at its virtual cursor, screen (0, 0), after layout; macOS does not. `guardOriginPointer()` (in-page, self-contained, idempotent): window-capture listeners swallow those arrivals at screen (0, 0) and the out / leave of elements whose arrival was swallowed (a later scripted arrival makes it real again); `window.__rivetOriginPointer` counts per type; CSS `:hover` untouched. `installPlaywrightGuard(playwright)`: client instrumentation `runAfterCreateBrowserContext` → `addInitScript(guardOriginPointer)` (`newContext`, `newPage`, persistent). `RIVET_HEADLESS_CURSOR=origin`: mouse to (0, 0) on every page's `domcontentloaded` (approximates CI on macOS; reproduced router `nested` "first navigation" without the guard). Test: `tests/headless-cursor.test.ts`. |
| `./steps` | `steps.ts` | `steps(t => …)`: sequential named sub-steps in one test (node:test `await t.test` semantics; all failures aggregated). |
| `./jest` | `jest.ts` | Jest globals over Vitest (`jest` = object inheriting `vi`) for react-spectrum ports; `jest.mock` / `jest.unmock` throw (Vitest hoists only literal `vi.mock` / `vi.unmock`; the jest call would silently mock nothing) — ports write `vi.mock(…)`. |
| `./jest-dom` | `jest-dom.ts` | jest-dom matchers registered on Vitest `expect` (import once, side effect). |
| `./jasmine` | `jasmine.ts` | Jasmine shim for Angular ports: `jasmine.createSpy`, `spyOn().and/.calls`, `jasmine.clock()`, Jasmine-only matchers. Jasmine semantics: `createSpy(name, fn)` / `spyOn` / `spyOnProperty` stub (return undefined) until `.and.callThrough()` etc.; `toHaveClass` is jest-dom's matcher (superset; same result whichever of `./jasmine` / `./jest-dom` loads last). |
| `./fake-events` | `fake-events/index.ts` | Angular CDK `testing/testbed/fake-events` port — see [fake-events/CLAUDE.md](fake-events/CLAUDE.md). |
| `./html` | `html.ts` | `normalizedHTML(node, { properties, focus }?, self?)`: target-independent markup (comments / empty Text anchors dropped, adjacent text merged, attributes sorted, SVG elements `svg:`-prefixed, live `:value` / `:checked` / `:selected` + `:focus` pseudo-attributes). For marker-free assertions (DOM v2-only spec Q9). |
| `./fuzz` | `fuzz/index.ts` | Resume fuzz (Function Bridge T31): `fuzzRoute(route, { origin, browser, from?, seed?, maxSteps?, text?, viewport?, minimize?, skip? })` → `{ elements, steps, findings, ms, compareEnded? }` (resumed document vs CSR client navigation of one story route, every interactive element driven, normalised DOM compared after each step; finding kinds `resume-error` / `page-error` / `csr-error` / `mismatch` / `recreated` / `missing` / `load` / `reload`), `fuzzSuite({ routes, start, project, pins, options })` (one vitest test per route + one `test.fails` per pin, skipped under `RIVET_FUZZ_STEPS` / `RIVET_FUZZ_SEED`; pins `{ route, kind, match, step?, owner, note, design? }` match the finding's `diff` (differing tokens / lines only); `design: true` pins only filter; `RIVET_FUZZ_OUT` JSON lines), `storyRoutes(dir, { exclude })`, `selectRoutes(routes, env)` (`RIVET_FUZZ_ROUTES` / `RIVET_FUZZ_SHARD`), `plan`, `attributeDiff`, `diffLines`, `structuralDiff`, `formatFinding(finding, project?)` (+ rerun command), `rerunCommand`. In-page half `fuzz/page.ts` `installFuzz` + `dropPreloads` (resumed page only: post-parse `modulepreload` links removed — handler chunks load on their events only, deterministic cold state) (init scripts, self-contained: Playwright sends its source; calls go through `page.evaluate`, so page CSPs do not apply). Consumers `libs/cdk/tests-fuzz`, `libs/ui/tests-fuzz` (projects `cdk-resume-fuzz` / `ui-resume-fuzz`). Guide: `docs/guides/resumability.md` "Fuzz". |
| `./user` | `user/index.ts` | `@react-aria/test-utils` port: `User` + pattern testers — see [user/CLAUDE.md](user/CLAUDE.md). |

## Layout

- Flat top-level `*.ts` = single-file subpaths. Convention: single-file subpath stays a flat file; multi-file subpath = folder with `index.ts`. Do NOT move `vite.ts` / `node-env.ts`: root `vitest.config.ts` imports them by path (`./libs/testing/vite.ts`, `setupFiles: ["libs/testing/node-env.ts"]`).
- `fake-events/` — Angular port (6 files).
- `user/` — react-aria testers port (17 files).
- `fuzz/` — resume fuzz: `resume-fuzz.ts` (driver: two contexts per route, settle = no request younger than 1.5 s in flight + 2 frames twice, stamps for re-creation, exact-triple attribute tolerance keyed per element, comparison ends on a structural diff but the route keeps running for errors, repro minimisation), `page.ts` (in-page discovery / normaliser / snapshot; dropped attributes `data-r`, `data-b` (derived-model boundary ids, M2-R5 2026-10-20), `data-rivet-*`, `data-fuzz*`; generated ids renumbered by first appearance: `createId` scopes + lazy row seeds `rvr<forId>_<k>_<n>`), `suite.ts` (vitest wiring; `pinMatches` / `openFindings` / `checkPin` exported for the unit test), `index.ts`. Pin rule: a finding becomes a `test.fails` pin only when 3 reruns of its route (default plan, `dropPreloads` on) give identical findings; 1 or 2 of 3 = timing → narrow `design: true` pin (observed `diff` lines + `step`, rate in the note). `dropPreloads` is not proven to cancel a fetch already started — the 3 runs are the evidence (guide `docs/guides/resumability.md` "Fuzz").
- `tests/` — own suites: `headless-cursor.test.ts` (guard: origin arrivals swallowed in `newPage` + `newContext` pages, scripted over / enter / move delivered, a move away to (0, 0) still delivers out / leave), `steps.test.ts`, `fuzz-helpers.test.ts` (resume fuzz pure helpers: exact triples, `structuralDiff`, `rerunCommand` round trip through `selectRoutes`, a pin whose match no longer hits fails loudly, ids numbered in attribute-name order via `installFuzz` in happy-dom), `jest-shim.test.ts`, `vite.test.ts` (`rivetTest` server-target tagging: `.tsx`, relative `.ts`/`.mts` barrels, packages untagged) (node), `*.browser.test.*` (Chromium via Vitest browser mode; `toolkit.browser.test.tsx` = round-2 TK1–TK6 regressions: flush / act under fake timers, `fire` defaults, auto-cleanup + id reset across tests, serializer inline snapshot, jasmine stubs / `toHaveClass`, `installPointerEvent` restore).

## Rules / invariants

- Faithful ports: upstream files 1:1 with header `// Ported from <repo> (<path>), <license>, © <owner>.`; Rivet deviations marked inline `// Rivet: …` (e.g. `user/utils.ts` `cached`). Keep upstream formatting (2-space, single quotes) in ported files — don't prettier them into repo style. Port upstream specs alongside.
- Rivet-specific glue only where React/Angular differ: `user/act.ts` (Rivet `act`: sync passthrough + reactivity `_settle()` (a trusted first mouse click's deferred flush); async → await + `flush()` from `@rivetjs/runtime/testing` — any microtask depth, fake-timer safe).
- No runtime package may depend on this one except as a devDependency (cdk lists it as dev).
- Licences: Apache-2.0 (react-spectrum) / MIT (Angular) notices kept in file headers.

## Commands

```sh
export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH
NX_DAEMON=false npx nx run testing:typecheck --output-style=static --skip-nx-cache   # node scripts/tsc.ts -p libs/testing (tsgo)
npx vitest run --project testing --project testing-browser                         # = nx run testing:test
```
- Publishable package: `NX_DAEMON=false npx nx run testing:package` → `dist/libs/testing` (`.ts` → `.js`, `.tsx` → `.jsx`, `.d.ts`, LICENSE, generated package.json); publish from there — this package.json stays the private workspace manifest (`publishConfig.directory`). Builder + tarball smoke: `scripts/package/` (scripts/CLAUDE.md). Peers pinned to the tested majors (`vite` ^8.3.2, `vitest` ^5.0.3, `happy-dom` ^20.14.5, `playwright` ^1.63.0). Module paths handed to Vitest must be inline `new URL("./x.ts", import.meta.url)` (rewritten to `.js`), not built through a helper.

## Gotchas

- `jest-dom.ts` registers matchers by hand: `@testing-library/jest-dom/vitest` typings target Vitest <5 `Assertion<T>`; extension point is `Matchers<R, T>`.
- Vitest forwards Vite's `development` condition to workers unless `nodeConditions()` is in plugins → suites test the dev façades. For a deliberate dev run add `--conditions=development` to `execArgv`.
- `user/user.ts` imports `pointerMap` from `./index.ts` (circular, upstream-faithful) — keep.
- Fake timers: `flush()` / `act()` are safe, but `userEvent.setup()` (default `delay: 0`) waits on the faked clock → silent hang (root `vitest.config.ts` has `testTimeout: 0`). Use `userEvent.setup({ delay: null })` (as upstream specs do) or `advanceTimers: vi.advanceTimersByTime`.
- Auto-cleanup order: the setup file's `afterEach` is registered first, so it runs after a file's own `afterEach` hooks.
- Resumability unit tests: `@rivetjs/runtime/testing/resume` `serializeAndRevive` (Function Bridge T30) — needs the node register hook (`@rivetjs/runtime/testing/register`, `?rivet-resume=` modules); `rivetTest()` does not compile resume modules yet.
- Planned but not built (memory plan): `/dom` (happy-dom render/cleanup/screen), `/resume` (SSR → resume → trigger; values without a browser: `@rivetjs/runtime/testing/resume`), `/browser` (Playwright story harness), Angular `ComponentHarness` ports. Today `render`/`cleanup` come from `@rivetjs/runtime/testing`; cdk keeps its own helpers in `libs/cdk/tests*/harness.ts`.

## See also

- [docs/guides/testing.md](../../docs/guides/testing.md) — repo test setup, conditions, node-env.
- `apps/cdk-docs/src/routes/(docs)/start/testing.tsx` — user-facing testing page (testers on cdk components).
- [../cdk/](../cdk/) — main consumer.
