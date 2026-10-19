---
title: ButtonGroup
description: "Group related buttons together with consistent styling and spacing."
template: reference
status: experimental
related: [components/button, components/chip]
---

`ButtonGroup` joins related buttons into one control. Every [Button](button.md) inside reads the group's `size`, `variant`, `isDisabled` and `fullWidth`. The root is the [cdk Group](site:cdk/components/group/) (`role="group"`).

Notes:

- `class`, not `className`.
- There is no element cloning: every Button under the group reads it, also nested ones. Opt out with `BUTTON_GROUP_CHILD: false`.
- Group props are live (`isDisabled={d()}`).

Accessibility: The root has `role="group"`; give it an `aria-label` when the buttons need a shared name. Separators are `aria-hidden`. Each Button keeps its own Tab stop (use a [ToggleButtonGroup](toggle-button-group.md) for arrow-key navigation).

## Usage

```tsx
import { ButtonGroup } from "@rivetjs/ui/button-group";
import { Button } from "@rivetjs/ui/button";
```

::example{id=button-group-basic}

## Anatomy

```tsx
import { ButtonGroup } from "@rivetjs/ui/button-group";
import { Button } from "@rivetjs/ui/button";

export default () => (
  <ButtonGroup>
    <Button>First</Button>
    <Button>
      <ButtonGroup.Separator />
      Second
    </Button>
    <Button>
      <ButtonGroup.Separator />
      Third
    </Button>
  </ButtonGroup>
);
```

> **ButtonGroup** wraps multiple Button components together, applying consistent styling, spacing, and automatic border radius handling. It uses React Context to pass `size`, `variant`, and `isDisabled` props to all child buttons.

## Examples

### Variants

::example{id=button-group-variants}

### Sizes

::example{id=button-group-sizes}

### Orientation

Use the `orientation` prop to arrange buttons horizontally or vertically.

::example{id=button-group-orientation}

### With Icons

::example{id=button-group-with-icons}

### Full Width

::example{id=button-group-full-width}

### Disabled State

::example{id=button-group-disabled}

### Without Separator

Simply omit the `<ButtonGroup.Separator />` component from your buttons.

::example{id=button-group-without-separator}

## Customization

### Tailwind CSS

::example{id=button-group-custom-styles}

### Global CSS

To customize the ButtonGroup component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .button-group {
    @apply gap-2 rounded-lg;
  }

  .button-group__separator {
    @apply opacity-25;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ButtonGroup component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/button-group.css)):

#### Base Classes

- `.button-group` - Base button group container
- `.button-group--full-width` - Full width modifier
- `.button-group__separator` - Separator element between buttons

The ButtonGroup component automatically applies border radius to buttons:

- First button gets rounded left/start edge
- Last button gets rounded right/end edge
- Middle buttons have no border radius
- Single button gets full border radius on all edges

Add `<ButtonGroup.Separator />` inside each Button (except the first) to show dividers between buttons.

## API Reference

### ButtonGroup

| Prop          | Type                                                            | Default        | Description                                                                             |
| ------------- | --------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `variant`     | `'primary' \| 'secondary' \| 'tertiary' \| 'ghost' \| 'danger'` | -              | Visual style variant applied to all buttons in the group                                |
| `size`        | `'sm' \| 'md' \| 'lg'`                                          | -              | Size applied to all buttons in the group                                                |
| `orientation` | `'horizontal' \| 'vertical'`                                    | `'horizontal'` | The orientation of the button group                                                     |
| `fullWidth`   | `boolean`                                                       | `false`        | Whether the button group should take full width of its container                        |
| `isDisabled`  | `boolean`                                                       | `false`        | Whether all buttons in the group are disabled (can be overridden on individual buttons) |
| `class`       | `string`                                                        | -              | Additional CSS classes                                                                  |
| `children`    | `Content`                                                       | -              | Button components to group together                                                     |

### ButtonGroup.Separator

| Prop    | Type     | Default | Description            |
| ------- | -------- | ------- | ---------------------- |
| `class` | `string` | -       | Additional CSS classes |

::api{symbol="@rivetjs/ui/button-group#ButtonGroupRootProps"}

## Note

- ButtonGroup uses React Context to pass `size`, `variant`, and `isDisabled` props to all child Button components
- **Only direct child buttons receive the ButtonGroup props** - Buttons nested inside other components (like Modal, Dropdown, etc.) will not inherit the group's props even if they are descendants of the ButtonGroup
- Individual Button components can override the group's `isDisabled` prop by setting `isDisabled={false}`
- The component automatically handles border radius between buttons
- Add `<ButtonGroup.Separator />` inside each Button (except the first) to show dividers between buttons
- Buttons in a group have their active/pressed scale transform removed for a more cohesive appearance

## Related Components

- [Button](/components/button/): Allows a user to perform an action.
- [Dropdown](/components/dropdown/): Context menu with actions and options.
- [Chip](/components/chip/): Compact elements for tags and filters.
