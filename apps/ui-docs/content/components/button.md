---
title: Button
description: "A clickable button component with multiple variants and states."
template: reference
status: experimental
related: [components/alert, components/close-button]
---

`Button` is the styled button on top of the accessible [cdk Button](site:cdk/components/button/): press events that unify mouse, touch, keyboard and screen readers, hover / press / focus-visible state attributes, and a pending state.

Notes:

- `class`, not `className`.
- `isDisabled` and `isPending` accept accessors; the button updates without being re-created.
- Function `class` / `children` get accessor render props.
- A Button with a handler loads its resume chunk with the page. A Button without behaviour (data props only, no handler, not a submit / reset button, outside triggers / groups / forms) renders a plain `<button>` and ships no JavaScript: pressed / hover / focus styles come from `:active` / `:hover` / `:focus-visible`.
- `variant="brand"` (Rivet addition): the logo gradient for the one primary call to action of a page (white label ≥ 4.5:1 on every stop).
- `radius="concentric"` (Rivet addition): the padded parent's inner radius instead of the pill, for a Button in a Card corner ([Styling](/start/styling/)).

## Usage

```tsx
import { Button } from "@rivetjs/ui/button";
```

::example{id=button-basic}

## Anatomy

`Button` exposes `Button.Root`.

Use the composition in the live example above; the API reference below describes the props.

## Examples

### Variants

::example{id=button-variants}

### Brand

Rivet addition: a gradient fill from the logo's deep stops, for the one primary call to action of a page. Without the Rivet theme it falls back to the accent fill.

::example{id=button-brand}

### Sizes

::example{id=button-sizes}

### With Icons

::example{id=button-with-icons}

### Icon Only

::example{id=button-icon-only}

### Loading

::example{id=button-loading}

### Loading State

::example{id=button-loading-state}

### Full Width

::example{id=button-full-width}

### Disabled State

::example{id=button-disabled}

### Social Buttons

Google keeps its full-colour logo; GitHub and Apple follow the button text colour in light and dark themes.

::example{id=button-social}

### Render Function

::example{id=button-render-function}

### Adding custom variants

You can extend Rivet UI components by wrapping them and adding your own custom variants.

::example{id=button-custom-variants}

### Adding Ripple Effect

The Button component supports ripple effects through composition, allowing you to nest ripple components as children. This example nests [`PressableFeedback.Ripple`](pressable-feedback.md#standalone-ripple) (the original demo uses [m3-ripple](https://github.com/saltyaom/m3-ripple)): it follows the button's own press, ripples from the press point (Space / Enter: from the centre) and needs no other wrapper.

::example{id=button-ripple-effect}

## Customization

### Tailwind CSS

::example{id=button-custom-styles}

### Global CSS

To customize the Button component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .button {
    @apply bg-purple-500 text-white hover:bg-purple-600;
  }

  .button--icon-only {
    @apply rounded-lg bg-blue-500;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Button component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/button.css)):

#### Base & Size Classes

- `.button` - Base button styles
- `.button--sm` - Small size variant
- `.button--md` - Medium size variant
- `.button--lg` - Large size variant

#### Variant Classes

- `.button--primary`
- `.button--secondary`
- `.button--tertiary`
- `.button--outline`
- `.button--ghost`
- `.button--danger`
- `.button--danger-soft`
- `.button--brand` (Rivet addition)

#### Modifier Classes

- `.button--icon-only`
- `.button--icon-only.button--sm`
- `.button--icon-only.button--lg`

### Interactive States

The button supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]`
- **Active/Pressed**: `:active` or `[data-pressed="true"]` (includes scale transform)
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` (shows focus ring)
- **Disabled**: `:disabled` or `[aria-disabled="true"]` (reduced opacity, no pointer events)
- **Pending**: `[data-pending]` (no pointer events during loading)

### Zero-JS native path

Production builds give two kinds of Button call sites a native `<button>` without the cdk press code:

