---
title: Theming
description: "Customize @rivetjs/ui with CSS variables, BEM component classes and custom themes: how the theme files, Tailwind bridge and imports fit together."
template: guide
status: experimental
related: [start/colors, start/dark-mode, start/styling]
---

A Rivet UI theme is a set of CSS custom properties. Components never hard-code a color, radius or shadow; they read these variables, so a theme is changed with ordinary CSS and no JavaScript.

:::note
To design a theme visually, open the [Theme Builder](/themes/): it edits colors, radius, fonts and more, then exports the CSS.
:::

## How themes work

`@rivetjs/ui/styles` is built for [Tailwind CSS v4](https://tailwindcss.com/docs/theme) and has three parts:

1. **Theme variables** (`--accent`, `--surface`, `--radius`, …), declared per theme in `@layer base`. The light block matches `:root`, so it is always the fallback; the dark block matches `.dark` and `[data-theme="dark"]`.
2. **Calculated variables** derived from them with `color-mix()`: hover fills, soft variants, field states, border and separator levels.
3. **A Tailwind bridge** (`@theme inline`) that exposes the variables as Tailwind tokens, so `bg-accent`, `rounded-lg` or `shadow-surface` resolve to the active theme.

Naming follows one rule: a plain name is a fill (`--accent`), and `-foreground` is the text color for it (`--accent-foreground`). The full token list is on [Colors](/start/colors/).

## Applying a theme

Set the theme marker on `<html>` and give the body the background and text tokens:

```html
<html class="light" data-theme="light">
  <body class="bg-background text-foreground">
    <!-- Your app -->
  </body>
</html>
```

To switch, change the marker, for example `class="dark" data-theme="dark"`. In an app, render `<ThemeScript />` from `@rivetjs/kit` in the root layout so the stored theme is set before the first paint, and change `data-theme` from an event handler:

```tsx
import { Button } from "@rivetjs/ui/button";

export function ThemeSwitch() {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };
  return <Button onPress={toggle}>Toggle theme</Button>;
}
```

The complete setup, including a light / dark / system switcher, is on [Dark Mode](/start/dark-mode/).

## Overriding variables

The smallest customization is to redefine a few variables after the import:

```css
/* src/styles.css */
@import "tailwindcss";
@import "@rivetjs/ui/styles";

:root {
  /* Override any color variable */
  --accent: oklch(0.7 0.25 260);
  --success: oklch(0.65 0.15 155);
}
```

Derived colors (hover, soft, focus) follow the new base values. Adding new color roles is covered in [Colors](/start/colors/#changing-colors).

## Writing a custom theme

A named theme is a block of variables under its own `data-theme` value, usually one block per mode. This example defines a light and a dark "ocean" theme:

```css
/* src/themes/ocean.css */
@layer base {
  /* Ocean Light */
  [data-theme="ocean"] {
    color-scheme: light;

    /* Primitive Colors (Do not change between light and dark) */
    --white: oklch(100% 0 0);
    --black: oklch(0% 0 0);
    --snow: oklch(0.9911 0 0);
    --eclipse: oklch(0.2103 0.0059 285.89);

    /* Spacing & Layout */
    --spacing: 0.25rem;
    --border-width: 1px;
    --field-border-width: 0px;
    --disabled-opacity: 0.5;
    --ring-offset-width: 2px;
    --cursor-interactive: pointer;
    --cursor-disabled: not-allowed;

    /* Radius */
    --radius: 0.75rem;
    --field-radius: calc(var(--radius) * 1.5);

    /* Base Colors */
    --background: oklch(0.985 0.015 225);
    --foreground: var(--eclipse);

    /* Surface: Used for non-overlay components */
    --surface: var(--white);
    --surface-foreground: var(--foreground);

    /* Overlay: Used for floating/overlay components */
    --overlay: var(--white);
    --overlay-foreground: var(--foreground);

    --muted: oklch(0.5517 0.0138 285.94);

    --scrollbar-thumb: color-mix(in oklch, var(--foreground) 15%, transparent);
    --scrollbar-track: transparent;
    --scrollbar-gutter: auto;
    --scrollbar-width: thin;
    --scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
    --scrollbar: var(--scrollbar-thumb);

    --default: oklch(94% 0.001 286.375);
    --default-foreground: var(--eclipse);

    /* Ocean accent */
    --accent: oklch(0.45 0.15 230);
    --accent-foreground: var(--snow);

    /* Form Field Defaults */
    --field-background: var(--white);
    --field-foreground: oklch(0.2103 0.0059 285.89);
    --field-placeholder: var(--muted);
    --field-border: transparent;

    /* Status (kept compatible) */
    --success: oklch(0.7329 0.1935 150.81);
    --success-foreground: var(--eclipse);

    --warning: oklch(0.7819 0.1585 72.33);
    --warning-foreground: var(--eclipse);

    --danger: oklch(0.6532 0.2328 25.74);
    --danger-foreground: var(--snow);

    /* Component Colors */
    --segment: var(--white);
    --segment-foreground: var(--foreground);

    /* Misc */
    --border: oklch(0.5 0.06 230 / 22%);
    --separator: oklch(92% 0.004 286.32);
    --focus: var(--accent);
    --link: var(--accent);

    /* Shadows */
    --surface-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.06);
    --overlay-shadow: 0 4px 16px 0 rgba(24, 24, 27, 0.08), 0 8px 24px 0 rgba(24, 24, 27, 0.09);
    --field-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.06);

    /* Skeleton Default Global Animation */
    --skeleton-animation: shimmer; /* Possible values: shimmer, pulse, none */

    /* Tooltip Default Delays */
    --tooltip-delay: 1500ms;
    --tooltip-close-delay: 500ms;
  }

  /* Ocean Dark */
  [data-theme="ocean-dark"] {
    color-scheme: dark;

    /* Base Colors */
    --background: oklch(0.14 0.02 230);
    --foreground: var(--snow);

    /* Surface: Used for non-overlay components */
    --surface: oklch(0.2103 0.0059 285.89);
    --surface-foreground: var(--foreground);

    /* Overlay: Used for floating/overlay components */
    --overlay: oklch(0.22 0.0059 285.89);
    --overlay-foreground: var(--foreground);

    --muted: oklch(70.5% 0.015 286.067);

    --scrollbar-thumb: color-mix(in oklch, var(--foreground) 15%, transparent);
    --scrollbar-track: transparent;
    --scrollbar-gutter: auto;
    --scrollbar-width: thin;
    --scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
    --scrollbar: var(--scrollbar-thumb);

    --default: oklch(27.4% 0.006 286.033);
    --default-foreground: var(--snow);

    /* Form Field Defaults */
    --field-background: var(--default);
    --field-foreground: var(--foreground);

    /* Ocean accent */
    --accent: oklch(0.86 0.08 230);
    --accent-foreground: var(--eclipse);

    /* Status */
    --success: oklch(0.7329 0.1935 150.81);
    --success-foreground: var(--eclipse);

    --warning: oklch(0.8203 0.1388 76.34);
    --warning-foreground: var(--eclipse);

    --danger: oklch(0.594 0.1967 24.63);
    --danger-foreground: var(--snow);

    /* Component Colors */
    --segment: oklch(0.3964 0.01 285.93);
    --segment-foreground: var(--foreground);

    /* Misc */
    --border: oklch(22% 0.006 286.033);
    --separator: oklch(22% 0.006 286.033);
    --focus: var(--accent);
    --link: var(--accent);

    /* Shadows */
    --surface-shadow: 0 0 0 0 transparent inset;
    --overlay-shadow: 0 0 0 0 transparent inset;
    --field-shadow: 0 0 0 0 transparent inset;
  }
}
```

Import the file after the library styles, in the `theme` layer:

```css
/* src/styles.css */
@layer theme, base, components, utilities;

@import "tailwindcss";
@import "@rivetjs/ui/styles";

@import "./themes/ocean.css" layer(theme);
```

Then select it on `<html>`:

```html
<html data-theme="ocean"></html>

<!-- or the dark variant -->
<html data-theme="ocean-dark"></html>
```

## Customizing components

Theme variables change every component at once. To change one component everywhere, add rules for its [BEM](https://getbem.com/) classes in the `components` layer:

```css
@layer components {
  /* Customize buttons */
  .button {
    @apply font-semibold tracking-wide;
  }

  .button--primary {
    @apply bg-blue-600 hover:bg-blue-700;
  }

  /* Customize cards */
  .card__title {
    @apply text-lg font-bold;
  }
}
```

Each component page lists its classes (block, elements, modifiers, states), for example [Button classes](/components/button/#css-classes). More options are on [Styling](/start/styling/).

## Importing the styles

**Standard setup:** two imports.

```css
@import "tailwindcss";
@import "@rivetjs/ui/styles";
```

`@rivetjs/ui/styles` contains the theme variables, base styles, utilities and variants, but no component styles. Each component module imports its own compiled stylesheet (`@rivetjs/ui/styles/out/<name>.css`), so a page loads CSS only for the components it renders. In a production build the router merges a page's component stylesheets into one file.

**Assembling it yourself:** import the pieces in Tailwind's layer order.

```css
@layer theme, base, components, utilities;

@import "tailwindcss";
@import "@rivetjs/ui/styles/base/base.css" layer(base);

/* Theme variables */
@import "@rivetjs/ui/styles/themes/shared/theme.css" layer(theme);
@import "@rivetjs/ui/styles/themes/rivet.css" layer(theme);
/* the theme variables the compiled component stylesheets read */
@import "@rivetjs/ui/styles/out/theme.css";

/* Utilities and variants (optional) */
@import "@rivetjs/ui/styles/utilities/index.css" layer(utilities);
@import "@rivetjs/ui/styles/variants/index.css" layer(utilities);
```

**A themed region inside another design:** on a page with its own Tailwind theme, `themes/scoped.css` applies the Rivet theme only below `<section data-ui-theme="rivet">`. Import the component theme variables in a sub-layer so the page's own values keep priority:

```css
@import "@rivetjs/ui/styles/themes/scoped.css" layer(theme);
@import "@rivetjs/ui/styles/out/theme.css" layer(theme.ui);
```

**Without Tailwind or a bundler:** `@rivetjs/ui/styles/*` maps directly to the package files. Link `@rivetjs/ui/styles/out/base.css` (everything except components) and `@rivetjs/ui/styles/out/all.css` (all components).

**Headless:** components always ship with their styles. For unstyled parts with the same behaviour, use [@rivetjs/cdk](site:cdk/), which has no CSS.

## Variables Reference

The variables come from two files:

- [`themes/default/variables.css`](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/themes/default/variables.css) declares the values, per theme:
  1. **Base variables**, identical in every theme: primitives (`--white`, `--black`, `--snow`, `--eclipse`), spacing, border widths, radius, cursors.
  2. **Theme variables**, which differ between light and dark: colors, shadows and the scrollbar tokens (`--scrollbar-thumb`, `--scrollbar-width`, …).
  3. **Calculated variables**: hover states, soft variants, field states and border / separator levels, in the **Calculated Colors** part of each theme block, written with `color-mix()`.
- [`themes/shared/theme.css`](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/themes/shared/theme.css) is the Tailwind bridge, plus the tokens that do not depend on the theme (radius scale, spacing steps, durations, easings, animations).

Shape tokens of the current theme, read live from this page's CSS:

::example{id=tokens-shadows}

::example{id=tokens-borders}

**The Tailwind bridge.** `theme.css` is one `@theme inline` block. It maps each semantic variable to a Tailwind token (`--color-*`, `--shadow-*`, `--radius-*`, `--ease-*`) by reference; calculated colors such as `--accent-soft` stay defined in `variables.css` and are only referenced here. An excerpt:

```css
@theme inline {
  /* Semantic colors */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-surface: var(--surface);
  --color-surface-foreground: var(--surface-foreground);
  --color-overlay: var(--overlay);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-border: var(--border);
  --color-separator: var(--separator);
  --color-focus: var(--focus);
  /* … default, success, warning, danger, segment, muted, link, backdrop */

  /* Calculated colors */
  --color-accent-hover: var(--accent-hover);
  --color-accent-soft: var(--accent-soft);
  --color-accent-soft-foreground: var(--accent-soft-foreground);
  --color-border-secondary: var(--border-secondary);
  --color-separator-secondary: var(--separator-secondary);
  /* … the same for every role and level */

  /* Shadows */
  --shadow-surface: var(--surface-shadow);
  --shadow-overlay: var(--overlay-shadow);
  --shadow-field: var(--field-shadow);

  /* Form fields */
  --color-field: var(--field-background, var(--default));
  --color-field-hover: var(--field-hover);
  --color-field-foreground: var(--field-foreground, var(--foreground));
  --color-field-placeholder: var(--field-placeholder, var(--muted));
  --color-field-border: var(--field-border, var(--border));
  --radius-field: var(--field-radius, calc(var(--radius) * 1.5));
  --border-width-field: var(--field-border-width, var(--border-width));

  /* Radius scale: every step is a multiple of --radius */
  --radius-xs: calc(var(--radius) * 0.25); /* 2px */
  --radius-sm: calc(var(--radius) * 0.5); /* 4px */
  --radius-md: calc(var(--radius) * 0.75); /* 6px */
  --radius-lg: calc(var(--radius) * 1); /* 8px */
  --radius-xl: calc(var(--radius) * 1.5); /* 12px */
  --radius-2xl: calc(var(--radius) * 2); /* 16px */
  --radius-3xl: calc(var(--radius) * 3); /* 24px */
  --radius-4xl: calc(var(--radius) * 4); /* 32px */
  --r-min: var(--radius-sm); /* floor of a concentric inner radius */

  /* Spacing steps (4, 6, 8, 12, 16, 24, 36, 52 px) */
  --space-1: 0.25rem;
  /* … --space-8: 3.25rem */

  /* Motion */
  --ease-smooth: cubic-bezier(0.2, 0, 0, 1);
  --duration-fast: 120ms;
  --duration-base: 180ms;
  --duration-slow: 260ms;
  --overlay-ease: cubic-bezier(0.32, 0.72, 0, 1);
  --overlay-duration: 500ms;
  --overlay-fade-duration: 400ms;
  --overlay-exit-duration: var(--duration-slow);
  --ease-out-fluid: cubic-bezier(0.32, 0.72, 0, 1);
  /* … --ease-in-*, --ease-out-*, --ease-in-out-* (quad to circ), --ease-linear */

  /* Animations */
  --animate-spin-fast: spin 0.75s linear infinite;
  --animate-skeleton: skeleton 2s linear infinite;
  --animate-caret-blink: caret-blink 1.2s ease-out infinite;
}
```

Form controls (inputs, checkboxes, radios, OTP slots) read only the `--field-*` variables. Their hover, focus and border states are calculated in `variables.css` and bridged in `theme.css` (`--color-field-hover: var(--field-hover)`). Override `--field-background`, `--field-hover` and the related tokens to restyle form controls without changing buttons or cards.

## Scrollbars

Component scroll areas (tables, popovers, drawers and similar) share one scrollbar style. It is built only from the standard properties `scrollbar-width`, `scrollbar-color` and `scrollbar-gutter`; there are no `::-webkit-scrollbar` rules.

**Modes.** Set `data-scrollbar` on `<html>`, a component root or a scroll slot. The closest ancestor wins:

| Mode         | `data-scrollbar`    | Behavior                                       |
| ------------ | ------------------- | ---------------------------------------------- |
| Themed thin  | _(unset)_ or `thin` | Thin thumb from theme tokens                   |
| OS / browser | `default`           | Native scrollbars (`auto`)                     |
| Hidden       | `none`              | No visible scrollbar (`scrollbar-width: none`) |

```html
<!-- Native scrollbars everywhere -->
<html data-scrollbar="default">
  <!-- Themed scrollbars again in one subtree -->
  <main data-scrollbar="thin">...</main>

  <!-- Hide scrollbars in one subtree (e.g. a popover) -->
  <div data-scrollbar="none">...</div>
</html>
```

**Tokens.** Each theme block in [`variables.css`](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/themes/default/variables.css) sets:

| Variable             | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `--scrollbar-thumb`  | Thumb color (default: 15% `--foreground` via `color-mix`) |
| `--scrollbar-track`  | Track color (default: `transparent`)                      |
| `--scrollbar-gutter` | Gutter (default: `auto`)                                  |
| `--scrollbar-width`  | `scrollbar-width` (default: `thin`)                       |
| `--scrollbar-color`  | `scrollbar-color` (default: thumb + track)                |
| `--scrollbar`        | Legacy alias of `--scrollbar-thumb`                       |

Change them globally:

```css
/* src/styles.css */
:root {
  --scrollbar-thumb: color-mix(in oklch, var(--accent) 30%, transparent);
  --scrollbar-gutter: auto;
}
```

Or per component, with the attribute on the component or a wrapper that overrides the tokens:

```tsx
<ScrollShadow data-scrollbar="default">...</ScrollShadow>

<Card.Content data-scrollbar="thin" />
```

The attribute works on any element. For your own overflow containers, use the `scrollbar`, `scrollbar-thin`, `scrollbar-default` and `scrollbar-none` utilities ([Styling](/start/styling/#scrollbars)).

Some components hide their scrollbars by default: date picker popovers, the color picker, secondary tabs. A scroll slot nested inside them, such as the calendar year picker in a date picker, still shows the themed scrollbar, because `scrollbar-none` applies to its own element only and not to descendants that `@apply scrollbar`.

## Vibrant Palette

Soft variants (`*-soft-foreground` for accent, success, warning and danger) mix a fair amount of foreground into the color by default, between 30% and 70% depending on role and mode, so text on soft fills stays readable. For more saturated soft text, set `data-vibrant-palette` on the root element:

```html
<html data-vibrant-palette="true"></html>
```

Every soft foreground then becomes 92% of its color with 8% foreground, close to the raw color with a small contrast lift.

| Mode            | Default                                      | Vibrant                               |
| --------------- | -------------------------------------------- | ------------------------------------- |
| Soft foreground | `color-mix(color 70–80%, foreground 30–70%)` | `color-mix(color 92%, foreground 8%)` |

:::tip
The vibrant palette trades contrast for saturation. Some pairs, especially with a light accent, may fall below WCAG contrast requirements.
:::

The [Theme Builder](/themes/) has a "Vibrant palette" toggle in its theme popover.

## See also

- [Colors](/start/colors/)
- [Styling](/start/styling/)
- [Tailwind CSS v4 theme variables](https://tailwindcss.com/docs/theme)
- [BEM methodology](https://getbem.com/)
- [OKLCH color tool](https://oklch.com)
