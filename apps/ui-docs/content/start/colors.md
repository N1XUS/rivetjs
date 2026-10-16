---
title: Colors
description: "The color tokens of @rivetjs/ui: accent, neutrals, status, foreground, background, surface, field, separator; light and dark values, contrast checks."
template: guide
status: experimental
related: [start/theming, start/dark-mode]
---

Rivet UI does not hand you a large raw palette. It defines a short list of color roles, each named for what it means (accent, danger, surface, separator…), and components only ever use those roles. Most role variants, such as hover fills and soft backgrounds, are computed from a few base values with `color-mix()`, so changing one base color updates everything derived from it and keeps contrast and hierarchy consistent.

Two naming rules cover the whole set:

- A name without a suffix is a fill or background: `--accent`.
- The same name with `-foreground` is the text and icon color to use on it: `--accent-foreground`.

Each role is also a Tailwind color (`bg-accent`, `text-accent-foreground`, `bg-accent-soft`, …) through the `@theme inline` bridge described in [Theming](/start/theming/#variables-reference).

:::note
To design a theme visually, open the [Theme Builder](/themes/): it edits colors, radius, fonts and more, then exports the CSS.
:::

The swatches below read the live tokens of the Rivet theme from this page's CSS; switch the site to dark mode to see the dark values.

::example{id=tokens-colors-semantic}

The tables on this page list the values of the base theme in `themes/default/variables.css`. The shipped Rivet theme (`themes/rivet.css`) builds on it and replaces the accent (taken from the logo's blue and indigo), tints the neutrals toward it and adjusts a few pairs for contrast, so its live values differ from the tables.

## Accent

The accent is the product color. It marks primary actions, selection and other points of emphasis, and it loses that effect when it is everywhere: reserve it for the few things that should stand out. Components derive their hover, soft and focus colors from the base accent, so one value is usually all you set.

| Token                            | Value                                                                  |
| -------------------------------- | ---------------------------------------------------------------------- |
| `--accent`                       | `oklch(0.6204 0.195 253.83)`                                           |
| `--color-accent-hover`           | `color-mix(in oklab, var(--accent) 90%, var(--accent-foreground) 10%)` |
| `--accent-foreground`            | `var(--snow)`                                                          |
| `--color-accent-soft`            | `color-mix(in oklab, var(--accent) 15%, transparent)`                  |
| `--color-accent-soft-hover`      | `color-mix(in oklab, var(--accent) 20%, transparent)`                  |
| `--color-accent-soft-foreground` | `color-mix(in oklab, var(--accent) 70%, var(--foreground) 30%)`        |

## Default (neutrals)

The default role is the neutral fill for everything that should not draw attention: secondary buttons, chips, tracks, inactive controls.

| Token                   | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| `--default`             | `oklch(94% 0.001 286.375)`                                              |
| `--color-default-hover` | `color-mix(in oklab, var(--default) 96%, var(--default-foreground) 4%)` |
| `--default-foreground`  | `var(--eclipse)`                                                        |

## Success

Status colors carry meaning, so use each one only for its state. Success marks a positive outcome: a saved form, a passed check, a completed step.

| Token                             | Value                                                                    |
| --------------------------------- | ------------------------------------------------------------------------ |
| `--success`                       | `oklch(0.7329 0.1935 150.81)`                                            |
| `--color-success-hover`           | `color-mix(in oklab, var(--success) 90%, var(--success-foreground) 10%)` |
| `--success-foreground`            | `var(--eclipse)`                                                         |
| `--color-success-soft`            | `color-mix(in oklab, var(--success) 15%, transparent)`                   |
| `--color-success-soft-hover`      | `color-mix(in oklab, var(--success) 20%, transparent)`                   |
| `--color-success-soft-foreground` | `color-mix(in oklab, var(--success) 80%, var(--foreground) 60%)`         |

## Warning

Warning asks the user to pause: a risk, a limit about to be reached, something to review. It is not for destructive actions.

| Token                             | Value                                                                    |
| --------------------------------- | ------------------------------------------------------------------------ |
| `--warning`                       | `oklch(0.7819 0.1585 72.33)`                                             |
| `--color-warning-hover`           | `color-mix(in oklab, var(--warning) 90%, var(--warning-foreground) 10%)` |
| `--warning-foreground`            | `var(--eclipse)`                                                         |
| `--color-warning-soft`            | `color-mix(in oklab, var(--warning) 15%, transparent)`                   |
| `--color-warning-soft-hover`      | `color-mix(in oklab, var(--warning) 20%, transparent)`                   |
| `--color-warning-soft-foreground` | `color-mix(in oklab, var(--warning) 80%, var(--foreground) 70%)`         |

## Danger

Danger marks errors and actions that cannot be undone: delete buttons, failed validation, critical alerts. Keep it consistent so users recognise it at a glance.

| Token                            | Value                                                                  |
| -------------------------------- | ---------------------------------------------------------------------- |
| `--danger`                       | `oklch(0.6532 0.2328 25.74)`                                           |
| `--color-danger-hover`           | `color-mix(in oklab, var(--danger) 90%, var(--danger-foreground) 10%)` |
| `--danger-foreground`            | `var(--snow)`                                                          |
| `--color-danger-soft`            | `color-mix(in oklab, var(--danger) 15%, transparent)`                  |
| `--color-danger-soft-hover`      | `color-mix(in oklab, var(--danger) 20%, transparent)`                  |
| `--color-danger-soft-foreground` | `color-mix(in oklab, var(--danger) 70%, var(--foreground) 40%)`        |

The tables above show light values. In the dark theme the soft fills of accent, success and warning are lighter (12%, hover 16%), danger keeps 15% / 20%, and every soft foreground mixes 80% of its color with 30% foreground. The dark theme also uses its own `--warning` (`oklch(0.8203 0.1388 76.34)`) and `--danger` (`oklch(0.594 0.1967 24.63)`).

## Foreground

Foreground tokens color text and icons. Use the token rather than a fixed color in components, so text stays readable on every background and in both themes.

| Role       | Token          | Light                         | Dark                          |
| ---------- | -------------- | ----------------------------- | ----------------------------- |
| Foreground | `--foreground` | `var(--eclipse)`              | `var(--snow)`                 |
| Muted      | `--muted`      | `oklch(0.5517 0.0138 285.94)` | `oklch(70.5% 0.015 286.067)`  |
| Segment    | `--segment`    | `var(--white)`                | `oklch(0.3964 0.01 285.93)`   |
| Overlay    | `--overlay`    | `var(--white)`                | `oklch(0.2103 0.0059 285.89)` |
| Link       | `--link`       | `var(--foreground)`           | `var(--foreground)`           |

## Background

The background is the page canvas: a quiet base that sets overall contrast. The secondary and tertiary levels step slightly toward the foreground. How the layers stack, with live Rivet values:

::example{id=tokens-colors-surface}

| Role       | Token                          | Light                                                              | Dark                                                               |
| ---------- | ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Background | `--background`                 | `oklch(0.9702 0 0)`                                                | `oklch(12% 0.005 285.823)`                                         |
| Secondary  | `--color-background-secondary` | `color-mix(in oklab, var(--background) 96%, var(--foreground) 4%)` | `color-mix(in oklab, var(--background) 96%, var(--foreground) 4%)` |
| Tertiary   | `--color-background-tertiary`  | `color-mix(in oklab, var(--background) 92%, var(--foreground) 8%)` | `color-mix(in oklab, var(--background) 92%, var(--foreground) 8%)` |
| Inverse    | `--color-background-inverse`   | `var(--foreground)`                                                | `var(--foreground)`                                                |

## Surface

Surfaces are the containers placed on the background: cards, panels, accordions. Floating layers (popovers, menus, modals, tooltips) use `--overlay` instead. Hierarchy comes from layering and elevation, not from strong hue changes.

Each level pairs with a shadow token (`--surface-shadow`, `--overlay-shadow`). In dark mode (Rivet theme) the lighter surface color carries the elevation instead of a drop shadow; see [Shadows](/start/styling/#shadows).

| Role      | Token                 | Light                         | Dark                          |
| --------- | --------------------- | ----------------------------- | ----------------------------- |
| Surface   | `--surface`           | `var(--white)`                | `oklch(0.2103 0.0059 285.89)` |
| Secondary | `--surface-secondary` | `oklch(0.9524 0.0013 286.37)` | `oklch(0.257 0.0037 286.14)`  |
| Tertiary  | `--surface-tertiary`  | `oklch(0.9373 0.0013 286.37)` | `oklch(0.2721 0.0024 247.91)` |

## Form field

Inputs, selects, checkboxes, radios and OTP slots read a separate set of `--field-*` tokens. Keeping fields apart from buttons and surfaces lets you restyle all form controls without touching anything else.

| Role             | Token                  | Light / formula                                                                                                   | Dark                          |
| ---------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Background       | `--field-background`   | `var(--white)`                                                                                                    | `oklch(0.2103 0.0059 285.89)` |
| Text             | `--field-foreground`   | `oklch(0.2103 0.0059 285.89)`                                                                                     | `var(--foreground)`           |
| Placeholder      | `--field-placeholder`  | `var(--muted)`                                                                                                    | `var(--muted)`                |
| Border           | `--field-border`       | `transparent`                                                                                                     | `transparent`                 |
| Hover background | `--field-hover`        | `color-mix(in oklab, var(--field-background, var(--default)) 90%, var(--field-foreground, var(--foreground)) 2%)` | same formula                  |
| Focus background | `--field-focus`        | `var(--field-background, var(--default))`                                                                         | same formula                  |
| Hover border     | `--field-border-hover` | `color-mix(in oklab, var(--field-border, var(--border)) 88%, var(--field-foreground, var(--foreground)) 10%)`     | same formula                  |
| Focus border     | `--field-border-focus` | `color-mix(in oklab, var(--field-border, var(--border)) 74%, var(--field-foreground, var(--foreground)) 22%)`     | same formula                  |

The Tailwind colors are `bg-field`, `bg-field-hover`, `bg-field-focus`, `text-field-foreground`, `text-field-placeholder`, `border-field-border` and so on.

## Separator

Separators are dividers between list rows, table cells and sections. They structure content and should stay low in contrast so they never compete with it.

| Role      | Token                         | Light                                                                    | Dark                                                                     |
| --------- | ----------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Separator | `--separator`                 | `oklch(92% 0.004 286.32)`                                                | `oklch(25% 0.006 286.033)`                                               |
| Secondary | `--color-separator-secondary` | `color-mix(in oklab, var(--surface) 85%, var(--surface-foreground) 15%)` | `color-mix(in oklab, var(--surface) 85%, var(--surface-foreground) 15%)` |
| Tertiary  | `--color-separator-tertiary`  | `color-mix(in oklab, var(--surface) 81%, var(--surface-foreground) 19%)` | `color-mix(in oklab, var(--surface) 81%, var(--surface-foreground) 19%)` |

## Other

Utility roles that do not fit the groups above:

| Role     | Token        | Light                     | Dark                          |
| -------- | ------------ | ------------------------- | ----------------------------- |
| Border   | `--border`   | `oklch(90% 0.004 286.32)` | `oklch(28% 0.006 286.033)`    |
| Backdrop | `--backdrop` | `rgba(0, 0, 0, 0.5)`      | `rgba(0, 0, 0, 0.6)`          |
| Overlay  | `--overlay`  | `var(--white)`            | `oklch(0.2103 0.0059 285.89)` |
| Segment  | `--segment`  | `var(--white)`            | `oklch(0.3964 0.01 285.93)`   |
| Focus    | `--focus`    | `var(--accent)`           | `var(--accent)`               |

`--border` has two stronger levels, `--border-secondary` and `--border-tertiary` (mixes of `--surface` with 22% and 34% `--surface-foreground`).

## Primitive

Primitives are the fixed values the semantic tokens are built from. They are the same in light and dark.

| Token       | Value                         |
| ----------- | ----------------------------- |
| `--white`   | `oklch(100% 0 0)`             |
| `--black`   | `oklch(0% 0 0)`               |
| `--snow`    | `oklch(0.9911 0 0)`           |
| `--eclipse` | `oklch(0.2103 0.0059 285.89)` |

## Using the tokens

In markup, use the Tailwind colors:

```tsx
<div class="bg-background text-foreground">
  <button class="bg-accent text-accent-foreground hover:bg-accent-hover">Click me</button>
</div>
```

In CSS, read the variables directly or `@apply` the utilities:

```css title="global.css"
/* Direct CSS variables */
.my-component {
  background: var(--accent);
  color: var(--accent-foreground);
  border: 1px solid var(--border);
}

/* With @apply and @layer */
@layer components {
  .button {
    @apply bg-accent text-accent-foreground;

    &:hover,
    &[data-hovered="true"] {
      @apply bg-accent-hover;
    }

    &:active,
    &[data-pressed="true"] {
      @apply bg-accent-hover;
      transform: scale(0.97);
    }
  }
}
```

## The theme file

All values above come from one file, [`themes/default/variables.css`](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/themes/default/variables.css). It has four blocks:

1. `:root, :host`: values shared by every theme (primitives, spacing, border widths, radius, cursors, accent and success, tooltip delays, skeleton animation).
2. Light: `:root`, `.light`, `.default`, `[data-theme="light"]`, `[data-theme="default"]`.
3. Dark: `.dark`, `[data-theme="dark"]`.
4. The vibrant palette overrides (`[data-vibrant-palette="true"]`, see [Theming](/start/theming/#vibrant-palette)).

The light and dark blocks each set the base colors first and then the **Calculated Colors** (hover, soft, field states, separator and border levels) from them. Shortened:

```css
@layer base {
  /* Shared by every theme */
  :root,
  :host {
    --white: oklch(100% 0 0);
    --black: oklch(0% 0 0);
    --snow: oklch(0.9911 0 0);
    --eclipse: oklch(0.2103 0.0059 285.89);

    --spacing: 0.25rem;
    --border-width: 1px;
    --field-border-width: 0px;
    --disabled-opacity: 0.5;
    --ring-offset-width: 2px;
    --cursor-interactive: pointer;
    --cursor-disabled: not-allowed;
    --radius: 0.5rem;
    --field-radius: calc(var(--radius) * 1.5);

    --accent: oklch(0.6204 0.195 253.83);
    --accent-foreground: var(--snow);
    --success: oklch(0.7329 0.1935 150.81);
    --success-foreground: var(--eclipse);
    --field-border: transparent;

    --skeleton-animation: shimmer; /* shimmer, pulse, none */
    --tooltip-delay: 1500ms;
    --tooltip-close-delay: 500ms;
  }

  /* Light */
  :root,
  .light,
  [data-theme="light"] {
    color-scheme: light;
    --background: oklch(0.9702 0 0);
    --foreground: var(--eclipse);
    --surface: var(--white);
    --overlay: var(--white);
    --muted: oklch(0.5517 0.0138 285.94);
    --default: oklch(94% 0.001 286.375);
    --field-background: var(--white);
    --warning: oklch(0.7819 0.1585 72.33);
    --danger: oklch(0.6532 0.2328 25.74);
    --border: oklch(90% 0.004 286.32);
    --separator: oklch(92% 0.004 286.32);
    --focus: var(--accent);
    --backdrop: rgba(0, 0, 0, 0.5);

    /* Calculated Colors */
    --accent-hover: color-mix(in oklab, var(--accent) 90%, var(--accent-foreground) 10%);
    --accent-soft: color-mix(in oklab, var(--accent) 15%, transparent);
    /* … */
  }

  /* Dark */
  .dark,
  [data-theme="dark"] {
    color-scheme: dark;
    --background: oklch(12% 0.005 285.823);
    --foreground: var(--snow);
    --surface: oklch(0.2103 0.0059 285.89);
    --overlay: oklch(0.2103 0.0059 285.89);
    --muted: oklch(70.5% 0.015 286.067);
    --default: oklch(27.4% 0.006 286.033);
    --field-background: oklch(0.2103 0.0059 285.89);
    --warning: oklch(0.8203 0.1388 76.34);
    --danger: oklch(0.594 0.1967 24.63);
    --border: oklch(28% 0.006 286.033);
    --separator: oklch(25% 0.006 286.033);
    --backdrop: rgba(0, 0, 0, 0.6);

    --surface-shadow: 0 0 0 0 transparent inset; /* no drop shadow in dark mode */
    --overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.3) inset;
    --field-shadow: 0 0 0 0 transparent inset; /* keeps ring utilities working */
    /* … Calculated Colors */
  }
}
```

The theme switches on the `dark` class or `data-theme="dark"`; see [Dark Mode](/start/dark-mode/).

## Contrast

The Rivet theme is checked pair by pair (`CONTRAST_PAIRS` in `@rivetjs/ui/theme`), in light and dark, with two measures: the WCAG 2 ratio and the APCA lightness contrast (Lc, APCA-W3 0.1.9).

| Pair                                                                                                           | WCAG  | APCA  |
| -------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| Text on backgrounds, surfaces (all levels), overlays, fields, soft fills; muted text and placeholders included | 4.5:1 | Lc 60 |
| Focus ring on background and surface, chart series on surface                                                  | 3:1   | Lc 30 |
| Accent fill on background (selected checkbox / switch / radio)                                                 | 3:1   | Lc 15 |

The [theme builder](/themes/) runs the same check on the theme you edit and lists the pairs that fail.

## Changing colors

To change a role, redefine its base variable. Set the light value on `:root` and the dark one on the dark selector; derived colors follow automatically:

```css
:root {
  /* Override default colors */
  --accent: oklch(0.7 0.15 250);
  --success: oklch(0.65 0.15 155);
}

[data-theme="dark"] {
  /* Override dark theme colors */
  --accent: oklch(0.8 0.12 250);
  --success: oklch(0.75 0.12 155);
}
```

[oklch.com](https://oklch.com) converts hex or RGB values to OKLCH.

A new role needs a value per theme plus an entry in `@theme inline`, which turns it into Tailwind utilities:

```css
:root,
[data-theme="light"] {
  --info: oklch(0.6 0.15 210);
  --info-foreground: oklch(0.98 0 0);
}

.dark,
[data-theme="dark"] {
  --info: oklch(0.7 0.12 210);
  --info-foreground: oklch(0.15 0 0);
}

/* Make the color available to Tailwind */
@theme inline {
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
}
```

```tsx
<div class="bg-info text-info-foreground">Info message</div>
```

How `@theme` variables become utilities in Tailwind CSS v4: [Tailwind theme variables](https://tailwindcss.com/docs/theme).
