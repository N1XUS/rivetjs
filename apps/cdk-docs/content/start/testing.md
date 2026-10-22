---
title: Testing
description: Test @rivetjs/cdk components with Vitest - browser mode, the ported React Aria testers in @rivetjs/testing, Angular CDK fake events and server render tests.
template: guide
status: experimental
related: [start/installation, start/resumability, components/overview, components/listbox, components/menu]
---

Test cdk components the way you use them: render them in a real browser, drive them like a user, and assert ARIA state. After this page you have a Vitest setup with a browser project and a server project, a component test with a React Aria tester, and a test of the server HTML.

:::note[Alpha release]
`@rivetjs/testing` is available on npm as `0.1.0-alpha.1`. Install it as a dev dependency with `npm install -D @rivetjs/testing`. Its API may change.
:::

## Packages

| Import | Gives you |
| --- | --- |
| `@rivetjs/runtime/testing` | `render(() => <App />)` (returns `container`, `unmount()`, `html()`, `find(selector)`), `cleanup()` (unmount everything, restart ids; automatic after each test with `rivetTest()`), `flush()` (let effects and async commits settle; safe under fake timers), `fire(target, type, init)` (a real event with the browser's class and `bubbles` / `cancelable` / `composed` defaults for that type, like Testing Library's `fireEvent`) |
| `@rivetjs/runtime/testing/server` | `renderToString(() => <App />)`: server HTML as a Promise |
| `@rivetjs/testing/vite` | `rivetTest()`: Vite plugin that compiles `.tsx` through the Rivet compiler, for the DOM, or for the server in `*.server.test.tsx` files and the `.tsx` modules they import; registers auto-cleanup (`cleanup: false` to opt out) and the snapshot serializer (`serializer: false`); `nodeConditions()` |
| `@rivetjs/testing/serializer` | `rivetSerializer`: DOM snapshots without the runtime's marker comments (registered by `rivetTest()`; elsewhere `expect.addSnapshotSerializer(rivetSerializer)`) |
| `@rivetjs/testing/cleanup` | Setup file running `cleanup()` after each test, for configs without `rivetTest()` |
| `@rivetjs/testing/user` | Port of `@react-aria/test-utils`: `User` and its testers for `ListBox`, `Menu`, `Select`, `ComboBox`, `Tabs`, `Dialog`, `RadioGroup`, `CheckboxGroup`, `GridList`, `Table`, `Tree`; `pointerMap`, `installPointerEvent`, `installMouseEvent`, `triggerLongPress` |
| `@rivetjs/testing/fake-events` | Port of Angular CDK fake events: `dispatchFakeEvent`, `dispatchKeyboardEvent`, `dispatchMouseEvent`, `dispatchPointerEvent`, `dispatchTouchEvent`, `create*Event`, `typeInElement`, `clearElement`, `triggerFocus`, `triggerBlur`, `patchElementFocus` |
| `@rivetjs/testing/jest-dom` | `@testing-library/jest-dom` matchers (`toHaveAttribute`, `toBeInTheDocument`, …) on Vitest's `expect`; import once as a setup file |
| `@rivetjs/testing/jest` | Jest globals on Vitest (`jest` = `vi`), for suites ported from react-spectrum |
| `@rivetjs/testing/jasmine` | Jasmine globals on Vitest (spies, `jasmine.clock()`, Jasmine-only matchers), for suites ported from Angular Components |
| `@rivetjs/testing/steps` | `steps()`: sequential named subtests inside one test |
| `@rivetjs/testing/node-env` | Setup file: undoes Vitest's `NODE_ENV=test` |

`@rivetjs/testing` depends on `@testing-library/dom`, `@testing-library/user-event` and `@testing-library/jest-dom`; Vitest, Playwright and the compiler are peer dependencies.

## Vitest config

Two projects: Chromium (Vitest browser mode with Playwright) for components, Node for server render tests.

```ts title="vitest.config.ts"
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { rivetTest } from "@rivetjs/testing/vite";

export default defineConfig({
  plugins: [rivetTest()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.tsx"],
          setupFiles: ["@rivetjs/testing/jest-dom"],
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" }] },
        },
      },
      { extends: true, test: { name: "server", include: ["src/**/*.server.test.tsx"], environment: "node" } },
    ],
  },
});
```

