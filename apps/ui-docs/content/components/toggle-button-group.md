---
title: ToggleButtonGroup
description: "Groups multiple ToggleButtons into a unified control, allowing users to select one or multiple options."
template: reference
status: experimental
related: [components/toggle-button, components/button-group, components/button]
---

`ToggleButtonGroup` manages the selection of the [ToggleButtons](toggle-button.md) inside it. With `selectionMode="single"` it is a radio group; with `"multiple"` a toolbar. Behaviour is the [cdk ToggleButtonGroup](site:cdk/components/toggle-button-group/): one Tab stop, arrow keys between buttons.

Notes:

- `class`, not `className`.
- `selectedKeys` may be a two-way signal.
- A live `isDisabled` / `orientation` restyles the group but the cdk reads them once for state, ARIA and keys: re-create the group to change them.

## Usage

```tsx
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
```

::example{id=toggle-button-group-basic}

## Anatomy

```tsx
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";
import { ToggleButton } from "@rivetjs/ui/toggle-button";

export default () => (
  <ToggleButtonGroup selectionMode="multiple">
    <ToggleButton id="first">First</ToggleButton>
    <ToggleButton id="second">
      <ToggleButtonGroup.Separator />
      Second
    </ToggleButton>
    <ToggleButton id="third">
      <ToggleButtonGroup.Separator />
      Third
    </ToggleButton>
  </ToggleButtonGroup>
);
```

Additional exported parts: `ToggleButtonGroup.Root`.

## Examples

### Sizes

::example{id=toggle-button-group-sizes}

### Orientation

::example{id=toggle-button-group-orientation}

### Full Width

::example{id=toggle-button-group-full-width}

### Disabled

::example{id=toggle-button-group-disabled}

### Without Separator

Simply omit the `<ToggleButtonGroup.Separator />` component from your buttons.

::example{id=toggle-button-group-without-separator}

### Detached

Use `isDetached` to separate buttons with gaps instead of connecting them.

::example{id=toggle-button-group-attached}

### Selection Mode

Use `selectionMode="single"` for mutually exclusive choices or `selectionMode="multiple"` for independent toggles.

::example{id=toggle-button-group-selection-mode}

### Controlled

::example{id=toggle-button-group-controlled}

### Note

- ToggleButtonGroup uses React Context to pass `size` to all child ToggleButton components
- Each ToggleButton must have a unique `id` prop that corresponds to the keys used in `selectedKeys` / `defaultSelectedKeys`
- The `isDisabled` prop is handled natively by React Aria and disables all child ToggleButtons — individual buttons can override this by setting `isDisabled={false}`
- The component automatically handles border radius between buttons
- Add `<ToggleButtonGroup.Separator />` inside each ToggleButton (except the first) to show dividers between buttons
- Use `disallowEmptySelection` with `selectionMode="single"` to ensure one option is always selected

## Customization

### Tailwind CSS

::example{id=toggle-button-group-custom-styles}

### Global CSS

To customize the ToggleButtonGroup component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .toggle-button-group {
    @apply rounded-lg;
  }

  .toggle-button-group__separator {
    @apply opacity-25;
  }

  .toggle-button-group--full-width {
    @apply w-full;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `toggle-button-group-separator`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ToggleButtonGroup component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/toggle-button-group.css)):

#### Base & Layout Classes

- `.toggle-button-group` - Base container styles
- `.toggle-button-group--horizontal` - Horizontal orientation
- `.toggle-button-group--vertical` - Vertical orientation
- `.toggle-button-group--full-width` - Full width modifier
- `.toggle-button-group__separator` - Separator element between buttons

#### Modifier Classes

- `.toggle-button-group--detached` - Detached mode (separated buttons with gaps)

## API Reference

See the [full module API](/api/rivetjs/ui/toggle-button-group/) for every named export and part prop type.

### ToggleButtonGroup

Inherits from [React Aria ToggleButtonGroup](https://react-aria.adobe.com/ToggleButtonGroup).

| Prop                     | Type                         | Default        | Description                                      |
| ------------------------ | ---------------------------- | -------------- | ------------------------------------------------ |
| `selectionMode`          | `"single" \| "multiple"`     | `"single"`     | Whether one or multiple buttons can be selected  |
| `selectedKeys`           | `Iterable<Key>`              | -              | Controlled selection state                       |
| `defaultSelectedKeys`    | `Iterable<Key>`              | -              | Default selected keys (uncontrolled)             |
| `onSelectionChange`      | `(keys: Set<Key>) => void`   | -              | Called when selection changes                    |
| `disallowEmptySelection` | `boolean`                    | `false`        | Prevents clearing all selections                 |
| `orientation`            | `"horizontal" \| "vertical"` | `"horizontal"` | Layout direction                                 |
| `size`                   | `"sm" \| "md" \| "lg"`       | `"md"`         | Size propagated to child ToggleButtons           |
| `isDetached`             | `boolean`                    | `false`        | Whether buttons are visually separated with gaps |
| `fullWidth`              | `boolean`                    | `false`        | Whether the group fills available width          |
| `isDisabled`             | `boolean`                    | `false`        | Disables all buttons in the group                |
| `class`                  | `string`                     | -              | Additional CSS classes                           |

### ToggleButtonGroup.Separator

| Prop    | Type     | Default | Description            |
| ------- | -------- | ------- | ---------------------- |
| `class` | `string` | -       | Additional CSS classes |

::api{symbol="@rivetjs/ui/toggle-button-group#ToggleButtonGroupRootProps"}

## Accessibility

| Key                                | Action                                            |
| ---------------------------------- | ------------------------------------------------- |
| :kbd[Tab]                          | Moves focus into and out of the group (one stop). |
| :kbd[ArrowLeft] / :kbd[ArrowRight] | Previous / next button (horizontal).              |
| :kbd[ArrowUp] / :kbd[ArrowDown]    | Previous / next button (vertical).                |
| :kbd[Space] / :kbd[Enter]          | Toggle the focused button.                        |

Name the group with `aria-label`.

## Related Components

- [ToggleButton](/components/toggle-button/): Interactive toggle control for on/off states.
- [ButtonGroup](/components/button-group/): Group related buttons together.
- [Button](/components/button/): Allows a user to perform an action.
