---
title: ToggleButton
description: "An interactive toggle control for on/off or selected/unselected states."
template: reference
status: experimental
related: [components/button, components/toggle-button-group]
---

`ToggleButton` is a button that stays pressed: bold in a toolbar, a star, a filter. It is the [cdk ToggleButton](site:cdk/components/toggle-button/) with the Rivet UI styles.

Notes:

- `class`, not `className`.
- `isSelected` is a two-way signal, not a React controlled value with `onChange`; a live boolean `isSelected={x()}` is not supported.

Accessibility: A `<button aria-pressed>`; inside a single-selection [ToggleButtonGroup](toggle-button-group.md) it becomes `role="radio"` with `aria-checked`. Icon-only buttons need an `aria-label`.

## Usage

```tsx
import { ToggleButton } from "@rivetjs/ui/toggle-button";
```

::example{id=toggle-button-basic}

## Examples

### Variants

::example{id=toggle-button-variants}

### Icon Only

::example{id=toggle-button-icon-only}

### Sizes

::example{id=toggle-button-sizes}

### Disabled

::example{id=toggle-button-disabled}

### Controlled

::example{id=toggle-button-controlled}

## Customization

### Tailwind CSS

::example{id=toggle-button-custom-styles}

### Global CSS

To customize the ToggleButton component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .toggle-button {
    @apply bg-purple-500 text-white;
  }

  .toggle-button--icon-only {
    @apply rounded-lg;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ToggleButton component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/toggle-button.css)):

#### Base & Size Classes

- `.toggle-button` - Base toggle button styles
- `.toggle-button--sm` - Small size variant
- `.toggle-button--md` - Medium size variant (default)
- `.toggle-button--lg` - Large size variant

#### Variant Classes

- `.toggle-button--default` - Default variant with filled background
- `.toggle-button--ghost` - Ghost variant with transparent background

#### Modifier Classes

- `.toggle-button--icon-only` - Icon-only toggle button
- `.toggle-button--icon-only.toggle-button--sm` - Small icon-only
- `.toggle-button--icon-only.toggle-button--lg` - Large icon-only

### Interactive States

The toggle button supports both CSS pseudo-classes and data attributes for flexibility:

- **Selected**: `[data-selected="true"]` (accent background and foreground)
- **Hover**: `:hover` or `[data-hovered="true"]`
- **Active/Pressed**: `:active` or `[data-pressed="true"]` (includes scale transform)
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` (shows focus ring)
- **Disabled**: `:disabled` or `[aria-disabled="true"]` (reduced opacity, no pointer events)

## API Reference

### ToggleButton

Inherits from [React Aria ToggleButton](https://react-spectrum.adobe.com/react-aria/ToggleButton.html).

| Prop              | Type                                                      | Default     | Description                               |
| ----------------- | --------------------------------------------------------- | ----------- | ----------------------------------------- |
| `variant`         | `'default' \| 'ghost'`                                    | `'default'` | Visual style variant                      |
| `size`            | `'sm' \| 'md' \| 'lg'`                                    | `'md'`      | Size of the toggle button                 |
| `isIconOnly`      | `boolean`                                                 | `false`     | Whether the button contains only an icon  |
| `isSelected`      | `boolean`                                                 | -           | Controlled selected state                 |
| `defaultSelected` | `boolean`                                                 | `false`     | Default selected state (uncontrolled)     |
| `isDisabled`      | `boolean`                                                 | `false`     | Whether the toggle button is disabled     |
| `onChange`        | `(isSelected: boolean) => void`                           | -           | Handler called when selection changes     |
| `onPress`         | `(e: PressEvent) => void`                                 | -           | Handler called when the button is pressed |
| `children`        | `Content \| (values: ToggleButtonRenderProps) => Content` | -           | Button content or render prop             |

### Render Props

When using the render prop pattern, these values are provided:

| Prop             | Type      | Description                                    |
| ---------------- | --------- | ---------------------------------------------- |
| `isSelected`     | `boolean` | Whether the button is currently selected       |
| `isPressed`      | `boolean` | Whether the button is currently pressed        |
| `isHovered`      | `boolean` | Whether the button is hovered                  |
| `isFocused`      | `boolean` | Whether the button is focused                  |
| `isFocusVisible` | `boolean` | Whether the button should show focus indicator |
| `isDisabled`     | `boolean` | Whether the button is disabled                 |

::api{symbol="@rivetjs/ui/toggle-button#ToggleButtonRootProps"}

## Related Components

- [Button](/components/button/): Allows a user to perform an action.
- [Switch](/components/switch/): Toggle between two states.
- [Checkbox](/components/checkbox/): Binary choice input control.
