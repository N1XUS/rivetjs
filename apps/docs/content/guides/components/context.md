---
title: Context
description: Share a value with every component below a point in the tree using createContext, Provider and useContext, without passing props through each level.
template: guide
related: [guides/components/components, guides/components/async, gotchas/context-gone-after-await]
---

Some values are needed by many components at different depths: a theme, the current user, a set of settings. Passing them as props through every level is tiring. :term[Context]{id=context} lets a parent provide a value once, and any component below it reads it. After reading this page you can create, provide and read context, and make the value change over time.

::example{id=context-theme}

## Create a context

Call `createContext` with a default value. Put it in its own module, so both the provider and the readers can import it:

```ts title="src/components/theme.ts"
import { createContext } from "@rivetjs/reactivity";

export const ThemeContext = createContext<"light" | "dark">("light");
```

The default is used when a component reads the context and no provider is above it.

::api{symbol="@rivetjs/reactivity#createContext"}

## Provide a value

Wrap part of the tree in `Provider`, from `@rivetjs/runtime/dom`. Give it the context as `token` and the value as `value`:

```tsx title="src/routes/index.tsx"
import { Provider } from "@rivetjs/runtime/dom";
import { ThemeContext } from "../components/theme.ts";
import { Sidebar } from "../components/Sidebar.tsx";

export default function Page() {
  return (
    <Provider token={ThemeContext} value="dark">
      <Sidebar />
    </Provider>
  );
}
```

Everything inside the `Provider`, at any depth, sees `"dark"`. A nested `Provider` for the same context overrides it for its own part of the tree.

## Read the value

Call `useContext` in a component:

```tsx title="src/components/Sidebar.tsx"
import { useContext } from "@rivetjs/reactivity";
import { ThemeContext } from "./theme.ts";

export function Sidebar() {
  const theme = useContext(ThemeContext);
  return <aside class={theme === "dark" ? "bg-slate-800 text-white" : "bg-white"}>…</aside>;
}
```

Call `useContext` at the top of the component, while it renders. That is when Rivet knows where in the tree the component is. The component runs on the server, and again in the browser when it wakes up; each run looks the value up there.

::api{symbol="@rivetjs/reactivity#useContext"}

## A value that changes

The value of a `Provider` is read once, when the Provider renders (unlike a prop, which stays live). To share something that changes, provide a signal. Readers call it where they show it:

```ts title="src/components/theme.ts"
import { createContext, signal, type Signal } from "@rivetjs/reactivity";

export type Theme = "light" | "dark";
export const ThemeContext = createContext<Signal<Theme>>(signal<Theme>("light"));
```

```tsx
import { signal, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { ThemeContext, type Theme } from "./theme.ts";

export function Parent() {
  const theme = signal<Theme>("light");
  return (
    <>
      <button type="button" onClick={() => theme.update((t) => (t === "light" ? "dark" : "light"))}>
        Toggle theme
      </button>
      <Provider token={ThemeContext} value={theme}>
        <Card title="First card" />
      </Provider>
    </>
  );
}

function Card(props: { title: string }) {
  const theme = useContext(ThemeContext);
  return <article class={theme() === "dark" ? "bg-slate-800 text-white" : "bg-slate-100"}>{props.title}</article>;
}
```

Any component can also write the signal it got from context, for example a theme switch deep in the tree.

## Context in a resumed page

The lookup happens where the component runs. In the browser, a component that wakes up looks the value up again from its providers, which run with it when they are needed. See [pass data, not services](/best-practices/pass-data-not-services.md).

`createContext(defaultValue)` takes one argument. Export the token from a shared module so providers and readers use the same object. The derived model rebuilds providers when their components run; it does not require a context id or a custom resume entry.

For a callback that runs later while its owner is still alive, see [`runWithOwner`](../../reference/utilities.md#owner-callbacks-runwithowner).

## Context after await

`useContext` is synchronous. After an `await`, Rivet no longer knows where in the tree the code runs, and `useContext` returns the default. Inside an [Async](./async.md) `load` function, use `work.get(token)` after an `await`:

```tsx
import { Async } from "@rivetjs/runtime/dom";

<Async
  load={async (work) => {
    const res = await fetch("/api/user");
    const theme = work.get(ThemeContext); // still the provided value
    return { user: await res.json(), theme };
  }}
>
  {(data) => <p>{data.user.name}</p>}
</Async>
```

See [context gone after await](/gotchas/context-gone-after-await.md).

## Common mistakes

- **Providing a plain value and expecting updates.** Provide a signal.
- **Calling `useContext` inside a handler.** The handler runs later, in the browser. Call it at the top of the component and use the result in the handler.
- **Putting services in context.** A database client or an API class cannot go into the page data. Load data on the server with a [loader](/guides/routing/loading-data.md) and pass the data.

## See also

- [Components](./components.md)
- [Async](./async.md)
- [Signals](../state/signals.md)
