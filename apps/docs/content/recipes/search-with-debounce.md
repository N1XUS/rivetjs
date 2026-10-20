---
title: Search with debounce
description: Filter a list while the user types, but only after a short pause, using a signal, a clientEffect with cleanup and a computed value.
template: recipe
related: [guides/state/effects, guides/state/computed, guides/components/lists, guides/components/forms-and-input]
---

## What you will build

A search box over a list of fruits. The list does not update on every key press. It updates 250 ms after the user stops typing. This is called **debouncing**: you wait until the input is calm, then do the work once.

::example{id=search-with-debounce}

## How it works

### 1. The data comes from a loader

`load(…)` in `index.tsx` returns the list. In a static build the loader runs once, at build time. In a server app it runs for each request.

```tsx title="src/routes/index.tsx"
import { load } from "@rivetjs/router";
export const loader = load(() => ({ fruits }));
```

The page gets it as `data.fruits`. The server renders the full list into the HTML, so the page is useful before any JavaScript runs.

### 2. Two signals: what is typed, and what is searched

```tsx
const text = signal("");  // updates on every key press
const query = signal(""); // updates after the pause
```

`model:value={text}` connects the input to `text`. Each key press writes the new value into the signal. No code of yours runs for that.

### 3. The debounce is an effect with a cleanup

```tsx
clientEffect(() => {
  const value = text().trim().toLowerCase();
  const timer = setTimeout(() => query.set(value), 250);
  return () => clearTimeout(timer);
});
```

- The effect reads `text()`, so it runs again each time `text` changes.
- Each run starts a timer.
- The function it returns is a **cleanup**. Rivet calls it before the next run. It cancels the previous timer.

So while the user types fast, every timer is cancelled before it fires. Only the last one sets `query`.

`setTimeout` is a browser API. It is fine here, because `clientEffect` only runs in the browser. It never runs on the server.

### 4. The list filters with a computed value

```tsx
const results = computed(() => fruits.filter((fruit) => fruit.toLowerCase().includes(query())));
```

`results` re-calculates only when `query` changes, not on every key press. `<For each={results} by={(fruit) => fruit}>` renders the rows. Rows that stay in the list keep their DOM nodes.

The counter line shows "(typing…)" while `text` and `query` differ, so the user knows the list will change.

## Variations

- **Search on the server.** For a large list, do not send it all to the browser. Put the input in a `<form method="get">` with `name="q"`, and read `url.searchParams.get("q")` in the loader. This works without JavaScript too. See [paginated list from the URL](./paginated-list-from-url.md) for the same idea with pages.
- **Fetch results.** Instead of `query.set(value)`, call `fetch` inside the timer callback and put the response into a signal. Use an `AbortController` and abort it in the cleanup, so an old, slow response cannot overwrite a newer one.
- **Different delay.** 150 to 300 ms works well for typing. Shorter feels faster but does more work.

## Watch out

- **The whole list is in the page.** The handler and the computed value need the list in the browser, so Rivet writes it into the page as data. That is fine for hundreds of items, not for thousands. Search on the server instead.
- **Keep the filter cheap.** It runs once per pause, but on the main thread. Avoid heavy work inside `computed`.
- **Do not set `query` directly in `onInput`** if you want a debounce: that runs the filter on every key press.
