---
title: Scoped styles
description: Write CSS in the component file with css``, get class names unique to that file, and ship it as normal per-route stylesheets.
template: guide
status: experimental
related: [guides/styling/css-and-tailwind, ui/kit, reference/config]
---

Scoped styles let you write CSS in the same file as a component. The compiler makes every class name unique to that file, so a `.card` in one component never matches a `.card` in another. The CSS is moved into a normal stylesheet at build time. No JavaScript injects styles into the page. After reading this page you can write `css` blocks, combine classes with `cx`, style child elements with `:global`, and use CSS module files.

Scoped styles are experimental.

## Write a css block

Import `css` from `@rivetjs/runtime/css` and assign it to a `const` at the top level of the file:

```tsx title="src/components/Card.tsx"
import { css } from "@rivetjs/runtime/css";

const styles = css`
  .card {
    border: 1px solid #cbd5e1;
    border-radius: 0.75rem;
    padding: 1rem;
  }
  .title {
    font-weight: 600;
  }
`;

export function Card(props: { title: string }) {
  return (
    <article class={styles.card}>
      <h2 class={styles.title}>{props.title}</h2>
    </article>
  );
}
```

`styles` is a map from your class names to the unique names. The compiler replaces `styles.card` with the final string, so the class is part of the static HTML. You need no extra setup: the Rivet Vite plugin (`rivetRouter()` or `rivet()`) handles every file that imports `@rivetjs/runtime/css`.

The unique names look like `card_k3x9a` in dev and `r0dfoxw` in production builds. They depend only on the file path and the class name, so the server and the browser always agree.

::example{id=scoped-card}

## Combine classes with cx

`cx` joins class names and skips `false`, `null`, `undefined` and `0`. It also takes arrays and `{ name: condition }` objects. Use it to switch classes from a signal or to accept a class from the parent:

```tsx
import { signal } from "@rivetjs/reactivity";
import { css, cx } from "@rivetjs/runtime/css";

const styles = css`
  .card { border: 2px solid #cbd5e1; padding: 1rem; }
  .selected { border-color: #0f766e; }
`;

export function SelectableCard(props: { class?: string }) {
  const selected = signal(false);
  return (
    <article class={cx(styles.card, selected() && styles.selected, props.class)}>
      <button type="button" onClick={() => selected.update((on) => !on)}>
        {selected() ? "Selected" : "Select"}
      </button>
    </article>
  );
}
```

You can mix in Tailwind classes too: ``class={`${styles.title} text-lg`}``.

For one class per state, `class:` works with scoped names as well: `class={styles.card}` with ``class:selected={selected()}`` toggles the plain name `selected`, so for a scoped name use `cx` or a class object with a computed key, `class={[styles.card, { [styles.selected]: selected() }]}`.

## Style elements you do not own

Only class names and `@keyframes` names are made unique. Element selectors like `code` or `a` stay as they are. To keep a class name unchanged, wrap it in `:global(...)`:

```tsx
const styles = css`
  /* .dark is set on <html> by the theme script: keep its name. */
  :global(.dark) .card { background: #0f172a; }
  .card :global(code) { font-weight: 600; }
`;
```

`:local(...)` marks a part as scoped, which is already the default. A bare `:global` without parentheses is a compile error.

## What CSS you can write

Inside a block you can use normal modern CSS:

- Nested rules (`&:hover { … }`), `@media`, `@supports`, `@container` and `@layer`.
- `@keyframes`. The name is made unique, and `animation` / `animation-name` in the same block follow it. Keyframe names are in the map too (`styles.pulse`).
- Tailwind's `@apply`. To use your theme there, set `rivetRouter({ css: { reference: "src/styles.css" } })`.
- `@import`. It is moved to the top of the sheet.

The CSS goes through Vite's CSS pipeline like any stylesheet: PostCSS, Tailwind, minifying.

## How it reaches the page

- Each file's CSS becomes part of the CSS file of the route that uses it. A page links only the CSS of its own route, not every route's CSS.
- The output is wrapped in `@layer components`. Tailwind utilities are in a later layer, so a utility class always beats a component style.
- A parent component's styles come after the styles of the children it imports, so the parent can override a child with the same specificity.
- In dev, a CSS-only edit updates the stylesheet and keeps component state.

Your document shell links these files: route stylesheets arrive in the `styles` list after your global ones. The starter shells already link everything in `styles`. In a production build a route's stylesheets are merged into one file, so a page links two: your global stylesheet and its route stylesheet.

## Stylesheet files

You can also import stylesheet files from a component:

```tsx
import "./global-extra.css"; // global: class names unchanged
import notes from "./Notes.module.css"; // scoped: a class map like css``

export function Notes() {
  return <p class={notes.note}>Saved.</p>;
}
```

- `.css`, `.scss`, `.sass`, `.less` and `.styl` files work as in Vite. Install the preprocessor yourself (`sass`, `less` or `stylus`).
- Files named `*.module.<ext>` are CSS modules. Their class names use the same scheme as `css` blocks.

Add `/// <reference types="vite/client" />` at the top of the file if TypeScript does not know `*.module.css` imports.

## Limits and compile errors

| You write | Compile error |
| --- | --- |
| `css` inside a function, or with `let` | ``` css`` must initialize a top-level const (const styles = css`…`) ``` |
| `${value}` inside the block | ``` css`` interpolations are not supported: write values literally; for a dynamic value set a custom property on the element … ``` |
| `styles.nope` (no `.nope` in the block) | ``` Unknown class 'nope' in css`` block styles ``` |
| `styles.card = "x"` | ``` css`` class maps are read-only ``` |
| `:global .x` | ``` css``: use :global(selector); bare :global is not supported ``` |
| A missing `}` | ``` css``: unclosed block ``` |

Values cannot change at run time inside a `css` block. For a value that changes, set a custom property on the element and read it in the block:

```tsx
const styles = css`
  .bar { width: var(--progress); }
`;

<div class={styles.bar} style={{ "--progress": progress() + "%" }} />;
```

For a fixed set of states, switch classes with `cx` or `class:`, or set a `data-` attribute and style it. See [CSS and Tailwind](./css-and-tailwind.md#change-other-styles-style-objects-css-variables-and-data-attributes).

If you see the run-time error ``` css``: this module was not compiled by the Rivet Vite plugin ```, the file was not built through `rivet()` or `rivetRouter()`.

## Options

`rivetRouter({ css: { … } })` (or `rivet({ css })`):

| Option | Default | Meaning |
| --- | --- | --- |
| `layer` | `"components"` | Cascade layer of the output. `false`: no layer. |
| `layers` | Tailwind's order | Layer order line at the start of each sheet. `false`: none. |
| `names` | `"readable"` in dev, `"short"` in builds | Class name style. |
| `reference` | none | Stylesheet `@reference`d by every block, for Tailwind `@apply` and theme values. |
| `modules` | `true` | Name `*.module.*` classes like `css` blocks. |

## Common mistakes

- **Building class names from strings**, like `styles["card-" + size]` with sizes the block does not have. Write each class in the block.
- **Expecting `.card` to match children in other components.** It only matches elements in this file. Pass `props.class` or use `:global`.

## See also

- [CSS and Tailwind](./css-and-tailwind.md)
- [Kit](../../ui/kit.md) for fonts and the theme script
- [Config](../../reference/config.md#rivetrouter)
