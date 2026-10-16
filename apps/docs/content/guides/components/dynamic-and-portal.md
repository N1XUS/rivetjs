---
title: Dynamic and Portal
description: Render an element or component picked at runtime with Dynamic, and render content elsewhere in the document with Portal.
template: guide
status: experimental
related: [guides/components/conditional, guides/components/components, guides/components/browser-only]
---

Two helpers for content whose shape or place is not fixed in the JSX: `Dynamic` renders a tag or component chosen by a value, and `Portal` renders its children at the end of `<body>` (or another element) instead of in place. After reading this page you can use both and you know how they behave on a resumed page.

::example{id=dynamic-portal}

## Dynamic

`component` is a tag name or a component function. The other props go to it:

```tsx check
import { Dynamic } from "@rivetjs/runtime/dom";

function Badge(props: { label: string }) {
  return <span class="badge">{props.label}</span>;
}

export function Title(props: { level: 1 | 2 | 3 }) {
  return (
    <>
      <Dynamic component={`h${props.level}`} class="title">
        Release notes
      </Dynamic>
      <Dynamic component={Badge} label="New" />
    </>
  );
}
```

- With a tag name, the other props become attributes, as in a spread: `class`, `id`, `aria-*`, `onClick` (a listener), `style` (an object), `ref`. `children` is the content.
- With a component, `Dynamic` calls it with the other props.
- Tag names are checked: `script`, `style`, `iframe`, `object`, `template`, `textarea`, `title`, `base`, `meta`, `link` and the document elements throw `Unsafe dynamic tag`. Children on a void element (`img`, `input`, …) throw too.
- SVG and MathML tags (`path`, `mi`) are created in their namespace.

::api{symbol="@rivetjs/runtime/dom#Dynamic"}

### Switch the tag

`Dynamic` follows its props. When the value passed as `component` changes, it removes the old element or component and renders the new one. The other props stay live: attributes and the content of a tag update in place, and a component receives them as live props.

```tsx
import { signal } from "@rivetjs/reactivity";
import { Dynamic } from "@rivetjs/runtime/dom";

const level = signal<"h2" | "h3">("h2");

<Dynamic component={level()} class="title">
  Heading
</Dynamic>;
```

Switching `component` creates the new content from scratch: state inside the old one (an input's text, local signals) is not carried over.

## Portal

`Portal` renders its children into a `<div data-rivet-portal>` that it appends to `document.body`, or to the element in `mount`. It renders nothing in place. When its part of the page goes away, the portal's `div` is removed too.

```tsx
import { signal } from "@rivetjs/reactivity";
import { Portal, Show } from "@rivetjs/runtime/dom";

const open = signal(false);

<>
  <button type="button" onClick={() => open.set(true)}>
    Save
  </button>
  <Show when={open()}>
    {() => (
      <Portal>
        <div role="status" class="toast">
          Saved
        </div>
      </Portal>
    )}
  </Show>
</>;
```

- Portal content is browser-only. The server renders nothing for it, and on a resumed page it is not created at load. Put it behind a signal, as above, so the browser creates it when the signal turns on.
- Events in the portal's content work as usual: handlers, `model:value`, refs.
- Context reaches into the portal: `useContext` inside it sees the providers around the `Portal`, not the ones around the `<div>` in `<body>`.

::api{symbol="@rivetjs/runtime/dom#Portal"}

:::tip
For menus, dialogs and popovers, use the accessible overlay components of [@rivetjs/cdk](site:cdk/components/overview/). They handle focus, keyboard and stacking, which a plain `Portal` does not.
:::

## Common mistakes

- **Expecting state to survive a switch.** A new `component` value renders new content; the old one, and its local state, is disposed.
- **Expecting portal content in the server HTML.** It is never rendered on the server. Search engines and visitors without JavaScript do not see it.
- **Passing user input as the tag.** Only pick tags from a fixed list of your own.

## See also

- [Conditional rendering](./conditional.md): `Show`, `Switch` and `Match`.
- [Components](./components.md)
- [Browser-only code](./browser-only.md)
