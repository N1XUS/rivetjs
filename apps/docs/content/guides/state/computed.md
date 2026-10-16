---
title: Computed values
description: Derive values from signals with computed, so totals, filters and labels stay correct without extra code.
template: guide
related: [guides/state/signals, guides/state/equality, guides/state/effects]
---

A :term[computed]{id=computed} value is a value made from other signals: a total from a cart, a filtered list from a search box, a label from a count. After reading this page you can create computed values, use them in JSX, and know the rules they follow.

::example{id=computed-total}

## Create a computed value

Pass a function to `computed`. The function reads signals and returns a value.

```tsx
import { computed, signal } from "@rivetjs/reactivity";

const price = signal(440);
const quantity = signal(2);
const total = computed(() => price() * quantity());

total(); // 880
quantity.set(3);
total(); // 1320
```

Like a signal, a computed value is a function. Call it to read it. It has no `set` or `update`: you change it by changing the signals it reads.

::api{symbol="@rivetjs/reactivity#computed"}

## Use it in JSX

Read a computed value in JSX the same way as a signal:

```tsx title="src/routes/index.tsx"
import { computed, signal } from "@rivetjs/reactivity";

export default function Search() {
  const query = signal("");
  const names = ["Ada", "Grace", "Alan"];
  const matches = computed(() => names.filter((name) => name.toLowerCase().includes(query().toLowerCase())));
  return (
    <div>
      <input type="search" model:value={query} />
      <p>{matches().length} of {names.length} match</p>
    </div>
  );
}
```

When `query` changes, `matches` computes again, and the text updates.

## When it computes

A computed value is lazy and cached:

- It runs its function the first time something reads it.
- It keeps the result. Reading it again returns the stored value.
- When a signal it reads changes, it is marked as out of date. It computes again the next time something reads it.

So a computed value that nothing reads costs nothing. And reading it many times in one update runs the function only once.

## It stops updates that change nothing

When a computed value computes again and gets an equal result, the things that read it do not update. For example, `computed(() => count() > 10)` only notifies the page when the answer switches between `true` and `false`, not on every change of `count`.

"Equal" means `Object.is` by default. You can pass your own comparison with the `equals` option. See [equality](./equality.md).

## Rules

- **Only read.** The function must not write signals. A write throws `Signal writes are not allowed during computed evaluation`. If you need to write when something changes, use an [effect](./effects.md).
- **No side effects.** Do not fetch, log or touch the DOM inside it. It may run at any time, or not at all.
- **No JSX.** In a resumed page, JSX inside a computed is not allowed. The compiler reports `JSX inside handlers, effects and computeds is not resumable`. Compute data, and render it in the component's JSX.

## Computed values in a resumed page

On a server-rendered page, a computed value does not go into the page data as a value. Rivet records which function made it and what it read. The browser rebuilds it when it is first needed. This means the values it reads must be :term[serializable]{id=serializable}, like any value a handler uses. See [serializable captures](/best-practices/serializable-captures.md).

## Common mistakes

- **Using a plain function instead.** `const total = () => price() * quantity()` also works in JSX, but it computes again every time it is read, and it does not stop equal results. Use `computed` when the work is not tiny or when many places read it.
- **Storing a copy in a signal.** Do not copy a derived value into a second signal with an effect. Use `computed`, so the two can never disagree.

## See also

- [Signals](./signals.md)
- [Equality](./equality.md)
- [Effects](./effects.md)
