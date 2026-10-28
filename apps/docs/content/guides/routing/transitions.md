---
title: Route transitions
description: Animate page changes with the browser's View Transitions, morph shared elements between pages, and show loading state during slow navigations.
template: guide
status: experimental
related: [guides/routing/links-and-navigation, guides/routing/layouts, guides/styling/css-and-tailwind]
---

When the user follows a link, the router can animate the change: the page area fades, a thumbnail grows into the big photo on the next page, and a small bar shows while a slow page loads. Rivet uses the browser's own **View Transitions** for this, so the animations are plain CSS. After reading this page you can turn transitions on, style them, connect elements across pages and show loading state.

::example{id=route-transitions}

:::note
This feature is experimental. Browsers without View Transitions (or users who ask for reduced motion) get an instant page swap; links and loading state still work.
:::

## Turn transitions on

Two steps. Enable them in the router plugin:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"], transitions: true, clientRouter: true })],
});
```

Transitions run on client navigations. `clientRouter: true` makes every page navigate in place; without it, links on pages that ship no JavaScript load the next document (no animation). See [when the router is active](./links-and-navigation.md#when-the-router-is-active).

Then import the default styles in your stylesheet:

```css title="src/styles.css"
@import "@rivetjs/router/transitions.css";
```

That is all. Now every client navigation cross-fades the page area for 200 ms, while the root layout (header, menu) stays still. The transition code is a separate file that the browser loads the first time the user points at a link, so pages that nobody navigates away from pay nothing.

Without `transitions`, nothing changes in your build: no extra code, no extra bytes.

## Options

`transitions: true` uses the defaults. Pass an object to change them:

```ts title="vite.config.ts"
import { rivetRouter } from "@rivetjs/router/vite";

rivetRouter({
  transitions: {
    viewTransitions: true, // false: no animation, keep only the loading state
    reducedMotion: "skip", // "skip": no animation when the user prefers reduced motion; "allow": let your CSS decide
    pending: { delay: 200, minDuration: 300 }, // loading indicator timing in ms
  },
});
```

`pending.delay` keeps the indicator hidden for fast navigations, so it does not flash. Once shown, it stays at least `minDuration`, so it does not blink.

## Style the animation

The router names the page area `rivet-page` during a transition and sets `data-rivet-transition` on `<html>` with the navigation type: `push`, `replace`, `back` or `forward`, plus any custom types. Target them with the View Transitions pseudo-elements:

```css title="src/styles.css"
@import "@rivetjs/router/transitions.css";

/* Slower fade */
::view-transition-group(rivet-page) {
  animation-duration: 350ms;
}
```

For a slide (forward slides left, back slides right), add the `rivet-slide` class to `<html>` in your document shell; `transitions.css` already contains those rules. Copy them from the file if you want a different selector.

`transitions.css` also turns all these animations off under `prefers-reduced-motion: reduce`.

## Pick a type per link or per page

Add your own types and write CSS for them. On a link:

```tsx
<a href="/photos/2" data-transition="zoom">Forest</a>
<a href="/settings" data-transition="none">Settings</a> {/* no animation */}
```

On a page, export `transition` from its `.tsx` file:

```tsx title="src/routes/photos/[id].tsx"
// Added to the types when navigating to this page.
export const transition = { types: ["zoom"] };
// export const transition = false;   // never animate into this page
// export const transition = (nav) => (nav.type === "back" ? false : { types: ["zoom"] });
```

A link's `data-transition` wins over the page's `transition`. Then style the type:

```css
html[data-rivet-transition~="zoom"]::view-transition-new(rivet-page) {
  animation: 250ms ease both zoom-in;
}
@keyframes zoom-in {
  from { transform: scale(0.96); opacity: 0; }
}
```

With [`<Link>`](./links-and-navigation.md#use-link-for-typed-links), write `transition="zoom"` or `transition={false}`.

## Morph an element into the next page

Give the element on both pages the same `data-vt-name`:

```tsx title="src/routes/index.tsx"
<a href={"/photos/" + photo.id}>
  <img src={photo.thumb} alt={photo.title} data-vt-name={"photo-" + photo.id} />
