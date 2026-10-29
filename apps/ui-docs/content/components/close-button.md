---
title: CloseButton
description: "Button component for closing dialogs, modals, or dismissing content."
template: reference
status: experimental
related: [components/alert, components/chip]
---

`CloseButton` is the small dismiss button used in alerts, chips and dialogs. It is a [cdk Button](site:cdk/components/button/) with `aria-label="Close"` and `type="button"`; without children it shows the lucide `X` icon.

Notes:

- `class`, not `className`.
- The icon is lucide `X` (stroked).
- Any child replaces the default icon; omit children to keep it.

## Usage

```tsx
import { CloseButton } from "@rivetjs/ui/close-button";
```

::example{id=close-button-default}

## Anatomy

`CloseButton` exposes `CloseButton.Root`.

Use the composition in the live example above; the API reference below describes the props.

## Examples

### Interactive

::example{id=close-button-interactive}

### With Custom Icon

::example{id=close-button-with-custom-icon}

## Customization

### Tailwind CSS

::example{id=close-button-custom-styles}

### Global CSS

To customize the CloseButton component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .close-button {
    @apply bg-red-100 text-red-800 hover:bg-red-200;
  }

  .close-button--custom {
    @apply rounded-full border-2 border-red-300;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `close-button-icon`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The CloseButton component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/close-button.css)):

#### Base Classes

- `.close-button` - Base component styles

#### Variant Classes

- `.close-button--default` - Default variant

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]`
- **Active/Pressed**: `:active` or `[data-pressed="true"]`
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]`
- **Disabled**: `:disabled` or `[aria-disabled="true"]`

### Zero-JS native path

In production builds, a CloseButton with only declared data props (`variant`, `isDisabled`, `id`, `class`, children with no render prop) and no `onPress`, outside every trigger, tooltip, dialog slot and group, renders a plain `<button>` with the same markup and ships no JavaScript, before or after a press. Press, hover and focus states then come from `:active`, `:hover` and `:focus-visible` only; there is no `data-pressed` / `data-hovered` / `data-focus-visible`. A CloseButton inside an Alert, Modal or Chip that closes it, or one with `onPress`, keeps the interactive path. See [What ships no JavaScript](site:docs/guides/performance/zero-js/).

## API Reference

See the [full module API](/api/rivetjs/ui/close-button/) for every named export and part prop type.

### CloseButton

| Prop         | Type                         | Default         | Description                                 |
| ------------ | ---------------------------- | --------------- | ------------------------------------------- |
| `variant`    | `"default"`                  | `"default"`     | Visual variant of the button                |
| `children`   | `Content \| function`        | `<CloseIcon />` | Content to display (defaults to close icon) |
| `onPress`    | `() => void`                 | -               | Handler called when the button is pressed   |
| `isDisabled` | `boolean \| (() => boolean)` | `false`         | Whether the button is disabled              |

### React Aria Button Props

CloseButton extends all React Aria Button props. Common props include:

| Prop               | Type     | Description                             |
| ------------------ | -------- | --------------------------------------- |
| `aria-label`       | `string` | Accessible label for screen readers     |
| `aria-labelledby`  | `string` | ID of element that labels the button    |
| `aria-describedby` | `string` | ID of element that describes the button |

### Render Props

When using the render prop pattern, these values are provided:

| Prop         | Type            | Description                    |
| ------------ | --------------- | ------------------------------ |
| `isHovered`  | `() => boolean` | Whether the button is hovered  |
| `isPressed`  | `() => boolean` | Whether the button is pressed  |
| `isFocused`  | `() => boolean` | Whether the button is focused  |
| `isDisabled` | `() => boolean` | Whether the button is disabled |

::api{symbol="@rivetjs/ui/close-button#CloseButtonRootProps"}

## Accessibility

A real `<button>` named "Close" unless you pass another `aria-label`. Keyboard: Enter and Space. A CloseButton without `onPress`, outside triggers, can ship no JavaScript ([Zero-JS native path](#zero-js-native-path)).

## Related Components

- [Alert](/components/alert/): Display important messages and notifications.
- [AlertDialog](/components/alert-dialog/): Critical confirmations requiring user attention.
- [Chip](/components/chip/): Compact elements for tags and filters.
