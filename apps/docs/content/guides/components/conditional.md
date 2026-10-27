---
title: Conditional rendering
description: Show, hide and switch parts of the page based on signals, with ternaries, attributes and classes.
template: guide
related: [guides/components/lists, guides/state/signals, guides/components/async]
---

Often a part of the page should only appear in some cases: a menu when it is open, an error when there is one, a "Pro" badge for paying users. After reading this page you can show, hide and switch content based on signals.

::example{id=show-hide}

## Switch between two branches

Use a JavaScript ternary inside JSX. When the signal changes, Rivet replaces the old branch with the new one:

```tsx
import { signal } from "@rivetjs/reactivity";

export default function Plan() {
  const plan = signal<"free" | "pro">("free");
  return (
    <div>
      <button type="button" onClick={() => plan.update((p) => (p === "free" ? "pro" : "free"))}>
        Switch plan
      </button>
      <p>{plan() === "pro" ? <strong>Pro: $9 a month</strong> : <span>Free plan</span>}</p>
    </div>
  );
}
```

Only the content inside the `<p>` changes. The button and the rest of the page stay as they are.

A branch is created again only when the condition picks the other branch. If the condition reads a signal that changes without switching branches (`count() > 0` while `count` goes from 1 to 2), the shown branch keeps its elements: focus, typed text and CSS enter animations are not reset. The same holds for `&&`, `||` and `??`, and for a ternary nested in a branch.

## Show something or nothing

Write it the way you would in React: `cond && <jsx/>`. When the condition is false, nothing is rendered:

```tsx
import { signal } from "@rivetjs/reactivity";

const open = signal(false);

<button type="button" onClick={() => open.update((v) => !v)}>
  {open() ? "Hide details" : "Show details"}
</button>
{open() && <p>Details are visible now.</p>}
```

The other usual forms work the same, on the server, after the page resumes in the browser, and in client-only code:

```tsx
{error() ? <p class="text-red-700">{error()}</p> : null}
{name() ?? <em>Anonymous</em>}
{loggedIn() || <a href="/login">Log in</a>}
{user() && user()!.pro && <span>Pro</span>}
```

`null`, `undefined`, `false` and `true` render nothing. Empty strings render nothing too, while `0` renders as the text `0`, as in React.

## Show with a component

`<Show when={cond()} fallback={…}>` does the same as the ternary. `when` takes a value (`when={open()}`, live because props are getters) or an accessor (`when={open}`). `For each` and `Match when` work the same:

```tsx
import { Show } from "@rivetjs/runtime/dom";

<Show when={open()} fallback={<p>Closed</p>}>
  <p>Details are visible now.</p>
</Show>;
```

A function used as a value is called: `when={fn}` runs `fn()` and uses its result, even if you meant the function itself as the condition. To test a function for truthiness, write `when={!!fn}`.

`Show` creates its branch once and keeps it while the condition stays truthy. Two options change that:

- A **function child** gets the value as an accessor, and is created only when the branch shows: `<Show when={user()}>{(u) => <p>Hello {u().name}</p>}</Show>`.
- **`keyed`** creates the branch again whenever the value itself changes, not only its truthiness. Use it when the branch should start fresh per value, for example per selected item. The function child still gets an accessor, not the value: `<Show keyed when={item()}>{(i) => <Editor item={i()} />}</Show>`. Unlike Solid, a function child always gets an accessor, keyed or not; with `keyed` it returns the same value for the whole life of the branch.

::api{symbol="@rivetjs/runtime/dom#Show"}

## Several cases: Switch and Match

`Switch` renders the first `Match` whose `when` is truthy, or its `fallback`:

```tsx
import { signal } from "@rivetjs/reactivity";
import { Match, Switch } from "@rivetjs/runtime/dom";

const status = signal<"idle" | "saving" | "saved" | "error">("idle");

<Switch fallback={<span>Not saved yet</span>}>
  <Match when={status() === "saving"}>
    <span>Saving…</span>
  </Match>
  <Match when={status() === "saved"}>
    <span>Saved</span>
  </Match>
  <Match when={status() === "error"}>
    <span class="text-red-700">Could not save</span>
  </Match>
</Switch>;
```

The content changes only when a different `Match` wins. `Match` takes `keyed` and a function child like `Show`.

On a resumed page, a `Show` or `Switch` that the server rendered usually keeps its server nodes on the first change when the same branch still wins: inputs keep what was typed, and nothing is created again.

## Switch text

When both branches are plain text, a ternary of strings is enough. Rivet updates only the text:

```tsx
<span>{count() === 1 ? "1 item" : `${count()} items`}</span>
```

## Hide with an attribute

If the content is big, or you want to keep its state (for example, text typed into a field), keep it on the page and hide it with the `hidden` attribute:

```tsx
<section hidden={!open()}>
  <input placeholder="Your note" />
</section>
```

The same works for `disabled`, `aria-expanded` and other attributes:

```tsx
<button type="button" aria-expanded={open() ? "true" : "false"} disabled={saving()}>
  Menu
</button>
```

## Switch classes

Change the look with a class expression:

```tsx
<li class={todo().done ? "text-slate-400 line-through" : ""}>{todo().text}</li>
```

## More than two cases without components

Instead of `Switch`, you can compute the branch in a local function and call it in JSX:

```tsx
import { signal } from "@rivetjs/reactivity";

const status = signal<"idle" | "saving" | "saved" | "error">("idle");
const message = (value: string) =>
  value === "saving" ? <span>Saving…</span>
  : value === "saved" ? <span>Saved</span>
  : value === "error" ? <span class="text-red-700">Could not save</span>
  : null;

<p>{message(status())}</p>;
```

The JSX reads `status()`, so the `<p>` content updates when `status` changes.

## Which to choose

| You want | Use |
| --- | --- |
| Two different pieces of content | Ternary with JSX in both branches |
| Content or nothing | `cond() && <jsx/>` (or a ternary with `null`) |
| Keep the content and its state, only hide it | `hidden={…}` |
| Different look | `class={…}` |
| One of several branches | `Switch` and `Match`, or a local function |
| A tag or component chosen by a value | [`Dynamic`](./dynamic-and-portal.md) |

## Common mistakes

- **Reading the signal outside JSX.** `const isOpen = open();` at the top of the component reads the value once, on the server. Read `open()` inside the JSX expression.
- **Using `if` statements around `return`.** The component runs once, so an `if` picks a branch once. Use expressions inside JSX for things that change. See [the component did not run again](/gotchas/component-did-not-run-again.md).

## See also

- [Lists](./lists.md)
- [Async](./async.md): show a fallback while data loads.
