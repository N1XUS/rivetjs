---
title: Signals
description: What signals are, how Rivet uses them to update only the changed parts of a page, and how they carry state from the server to the browser.
template: concept
status: experimental
related: [guides/state/signals, guides/state/computed, guides/state/effects, guides/state/batching, guides/state/equality]
---

A :term[signal]{id=signal} is a value that tells others when it changes. Rivet uses signals for all state that can change on a page. When a signal changes, Rivet updates exactly the parts of the page that read it, and nothing else.

## What it is

A signal is a function with two methods:

```ts
import { signal } from "@rivetjs/reactivity";

const count = signal(0); // create, with a starting value
count(); // read: 0
count.set(5); // write a new value
count.update((n) => n + 1); // write, based on the old value: 6
```

There are two more building blocks:

- **`computed(fn)`** is a value worked out from other signals. It re-runs `fn` only when a signal it read has changed.
- **`effect(fn)`** runs `fn` now and again each time a signal it read changes. In components, use `clientEffect` from `@rivetjs/runtime/dom` for browser work instead (see below).

```ts
import { computed, effect, signal } from "@rivetjs/reactivity";

const price = signal(20);
const quantity = signal(2);
const total = computed(() => price() * quantity());

effect(() => console.log("total is", total())); // logs "total is 40"
quantity.set(3); // logs "total is 60"
```

::api{symbol="@rivetjs/reactivity#signal"}

## Why it matters

Many frameworks re-run a whole component when its state changes, then compare the old and new output to find what changed. Rivet does not re-run components at all. It needs another way to know what to update, and signals are that way.

- **Updates are precise.** A change to `count` touches the text node that shows `count`, not the component, not the list next to it.
- **Components can run once.** Because updates do not depend on re-running components, the component can run on the server only. This is what makes [resuming](resuming.md) possible.
- **Unchanged values stop early.** If a computed value comes out the same as before, the things that read it do not run.

## How it works

Reading a signal inside a tracked function (a computed, an effect, or a JSX expression) records a dependency. Writing the signal notifies everything that depends on it.

```tsx compiled title="Cart.tsx"
import { signal } from "@rivetjs/reactivity";

export default function Cart() {
  const quantity = signal(1);
  return (
    <p>
      <button type="button" onClick={() => quantity.update((n) => n + 1)}>
        Add
      </button>
      {quantity()} items
    </p>
  );
}
```

The compiler sees that `{quantity()}` reads a signal and turns it into a binding: a small piece of code that updates one text node. The rest of the JSX is plain HTML. Turn on "Compiled output" to see both: the browser code with its one binding, and the server code that joins strings.

Across server and browser:

1. **Server.** `Cart()` runs. `quantity` is `1`. While writing `{quantity()}`, the server records that this text depends on `quantity`, and saves the value `1` into the page.
2. **Browser, before any change.** Nothing runs. The signal is not even created yet.
3. **Browser, first change.** You click "Add". The handler runs, and the runtime creates `quantity` from the saved value `1`. The handler sets it to `2`. The binding for the text wakes up and writes `2`.

A binding that reads no signal, such as `{title}` with a plain string, is static. It is never updated, and no code for it reaches the browser.

## Reading versus passing

The parentheses matter:

```tsx
import { signal } from "@rivetjs/reactivity";

export function Count() {
  const count = signal(0);
  const now = count(); // in the component body: reads once, on the server
  return (
    <>
      <p>{now}</p> {/* a snapshot: never updates */}
      <p>{count()}</p> {/* read inside JSX: the text updates when count changes */}
    </>
  );
}
```

Code in the component body runs on the server, and once in the browser when the component wakes up. A value read there is a snapshot. Read signals inside JSX, `computed`, handlers or effects to see changes.

## Equality

A signal notifies only when the new value is different. By default it compares with `Object.is`. That is why this does nothing:

```ts
const list = signal([1, 2]);
list.update((items) => {
  items.push(3); // changes the same array
  return items; // same array, so no notification
});
```

Return a new array or object instead: `list.update((items) => [...items, 3])`. You can also pass your own comparison, `signal(value, { equals })`, or `{ equals: false }` to always notify. See [equality](../guides/state/equality.md).

## What it means for your code

- **All changing state is a signal.** A plain `let` variable changed in a handler does not update the page.
- **Signal values are saved into the page.** A signal of a component that wakes up in the browser is written into the page when it holds :term[serializable]{id=serializable} data: strings, numbers, plain objects and arrays, dates, maps, sets. A signal holding a class instance or a function starts again from its initial value in the browser.
- **Update immutably.** Create new arrays and objects when you change them.
- **Handlers run in a batch.** Several `set` calls in one handler cause one update of the page, not one per call. Outside handlers, wrap them in `batch(() => …)`. See [batching](../guides/state/batching.md).
- **Use `clientEffect` for browser side effects.** `effect` runs where its code runs, and a component body runs on the server. `clientEffect(fn)` runs only in the browser, at a time you choose (`load`, `idle`, `visible`, …). See [effects](../guides/state/effects.md).

## Coming from another signal library

The names are familiar, but some behaviour differs from Preact signals, Solid, Angular signals and the TC39 proposal:

| Behaviour | Rivet | Elsewhere |
| --- | --- | --- |
| When effects run | During `set()`: effects that depend on the signal have run when `set()` returns. Inside `batch(() => …)` (and in handlers) they run once, when the batch ends. | Preact: the same. Solid 2 runs them in a microtask, Angular schedules them. |
| An effect throws | The `set()` that triggered it throws the first error, even if the effect is unrelated to the code that called `set()`. Other errors of the same update go to `reportError`. Use `catchError` to handle them where they happen. | Angular sends them to its `ErrorHandler`. |
| Unused computeds | A `computed` stays connected to its signals until its scope is disposed, even when nothing reads it. It still computes only when read. | Preact, Angular and TC39 disconnect a computed that nothing watches. |
| A computed throws | The error is kept: reads throw it again until a signal it read changes. | The same in Preact, Angular and TC39. |
| Circular computeds | A computed that reads itself (directly or through others) gets its previous value, at first `undefined`. There is no error yet, so avoid cycles. | Preact, Angular and TC39 throw. |
| Equality | `Object.is`: `NaN` to `NaN` does not notify, `0` to `-0` does. | Preact and Solid compare with `===`. |
| Endless updates | An effect that runs more than 10,000 times in one update stops with "Reactive effect did not settle". | Preact stops after 100 rounds. |
| `catchError` handler | Runs inside the `catchError` scope: `useContext` and `getOwner()` work there, and it reads signals without subscribing. | |
| `createRoot` | The root belongs to the scope it is created in and is disposed with it. Create it outside any scope for its own lifetime. | Solid's roots are detached. |
| Untracked reads | `untrack(sig)` or `untrack(() => …)`, for signals and computeds; there is no `peek()`. | Preact: `peek()` on signals and computeds. Solid: `untrack`. Angular: `untracked`. |

## Related

- [Signals guide](../guides/state/signals.md): create, read, update, share.
- [Computed values](../guides/state/computed.md) and [effects](../guides/state/effects.md).
- [Tutorial step 3: state](../start/tutorial/03-state.md): signals in a real component.
