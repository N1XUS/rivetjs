---
title: "Step 3: state"
description: Give each book card a signal and a button, and see how Rivet resumes a card when you use it.
template: tutorial
status: experimental
related: [learn/signals, guides/state/signals, guides/components/events, learn/resuming]
---

## Goal

Each card gets a button. Clicking it switches the label between "Not read yet" and "Read". You learn how to keep state in a signal and how to handle a click.

## Add a signal and a button

Update `src/components/BookCard.tsx`:

```tsx title="src/components/BookCard.tsx"
import { signal } from "@rivetjs/reactivity"; // [!code ++]

interface BookCardProps {
  title: string;
  author: string;
}

export function BookCard({ title, author }: BookCardProps) {
  // Each card has its own piece of state: has the book been read?
  const read = signal(false); // [!code ++]
  return (
    <li class="flex items-center justify-between rounded-lg border border-slate-200 p-3">
      <div>
        <p class="font-semibold">{title}</p>
        <p class="text-sm text-slate-600">{author}</p>
      </div>
      <button
        type="button"
        class="rounded-md border border-teal-700 px-3 py-1 text-sm text-teal-700"
        onClick={() => read.update((value) => !value)}
      >
        {read() ? "Read" : "Not read yet"}
      </button>
    </li>
  );
}
```

How it works:

- `signal(false)` creates a value that can change. Its starting value is `false`.
- `read()` reads the value. Because the JSX reads it, Rivet knows that the button label depends on `read`.
- `read.update((value) => !value)` changes the value based on the old one. `read.set(true)` would set it directly.
- `onClick={...}` runs the function when you click the button.

When `read` changes, Rivet updates only the button text. It does not run `BookCard` again.

## Nothing to register

`BookCard.tsx` is outside `src/routes` and now has a handler and state. `rivetRouter` resumes every component file a route imports, so `vite.config.ts` stays as it is and the component works in the production build.

The page itself does not change in this step.

## What runs where

This is the core idea of Rivet, so look at it closely:

1. **On the server** (at build time), `BookCard` runs three times, once per card. Each run creates a signal with `false`, writes the HTML, and records that the button has a click handler and that its text depends on the signal.
2. **In the HTML**, the browser gets the three cards with "Not read yet" and their boundary records. The unchanged literal `false` values need no saved signal entries.
3. **In the browser**, the card adopts its existing HTML when used, then the handler changes its signal and Rivet updates its label. The build can emit a smaller adoption function for simple cards like this one.

This is :term[resuming]{id=resumability}: the browser picks up where the server left off, instead of running all components again. [Resuming](../../learn/resuming.md) explains the details.

## Check that it works

Click the button on "Dune". Its label changes to "Read". The other cards keep "Not read yet", because each card has its own signal.

::example{id=tutorial-03}

The "What loaded" line below the example lists the scripts the page loaded before and after the first click. By default, the loader fetches the page's interactive code at idle after load without running it. Pointer or keyboard intent fetches any missing code sooner. See [preloading](../../guides/performance/preloading.md).

:::gotcha[Component setup is not a reactive update]
Code at the top of `BookCard` runs during server rendering and can run again when the browser adopts the card. It does not re-run for each signal change. Put browser work in a handler or `clientEffect`. See [component did not run again](../../gotchas/component-did-not-run-again.md).
:::

## Next step

Each card knows only its own state. To show "1 of 3 read" at the top, the page needs all books in one place. In the next step you move the books into a list.

[Step 4: lists](04-lists.md)
