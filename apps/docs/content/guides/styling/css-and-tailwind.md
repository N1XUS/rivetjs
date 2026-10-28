---
title: CSS and Tailwind
description: Add stylesheets to a Rivet app, use Tailwind CSS v4 classes, switch classes with signals, and know which styling patterns the compiler rejects.
template: guide
related: [guides/styling/scoped-styles, guides/tooling/vite, recipes/dark-mode-toggle]
---

Rivet styles pages with normal CSS files. The starters come with Tailwind CSS v4 set up. After reading this page you can add stylesheets, use Tailwind classes, change classes from signals, and avoid the styling patterns that Rivet does not support.

## Where styles come from

List your stylesheets in the `styles` option of `rivetRouter` in `vite.config.ts`. Paths are relative to the project root:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ mode: "static", styles: ["src/styles.css"] }), tailwindcss()],
});
```

Rivet builds each file with Vite and adds it to every page. Your document shell in `src/document.ts` writes the tags: pass the shell's `input` to `headTags`, and it writes a `<link rel="stylesheet">` for each built file (or the CSS itself, see below):

```ts title="src/document.ts"
import { headTags, type DocumentShell } from "@rivetjs/router/server";

const document: DocumentShell = (input) => ({
  start:
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    headTags({ ...input.head, title: input.head?.title ?? "Rivet app" }, input) +
    "</head><body>",
  end: "</body></html>",
});
export default document;
```

You can list several files: `styles: ["src/reset.css", "src/styles.css"]`.

### Small stylesheets are inlined

A linked stylesheet blocks the first paint until it has downloaded. When a page's CSS is small, that request costs more than its bytes. So in production builds, Rivet decides per page:

- If all of the page's stylesheets (your `styles` plus the route's own stylesheet) add up to 6 KB or less compressed (brotli, measured at build time), `headTags` writes all of them into the page as `<style data-href="…">` elements, each in the place of its link. The page then makes no stylesheet request before its first paint, and `data-href` tells the browser code that the sheet is already there.
- Otherwise, only stylesheets of 4 KB or less uncompressed (Vite's `build.assetsInlineLimit`) are inlined, and the rest stay linked.

Files with relative `url()` or `@import` references always stay linked. The dev server links every file.

Inlined CSS is not cached between pages: each page carries it again. Change the rule with the `inlineStylesheets` option of `rivetRouter`: `{ maxTotalBrotli: 8192 }` sets another total in bytes, `"always"` inlines every stylesheet, `"never"` links them all.

```ts title="vite.config.ts"
import { rivetRouter } from "@rivetjs/router/vite";

rivetRouter({ styles: ["src/styles.css"], inlineStylesheets: "never" });
```

The first interaction on a page never downloads CSS the page already has. The code it loads lists the route's stylesheet, not the component files inside it, so a page that links or inlines that stylesheet fetches nothing; a client navigation fetches the target route's one stylesheet; a part loaded later (a lazily imported module) still fetches its own stylesheets before it runs, and the component stylesheets it shares with the page only when the page's route stylesheet does not already hold them (checked in the browser, so after a client navigation it fetches exactly what is missing). This applies when you leave Vite's `build.modulePreload` unset.

The inline styles carry the page's CSP nonce. A shell that writes its own links from `styles` (`styles.map(...)`) links every file; pass `input` to `headTags` instead, or call `headTags(undefined, { styles, inlineStyles, nonce })` from the shell's input.

## Tailwind CSS

The starters use Tailwind CSS v4 through its Vite plugin (`@tailwindcss/vite`, as above). The stylesheet imports Tailwind and tells it where to look for class names:

```css title="src/styles.css"
@import "tailwindcss";
/* Scan the app's source for class names. */
@source "./**/*.{ts,tsx}";

@layer base {
  body {
    @apply m-0 bg-white font-sans text-slate-900 antialiased;
  }
}
```

Then use utility classes in JSX:

```tsx
<button type="button" class="rounded-md bg-teal-700 px-4 py-2 font-semibold text-white">
  Save
</button>
```

All examples in these docs are styled this way.

::starter{template=starter-static}

## Plain CSS

Tailwind is optional. Remove the Tailwind plugin and the `@import "tailwindcss"` line, and write normal CSS in the files you list in `styles`:

```css title="src/styles.css"
.card {
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem;
}
.card--active {
  border-color: #0f766e;
}
```

```tsx
<article class="card">…</article>
```

## Scoped styles

To write CSS next to a component, with class names unique to that file, use a `css` block from `@rivetjs/runtime/css`. Its CSS ships in the route's stylesheet. See [scoped styles](./scoped-styles.md) (experimental).

## class and className

Write `class` as in HTML. `className` also works and renders as `class`. Use one of them per element: both on one element is a compile error (`Use one class attribute (class or className) per element`).

## Change classes with signals

A `class` expression that reads a signal updates when the signal changes:

```tsx
import { signal } from "@rivetjs/reactivity";