- **No behaviour.** A Button with only declared data props (`variant`, `size`, `fullWidth`, `isIconOnly`, `isDisabled`, `type`, `id`, `radius`, `class`, children with no render prop) and no handler, outside every trigger, tooltip, group and form, renders the same markup as the interactive one and ships no JavaScript, before or after a press. `type="submit"` / `"reset"` keep the interactive path (the form handles the press).
- **A handler that ignores its event.** A Button whose `onPress` never reads its event (`onPress={() => save()}`), with constant style props, no `class`, spread or render-prop children, `type` absent or `"button"` and nothing above it that reads into a button, becomes `<button type="button" onClick>`: the page keeps your handler but loads no press, hover or focus code. This applies only where no other Button on the same page still needs that code. `isDisabled` may be live.

At both kinds of sites Enter and Space follow native button rules (Enter on keydown, Space on keyup), and there is no `data-pressed`, `data-hovered` or `data-focus-visible`: style states with the pseudo-classes above (`:active`, `:hover`, `:focus-visible`, `:disabled`), which the Button stylesheet already pairs with each attribute. On a handler site the handler receives the native `MouseEvent`; Safari and Firefox on macOS do not focus a native button on mouse click. Every other call site keeps the interactive path. Builds read `RIVET_NATIVE_LITE=0` (no handler rewrite) and `=all` from the environment; see [What ships no JavaScript](site:docs/guides/performance/zero-js/).

## API Reference

See the [full module API](/api/rivetjs/ui/button/) for every named export and part prop type.

### Button

| Prop         | Type                                                                                                     | Default     | Description                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| `variant`    | `'primary' \| 'secondary' \| 'tertiary' \| 'outline' \| 'ghost' \| 'danger' \| 'danger-soft' \| 'brand'` | `'primary'` | Visual style variant                                                 |
| `size`       | `'sm' \| 'md' \| 'lg'`                                                                                   | `'md'`      | Size of the button                                                   |
| `fullWidth`  | `boolean`                                                                                                | `false`     | Whether the button should take full width of its container           |
| `isDisabled` | `boolean \| (() => boolean)`                                                                             | `false`     | Whether the button is disabled                                       |
| `isPending`  | `boolean \| (() => boolean)`                                                                             | `false`     | Whether the button is in a loading state                             |
| `isIconOnly` | `boolean`                                                                                                | `false`     | Whether the button contains only an icon                             |
| `radius`     | `'concentric'`                                                                                           | -           | The padded parent's inner radius instead of the pill (`data-radius`) |
| `onPress`    | `(e: PressEvent) => void`                                                                                | -           | Handler called when the button is pressed                            |
| `children`   | `Content \| (values: ButtonRenderProps) => Content`                                                      | -           | Button content or render prop                                        |
| `render`     | `DOMRenderFunction<keyof JSX.IntrinsicElements, ButtonRenderProps>`                                      | -           | Overrides the default DOM element with a custom render function.     |

### Render Props

When using the render prop pattern, these values are provided:

| Prop             | Type            | Description                                    |
| ---------------- | --------------- | ---------------------------------------------- |
| `isPending`      | `() => boolean` | Whether the button is in a loading state       |
| `isPressed`      | `() => boolean` | Whether the button is currently pressed        |
| `isHovered`      | `() => boolean` | Whether the button is hovered                  |
| `isFocused`      | `() => boolean` | Whether the button is focused                  |
| `isFocusVisible` | `() => boolean` | Whether the button should show focus indicator |
| `isDisabled`     | `() => boolean` | Whether the button is disabled                 |

::api{symbol="@rivetjs/ui/button#ButtonRootProps"}

## Accessibility

A native `<button>` with the cdk Button behaviour: Enter and Space press it, a disabled button is `disabled`, a pending one is announced and keeps focus. Focus rings follow `data-focus-visible` (keyboard only); a Button without behaviour is a plain `<button>` whose ring follows `:focus-visible`. In production builds some call sites render a native `<button>` instead ([Zero-JS native path](#zero-js-native-path)).

## Related Components

- [Popover](/components/popover/): Displays content in context with a trigger.
- [Tooltip](/components/tooltip/): Contextual information on hover or focus.
- [Form](/components/form/): Form validation and submission handling.
