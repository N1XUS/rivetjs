---
title: Tooltip
description: "Displays informative text when users hover over or focus on an element."
template: reference
status: experimental
related: [components/button, components/popover]
---

`Tooltip` shows a short description on hover or keyboard focus. The root is the [cdk TooltipTrigger](site:cdk/components/tooltip/) (global warmup / cooldown, Escape, `aria-describedby`); `Tooltip.Content` is the cdk `Tooltip` on the shared div overlay layer.

Notes:

- `class`, not `className`. `isOpen` takes a signal (two-way).
- `delay` / `closeDelay` default to the `--tooltip-delay` / `--tooltip-close-delay` theme variables on client-created tooltips; server-rendered (resumed) ones use 1500 / 500 ms, the theme's values.
- `Tooltip.Arrow`'s default tip is a CSS-shaped `span` filled with `var(--overlay)`. A custom arrow child is not cloned: give it `data-slot="overlay-arrow"`.
- The tooltip renders in Rivet's div overlay layer; nothing is rendered on the server while it is closed.

Accessibility: The tooltip has `role="tooltip"` and is linked to its trigger with `aria-describedby` while open. It opens on hover and keyboard focus, never takes focus, and closes on Escape, blur, press and pointer leave. `Tooltip.Trigger` is a focusable `div role="button"`; give it an `aria-label`.

## Usage

```tsx
import { Tooltip } from "@rivetjs/ui/tooltip";
```

::example{id=tooltip-basic}

## Anatomy

```tsx
import { Button } from "@rivetjs/ui/button";
import { Tooltip } from "@rivetjs/ui/tooltip";

export default () => (
  <Tooltip>
    <Tooltip.Trigger>
      <Button>Hover for tooltip</Button>
    </Tooltip.Trigger>
    <Tooltip.Content>
      <Tooltip.Arrow />
      Helpful information about this element
    </Tooltip.Content>
  </Tooltip>
);
```

## Examples

### Placement

::example{id=tooltip-placement}

### With Arrow

::example{id=tooltip-with-arrow}

### Custom Triggers

::example{id=tooltip-custom-trigger}

### Render Function

::example{id=tooltip-render-function}

## Customization

### Tailwind CSS

::example{id=tooltip-custom-styles}

### Global CSS

To customize the Tooltip component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .tooltip {
    @apply rounded-xl shadow-lg;
  }

  .tooltip__trigger {
    @apply cursor-help;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Tooltip component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/tooltip.css)):

#### Base Classes

- `.tooltip` - Base tooltip styles with animations
- `.tooltip__trigger` - Trigger element styles

### Interactive States

The component supports animation states:

- **Entering**: `[data-entering]` - Applied during tooltip appearance
- **Exiting**: `[data-exiting]` - Applied during tooltip disappearance
- **Placement**: `[data-placement="*"]` - Applied based on tooltip position

## API Reference

### Tooltip

| Prop                  | Type                 | Default   | Description                                                                                   |
| --------------------- | -------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `children`            | `Content`            | -         | Trigger element and content                                                                   |
| `delay`               | `number`             | `1500`    | Delay in milliseconds before showing tooltip (`--tooltip-delay`)                              |
| `closeDelay`          | `number`             | `500`     | Delay in milliseconds before hiding tooltip (`--tooltip-close-delay`)                         |
| `trigger`             | `"hover" \| "focus"` | `"hover"` | How the tooltip is triggered                                                                  |
| `isDisabled`          | `boolean`            | `false`   | Whether the tooltip is disabled                                                               |
| `shouldSkipAnimation` | `boolean`            | `false`   | Whether to skip the enter and exit animations when moving quickly from one tooltip to another |

### Tooltip.Content

| Prop        | Type                                                    | Default            | Description                                                      |
| ----------- | ------------------------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| `children`  | `Content`                                               | -                  | Content to display in the tooltip                                |
| `showArrow` | `boolean`                                               | `false`            | Whether to show the arrow indicator                              |
| `offset`    | `number`                                                | `3` (7 with arrow) | Distance from the trigger element                                |
| `placement` | `"top" \| "bottom" \| "left" \| "right"` (and variants) | `"top"`            | Placement of the tooltip                                         |
| `class`     | `string`                                                | -                  | Additional CSS classes                                           |
| `render`    | `DOMRenderFunction<"div", TooltipRenderProps>`          | -                  | Overrides the default DOM element with a custom render function. |

### Tooltip.Trigger

| Prop       | Type      | Default | Description                       |
| ---------- | --------- | ------- | --------------------------------- |
| `children` | `Content` | -       | Element that triggers the tooltip |
| `class`    | `string`  | -       | Additional CSS classes            |

### Tooltip.Arrow

| Prop       | Type                                                | Default | Description                                                      |
| ---------- | --------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `children` | `Content`                                           | -       | Custom arrow element                                             |
| `class`    | `string`                                            | -       | Additional CSS classes                                           |
| `render`   | `DOMRenderFunction<"div", OverlayArrowRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

::api{symbol="@rivetjs/ui/tooltip#TooltipContentProps"}

## Related Components

- [Button](/components/button/): Allows a user to perform an action.
- [Popover](/components/popover/): Displays content in an overlay.