const active = signal(false);

<article class={active() ? "card card--active" : "card"} onClick={() => active.update((v) => !v)}>
  …
</article>;
```

To switch single classes, use `class:name` or a class object. Both combine with a `class` attribute:

```tsx
<article class="card" class:card--active={active()}>…</article>
<article class={{ card: true, "card--active": active() }}>…</article>
<article class={["card", active() && "card--active"]}>…</article>
```

A truthy value adds the class, a falsy one removes it. Class objects and arrays are normalized when written in the attribute. For a class value held in a variable or prop, join it with `cx(value)` from `@rivetjs/runtime/css`.

With Tailwind, write the full class names in your code, like `"bg-teal-700"`. Tailwind finds classes by scanning your files for these strings. A class built from pieces at run time, like `"bg-" + color()`, is not found and has no CSS.

## Change other styles: style objects, CSS variables and data attributes

`style` takes an object, and `style:prop` sets one property:

```tsx
<div class="bar" style={{ "--progress": progress() + "%" }} style:opacity={busy() ? 0.5 : 1}>…</div>
```

```css
.bar { width: var(--progress); }
```

- Keys: camelCase (`marginTop`), kebab-case (`margin-top`) or custom properties (`"--progress"`). Custom properties only work in the object form, because `style:--x` is not valid TSX.
- `null`, `undefined`, booleans and `""` leave the property out. A number gets `px`, as in React (`width: 10` → `width:10px`), except `0`, custom properties (`"--x": 3`) and unitless properties such as `opacity`, `zIndex`, `lineHeight`, `flexGrow`, `fontWeight` (React's list).
- Values with `url(`, `src(`, `image-set(`, `expression(`, `javascript:`, `;`, `{`, `}`, `\` or `/*` are refused: a literal fails the build, a dynamic value is dropped (the development build warns). Put images in CSS.
- Style strings (`style="color: red"`) are still a compile error.
- In the browser, Rivet sets properties through CSSOM (`style.setProperty`), which a strict `style-src` Content Security Policy allows. The server writes a `style` attribute, which such a policy blocks until the page updates it. Under a strict policy, keep first-paint styles in classes.

For a fixed set of states, set a `data-` or `aria-` attribute and style it in CSS:

```tsx
<div data-size={size()} class="box">…</div>
```

```css
.box[data-size="small"] { width: 8rem; }
.box[data-size="large"] { width: 16rem; }
```

Tailwind can target these too: `class="data-[size=large]:w-64"`, `class="aria-expanded:rotate-180"`.

## What is not supported

| Pattern | What happens | Use instead |
| --- | --- | --- |
| `style="color: red"` or `style={text}` | Compile error RV5003: `style strings are not supported: use a style object …` | `style={{ color: "red" }}`, `style:color`, classes |
| `style={{ background: "url(x.png)" }}` | Compile error: `Unsafe style value for background: …` (dynamic: property dropped) | A class with the image in CSS |
| `<style>…</style>` in JSX | Compile error: `Script/style JSX content is not supported; use build-time assets` | A stylesheet in `styles`, or a [`css` block](./scoped-styles.md) |

Keeping first-paint styles in classes also keeps pages compatible with a strict [Content Security Policy](/guides/security/csp.md). See [spread props and style](/gotchas/spread-props-and-style.md).

## Dark mode

A common pattern is a `dark` class on `<html>`, toggled from a `clientEffect`, with Tailwind's `dark:` variant. The [dark mode recipe](/recipes/dark-mode-toggle.md) shows it end to end.

## Common mistakes

- **Building Tailwind class names from strings at run time.** Tailwind cannot see them. Write full names.
- **Forgetting the `@source` line.** Tailwind may miss classes in some folders. The starters include it.
- **A stylesheet missing from `styles`.** It is not built and not linked.
- **`class` and `className` on one element.** Compile error; keep one. Merge the values with an array: `class={["card", props.class]}`.
- **A background image from a signal.** ``style={{ background: `url(${src()})` }}`` is dropped at run time (a literal fails the build). Use an `<img>`, or a class per image in CSS.

## See also

- [Scoped styles](./scoped-styles.md): CSS in the component file with `css` blocks (experimental)
- [Vite setup](/guides/tooling/vite.md)
- [Content Security Policy](/guides/security/csp.md)
