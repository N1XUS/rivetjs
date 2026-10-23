---
title: Slots
description: Let a component take several pieces of content with named slots, fallbacks and scoped slots, using the slot syntax from web components.
template: guide
status: experimental
related: [guides/components/components, guides/components/lists]
---

`children` gives a component one place for content. Slots give it several: a header, a body, a footer, a template for each row. After reading this page you can write components with named slots, give them fallback content, and pass content that depends on data from the component.

Rivet uses the syntax of web components: `<slot>` in the component, and `r:slot="name"` where you use it. The compiler turns this into normal props, so slots add no code to the browser.

::example{id=card-slots}

## The default slot

In a component, `<slot />` renders the `children`:

```tsx title="src/components/Panel.tsx"
import type { Content } from "@rivetjs/runtime/jsx-runtime";

export function Panel({ children }: { children?: Content }) {
  return (
    <section class="rounded-lg border p-4">
      <slot />
    </section>
  );
}
```

`<slot />` and `{children}` do the same thing here. Use the one you find clearer. A component that destructures its props must name every slot it renders in the parameter; with a `props` parameter there is nothing to list.

## Named slots

Give a slot a name with `r:name`. Where you use the component, put `r:slot="name"` on a direct child:

```tsx title="src/components/Card.tsx"
import type { Content, Slots } from "@rivetjs/runtime/jsx-runtime";

export function Card({ header, footer, children }: Slots<"header" | "footer"> & { children?: Content }) {
  return (
    <article>
      <slot r:name="header" />
      <slot />
      <slot r:name="footer" />
    </article>
  );
}
```

```tsx
<Card>
  <h2 r:slot="header">Title</h2>
  <p>Body text goes into the default slot.</p>
  <small r:slot="footer">Updated today</small>
</Card>
```

A named slot is a prop with the same name. `Slots<"header" | "footer">` types those props. Destructure every slot you render: if `header` is missing from the parameter, the compiler tells you how to fix it.

Several children with the same `r:slot` name all go into that slot, in order.

## Fallback content

Content inside `<slot>` is the fallback. It renders when nobody filled the slot:

```tsx
<slot r:name="header">
  <h2>Untitled card</h2>
</slot>
```

## Slot content is lazy

Content passed with `r:slot` is not rendered until the component renders the slot. If the component never shows a slot, its content costs nothing. The default slot (plain children) is rendered right away. To make it lazy too, pass a function child:

```tsx
<Panel>{() => <ExpensiveChart />}</Panel>
```

## Style a component by whether a slot is filled

A named slot is a prop, so check it like any other prop. It is `undefined` when nobody filled the slot:

```tsx title="src/components/Card.tsx"
import type { Content, Slots } from "@rivetjs/runtime/jsx-runtime";

export function Card(props: Slots<"header"> & { children?: Content }) {
  return (
    <div class={props.header ? "card has-header" : "card"}>
      <slot r:name="header" />
      <slot />
    </div>
  );
}
```

Checking the prop does not render the slot content. A component can check a slot and never render it, and the content then costs nothing. This works the same on the server, in the browser and on a resumed page.

A conditional slot (`{open() && <h2 r:slot="header">…</h2>}`) is a live prop: `props.header` in a binding, like the `class` above, follows the condition, and so does the `<slot>` element. When the condition turns true, the content appears; when it turns false, the content is removed and the `<slot>` fallback comes back. This also works on a resumed page.

```tsx
<Card>
  {open() && <h2 r:slot="header">Details</h2>}
  Body
</Card>
```

Slot content passed as a function prop works in a condition too, also on a resumed page: `header={open() ? () => <h2>Details</h2> : undefined}`.

### With CSS instead

CSS can check for the slot content with `:has()`. Rivet adds no attribute to slot content, so add your own:

```tsx
<Card>
  <h2 r:slot="header" data-slot="header">Title</h2>
</Card>
```

```css
.card:has(> [data-slot="header"]) {
  padding-top: 0;
}
```

Or let the component render its own wrapper only when the slot is filled, and select that: `{props.header ? <header class="card-header"><slot r:name="header" /></header> : null}` with `.card:has(> .card-header)`.

## Scoped slots

Sometimes the content needs data from the component, for example one template per row. Add `r:args` to the slot. The component calls the slot with these arguments:

```tsx title="src/components/List.tsx"
import type { Slot } from "@rivetjs/runtime/jsx-runtime";

export function List({ rows, row }: { rows: readonly string[]; row?: Slot<[text: () => string, index: () => number]> }) {
  return (
    <ul>
      {rows.map((text, i) => (
        <slot r:name="row" r:args={[() => text, () => i]}>
          <li>{text}</li>
        </slot>
      ))}
    </ul>
  );
}
```

Where you use it, pass a function with the same arguments:

```tsx
<List rows={["Ada", "Grace"]} row={(text, index) => <li>{index() + 1}. {text()}</li>} />
```

Pass the arguments as functions (`() => value`), like the `item` and `index` of [For](./lists.md). `Slot<[...]>` types the arguments, so TypeScript checks the function you pass.

## Slots on a resumed page

Content you pass in a slot can have its own handlers and signals. In the example above, the footer button updates a signal of the page, not of the card. When the page resumes, a click on the slot content runs the code of the component that wrote it; the card runs with it only when the content is passed through its props.


## Rules

The compiler reports these at build time:

- `r:slot` must be on a direct child of a component element, or on the element of a condition there: `{open && <h2 r:slot="header">…</h2>}` or `{open ? <h2 r:slot="header">…</h2> : null}`. When the condition is false, the slot is not passed.
- A slot name can be passed once: not both directly and in a condition.
- The `r:slot` value must be a fixed string, and not `"children"` (use plain children).
- A slot name cannot also be passed as an attribute on the same element.
- `r:name` must be a fixed string. `r:args` must be an array written inline.

A `<slot>` inside `<template>`, or with a plain `name` attribute, stays a native HTML `<slot>` for shadow DOM.

## See also

- [Components](./components.md)
- [Lists](./lists.md)
- [Conditional rendering](./conditional.md)
