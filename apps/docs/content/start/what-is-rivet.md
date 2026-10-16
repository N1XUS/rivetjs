---
title: What is Rivet
description: Rivet is a JSX framework that renders pages on the server and lets them keep working in the browser without running your components again.
template: concept
status: experimental
related: [learn/server-first, learn/resuming, start/quick-start, start/tutorial/index]
---

Rivet is a framework for building websites with JSX and TypeScript. You write components the way you know from React or Solid. Rivet turns them into HTML on the server. In the browser, the page keeps working, but your components do not run a second time.

:::warning[Experimental]
Rivet is experimental. The packages are available on npm as `0.1.0-alpha.0`, and APIs can still change. The [quick start](quick-start.md) shows how to try it today.
:::

## What it is

A Rivet app is a folder of `.tsx` files. Each file in `src/routes` is a page. A page is a function that returns JSX:

```tsx title="src/routes/index.tsx"
import { signal } from "@rivetjs/reactivity";

export default function Home() {
  const count = signal(0);
  return (
    <button type="button" onClick={() => count.update((n) => n + 1)}>
      Clicked {count()} times
    </button>
  );
}
```

Three parts work together:

- **The compiler** reads your JSX at build time. It makes two versions of each component: one that writes HTML on the server, and one with only the small pieces the browser needs.
- **Signals** (`@rivetjs/reactivity`) hold values that change, like `count` above. When a signal changes, only the parts of the page that show it update.
- **The router** (`@rivetjs/router`) turns files in `src/routes` into pages, loads data on the server, and handles forms.

## Why it matters

Most JSX frameworks send the page as HTML and then run all the components again in the browser to make the page interactive. This second run is called :term[hydration]{id=hydration}. It downloads and runs code for every component on the page, even for parts that never change.

Rivet skips that second run. The server writes the HTML and a small amount of data next to it. The browser reads that data and picks up where the server left off. This is called :term[resuming]{id=resumability}.

What you get:

- The page shows its content before any JavaScript runs.
- The browser downloads code only for the parts you use. If you never click a button, its code never loads.
- A large page with little interaction stays cheap in the browser.

## How it works

For the counter above, the flow looks like this:

1. **On the server**, `Home()` runs once. It creates the signal, writes `<button>Clicked 0 times</button>` and remembers two things: the button has a click handler, and the text depends on `count`.
2. **In the HTML**, Rivet adds a small inline script (the loader) and the saved state, for example "count is 0".
3. **In the browser**, only the loader runs at first. (With file routes, the router's link handling also loads right after the page appears: about 15 KB compressed, in 4 files.) When you point at the button, the loader fetches the click handler's code. When you click, the handler runs, `count` becomes 1, and Rivet updates only the text inside the button.

`Home()` never runs in the browser. Only the handler `() => count.update(...)` and the text update run there.

## What it means for your code

Writing for Rivet feels like writing for other JSX frameworks, with a few rules that follow from "components run once, on the server":

- Code at the top of a component runs on the server only. Put browser work in event handlers or in `clientEffect`. See [browser-only code](../guides/components/browser-only.md).
- Values that a handler uses are written into the page as data: plain data (numbers, strings, arrays, objects, dates, signals), functions written in your components, and instances of simple data classes. Package-class instances and library objects are built in the browser with `reconstruct(() => …)` (or a package class is registered with `registerClass`). See [what the handler can use](../learn/resuming.md#what-the-handler-can-use) and [function is not serializable](../gotchas/function-is-not-serializable.md).
- Browser globals such as `window` and `document` are only available inside handlers and client effects. The compiler stops the build if you read them during server rendering.
- The dev server resumes pages like production until you edit a file; then the page renders in the browser so hot reload can keep state. See [dev and production differ](../gotchas/dev-and-production-differ.md).

## Alpha status

Rivet is available on npm as `0.1.0-alpha.0`. APIs may change while the framework is experimental. The [roadmap](../about/roadmap.md) lists what ships and what is planned.

## Next steps

- [Quick start](quick-start.md): run a starter project.
- [Tutorial](tutorial/index.md): build a small reading list app, step by step.
- [Server first](../learn/server-first.md) and [Resuming](../learn/resuming.md): the two core ideas in more detail.