- Dev dependencies: `vitest`, `@vitest/browser-playwright`, `playwright` (plus `npx playwright install chromium`).
- `rivetTest()` picks the compile target by file name: `*.server.test.tsx` and its `.tsx` imports compile for the server, everything else for the DOM. `rivetTest({ target: "server" })` forces one target.
- `rivetTest()` also adds Vitest config: a setup file that runs `cleanup()` after each test (unmounts every `render`, restarts the `rvc…` id counter, so tests don't depend on their order) and `rivetSerializer`, so `expect(container).toMatchSnapshot()` shows the markup without `<!--rivet:…-->` range comments.
- A real browser gives layout, focus and pointer events; the overlay position engine and focus scopes need it.
- The repository's own `vitest.config.ts` uses the same `browser()` shape (`testing-browser`, `kit-browser` projects).

## A component test

Render, then drive the component through a tester. Testers find parts by role and ARIA attributes, so they work on cdk markup:

```tsx title="src/fruit.browser.test.tsx"
import { expect, test } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { render } from "@rivetjs/runtime/testing";
import { ListBox, type Selection } from "@rivetjs/cdk/listbox";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger, type Key } from "@rivetjs/cdk/menu";
import { User } from "@rivetjs/testing/user";

const fruits = [
  { key: "apple", label: "Apple" },
  { key: "banana", label: "Banana" },
  { key: "cherry", label: "Cherry", disabled: true },
];

test("ListBox: mouse and keyboard selection", async () => {
  const selected = signal<Selection>(new Set());
  render(() => <ListBox id="fruit" aria-label="Fruit" items={fruits} selectionMode="multiple" selectedKeys={selected} />);
  const user = new User({ interactionType: "mouse" });
  const listbox = user.createTester("ListBox", { root: document.getElementById("fruit")! });

  await listbox.toggleOptionSelection({ option: "Banana" });
  expect([...(selected() as Set<Key>)]).toEqual(["banana"]);
  expect(listbox.getSelectedOptions().map((option) => option.textContent)).toEqual(["Banana"]);

  await listbox.toggleOptionSelection({ option: 0, interactionType: "keyboard" });
  expect(listbox.findOption({ indexOrText: "Apple" })).toHaveAttribute("aria-selected", "true");
  expect(listbox.findOption({ indexOrText: "Cherry" })).toHaveAttribute("aria-disabled", "true");
});

test("MenuTrigger: open with the keyboard, run an action", async () => {
  const actions: Key[] = [];
  render(() => (
    <MenuTrigger>
      <Button id="edit-trigger">Edit</Button>
      <Popover>
        <Menu id="edit" onAction={(key) => actions.push(key)}>
          <MenuItem id="apple">Apple</MenuItem>
          <MenuItem id="banana">Banana</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  ));
  const user = new User({ interactionType: "keyboard" });
  const menu = user.createTester("Menu", { root: document.getElementById("edit-trigger")! });

  await menu.open();
  expect(menu.getMenu()).toHaveAttribute("role", "menu");
  await menu.toggleOptionSelection({ option: "Banana" });
  expect(actions).toEqual(["banana"]);
  expect(document.getElementById("edit")).toBeNull();
});
```

- `new User({ interactionType })`: `"mouse"` (default), `"keyboard"` or `"touch"`; each tester call can override it. `advanceTimer` for fake timers.
- `createTester(name, { root })`: `root` is the widget (listbox, tablist, radio group, table) or its trigger (Menu, Select, ComboBox, Dialog).
- Testers wait for overlays: `menu.open()` resolves once `aria-controls` points at a rendered menu.
- The ListBox tester is exercised against a cdk `ListBox` in `libs/testing/tests/user.browser.test.tsx`; the others (Menu included) are ported unchanged from React Aria and expect the same markup.
- Without a tester: `fire(element, "keydown", { key: "ArrowDown" })` from `@rivetjs/runtime/testing`, `@testing-library/user-event`, or `@rivetjs/testing/fake-events` for Angular-style specs. Call `await flush()` after work that runs in effects; it also works under `vi.useFakeTimers()` (it never waits on the faked clock — advance timers yourself).

## A server render test

Assert the ARIA state the server writes, which is what users get before any code loads (see [Resumability](resumability.md)):

```tsx title="src/toolbar.server.test.tsx"
import { expect, test } from "vitest";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { Tabs } from "@rivetjs/cdk/tabs";

test("server HTML carries the ARIA state", async () => {
  const html = await renderToString(() => (
    <>
      <ToggleButton id="bold" defaultSelected>
        Bold
      </ToggleButton>
      <Tabs id="t" aria-label="Views" items={[{ id: "a", label: "A" }, { id: "b", label: "B" }]} />
    </>
  ));
  expect(html).toContain('aria-pressed="true"');
  expect(html).toMatch(/role="tab"[^>]*aria-selected="true"/);
});
```

The HTML it checks:

```html
<button type="button" id="bold" class="rv-ToggleButton" aria-pressed="true" data-selected="true">Bold</button>
<div id="t" class="rv-Tabs" data-orientation="horizontal">
  <div id="t-tablist" role="tablist" class="rv-TabList" aria-label="Views" aria-orientation="horizontal" … data-rk="ArrowLeft ArrowRight Home End Space Enter">
    <div id="t-tab-a" role="tab" class="rv-Tab" data-key="a" aria-selected="true" tabindex="0" data-selected="true">A</div>
    <div id="t-tab-b" role="tab" class="rv-Tab" data-key="b" aria-selected="false" tabindex="-1">B</div>
  </div>
</div>
```

- `renderToString` runs no `clientEffect` and renders closed overlays as nothing: assert triggers (`aria-expanded="false"`), not overlay content.
- Resume itself (server HTML, then the first interaction in a browser) is covered by building the app: the docs examples run scripted steps against the production build in Chromium.

## Common mistakes

- **Turning off auto-cleanup.** `rivetTest()` runs `cleanup()` after every test: overlays portal to `document.body`, and without it the next test sees them (and ids keep counting). With `rivetTest({ cleanup: false })`, or without `rivetTest()`, add `afterEach(cleanup)` yourself (or the `@rivetjs/testing/cleanup` setup file).
- **happy-dom or jsdom for overlays.** No layout: positioning and focus scopes behave differently. Use the browser project.
- **A `.server.test.tsx` that imports a DOM-only helper.** Everything it imports compiles for the server; keep browser helpers out.
- **Asserting `data-*` values.** Some parts set `""`, others `"true"`: assert presence (`toHaveAttribute("data-selected")`).
