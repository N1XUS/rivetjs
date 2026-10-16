---
title: Stores
description: Keep nested state in one store, read single paths so only the right parts of the page update, and change it with write, produce and reconcile.
template: guide
status: experimental
related: [guides/state/signals, guides/state/equality, guides/components/lists, guides/state/batching]
---

A signal holds one value. When the value is a big object, every part of the page that reads it updates on every change. A **store** holds nested data and keeps one signal for each path that the page reads, so `user.name` updates only the parts that show the name. After reading this page you can create a store, read and write paths, and update lists in it.

:::note
Stores are experimental. The functions may change before 1.0.
:::

## Create a store

Import `createStore` from `@rivetjs/reactivity/store` and give it an object:

```tsx
import { createStore, read, write } from "@rivetjs/reactivity/store";

const state = createStore({
  user: { name: "Ada", email: "ada@example.com" },
  todos: [
    { id: 1, title: "Write docs", done: false },
    { id: 2, title: "Ship it", done: true },
  ],
});
```

::api{symbol="@rivetjs/reactivity/store#createStore"}

## Read a path

`read(store, path)` returns the value at a path. The path is a string with dots, like a form field name. List items use their index: `"todos.0.done"`.

```tsx
<>
  <p>Hello {read(state, "user.name")}</p>
  <p>{read(state, "todos.0.done") ? "done" : "open"}</p>
</>
```

The paragraph that reads `user.name` updates when the name changes, not when the email or a todo changes. TypeScript checks the path and knows the value type: `read(state, "user.nmae")` is an error.

`read(state)` without a path returns the whole data. Reading `"user"` returns the whole user object, which changes when any field of the user changes.

::api{symbol="@rivetjs/reactivity/store#read"}

## Write a path

`write(store, path, value)` sets a value. Pass a function to compute the new value from the old one:

```tsx
<>
  <button onClick={() => write(state, "user.name", "Grace")}>Rename</button>
  <button onClick={() => write(state, "todos.0.done", (done) => !done)}>Toggle</button>
  <button onClick={() => write(state, "todos", (todos) => [...todos, { id: 3, title: "New", done: false }])}>Add</button>
</>
```

A write never changes your objects. It copies the objects along the path, so `user` gets a new object while `todos` stays the same. Then it updates, in one go, the parts of the page that read a path whose value changed.

:::warning
Do not change the objects you get from `read`: `read(state, "user").name = "x"` changes the data without telling the page. Use `write`.
:::

::api{symbol="@rivetjs/reactivity/store#write"}

## Change several things at once

`produce` lets you write changes like normal assignments. Rivet runs them on a copy and keeps the parts you did not touch:

```tsx
import { produce } from "@rivetjs/reactivity/store";

write(
  state,
  produce((draft) => {
    draft.user.name = "Grace";
    draft.todos[1].done = false;
  }),
);
```

When new data arrives from the server, `reconcile` replaces the old data but keeps every part that is equal, so only the parts that really changed update:

```tsx
import { reconcile } from "@rivetjs/reactivity/store";

const fresh = await fetch("/api/todos").then((res) => res.json());
write(state, "todos", reconcile(fresh));
```

::api{symbol="@rivetjs/reactivity/store#produce"}
::api{symbol="@rivetjs/reactivity/store#reconcile"}

## Lists

Render a list from the store with `For`. Build each row's paths from the row index, inside the reads, so they follow the row when the list changes:

```tsx
import { For } from "@rivetjs/runtime/dom";
import { read, write } from "@rivetjs/reactivity/store";

<For each={() => read(state, "todos")} by={(todo) => todo.id}>
  {(_todo, index) => (
    <li>
      <input type="checkbox" checked={read(state, `todos.${index()}.done`)} onChange={() => write(state, `todos.${index()}.done`, (done) => !done)} />
      {read(state, `todos.${index()}.title`)}
    </li>
  )}
</For>;
```

Checking one box updates that row's checkbox only. The list itself re-runs its keys, but every row stays.

## Work on one part with `at`

`at(store, path)` gives a view of one part of a store. Reads and writes through the view are relative to it. Pass a view to a component that edits one part:

```tsx
import { at, read, write, type StoreView } from "@rivetjs/reactivity/store";

function UserCard({ user }: { user: StoreView<{ name: string; email: string }> }) {
  return <input value={read(user, "name")} onInput={(event) => write(user, "name", event.currentTarget.value)} />;
}

<UserCard user={at(state, "user")} />;
```

A view is a fixed path. For list rows, whose index can change, build the path inside the read as shown above.

::api{symbol="@rivetjs/reactivity/store#at"}

## In a resumed page

A store is plain data with signals inside, so a handler or a binding can use it on a resumed page. The page state holds the data once, plus one small entry for each path the server read. When the compiler can tell which paths the browser code uses, the page holds only those paths and the ones the server read. It can tell when every use of a store created in the component is `read`, `write` or `at` with a literal path (`read(store, "user.name")`, `at(store, "todos.1")`), and every use of a view from `at` is `read`, `write` or `at` too. The page keeps the whole store when a path is held in a variable (below a view from `at(store, "user")`, the whole `user` part), when code reads or writes the whole store (`read(store)`), when the store or a view of it is passed to a function or a child component, aliased, or read through `view.s`, when the server read the whole store, and on a streamed page whose later parts are still loading when the store is sent. In development, reading a path the page did not ship prints a `Rivet resume: store path "…" was not shipped` warning. In the browser, a click that writes `"user.name"` updates only the parts that read it.

## Common mistakes

- **Reading the whole object when you need one field.** `read(state, "user").name` updates on every user change. Read `"user.name"`.
- **Keys with dots.** A path cannot address a key that contains a `.`. Use an array or keys without dots.
- **Functions in a store.** A function passed to `write` is an updater, not a value. Store data, not functions.

## See also

- [Signals](./signals.md)
- [Equality](./equality.md)
- [Lists](/guides/components/lists.md)
