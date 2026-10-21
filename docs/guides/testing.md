# Testing components

Unit-test Rivet components with Vitest. Test entries (`@rivetjs/runtime/testing*`, `@rivetjs/testing/*`) are test-only: nothing in the runtime imports them (zero cost for apps).

## Runner: Vitest

- Repo setup: root `vitest.config.ts`, one project per suite (`npx vitest run --project <name>`; nx `test` targets call the same). Full run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t test --output-style=static --skip-nx-cache`.
- Project helpers in `vitest.config.ts`:
  - `node(name, include)`: Node workers (`pool: "forks"`), `environment: "node"`, `nodeConditions()`, setup file `libs/testing/node-env.ts`. Most suites (`libs/<pkg>/tests/*.test.ts`).
  - `dev(name, include)`: same suite under `--conditions=development` + the recording devtools hook (`reactivity-dev`, `runtime-dev`).
  - `browser(name, include)`: Vitest browser mode in real Chromium (Playwright provider) with `rivetTest()`; files `*.browser.test.{ts,tsx}` (`kit-browser`, `testing-browser`); setup file `libs/testing/browser-env.ts` (headless cursor guard); `provide.rivetPerfBudgets`.
- CI parity (CI-RED-2 2026-10-21):
  - Headless cursor guard (`libs/testing/headless-cursor.ts`): Linux headless Chromium (CI) dispatches trusted pointer / mouse over / enter / move at its virtual cursor, screen (0, 0), after layout (hover intents, chunk prefetches "before interaction", extra `pointerenter`); macOS does not. The guard swallows those arrivals (+ the matching out / leave) at window capture: `node-env.ts` installs it in every Playwright browser context (client instrumentation, loaded with Playwright only), `browser-env.ts` in the Vitest tester frame. `RIVET_HEADLESS_CURSOR=origin` approximates CI's cursor on macOS (mouse to (0, 0) on each `domcontentloaded`). `page.mouse.move(0, 0)` still "moves away" (the element left gets its out / leave).
  - Node: CI runs Node 24 (`.nvmrc` 24.14.1, `actions/setup-node` 24). Reproduce Node-specific CI failures with a Node 24 binary (no global `ErrorEvent`; ICU / CLDR NNBSP before AM / PM in `Intl` date formats; slower wasm).
  - Perf budgets (absolute ms bounds in functional suites): enforced off CI only (`CI` unset, or `RIVET_PERF_BUDGETS=1`): node suites check `process.env`, browser suites `inject("rivetPerfBudgets")` (root `vitest.config.ts` `PERF_BUDGETS`). CI's shared 2-vCPU runners measured 2–20× the local numbers; the benchmark lanes are the perf gates.
  - Slow host: wait for the state (a request, a flag, a log line, `networkidle`, a promise-held chunk — `withPage` `delays` takes a promise) instead of a fixed sleep margin.
- Node projects run on Node's own loader (`experimental.viteModuleRunner: false`): type stripping, package `exports`, `.tsx` through the register hook in `execArgv` (`--import @rivetjs/runtime/testing/register`).
- Vite resolve conditions cleared (`nodeConditions()` from `@rivetjs/testing/vite`), else Vitest forwards `--conditions development` to workers and suites silently run against the development façades. Deliberate dev run: `--conditions=development` in `execArgv`.
- `@rivetjs/testing/node-env` (setup file): plain-`node` defaults (no `NODE_ENV=test`, source maps off) + the headless cursor guard in every Playwright browser context.
- No per-test timeout (`testTimeout: 0`, `hookTimeout: 0`).

```ts
// vitest.config.ts — minimal app setup mirroring the repository's node projects
import { defineConfig } from "vitest/config";
import { nodeConditions } from "@rivetjs/testing/vite";

export default defineConfig({
  plugins: [nodeConditions()],
  test: {
    pool: "forks",
    environment: "node",
    experimental: { viteModuleRunner: false },
    execArgv: ["--import", "@rivetjs/runtime/testing/register"],
    setupFiles: ["@rivetjs/testing/node-env"],
  },
});
```

## DOM setup

- Node projects: a DOM implementation (`happy-dom`, used by the repo's own tests; `jsdom` also works) installed as `globalThis.document`. Browser projects: the real document.
- Helpers read `globalThis.document` only for the default container; events use the target element's own window constructors.
- `@rivetjs/compiler` needed as a dev dep (optional peer of `@rivetjs/runtime`; used by the register hook and `rivetTest()`).

```ts
// test/dom.ts — import first in DOM test files (node projects)
import { Window } from "happy-dom";
const window = new Window({ url: "http://localhost/" });
Object.assign(globalThis, { window, document: window.document });
```

## Compiling `.tsx` in tests

- Node projects: register hook `@rivetjs/runtime/testing/register` (in `execArgv`). Browser projects: `rivetTest()` Vite plugin (`@rivetjs/testing/vite`), same targeting rules.
- `.tsx` / `.jsx` modules compile through the Rivet compiler (types stripped, inline source map; `--enable-source-maps` for mapped stacks). `.ts` files: Node's own type stripping.
- Target: DOM by default.
- Server target: `*.server.test.{ts,tsx,js,jsx,mts,mjs}` files and every `.tsx`/`.jsx` module imported from them (transitively through `.tsx`/`.jsx`; the URL carries `?rivet-target=server`). A plain `.ts` module in between does not propagate — import components from the test file or a `.tsx` module.
- `RIVET_TEST_TARGET=server` (register hook) / `rivetTest({ target: "server" })`: everything on the server target.
- DOM-target modules compile exactly as the Vite plugin ships them (DOM v2 is the only DOM lowering). Only the hook / plugin compile; tests calling `compile()` themselves keep their options. Assert target-independent markup with `@rivetjs/testing/html` `normalizedHTML` (or `view.html()`), never marker comments.
- Compile errors throw `SyntaxError: Rivet compile failed:` with `file:line:column message` per diagnostic.
- Not applied: Vite-plugin features (css`` scoping, route `server*` export splitting, i18n static calls, resume mode). Test those through the app's Vite build.

## `@rivetjs/testing` (dev-only toolkit)

- `./steps`: `steps(t => …)` — sequential named sub-steps in one test, failures aggregated.
- `./user`: `@react-aria/test-utils` port (`User` + pattern testers); real `@testing-library/user-event` / `@testing-library/dom` / `@testing-library/jest-dom` (`./jest-dom` registers matchers on Vitest `expect`).
- `./jest`, `./jasmine`: Jest / Jasmine globals over Vitest for ported upstream suites (`jest.mock` / `jest.unmock` throw: write hoisted `vi.mock`; Jasmine spies stub until `.and.callThrough()`); `./fake-events`: Angular CDK fake events.
- `./vite` `rivetTest()`: also registers `./cleanup` (auto `cleanup()` after each test; `cleanup: false` opts out) and `./serializer` (`rivetSerializer`: DOM snapshots without marker comments; `serializer: false`).
- Details: `libs/testing/CLAUDE.md`.

## DOM helpers (`@rivetjs/runtime/testing`)

- `render(() => <App/>, { container? })` → `{ container, unmount, html(), find(selector) }`.
  - Default container: new `<div>` appended to `document.body`, removed on unmount. A given container stays in place (emptied).
  - `html()`: container `innerHTML` without the runtime's range marker comments.
  - `find(selector)`: `querySelector` in the container; throws (with the markup) when nothing matches. Generic: `find<HTMLInputElement>("input")`.
  - `unmount()`: disposes owners, effects, listeners; idempotent.
- `cleanup()`: unmounts every tree `render` created + restarts the `@rivetjs/runtime/id` counter (order-independent ids). Auto-registered by `rivetTest()` (Vitest) and on a global `afterEach` (Jest, Vitest `globals`; `RIVET_SKIP_AUTO_CLEANUP=1` opts out); otherwise (node:test, register hook) call it from `afterEach`.
- `fire(el, type, init?)`: dispatches a real event with `@testing-library/dom` `fireEvent` defaults per type (`testing-events.ts`, ported event map): constructor (`MouseEvent`, `PointerEvent`, `KeyboardEvent`, `FocusEvent`, `InputEvent`, `TouchEvent`, `DragEvent`, `AnimationEvent`, `TransitionEvent`, `CompositionEvent`, `ClipboardEvent`, `WheelEvent`, …) and `bubbles` / `cancelable` / `composed` (focus / blur / mouseenter don't bubble). `init` overrides; unknown (custom) types → plain `Event` with `init` only. Handlers run batched → DOM updated when `fire` returns (untrusted events always flush synchronously; only the first trusted mouse click per document — Playwright `page.click`, Vitest browser `userEvent` — flushes one task later: wait or `flush()`, see [resumability](resumability.md#first-mouse-click-deferred-flush)). Returns `dispatchEvent`'s result (`false` after `preventDefault`).
  - Inputs: set `el.value` / `el.checked`, then `fire(el, "input")` / `fire(el, "change")`.
- `await flush()`: settles a pending deferred click flush (`_settle`), then two task turns — drains microtask chains of any depth (`clientEffect` start, Async commits of already-settled promises); real timers: zero-delay timeouts queued before it fire. Fake timers (Vitest / Jest / node:test mocks): MessageChannel turns, never the faked clock — advance timers yourself. Pending promises: resolve them first, then `flush()`. `@rivetjs/testing/user` `act(async …)` awaits the callback, then `flush()`.

```tsx
// counter.test.tsx
import "./dom.ts";
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { render, fire, flush, cleanup } from "@rivetjs/runtime/testing";
import { Counter } from "./Counter.tsx";

afterEach(cleanup);

test("increments", async () => {
  const view = render(() => <Counter start={1} />);
  fire(view.find("button"), "click");
  assert.equal(view.find("output").textContent, "2");
  await flush(); // clientEffect work
  assert.equal(view.html(), '<div class="counter"><button>+1</button><output>2</output></div>');
});
```

## Server helper (`@rivetjs/runtime/testing/server`)

- `renderToString(() => <App/>, options?)` → always `Promise<string>`: sync output, Async children awaited, render failures reject. `options`: `signal`, `variant` (as `renderToString` of `@rivetjs/runtime/server`).
- Use from `*.server.test.tsx` (or `RIVET_TEST_TARGET=server`). `clientEffect` / handlers do not run.

```tsx
// counter.server.test.tsx
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Counter } from "./Counter.tsx";

test("ssr", async () => {
  assert.equal(await renderToString(() => <Counter start={3} />), '<div class="counter"><button>+1</button><output>3</output></div>');
});
```

## Not included

- Router stub for file-route pages: none yet — render the page component directly with its props/loader data.
- Resume (SSR → resumed client) tests: repo-internal harness only (`libs/runtime/tests/resume/harness.ts`, Chromium).
