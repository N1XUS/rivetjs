---
title: Equality
description: Control when a signal or computed value counts as changed with the equals option, and what that means in a resumed page.
template: guide
related: [guides/state/signals, guides/state/computed]
---

When you write a signal, Rivet compares the new value with the old one. If they are equal, nothing updates. After reading this page you can change that comparison, turn it off, and use it on computed values to skip work.

## The default

Signals and computed values compare with `Object.is`. For numbers, strings and booleans this is what you expect:

```ts
import { signal } from "@rivetjs/reactivity";

const count = signal(1);
count.set(1); // equal: no update
count.set(2); // update
```

For objects and arrays, `Object.is` checks identity, not content. A new object with the same content is "not equal". The same object changed in place is "equal":

```ts
import { signal } from "@rivetjs/reactivity";

const user = signal({ id: 1, name: "Ada" });
user.set({ id: 1, name: "Ada" }); // new object: update
user().name = "Grace";
user.set(user()); // same object: no update, the page shows "Ada"
```

## A custom comparison

Pass `equals` in the options. It gets the previous and the next value. Return `true` when they are equal, so no update happens:

```ts
import { signal } from "@rivetjs/reactivity";

const sameId = (a: { id: number }, b: { id: number }) => a.id === b.id;
const selected = signal({ id: 1, name: "Ada" }, { equals: sameId });

selected.set({ id: 1, name: "Ada L." }); // same id: no update
selected.set({ id: 2, name: "Grace" }); // update
```

::api{symbol="@rivetjs/reactivity#EqualsOptions"}

## Always update

`equals: false` turns the comparison off. Every write updates, even with the same value. This is useful when you change a value in place on purpose:

```ts
import { signal } from "@rivetjs/reactivity";

const box = { n: 0 };
const tick = signal(box, { equals: false });

box.n += 1;
tick.set(box); // updates although it is the same object
```

## On computed values

`computed` takes the same option. When a computed value computes again and the result is equal to the last one, things that read it do not update. This stops work early.

```ts
import { computed, signal } from "@rivetjs/reactivity";

const score = signal(0);
// Changes only when the score crosses a multiple of 10.
const level = computed(() => Math.floor(score() / 10), { equals: (a, b) => a === b });
```

When `score` goes from 3 to 4, `level` computes again, gets `0` again, and nothing that shows `level` updates.

## In a resumed page

The comparison must also work in the browser, after the page resumes. Rivet can carry it over when the compiler can see the function:

```ts
import { signal } from "@rivetjs/reactivity";

// Works: a function written inside the options.
signal(item, { equals: (a, b) => a.id === b.id });

// Works: a function from the same component or module.
signal(item, { equals: sameId });

// Fails: the options object is built at run time.
const options = makeOptions();
signal(item, options);
```

The last case fails during the server render with `equals comparator is not resumable`. Write the options object inline in the `signal(...)` or `computed(...)` call.

## Common mistakes

- **Returning `true` for "changed".** `equals` returns `true` when the values are the **same**. Returning `true` means "skip the update".
- **Changing objects in place without `equals: false`.** The page does not update. Prefer making a new object; use `equals: false` only when you have a reason.

## See also

- [Signals](./signals.md)
- [Computed values](./computed.md)
