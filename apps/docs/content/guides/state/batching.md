---
title: Batching
description: Group several signal writes into one page update with batch, and learn where Rivet already batches for you.
template: guide
related: [guides/state/signals, guides/state/effects, guides/components/events]
---

Each signal write updates the page right away. When you change several signals together, you usually want the page to update once, with all the new values. `batch` does that. After reading this page you know when you need it and when Rivet already does it for you.

## The problem

Here an effect reads two signals. Without a batch, it runs after each write:

```ts
import { effect, signal } from "@rivetjs/reactivity";

const first = signal("Ada");
const last = signal("Lovelace");
effect(() => console.log(first(), last()));
// logs "Ada Lovelace"

first.set("Grace"); // logs "Grace Lovelace" (a name that never existed)
last.set("Hopper"); // logs "Grace Hopper"
```

The middle run sees a half-updated state. It also does work that is thrown away right after.

## Use batch

Wrap the writes in `batch`. Effects and page updates wait until the batch ends, then run once:

```ts
import { batch } from "@rivetjs/reactivity";

batch(() => {
  first.set("Grace");
  last.set("Hopper");
});
// logs "Grace Hopper" once
```

::api{symbol="@rivetjs/reactivity#batch"}

## What happens inside a batch

- **Reads see new values.** After `first.set("Grace")`, `first()` returns `"Grace"` inside the same batch. Computed values are fresh too.
- **Only effects wait.** Effects and DOM updates run when the outermost batch ends.
- **Batches can nest.** An inner `batch` does not flush on its own. Everything runs when the outer one ends.
- **It returns a value.** `batch(() => compute())` returns what the function returns.
- **Errors still flush.** If the function throws, the waiting effects still run, then the error is thrown again.

```ts
const total = batch(() => {
  price.set(500);
  quantity.set(3);
  return price() * quantity(); // 1500: reads are already updated
});
```

## Where Rivet batches for you

Rivet runs these inside a batch, on resumed pages and on pages the browser renders alike:

- every event handler in JSX, like `onClick` or `onSubmit`,
- every handler passed to `clientEvent`.

So in a normal handler you do not need `batch`:

```tsx
<button
  type="button"
  onClick={() => {
    // One page update for both writes.
    name.set("");
    loud.set(false);
  }}
>
  Reset
</button>
```

### The first mouse click on a page

Chrome holds back the next frame for about 25 to 45 ms when the first mouse click in a tab changes the page during its click event. To avoid that wait, Rivet updates the page for that one click in the next task instead of at the end of the handler:

- The handler itself still runs during the click. `preventDefault()`, `stopPropagation()` and signal writes happen right away, and signal reads see the new values.
- Only the page update (effects and DOM bindings) waits, for one task. In Chrome the click then paints after about 13 ms instead of about 45 ms.
- It applies to the first trusted mouse click per page whose handler changes a signal. Later clicks, keyboard presses, touch taps and events you dispatch yourself (`el.click()`, testing libraries) update the page before the handler returns, as above.
- The waiting update never reorders: the next event, `batch`, or signal write outside a batch applies it first.

Code that reads the DOM right after that first click, in the same task (a microtask, or a test that checks the page right after a real click), sees the old page. Read signals instead, or wait one task. In end-to-end tests, use assertions that retry (Playwright `expect(locator).toHaveText(…)`).

You need `batch` yourself in code that Rivet does not call as a handler: inside a timer, a promise callback, a `clientEffect`, or a plain TypeScript module.

```tsx
clientEffect(() => {
  const timer = setInterval(() => {
    batch(() => {
      seconds.update((s) => s + 1);
      ticks.update((t) => t + 1);
    });
  }, 1000);
  return () => clearInterval(timer);
});
```

## Common mistakes

- **Expecting reads to be stale.** Inside a batch, reads return the new value. Only effects wait.
- **Async work inside batch.** `batch` is synchronous. Writes after an `await` inside the function happen after the batch has ended. Put a new `batch` around writes that happen after the `await`.

## See also

- [Signals](./signals.md)
- [Effects](./effects.md)
- [Events](../components/events.md)
