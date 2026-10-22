---
title: Testing
description: Test components with Vitest and happy-dom, check the server HTML, and test resumed pages end to end with Playwright on a production build.
template: guide
status: experimental
related: [guides/tooling/vite, guides/tooling/testing-resumability, guides/state/batching, gotchas/dev-and-production-differ]
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
| `@rivetjs/runtime/testing/resume` | `serializeAndRevive(() => value)`: a value written like a page render and read back like the browser, in Node. See [testing resumability](testing-resumability.md). |
| `@rivetjs/testing/jest-dom` | `@testing-library/jest-dom` matchers on Vitest's `expect` (`toHaveAttribute`, `toHaveTextContent`, …). Import it once as a setup file. |
| `@rivetjs/testing/user` | Testers for accessible widgets (listbox, menu, select, tabs, …), ported from React Aria. Used mostly with [@rivetjs/cdk](site:cdk/start/testing/). |

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

- No component code before the first interaction: count script requests with `page.on("request")` until the first click.
- Errors: collect `page.on("pageerror")` and console errors and expect none. `function is not serializable` and similar fail the server render, so check the response status too.

## Common mistakes

- **Testing resume with `render`.** `render` builds the page in the browser way. Resume-only problems (captures that are not serializable, handlers that do nothing) show only in a server render plus a real page, or in [`serializeAndRevive`](testing-resumability.md) for the captured values.
- **Reading the DOM before `flush()`.** Effects, `Async` results and promise callbacks land later. `await flush()` first.
- **Mixing server and DOM tests in one file.** The file name picks the compile target. Keep `*.server.test.tsx` separate.

## See also

- [Batching](../state/batching.md): when the DOM updates after a handler.
- [Vite](vite.md)
- [cdk testing](site:cdk/start/testing/): browser mode and widget testers.
