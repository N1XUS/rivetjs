---
title: Styling
description: "Style @rivetjs/ui components with Tailwind utilities, BEM classes, data attributes, render props, tailwind-variants and scoped css blocks."
template: guide
status: experimental
related: [start/theming, start/animation, start/composition]
---

Rivet UI components are styled by plain CSS classes on top of the theme tokens. You can change them at several levels: utilities on one instance, rules on the component classes for the whole app, variant wrappers for reusable designs, and scoped `css` blocks for one-off component styles. Render props cover styling that depends on state.

## Classes and inline styles

Every component takes a `class` prop. Your classes are merged with the component's own through `tailwind-merge`, so a conflicting utility you pass replaces the default instead of fighting it:

```tsx
<Button class="bg-purple-500 hover:bg-purple-600">Custom Button</Button>

<Card class="border-2 border-gray-200 rounded-xl">{/* content */}</Card>
```

In the browser, `tailwind-merge` loads only on pages whose code can pass a class it would change (two conflicting utilities, a class built at run time); other pages ship without it and render the same classes. A class string that comes from run-time data (JSON, a loader) is not seen by the build: write conflicting utilities in the code, or keep such strings free of conflicts.

`style` takes an object. Keys can be camelCase, kebab-case or custom properties (`--name`); style strings are not accepted:

```tsx
<Button style={{ backgroundColor: "#8B5CF6" }}>Styled Button</Button>
```

## State attributes

Interactive state is exposed as `data-*` attributes set by the cdk. They work like pseudo-classes but also cover states CSS cannot see, such as a press started by keyboard or a focus that came from the keyboard. Pair them with the native pseudo-class when you want both:

```css
.button[data-hovered="true"],
.button:hover {
  background: var(--accent-hover);
}

.button[data-pressed="true"],
.button:active {
  transform: scale(0.97);
}

.button[data-focus-visible="true"],
.button:focus-visible {
  outline: 2px solid var(--focus);
}
```

## Render props

`class` and `children` also accept a function of the component state. The state values are accessors: call them (`isPressed()`) and only the attribute or text that reads them updates.

```tsx
import { Icon } from "@rivetjs/kit/icon";
import { Heart } from "lucide";

// Dynamic classes
<Button class={({ isPressed }) => (isPressed() ? "bg-blue-600" : "bg-blue-500")}>Press me</Button>

// Dynamic content
<Button>
  {({ isHovered, isPressed }) => (
    <>
      <Icon icon={Heart} size={16} class={isPressed() ? "text-red-500" : "text-neutral-400"} />
      <span class={isHovered() ? "underline" : ""}>Like</span>
    </>
  )}
</Button>
```

## Component classes

Each component's stylesheet is written with [BEM](https://getbem.com/) names: a block class for the component, `__element` classes for its parts and `--modifier` classes for variants and sizes.

| Kind     | Examples                                              |
| -------- | ----------------------------------------------------- |
| Block    | `.button`, `.card`                                    |
| Element  | `.card__header`, `.card__title`                       |
| Modifier | `.button--primary`, `.button--lg`, `.card--secondary` |

Two common components, in full:

- **Button:** `.button`, `.button--{variant}`, `.button--{size}`, `.button--icon-only`
- **Card:** `.card`, `.card--{variant}`, `.card__header`, `.card__title`, `.card__description`, `.card__content`, `.card__footer`

