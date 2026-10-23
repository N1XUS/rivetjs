---
title: Signals
description: Create a signal, read it in JSX, change it from a handler, and learn which values a signal can hold in a resumed page.
template: guide
related: [learn/signals, guides/state/computed, guides/state/effects, guides/state/equality]
---

A :term[signal]{id=signal} is a value that tells the page when it changes. After reading this page you can create signals, show them in JSX, update them from event handlers, and avoid the mistakes that stop updates from reaching the page.

::example{id=counter}

## Create a signal

Import `signal` from `@rivetjs/reactivity` and give it a start value.

```tsx
import { signal } from "@rivetjs/reactivity";

const count = signal(0);
const name = signal("");
const todos = signal<{ id: number; text: string }[]>([]);
```

A signal is a function. Call it to read the value: `count()` returns `0`.

::api{symbol="@rivetjs/reactivity#signal"}

## Show it in JSX

Read the signal inside JSX. Rivet remembers which parts of the page read which signals.

```tsx title="src/routes/index.tsx"
import { signal } from "@rivetjs/reactivity";

export default function Page() {
  const count = signal(0);
  return (
    <button type="button" class={count() > 0 ? "font-bold" : ""} onClick={() => count.update((n) => n + 1)}>
      Clicked {count()} times
    </button>
  );
}
```

When `count` changes, only the text `{count()}` and the `class` attribute update. The component function does not run again. On a server-rendered page it runs in the browser only once, when the component is first used: see [Server first](/learn/server-first.md).

## Update it

A signal has two write methods:

| Method | What it does | Returns |
| --- | --- | --- |
| `count.set(5)` | Sets a new value. | The value |
| `count.update((n) => n + 1)` | Computes the new value from the current one. | The value |

```tsx
count.set(10);
count.update((n) => n * 2); // 20
```

Write signals in event handlers, in [effects](./effects.md), or in other browser code. Each write updates the page right away. To group several writes into one update, see [batching](./batching.md).

The function you pass to `update` does not subscribe anything to the signal. You can call `update` inside an effect without making the effect depend on the signal it writes.

## Read without subscribing

Sometimes you want the current value but do not want the code around it to re-run when the value changes. Use `untrack`:

```ts
import { effect, signal, untrack } from "@rivetjs/reactivity";

const query = signal("");
const visits = signal(0);

effect(() => {
  // Re-runs when `query` changes, not when `visits` changes.
  console.log(query(), untrack(() => visits()));
});
```

`untrack(fn)` also takes a signal or a computed directly. This computed depends only on `a`. It reads the latest `b` each time `a` changes, but a change to `b` alone does not recompute it:

```ts
import { computed, signal, untrack } from "@rivetjs/reactivity";

const a = signal(1);
const b = signal(10);

const total = computed(() => a() + untrack(b));

total(); // 11
b.set(20);
total(); // still 11: `b` is not a dependency
a.set(2);
total(); // 22
```

::api{symbol="@rivetjs/reactivity#untrack"}

## One subscription per key: `selector`

A list where each row asks "am I the selected one?" would normally make every row depend on the selected id: a new selection re-runs all rows. `selector(source)` returns a function `isSelected(key)` with the same answer, `key === source()`, but each row depends only on its own key. A change re-runs the row that lost the selection and the row that gained it. This is Solid's `createSelector`.

```tsx
import { selector, signal } from "@rivetjs/reactivity";

const selectedId = signal<number | null>(null);
const isSelected = selector(selectedId);

// 1000 rows: a new selection updates 2 of them.
const row = (id: number) => (
  <li aria-selected={isSelected(id)} onClick={() => selectedId.set(id)}>
    Row {id}
  </li>
);
```

With the default comparison only the previous and the next value can change their answer, so a change looks up just those two keys, whatever the number of rows. Subscribing costs no lookup either: new rows are only listed, and indexed in a later task.

Pass a function to compare keys another way, e.g. membership in a `Set`. Then every subscribed key is compared on a change, unless the `keys` option lists the keys whose answer may have changed:

```ts
import { selector, signal } from "@rivetjs/reactivity";

const selected = signal<Set<string>>(new Set());
const isIn = selector(selected, (key: string, set) => set.has(key), {
  // Keys added or removed since the previous value.
  keys: (next, previous) => [...next].filter((k) => !previous.has(k)).concat([...previous].filter((k) => !next.has(k))),
});
```

Outside a computed or effect, `isSelected(key)` just reads the source. On the server, a resumed page records the source signal, as with any other read.

::api{symbol="@rivetjs/reactivity#selector"}

## Arrays and objects

A signal compares the old and the new value with `Object.is`. If you change an array in place and set the same array again, nothing updates. Make a new array or object instead:

```ts
// Does not update: same array.
todos().push({ id: 3, text: "Walk" });
todos.set(todos());

// Updates: new array.
todos.update((list) => [...list, { id: 3, text: "Walk" }]);
```

You can change this comparison with the `equals` option. See [equality](./equality.md).

## Values in a resumed page

On a server-rendered page, Rivet writes the value of each signal of an interactive component into the HTML. The browser reads it back when the component wakes up. So the value should be :term[serializable]{id=serializable}: Rivet must be able to turn it into text and back. A signal holding something else starts again from its initial value in the browser.

These values work: strings, numbers, booleans, `null`, `undefined`, plain objects and arrays, `Date`, `URL`, `Map`, `Set` and `bigint`. These do not: functions, class instances, symbols, promises and `WeakMap`. The server render fails with an error that names the type.

## Common mistakes

- **Reading without calling.** `{count}` passes the signal itself. In text, write `{count()}`. (Props are live: `count={count()}` on a component updates the child, see [components](../components/components.md#props-are-live). Pass the signal itself when the child writes it.)
- **Writing during a computed.** A `computed` must only read. A write inside it throws `Signal writes are not allowed during computed evaluation`.
- **Changing an object in place.** See [arrays and objects](#arrays-and-objects).
- **Putting a class instance in a signal.** It cannot go into the page data. Store plain data and build the instance in the browser code that needs it.

## See also

- [Computed values](./computed.md): values derived from signals.
- [Effects](./effects.md): run code when signals change.
- [Signals, explained](/learn/signals.md): how the pieces fit together.
