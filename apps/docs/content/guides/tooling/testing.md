---
title: Testing
description: Test components with Vitest and happy-dom, check the server HTML, and test resumed pages end to end with Playwright on a production build.
template: guide
status: experimental
related: [guides/tooling/vite, learn/resuming, guides/state/batching, gotchas/dev-and-production-differ]
---

Rivet code is tested at three levels: components rendered in a DOM (fast, many tests), the HTML the server writes, and whole pages that resume in a real browser. After reading this page you have a Vitest setup for the first two and know what to watch for in end-to-end tests.

:::note[Alpha release]
`@rivetjs/testing` is available on npm as `0.1.0-alpha.1`. Install it as a dev dependency with `npm install -D @rivetjs/testing`. Its API may change.
:::

## Packages

| Import | Gives you |
| --- | --- |
| `@rivetjs/testing/vite` | `rivetTest()`: a Vite plugin that compiles `.tsx` and `.jsx` through the Rivet compiler for tests. DOM output by default; server output for `*.server.test.tsx` files and the `.tsx` modules they import. Also registers auto-cleanup and a snapshot serializer. |
| `@rivetjs/runtime/testing` | `render(() => <App />)` returns `container`, `find(selector)`, `html()` (markup without Rivet's marker comments) and `unmount()`. `fire(element, type, init?)` dispatches a real event with the browser's defaults for that type. `flush()` lets effects and async work settle. `cleanup()` unmounts everything. |
| `@rivetjs/runtime/testing/server` | `renderToString(() => <App />)`: the server HTML, as a promise. |
| `@rivetjs/testing/jest-dom` | `@testing-library/jest-dom` matchers on Vitest's `expect` (`toHaveAttribute`, `toHaveTextContent`, …). Import it once as a setup file. |
| `@rivetjs/testing/user` | Testers for accessible widgets (listbox, menu, select, tabs, …), ported from React Aria. Used mostly with [@rivetjs/cdk](site:cdk/start/testing/). |
| `@rivetjs/testing/html` | `normalizedHTML(node, options?, self?)`: markup without Rivet's anchors, for exact assertions. See [normalized markup](#normalized-markup). |
| `@rivetjs/testing/fuzz` | Resume fuzz: drives every interactive element of a resumed page and of the same page built in the browser, and compares the two. See [resume fuzz](#resume-fuzz). |
| `@rivetjs/testing/browser-env` | Setup file for Vitest browser mode: installs the headless cursor guard in the test page. |
| `@rivetjs/testing/headless-cursor` | `guardOriginPointer()` and `installPlaywrightGuard(playwright)`: the headless cursor guard on its own. See [headless Chromium on Linux](#headless-chromium-on-linux). |
| `@rivetjs/testing/cleanup`, `@rivetjs/testing/serializer` | The auto-cleanup setup file and snapshot serializer that `rivetTest()` registers. Add them by hand to a config without `rivetTest()`. |

`@testing-library/user-event` and `@testing-library/dom` work as they are; no Rivet wrapper is needed.

## Vitest config

Dev dependencies: `vitest` and `happy-dom` (or `jsdom`). Two projects: one renders components in happy-dom, one renders server HTML in Node.

```ts title="vitest.config.ts"
import { defineConfig } from "vitest/config";
import { rivetTest } from "@rivetjs/testing/vite";

export default defineConfig({
  plugins: [rivetTest()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: "dom", include: ["src/**/*.test.tsx"], exclude: ["src/**/*.server.test.tsx"], environment: "happy-dom" },
      },
      { extends: true, test: { name: "server", include: ["src/**/*.server.test.tsx"], environment: "node" } },
    ],
  },
});
```

- `rivetTest()` runs `cleanup()` after every test: each `render` is unmounted and the id counter starts again, so ids do not depend on test order. `rivetTest({ cleanup: false })` turns it off.
- Snapshots of elements leave out Rivet's marker comments. `rivetTest({ serializer: false })` turns that off.
- `rivetTest({ target: "server" })` compiles every module for the server.
- Runtime modules that Vite loads (workspace packages, browser mode) run with the same build switches a resumable app build ships: the adopt run and DOM-backed data on. `rivetTest({ resume: { domData: false } })` matches an app that sets `resume.domData: false`. A runtime that Vitest hands to Node unchanged, and the `@rivetjs/runtime/testing/register` hook under `node --test`, keep every switch off.
- For layout, focus and pointer behaviour, run the DOM project in Vitest browser mode with Playwright instead of happy-dom. The [cdk testing page](site:cdk/start/testing/) shows that config.

## Test a component

```tsx title="src/Counter.tsx"
import { signal } from "@rivetjs/reactivity";

export function Counter(props: { start?: number }) {
  const count = signal(props.start ?? 0);
  return (
    <button type="button" onClick={() => count.update((n) => n + 1)}>
      Clicked {count()} times
    </button>
  );
}
```

```tsx title="src/Counter.test.tsx"
import { expect, test } from "vitest";
import { fire, render } from "@rivetjs/runtime/testing";
import { Counter } from "./Counter.tsx";

test("counts clicks", () => {
  const view = render(() => <Counter start={1} />);
  const button = view.find("button");
  fire(button, "click");
  expect(button.textContent).toBe("Clicked 2 times");
  expect(view.html()).toBe('<button type="button">Clicked 2 times</button>');
});
```

- `render` mounts the component in the browser way: the component runs, handlers attach, bindings update. It does not resume; that needs a server render and a real page (see below).
- Handlers run in a batch, so the DOM is updated when `fire` returns.
- After `await` in a test, or after async code in the component (`Async`, `clientEffect`, timers), call `await flush()` before you read the DOM.

With `@testing-library/user-event`:

```tsx title="src/Counter.user.test.tsx"
import { expect, test } from "vitest";
import userEvent from "@testing-library/user-event";
import { flush, render } from "@rivetjs/runtime/testing";
import { Counter } from "./Counter.tsx";

test("clicks like a user", async () => {
  const view = render(() => <Counter />);
  await userEvent.setup().click(view.find("button"));
  await flush();
  expect(view.find("button").textContent).toBe("Clicked 1 times");
});
```

:::gotcha
With fake timers (`vi.useFakeTimers()`), `userEvent.setup()` waits on the faked clock and the test hangs. Use `userEvent.setup({ delay: null })`, or `advanceTimers: vi.advanceTimersByTime`. `flush()` itself is safe under fake timers.
:::

## Test the server HTML

Name the file `*.server.test.tsx`. `rivetTest()` compiles it, and the components it imports, for the server:

```tsx title="src/Counter.server.test.tsx"
import { expect, test } from "vitest";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Counter } from "./Counter.tsx";

test("server HTML", async () => {
  expect(await renderToString(() => <Counter start={3} />)).toBe('<button type="button">Clicked 3 times</button>');
});
```

Use it for markup that must be right before any JavaScript runs: headings, links, form fields, `aria-*` attributes. Browser globals do not exist here, as on a real server.

## Test resumed pages end to end

Only a real page shows resuming: server HTML, the page state, the loader and the chunks it fetches. Test it with Playwright against a production build (`npm run build`, then `npm start` or `npm run preview`), not the dev server. See [dev and production differ](../../gotchas/dev-and-production-differ.md).

```ts title="tests/counter.spec.ts"
import { expect, test } from "@playwright/test";

test("the counter resumes", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  const button = page.getByRole("button", { name: /Clicked/ });
  await expect(button).toHaveText("Clicked 0 times");
  await button.click();
  await expect(button).toHaveText("Clicked 1 times"); // retries until the update lands
});
```

:::gotcha[Read the DOM after the first click with a retrying assertion]
On the first real mouse click of a page, Rivet applies the DOM update one task after the handler (Chrome otherwise holds the next frame). Code that reads the DOM right after `page.click()` (`page.textContent(…)`, `page.evaluate(…)`) can see the old page. Use assertions that retry, such as `expect(locator).toHaveText(…)`, or `page.waitForFunction`. See [the first mouse click on a page](../state/batching.md#the-first-mouse-click-on-a-page).
:::

Useful checks in such tests:

- Fetching versus execution: record script requests with `page.on("request")`, and separately check when component code runs. Idle prefetch can download a boundary before interaction without executing it. Use the server's `preload: { lean: true }` when testing a page that must avoid background downloads.
- Errors: collect `page.on("pageerror")` and console errors and expect none. Check the response status of the server render too.

## Normalized markup

`view.html()` drops Rivet's marker comments. `normalizedHTML` from `@rivetjs/testing/html` goes further, so one expected string fits every compile target and live form state:

- comments and empty text anchors are dropped, adjacent text is merged;
- attributes are sorted by name, every element gets a closing tag (void elements too), SVG elements print as `svg:<name>`;
- live form state prints as `:value`, `:checked` and `:selected` pseudo-attributes (`properties: false` leaves them out);
- the focused element gets `:focus` (`focus: false` leaves it out).

It prints the children of `node`; pass `true` as the third argument to include `node` itself.

```tsx title="src/Field.test.tsx"
import { expect, test } from "vitest";
import { render } from "@rivetjs/runtime/testing";
import { normalizedHTML } from "@rivetjs/testing/html";

test("typed value shows up", () => {
  const view = render(() => <input name="q" type="text" />);
  const input = view.find("input") as HTMLInputElement;
  input.value = "rivet";
  expect(normalizedHTML(view.container, { focus: false })).toBe('<input :value="rivet" name="q" type="text"></input>');
});
```

## Resume fuzz

`@rivetjs/testing/fuzz` finds pages that behave differently after resuming. For each route it opens two Playwright pages against a production server: the server-rendered document, which resumes, and the route reached by client-side navigation from `from` (default `/`), which renders in the browser. It clicks every interactive element, types into text fields, presses its keys and Escape, and compares the normalized DOM after each step. Playwright is an optional peer dependency.

```ts title="tests/resume-fuzz.test.ts"
import { chromium } from "playwright";
import { start } from "@rivetjs/router/node";
import { fuzzSuite, storyRoutes } from "@rivetjs/testing/fuzz";

fuzzSuite({
  project: "resume-fuzz",
  routes: storyRoutes(new URL("../src/routes/", import.meta.url)),
  start: async () => {
    const app = await start({ dist: "dist", port: 0 });
    const browser = await chromium.launch();
    return {
      origin: app.url,
      browser,
      close: async () => {
        await browser.close();
        await app.close();
      },
    };
  },
});
```

- `storyRoutes(dir, { exclude })` lists the static routes of a routes folder. Layouts, `*.server.ts` files and dynamic segments are left out.
- `fuzzSuite` registers one Vitest test per route. A finding fails the test. Its kinds are `resume-error`, `page-error`, `csr-error`, `mismatch`, `recreated`, `missing`, `load` and `reload`.
- `pins: [{ route, kind, match, owner, note }]` records a known finding as an expected failure (`test.fails`), so the suite stays green until it is fixed. `design: true` only filters the finding.
- `options` passes `fuzzRoute` options to every route: `seed` (default 1), `maxSteps` (default 40), `text` (default `"Rivet 7"`), `viewport`, `minimize` (shorten each reproduction, default on), `skip` (CSS selectors to leave alone).
- `fuzzRoute(route, options)` runs one route without the suite and returns `{ elements, steps, findings, ms }`.

Environment variables: `RIVET_FUZZ_ROUTES` (comma-separated substrings or a `/regex/`), `RIVET_FUZZ_SHARD=i/n`, `RIVET_FUZZ_STEPS`, `RIVET_FUZZ_SEED`, `RIVET_FUZZ_LOG` (print each finding with a rerun command) and `RIVET_FUZZ_OUT` (a file for JSON lines). Pins are skipped while `RIVET_FUZZ_STEPS` or `RIVET_FUZZ_SEED` is set.

## Headless Chromium on Linux

Headless Chromium on Linux keeps a virtual cursor at screen (0, 0). After layout it sends trusted `pointerover`, `pointerenter`, `pointermove` and the matching mouse events to whatever element sits there, so a test can see hover state it never scripted. macOS does not do this, so such tests pass locally and fail in CI.

- `guardOriginPointer()` runs in the page. It swallows those events at screen (0, 0), and the out / leave events of elements whose arrival it swallowed. CSS `:hover` is not affected.
- `installPlaywrightGuard(playwright)` adds `guardOriginPointer` to every browser context the given Playwright instance creates.
- `@rivetjs/testing/browser-env` calls `guardOriginPointer()`. Add it to `setupFiles` of a Vitest browser-mode project.
- `RIVET_HEADLESS_CURSOR=origin` moves the mouse to (0, 0) on every page load, which comes close to CI behaviour on macOS.

## Common mistakes

- **Testing resume with `render`.** `render` builds the page in the browser way. Resume-only problems (a render that differs between server and browser, handlers that do nothing) show only in a server render plus a real page.
- **Reading the DOM before `flush()`.** Effects, `Async` results and promise callbacks land later. `await flush()` first.
- **Mixing server and DOM tests in one file.** The file name picks the compile target. Keep `*.server.test.tsx` separate.

## See also

- [Batching](../state/batching.md): when the DOM updates after a handler.
- [Vite](vite.md)
- [cdk testing](site:cdk/start/testing/): browser mode and widget testers.
