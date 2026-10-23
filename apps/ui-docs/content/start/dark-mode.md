---
title: Dark Mode
description: "Add light, dark and system theme switching to @rivetjs/ui: a dark class or data-theme on <html>, set before first paint by ThemeScript."
template: guide
status: experimental
related: [start/theming, start/colors]
---

Rivet UI has no theme provider. Every component reads its colours from CSS variables, and the active theme is chosen by a marker on an ancestor element, usually `<html>`. Switching to dark mode means changing that marker; no component re-renders.

## Selecting a theme

Put the theme marker on `<html>` and give the app shell the background and text tokens, so the page canvas follows the theme too:

```html
<html class="dark" data-theme="dark">
  <body class="bg-background text-foreground">
    <!-- Your app -->
  </body>
</html>
```

The built-in themes accept either form of marker:

| Theme | Class              | Attribute                                    |
| ----- | ------------------ | -------------------------------------------- |
| Light | `light`, `default` | `data-theme="light"`, `data-theme="default"` |
| Dark  | `dark`             | `data-theme="dark"`                          |

One marker is enough. If you set both the class and the attribute yourself, keep them in agreement.

:::note
Only the marker switches the variables. The `dark:` variant from `@rivetjs/ui/styles/variants` has a fallback: with no dark marker present it also matches `prefers-color-scheme: dark`, even below an explicit `light` ancestor. On a dark OS with no marker set, `dark:` utilities can then apply while the variables stay light. Pages with a theme switch should always set the marker explicitly.
:::

## Setting the theme before first paint

A stored theme has to be applied before the browser paints, or the page flashes the default theme first. `<ThemeScript>` from `@rivetjs/kit` handles this. It is a small blocking script in the document head that:

- reads the stored choice from `localStorage` (key `theme`),
- resolves `system` through `prefers-color-scheme`,
- sets `data-theme` on `<html>` before the body renders.

`@rivetjs/kit` is already a dependency of `@rivetjs/ui`, so there is nothing extra to install. Render the script once, from the root layout:

```tsx
// src/routes/_layout.tsx
import { ThemeScript } from "@rivetjs/kit";

export default function Layout(props: { children: unknown }) {
  return (
    <>
      <ThemeScript />
      <div class="bg-background text-foreground min-h-dvh">{props.children}</div>
    </>
  );
}
```

Rivet resumes the server markup instead of re-rendering it, so a theme attribute changed by the script never causes a mismatch warning.

`<ThemeScript>` is a kit head component, which needs the kit Vite plugin, `kit()` from `@rivetjs/kit/vite`, next to the router plugin. Without it, rendering stops with "kit head needs @rivetjs/router with the kit Vite plugin".

```ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { kit } from "@rivetjs/kit/vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [kit(), rivetRouter({ mode: "static", styles: ["src/styles.css"] }), tailwindcss()],
});
```

Props:

- `attribute="class"` toggles a class on `<html>` instead of `data-theme`.
- `storageKey` changes the `localStorage` key.
- `defaultTheme` sets the theme used when nothing is stored.

The script output depends only on its props, so a hash-based CSP stays stable across requests.

## Theme switcher

The server only knows the default theme; the stored one exists in the browser. A switcher therefore keeps its own signal and writes to `<html>` from event handlers, never during render:

```tsx
// src/components/theme-switcher.tsx
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";

export function ThemeSwitcher() {
  const theme = signal("system");
  const set = (next: string) => {
    theme.set(next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
    const dark = next === "dark" || (next === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  };

  return (
    <div class="flex items-center gap-2">
      <Button variant={theme() === "light" ? "primary" : "secondary"} onPress={() => set("light")}>
        Light
      </Button>
      <Button variant={theme() === "dark" ? "primary" : "secondary"} onPress={() => set("dark")}>
        Dark
      </Button>
      <Button variant={theme() === "system" ? "primary" : "secondary"} onPress={() => set("system")}>
        System
      </Button>
    </div>
  );
}
```

It stores the choice under the same key `<ThemeScript>` reads, so the next page load starts in the right theme. The buttons work on a resumed page without hydration: the first press runs the component over the server HTML ([resuming](site:docs/learn/resuming/)).

:::warning
Keep a single theme controller per app: your own switcher or the one your site shell ships, not both. On this site the top bar sets `data-theme` on `<html>`, and the examples follow it.
:::

## Custom theme names

`data-theme` is a plain attribute, so themes written against your own selectors work the same way. Set `document.documentElement.dataset.theme = "ocean"`, or store `ocean` under the `theme` key for `<ThemeScript>`. How to write the theme CSS is covered in [Theming](/start/theming/).

If the switcher offers custom themes, list `light` and `dark` as well when the built-in themes should stay selectable.

## Styling for both themes

Theme-aware utilities such as `bg-surface` read CSS variables, so they change with the theme and need no extra code. Since a theme is just a set of variables on an element, the marker also works on a subtree. Here the same card renders under `data-theme="light"` and `data-theme="dark"` on one page:

::example{id=theme-compare}

```tsx
<main class="min-h-screen bg-background text-foreground">
  <section class="bg-surface text-surface-foreground shadow-surface">Theme-aware content</section>
</main>
```

For an adjustment that only applies in dark mode, use the `dark:` variant:

```tsx
<div class="bg-background text-foreground dark:border-default">Custom dark-mode adjustment</div>
```