</a>
```

```tsx title="src/routes/photos/[id].tsx"
<img src={data.full} alt={data.title} data-vt-name={"photo-" + data.id} />
```

The browser then animates the thumbnail's position and size into the big image. Rules:

- The name must appear **once** on the old page and once on the new page. A name used twice on one side is ignored for that navigation.
- Names are only set while the transition runs, so 50 thumbnails with names cost nothing until one is clicked.
- Add `data-vt-class="photo"` to group them in CSS: `::view-transition-group(*.photo) { animation-duration: 300ms; }`.

The router sets these names through the element's style object, not inline `style` attributes, so a strict Content Security Policy keeps working.

## Show loading state

Three things happen during a navigation:

| What | When | Use it for |
| --- | --- | --- |
| `data-rivet-pending` on the clicked link | At once, until the new page is in | Dim the link: `a[data-rivet-pending] { opacity: 0.6 }` |
| `aria-busy="true"` on the page area | At once | Screen readers; styling the old page |
| `data-rivet-pending` on `<html>` | After `pending.delay` | A global indicator. `transitions.css` draws a thin bar at the top. |

With Tailwind v4, import the router's variants after Tailwind:

```css title="src/styles.css"
@import "tailwindcss";
@import "@rivetjs/router/tailwind.css";
@import "@rivetjs/router/transitions.css";
```

```tsx
<a href="/photos/2" class="link-pending:opacity-60">Forest</a>
<div class="hidden nav-pending:block">Loading…</div>
```

The variants are `nav-pending:`, `link-pending:`, `nav-back:` and `nav-forward:`. `<Link pending="opacity-60">` adds plain classes to the link instead.

For text that names the destination, read the navigation state in a component:

```tsx title="src/routes/_layout.tsx"
import type { LayoutProps } from "@rivetjs/router";
import { useNavigation } from "@rivetjs/router/client";

export default function Layout({ children }: LayoutProps) {
  const nav = useNavigation();
  return (
    <div>
      <p role="status" hidden={nav().shown ? undefined : true}>
        Loading {nav().location?.pathname}…
      </p>
      <main>{children}</main>
    </div>
  );
}
```

`nav()` returns `{ state, location, from, type, shown }`. `state` is `"idle"` or `"loading"`; `shown` follows the indicator timing. A resumed layout runs once over its server HTML when it wakes up. After that, navigation updates the bindings that read `nav()` without running the layout body again.

For loading states of changes inside a page (not navigations), see [Suspense and transitions](/guides/components/suspense.md).

## Wait for an image before the swap

Listen for `rivet:before-swap` and pass a promise to `event.detail.defer()`. The router waits for it, at most 500 ms:

```tsx
import { clientEvent } from "@rivetjs/runtime/dom";

clientEvent(document, "rivet:before-swap", (event: CustomEvent) => {
  const hero = document.querySelector<HTMLImageElement>("img[data-hero]");
  if (hero) event.detail.defer(hero.decode());
});
```

`rivet:after-swap` fires when the new page is in the document, `rivet:navigated` when the animation has finished. See [links and navigation](./links-and-navigation.md#react-to-navigations) for all events.

## How it behaves

- The router waits until both the page's data and its code are loaded, then swaps in one step. The old page stays visible and keeps working until then.
- The root layout stays mounted. Its state survives, and it does not animate unless you write CSS for it.
- A second click during a navigation cancels the first one.
- Back and forward get the types `back` and `forward`. When the browser already animated a swipe gesture, the router does not animate again.

## Common mistakes

- **Forgetting the CSS import.** Without `transitions.css`, the browser's default cross-fade covers the whole page, including your header.
- **The same `data-vt-name` on many elements of one page.** The name is ignored. Build unique names, for example with the item id.
- **Setting `view-transition-name` in inline `style` attributes.** Use `data-vt-name`, or a class in your stylesheet.

## See also

- [Links and navigation](./links-and-navigation.md)
- [Layouts](./layouts.md)
- [Design spec](https://github.com/N1XUS/rivetjs/blob/main/docs/design/specs/2026-10-03-route-transitions-design.md)