Every component page lists its classes under Styling Reference ([Button](/components/button/#css-classes), [Card](/components/card/#css-classes)). The stylesheets themselves are in `@rivetjs/ui/styles/components/` ([source](https://github.com/N1XUS/rivetjs/tree/main/libs/ui/styles/components)).

Rules on these classes inside `@layer components` change a component everywhere, and new modifiers sit next to the built-in ones:

```css
/* src/styles.css */

@layer components {
  /* Override button styles */
  .button {
    @apply font-semibold uppercase;
  }

  .button--primary {
    @apply bg-indigo-600 hover:bg-indigo-700;
  }

  /* Add custom variant */
  .button--gradient {
    @apply bg-gradient-to-r from-purple-500 to-pink-500;
  }
}
```

## Wrapper components

For a reusable design with its own variant props, extend the component's variant function with [tailwind-variants](https://tailwind-variants.org/). `@rivetjs/ui` re-exports it as `tv`:

```tsx
import { splitProps } from "@rivetjs/runtime/props";
import { tv, type VariantProps } from "@rivetjs/ui";
import { Button, buttonVariants, type ButtonProps } from "@rivetjs/ui/button";

const customButtonVariants = tv({
  extend: buttonVariants,
  base: "font-medium transition-all",
  variants: {
    intent: {
      primary: "bg-blue-500 hover:bg-blue-600 text-white",
      secondary: "bg-gray-200 hover:bg-gray-300",
      danger: "bg-red-500 hover:bg-red-600 text-white",
    },
    size: {
      small: "text-sm px-2 py-1",
      medium: "text-base px-4 py-2",
      large: "text-lg px-6 py-3",
    },
  },
  defaultVariants: {
    intent: "primary",
    size: "medium",
  },
});

type CustomButtonVariants = VariantProps<typeof customButtonVariants>;
interface CustomButtonProps extends Omit<ButtonProps, "class" | "size">, CustomButtonVariants {
  class?: string;
}

export function CustomButton(props: CustomButtonProps) {
  const [local, rest] = splitProps(props, ["intent", "size", "class"]);
  return <Button class={customButtonVariants({ intent: local.intent, size: local.size, class: local.class })} {...rest} />;
}
```

`splitProps` keeps the props live: when a parent passes `intent={intent()}`, the class updates in place.

## Scoped CSS

When a style belongs to one component file, write it in a `css` block from `@rivetjs/runtime/css`. Class names are made unique per file, and the CSS is extracted into a regular stylesheet at build time, with nothing injected at runtime. Details: [scoped styles](site:docs/guides/styling/scoped-styles/).

```tsx
import { css } from "@rivetjs/runtime/css";

const styles = css`
  .gradient {
    background: linear-gradient(45deg, #fe6b8b 30%, #ff8e53 90%);
    border-radius: 8px;
    color: white;
    padding: 12px 24px;
  }
  .gradient:hover {
    box-shadow: 0 3px 10px rgba(255, 105, 135, 0.3);
  }
`;

export const StyledButton = (props: ButtonProps) => <Button {...props} class={styles.gradient} />;

<Button class={styles.gradient}>Gradient Button</Button>;
```

CSS Modules (`*.module.css`) follow the same scoping scheme, for styles you prefer to keep in a separate file:

```css
/* Button.module.css */
.button {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
}

.button:hover {
  transform: translateY(-2px);
}
```

```tsx
import styles from "./Button.module.css";

<Button class={styles.button}>Scoped Button</Button>;
```

## Responsive styles

Breakpoint prefixes work on the `class` prop:

```tsx
<Button class="text-sm md:text-base lg:text-lg px-3 md:px-4 lg:px-6">Responsive Button</Button>
```

Or use media queries on the component class:

```css
.button {
  font-size: 0.875rem;
  padding: 0.5rem 1rem;
}

@media (min-width: 768px) {
  .button {
    font-size: 1rem;
    padding: 0.75rem 1.5rem;
  }
}
```

## Concentric Radii

A rounded element inset in a rounded parent follows the parent's curve: its radius is the parent's radius minus the inset, never less than `--r-min` (4 px). Padded surfaces set `--r-inner` for what they hold: a list item in a Select or Dropdown popover is 18 px (24 px popover − 6 px list padding), a Card nested in a Card or a Popover dialog is 8 px, a ColorArea in the ColorPicker popover 12 px. Every step of the radius scale is a multiple of `--radius`, so one variable rescales them all (values below are measured live):

::example{id=tokens-radius}

Use the same variable for your own content, for example an image in a Card:

```tsx
<Card>
  <img class="rounded-(--r-inner)" src={photo} alt="" />
</Card>
```

Pill-shaped controls (Button, Chip, Tag, Tab) stay pills. `data-radius="concentric"` on a Button opts in to `--r-inner`, for a Button that sits in a Card corner.

## Shadows

The theme has three shadow tokens, one per elevation step: `--field-shadow` (inputs), `--surface-shadow` (cards and other in-page containers) and `--overlay-shadow` (popovers, menus, modals, toasts), as the utilities `shadow-field`, `shadow-surface` and `shadow-overlay`. The page itself has none. Layers stack in that order: an Input on a Card, a Card over the page, a Popover over a Card, a Modal over everything (with `--backdrop` dimming what is below).

In dark mode the Rivet theme (`@rivetjs/ui/styles`, `themes/rivet.css`) draws no drop shadows: `--surface-shadow` and `--overlay-shadow` become a 1 px inset white hairline (8 % alpha) and `--field-shadow` is transparent. The default theme (`themes/default/variables.css`) keeps the dark surface transparent too and gives overlays a faint inset glow (`0 0 1px` at 0.3 alpha). Elevation there comes from lighter surface colours (`--surface`, `--overlay` over `--background`, see [Colors](/start/colors/#surface)). The light sample below keeps the drop shadows visible in both modes (values are measured live):

::example{id=tokens-shadows}

For another elevation step, add a token to your theme with a value per mode and map it to a Tailwind utility:

```css
@layer base {
  :root,
  [data-theme="light"] {
    --raised-shadow: 0 16px 32px -12px rgb(0 0 0 / 0.22), 0 4px 8px -4px rgb(0 0 0 / 0.08);
  }
  .dark,
  [data-theme="dark"] {
    --raised-shadow: 0 0 0 1px rgb(255 255 255 / 0.1) inset;
  }
}

@theme inline {
  --shadow-raised: var(--raised-shadow);
}
```

Then use `class="shadow-raised"`. To change the built-in steps, override `--surface-shadow`, `--overlay-shadow` or `--field-shadow` the same way ([Theming](/start/theming/#variables-reference)).

## Borders, Separators and Focus

Surfaces and outlines use `--border-width` and the `--border` / `--border-secondary` / `--border-tertiary` colours, inputs `--field-border-width`. Separators (`<Separator>`, list and table dividers) use `--separator` and its two lighter levels. Keyboard focus draws the `focus-ring` utility in `--focus` with a `--ring-offset-width` gap; press Tab in the example to see it on a Button and an Input:

::example{id=tokens-borders}

## Spacing and Density

Paddings and gaps follow one 4-pt scale with a ratio of about 1.5: 4, 6, 8, 12, 16, 24, 36 and 52 px (`--space-1` … `--space-8`, Tailwind `1`, `1.5`, `2`, `3`, `4`, `6`, `9`, `13`). Pill controls keep a horizontal to vertical padding ratio of 2 : 1 (Button lg 20 / 10 px, Chip 8 / 4 px, Tag 8 / 4 and 12 / 6 px), rectangular fields 1.5 : 1.

::example{id=tokens-spacing}

Small controls (Checkbox, Radio, Switch without a label, CloseButton, the Tag remove button, the Toast close button) answer presses in at least 24 × 24 px, and 44 × 44 px on touch screens (`pointer: coarse`), without changing their visible size. Use the `touch-target` utility for your own small controls; the element needs `position: relative`:

```tsx
<button class="relative touch-target size-4" aria-label="Info">
  <Icon icon={Info} />
</button>
```

`data-density="compact"` on a container makes the controls inside it one step smaller (the example above measures them): Button md 36 → 32 px high with 12 px padding (sm 32 → 28, lg 40 → 36), Input / TextArea / Select trigger 6 px vertical padding, ListBox and Menu items 32 px. A `data-density="comfortable"` container inside it restores the default sizes:

```tsx
<div data-density="compact">
  <Button>Save</Button>
  <ListBox aria-label="Files">…</ListBox>
  <div data-density="comfortable">
    <Button>Default size</Button>
  </div>
</div>
```

## Icon Sizes

Icons inside components follow the text next to them: 14 px next to 12 px text (Tag, list and menu check marks; 12 px in a small Tag), 16 px next to 14 px text (Button, menu chevrons, alerts, field buttons) and 20 px next to 16 px text (large Button and ToggleButton). The stroke stays visually even: 2 lucide units at 16 px, 1.75 at 20 px, and a 2 px stroke at 12 and 14 px (lucide `absoluteStrokeWidth`). Icons have no margins, so the gap between icon and label is the component's own `gap`.

Components set the size from CSS, so `<Icon icon={Plus} />` inside a Button needs no `size`. In a Chip an icon without `size` takes the chip icon box (14 px, 16 px in `lg`), as does `size={24}` (the kit default, any 24 × 24 direct-child `svg`); any other explicit `size` is kept.

::example{id=tokens-icon-sizes}

## Scrollbars

Component scroll areas get their scrollbar look from `@apply scrollbar` in the component CSS. The same utilities from `@rivetjs/ui/styles` work on your own overflow containers:

```tsx
<div class="scrollbar h-64 overflow-y-auto">{/* long content */}</div>
```

| Utility             | Effect                                                  |
| ------------------- | ------------------------------------------------------- |
| `scrollbar`         | Themed thumb (reads the theme's `--scrollbar-*` tokens) |
| `scrollbar-thin`    | Themed thin scrollbar                                   |
| `scrollbar-default` | OS / browser scrollbars                                 |
| `scrollbar-none`    | Hidden scrollbar                                        |

To switch the mode for the whole page or one subtree, set `data-scrollbar` on an ancestor. Tokens and modes: [Theming](/start/theming/#scrollbars).

## See also

- [Animation](/start/animation/)
- [Theming](/start/theming/)
- [Components](/components/overview/)
