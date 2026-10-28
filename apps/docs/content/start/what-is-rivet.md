---
title: What is Rivet
description: Rivet is a JSX framework that renders pages on the server and lets them keep working in the browser without running your components on load.
template: concept
status: experimental
related: [learn/server-first, learn/resuming, start/quick-start, start/tutorial/index]
---

Rivet is a framework for building websites with JSX and TypeScript. You write components the way you know from React or Solid. Rivet turns them into HTML on the server. In the browser, the page keeps working without running your components on load: a component runs there only when you use it.

:::warning[Experimental]
Rivet is experimental. The packages are available on npm as `0.1.0-alpha.1`, and APIs can still change. The [quick start](quick-start.md) shows how to try it today.
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

Rivet skips that second run on load. The server writes the HTML and a small amount of data next to it. The browser picks up where the server left off, and runs a component's code only when you use it. This is called :term[resuming]{id=resumability}.

What you get:

- The page shows its content before any JavaScript runs.
- The browser can fetch interactive code ahead of time without running it. Components wake when an event, state change or configured trigger needs them.
- A large page with little interaction stays cheap in the browser.

## How it works

For the counter above, the flow looks like this:

1. **On the server**, `Home()` runs once. It creates the signal, writes `<button>Clicked 0 times</button>` and remembers two things: the button has a click handler, and the text depends on `count`.
2. **In the HTML**, Rivet adds a small inline script (the loader) and a record of the component: where it is in the page and any state the browser cannot recover from its initializer. The unchanged literal `0` needs no saved signal value.
3. **In the browser**, only the loader runs at first. After the page has loaded, it fetches the code of `Home` at low priority without running it. When you click, the browser runs `Home()` once over the existing HTML (the live button is reused; `count` starts at its initializer `0`), attaches the handler, and the click runs it: `count` becomes 1, and Rivet updates only the text inside the button.

`Home()` runs in the browser once, on the first click, and never on load. After that, only the handler `() => count.update(...)` and the text update run.

## What it means for your code

Writing for Rivet feels like writing for other JSX frameworks, with a few rules that follow from "components run on the server, and in the browser only when used":

- Code at the top of a component runs on the server and again when the browser adopts it. Keep rendering deterministic, and put browser work in event handlers or in `clientEffect`. See [browser-only code](../guides/components/browser-only.md).
- Handlers are not sent as data: the browser runs a component's code again when it wakes up, so a handler can use any value of its component. What is written into the page is data: signal values, plain-data props and route data. See [what reaches the browser](../learn/resuming.md#what-reaches-the-browser) and [function is not serializable](../gotchas/function-is-not-serializable.md).
- Browser globals such as `window` and `document` are only available inside handlers and client effects. The compiler stops the build if you read them during server rendering.
- The dev server resumes pages like production; editing a resumed component reloads the page. Set `dev: { resume: false }` for client rendering with hot reload that keeps state. See [dev and production differ](../gotchas/dev-and-production-differ.md).

## Alpha status

Rivet is available on npm as `0.1.0-alpha.1`. APIs may change while the framework is experimental. The [roadmap](../about/roadmap.md) lists what ships and what is planned.

## Next steps

- [Quick start](quick-start.md): run a starter project.
- [Tutorial](tutorial/index.md): build a small reading list app, step by step.
- [Server first](../learn/server-first.md) and [Resuming](../learn/resuming.md): the two core ideas in more detail.
