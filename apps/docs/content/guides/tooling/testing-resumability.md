---
title: Testing resumability
description: Unit-test what a resumed page captures without a browser — serializeAndRevive encodes a value like a page render and revives it like the browser.
template: guide
status: experimental
related: [guides/tooling/testing, learn/resuming, best-practices/serializable-captures, gotchas/function-is-not-serializable]
---

A handler on a resumed page runs with values the server wrote into the page. `serializeAndRevive` checks those values in a plain Node test: it builds a value where a component body runs, writes it the way a page render does, and reads it back the way the browser does. After reading this page you can test that your captures resume (functions, `let` variables, signals, stores, classes, `reconstruct`) and that the ones that cannot fail with the error a real page shows. This answers a common request for resumable frameworks: testing resumability without a browser.

:::warning[Experimental testing API]
`@rivetjs/runtime/testing/resume` runs under the Node loader hook `@rivetjs/runtime/testing/register` (Vitest `execArgv: ["--import", "@rivetjs/runtime/testing/register"]` with `experimental: { viteModuleRunner: false }`). The `rivetTest()` Vite plugin does not compile resume modules yet. The API may change.
:::

## What it does

| Step | Same as |
| --- | --- |
| `make()` runs inside the server recorder | a component body during a resumable render: closures, `let` variables, stores and `reconstruct` sites register there only |
| its result is encoded as the captures of one client effect | the page state: table entries, references to module functions, class entries, the chunks the value needs |
| the state is decoded in the same process | the browser: functions come from their compiled browser chunk, classes from the browser copy of the module, `registerClass` revivers from a separate browser registry |

The value you get back is a copy built like the browser's: a revived function is the browser chunk's function, a revived `Money` is an instance of the browser module's `Money`.

## Write a test

Put the code that builds the value in a component module (`.tsx`). The compiler registers captures only in component-like functions, named with a capital letter. Import that module with `importResume`.

- `make` returns the value to revive. A component that returns JSX gives markup, not captures, so write a function that builds the value and returns it (`Cart()` below).
- Do not return a bare function with no parameters (`return () => total()`). The compiler renders a capitalized function's returned parameterless accessor as a child where the call sits, so you would get the rendered value, not the function. Return it inside an object (`{ read: () => total() }`), as below.

```tsx title="src/cart.tsx"
import { signal } from "@rivetjs/reactivity";

export class Money {
  cents: number;
  constructor(cents: number) {
    this.cents = cents;
  }
  euros() {
    return this.cents / 100;
  }
}

export function Cart() {
  const total = signal(new Money(250));
  let adds = 0;
  const add = (cents: number) => {
    adds++;
    total.set(new Money(total().cents + cents));
    return adds;
  };
  return { total, add };
}
```

```ts title="src/cart.test.ts"
import { expect, test } from "vitest";
import { importResume, serializeAndRevive } from "@rivetjs/runtime/testing/resume";

const url = new URL("./cart.tsx", import.meta.url);
const cart = await importResume<typeof import("./cart.tsx")>(url);
const browser = await importResume<typeof import("./cart.tsx")>(url, "browser");

test("the cart resumes", async () => {
  const revived = await serializeAndRevive(() => cart.Cart());
  expect(revived.total()).toBeInstanceOf(browser.Money);
  expect(revived.add(100)).toBe(1);
  expect(revived.add(100)).toBe(2); // the `let` counter is shared, as on the page
  expect(revived.total().euros()).toBe(4.5);
});
```

For a value with no compiled parts (data, a `Map`, a `Date`), `serializeValue(value)` does the same round trip.

## Test what must fail

A value that cannot resume rejects with the error a page render throws for it. Only the start of the message differs: it names `serializeAndRevive#value` (in development: capture `` `value` ``) where a page names the handler.

```ts
test("a WeakMap is refused", async () => {
  await expect(serializeAndRevive(() => ({ cache: new WeakMap() }))).rejects.toThrow("WeakMap instance is not serializable");
});
```

A class with a `#private` field and no `static [revive]`, captured by a handler, fails when the module compiles: `importResume` rejects with the compiler's message. See [serializable captures](../../best-practices/serializable-captures.md) for what can be captured.

## Options

| Option | Use |
| --- | --- |
| `symbols: { "src/cart.tsx": chunk }` | Browser chunks by module id (path from the workspace root: the nearest `package.json` with `workspaces`), instead of the chunks the loader hook compiles. Pass another build's chunk to test deploy skew: a missing symbol throws the browser's skew error (`error.skew` = the symbol id). |
| `platform: { window, location, WebSocket, … }` | Browser globals defined while the value decodes, when revivers run (`static [revive]`, `registerClass`, built-in entries). They are removed when the call returns. A `reconstruct` factory and a revived function run later, when you call them, and see the test's own globals then. Default: none. |
| `contexts: [[token, value]]` | Values for registered contexts the value holds (`resumableContext`), as `createResume({ contexts })` gets them. |
| `state: (state) => …` | Look at the page state before it decodes, for example that a narrowed store does not ship a field nobody reads. |

## Limits

- Element refs, routers and ErrorBoundary resets need a document: a value holding one rejects. Test those in a browser.
- What happens after the decode (a binding re-running, a region re-created) is not covered. Test it with Playwright on a production build ([testing](testing.md#test-resumed-pages-end-to-end)).
- `.ts` modules are not compiled for resume, as in an app: a closure they create is refused.

## See also

- [Testing](testing.md): components, server HTML, end-to-end.
- [Resuming](../../learn/resuming.md): what the browser receives.
- [Function is not serializable](../../gotchas/function-is-not-serializable.md)
