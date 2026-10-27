---
title: Lists
description: Render lists with For and a key, update them by making new arrays, and know when a plain map is enough.
template: guide
related: [guides/state/signals, guides/components/conditional, guides/components/forms-and-input]
---

Most pages show lists: todos, search results, table rows. After reading this page you can render a list that changes, give each row a key, and update the list without losing row state.

::example{id=todo-list}

## A list that never changes

If the list is fixed when the server renders the page, use a plain `.map()`:

```tsx
const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
];

export function Nav() {
  return (
    <nav>
      {links.map((link) => (
        <a href={link.href}>{link.label}</a>
      ))}
    </nav>
  );
}
```

Data from a route [loader](/guides/routing/loading-data.md) is fixed for the page too, so `.map()` is fine for it.

## A list that changes: For

When the list lives in a signal or depends on one, use `For` from `@rivetjs/runtime/dom`:

```tsx
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";

export default function Todos() {
  const todos = signal([
    { id: 1, text: "Read the guide" },
    { id: 2, text: "Build something" },
  ]);
  return (
    <ul>
      <For each={todos} by={(todo) => todo.id}>
        {(todo, index) => (
          <li>
            {index() + 1}. {todo().text}
          </li>
        )}
      </For>
    </ul>
  );
}
```

`For` takes three things, plus one option:

| Prop | What it is |
| --- | --- |
| `each` | The array, or a function that returns it. `each={todos()}` and `each={todos}` both follow the signal: props are live, and a signal is a function. |
| `by` | A function that returns a unique key for an item, like its `id`. Required. |
| children | A function that renders one row. It gets `item` and `index` as **functions**: call `todo()` and `index()`. |

::api{symbol="@rivetjs/runtime/dom#For"}

## Why the key matters

The key tells Rivet which row is which. When the array changes, Rivet compares keys:

- a row whose key is still there is kept, with its DOM nodes,
- a new key gets a new row,
- a key that is gone loses its row.

Kept rows keep things like focus, text selection and the state of a checkbox. Use a stable value from your data, such as an id. Do not use the index as the key when rows can be added, removed or moved.

## Filter and sort

`each` can be any function that reads signals. Rivet re-runs it when they change:

```tsx
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";

const query = signal("");

<input type="search" model:value={query} />
<ul>
  <For
    each={() => items.filter((item) => item.title.toLowerCase().includes(query().toLowerCase()))}
    by={(item) => item.id}
  >
    {(item) => <li>{item().title}</li>}
  </For>
</ul>;
```

On a server-rendered page, the browser reuses the rows that the server rendered. It does not build the list again on the first change.

## Update the list

Signals compare with `Object.is`, so change the list by making a new array:

```ts
// Add
todos.update((list) => [...list, { id: 3, text: "Ship it" }]);
// Remove
todos.update((list) => list.filter((t) => t.id !== 2));
// Change one item
todos.update((list) => list.map((t) => (t.id === 1 ? { ...t, text: "Read it again" } : t)));
```

`list.push(...)` changes the array in place and the page does not update. See [equality](../state/equality.md).

## Handlers inside rows

A row handler can use the row's `item` and `index`:

```tsx
import { For } from "@rivetjs/runtime/dom";

<For each={todos} by={(todo) => todo.id}>
  {(todo) => (
    <li>
      {todo().text}
      <button onClick={() => todos.update((list) => list.filter((t) => t.id !== todo().id))}>Remove</button>
    </li>
  )}
</For>
```

On a resumed page, the items go into the page data (as the component's props or route data), so they must be :term[serializable]{id=serializable}: plain objects, arrays, strings, numbers.

## Animate rows in and out

`PresenceFor` from `@rivetjs/motion/presence` is a keyed list like `For` whose removed rows play an exit animation in place before they leave. See [Presence and exit animations](../motion/presence.md).

## Common mistakes

- **Calling `.map()` on a signal in JSX.** `{todos().map(...)}` works, but every change renders the whole list again. Use `For`.
- **Forgetting to call `item`.** Inside `For`, `item` is a function. Write `todo().text`, not `todo.text`.
- **Keys that are not unique.** Two items with the same key confuse the update. Use ids.
- **Expecting row reuse in every case.** Today, a `For` placed directly as the row of another `For`, or two `For` lists in one part of the page that updates together, still work, but the browser builds those rows again on the first change instead of reusing the server's rows.

## See also

- [Conditional rendering](./conditional.md)
- [Forms and input](./forms-and-input.md)
- [Signals](../state/signals.md)
