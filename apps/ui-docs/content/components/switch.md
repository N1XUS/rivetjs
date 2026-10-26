---
title: Switch
description: "A toggle switch component for boolean states"
template: reference
status: experimental
related: [components/checkbox, components/toggle-button, components/slider]
---

`Switch` toggles a setting on or off: the [cdk SwitchField + SwitchButton](site:cdk/components/switch/) (a visually hidden native `<input type="checkbox" role="switch">` inside a `<label>`) with the Rivet UI parts, sizes and classes. `SwitchGroup` lays several switches out vertically or horizontally.

Notes:

- `class`, not `className`.
- `isSelected` takes a two-way signal (`isSelected={on}`) or a value; render props are accessors (`({ isSelected }) => isSelected()`).
- Shorthand (Rivet addition): `label` / `description` without children render the Content / Control / Thumb / Description parts.

Accessibility: A native checkbox input with `role="switch"` inside the `Switch.Content` `<label>` (Tab focuses, Space toggles). Without visible text, give the Switch an `aria-label`.

## Usage

```tsx
import { Label } from "@rivetjs/ui/label";
import { Switch } from "@rivetjs/ui/switch";
import { SwitchGroup } from "@rivetjs/ui/switch-group";
```

::example{id=switch-basic}

## Anatomy

```tsx
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Switch } from "@rivetjs/ui/switch";

export default () => (
  <Switch>
    <Switch.Control>
      <Switch.Thumb>
        <Switch.Icon/> {/* Optional */}
      </Switch.Thumb>
    </Switch.Control>
    <Switch.Content>
      <Label />
      <Description /> {/* Optional */}
    </Switch.Content>
  </Switch>
);
```

For grouping multiple switches, use the `SwitchGroup` component:

```tsx
import { Label } from "@rivetjs/ui/label";
import { Switch } from "@rivetjs/ui/switch";
import { SwitchGroup } from "@rivetjs/ui/switch-group";

export default () => (
  <SwitchGroup>
    <Switch>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Label>Option 1</Label>
    </Switch>
    <Switch>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Label>Option 2</Label>
    </Switch>
  </SwitchGroup>
);
```

## Examples

### Shorthand

Rivet addition: without children, `label` and `description` render the Content, Control, Thumb and Description parts for you, with the same markup and accessibility as the compound form. Use the parts for icons in the thumb or a custom label position. Explicit children win: next to children the shorthand props are ignored, with a development warning.

::example{id=switch-shorthand}

### Sizes

::example{id=switch-sizes}

### With Icons

::example{id=switch-with-icons}

### Disabled

::example{id=switch-disabled}

### Without Label

::example{id=switch-without-label}

### With Description

::example{id=switch-with-description}

### Default Selected

::example{id=switch-default-selected}

### Controlled

::example{id=switch-controlled}

### Label Position

::example{id=switch-label-position}

### Group

::example{id=switch-group}

### Group Horizontal

::example{id=switch-group-horizontal}

### Form Integration

::example{id=switch-form}

### Render Props

::example{id=switch-render-props}

### Render Function

::example{id=switch-render-function}

## Customization

### Tailwind CSS

::example{id=switch-custom-styles}

### Global CSS

To customize the Switch component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .switch {
    @apply inline-flex gap-3 items-center;
  }

  .switch__control {
    @apply h-5 w-8 bg-gray-400 data-[selected=true]:bg-blue-500;
  }

  .switch__thumb {
    @apply bg-white shadow-sm;
  }

  .switch__content {
    @apply flex flex-col gap-1;
  }

  .switch__icon {
    @apply h-3 w-3 text-current;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

#### Switch Classes

The Switch component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/switch.css)):

- `.switch` - Base switch container
- `.switch__content` - Optional content container
- `.switch__control` - Switch control track
- `.switch__thumb` - Switch thumb that moves
- `.switch__icon` - Optional icon inside the thumb
- `.switch--sm` - Small size variant
- `.switch--md` - Medium size variant (default)
- `.switch--lg` - Large size variant

#### SwitchGroup Classes

The SwitchGroup component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/switch-group.css)):

- `.switch-group` - Switch group container
- `.switch-group__items` - Container for switch items
- `.switch-group--horizontal` - Horizontal layout
- `.switch-group--vertical` - Vertical layout (default)

### Interactive States

The switch supports both CSS pseudo-classes and data attributes for flexibility:

- **Selected**: `[data-selected="true"]` (thumb position and background color change)
- **Hover**: `:hover` or `[data-hovered="true"]`
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` (shows focus ring)
- **Disabled**: `:disabled` or `[aria-disabled="true"]` (reduced opacity, no pointer events)
- **Pressed**: `:active` or `[data-pressed="true"]`

### Zero-JS native path

Where the build proves a switch call site closed (declared data props only, no handlers, no controlled state, no render props, no live values, no context-reading components inside, no state selectors in the calling module), it renders native markup and ships no JavaScript, before or after an interaction: a visually hidden `<input type="checkbox" role="switch">` inside the `<label>` (`.switch[data-native]`), selected = `.switch[data-native]:has(input:checked)`, focus = `:has(input:focus-visible)`; `data-selected` / `data-hovered` / `data-pressed` / `data-focus-visible` are not set there. Classes, slots and `data-disabled` stay the same; style state with the selectors above that include the native form (`:checked`, `[open]`, `:focus-visible`), not with a state attribute alone. Any other call site keeps the interactive path. See the framework guide "Native automata".

## API Reference

### Switch

Inherits from [React Aria Switch](https://react-spectrum.adobe.com/react-aria/Switch.html).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | The size of the switch |
| `isSelected` | `boolean` | `false` | Whether the switch is on |
| `defaultSelected` | `boolean` | `false` | Whether the switch is on by default (uncontrolled) |
| `isDisabled` | `boolean` | `false` | Whether the switch is disabled |
| `isInvalid` | `boolean` | `false` | Whether the switch is invalid |
| `isReadOnly` | `boolean` | `false` | Whether the switch is read only |
| `isRequired` | `boolean` | `false` | Whether the switch must be selected |
| `validate` | `(value: boolean) => ValidationError \| true \| null \| undefined` | - | Custom validation function |
| `validationBehavior` | `'native' \| 'aria'` | `'native'` | Whether to use native HTML form validation or ARIA |
| `name` | `string` | - | The name of the input element, used when submitting an HTML form |
| `value` | `string` | - | The value of the input element, used when submitting an HTML form |
| `onChange` | `(isSelected: boolean) => void` | - | Handler called when the switch value changes |
| `onPress` | `(e: PressEvent) => void` | - | Handler called when the switch is pressed |
| `children` | `Content \| (values: SwitchRenderProps) => Content` | - | Switch content or render prop |
| `label` | `Content` | - | Shorthand (no children): the label next to the control. |
| `description` | `Content` | - | Shorthand (no children): a Description under the label. |
| `render` | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, SwitchRenderProps>` | - | Overrides the default DOM element with a custom render function.|

### Render Props

When using the render prop pattern, these values are provided:

| Prop | Type | Description |
|------|------|-------------|
| `isSelected` | `boolean` | Whether the switch is currently on |
| `isHovered` | `boolean` | Whether the switch is hovered |
| `isPressed` | `boolean` | Whether the switch is currently pressed |
| `isFocused` | `boolean` | Whether the switch is focused |
| `isFocusVisible` | `boolean` | Whether the switch is keyboard focused |
| `isDisabled` | `boolean` | Whether the switch is disabled |
| `isReadOnly` | `boolean` | Whether the switch is read only |
| `isInvalid` | `boolean` | Whether the switch is invalid |
| `isRequired` | `boolean` | Whether the switch is required |
| `state` | `-` | State of the switch. |

### SwitchGroup

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `'horizontal' \| 'vertical'` | `'vertical'` | The orientation of the switch group |
| `children` | `Content` | - | The switch items to render |
| `class` | `string` | - | Additional CSS class names |

::api{symbol="@rivetjs/ui/switch#SwitchRootProps"}
::api{symbol="@rivetjs/ui/switch-group#SwitchGroupRootProps"}

## Related Components

- [Label](/components/label/): Accessible label for form controls.
- [Description](/components/description/): Helper text for form fields.
- [Button](/components/button/): Allows a user to perform an action.
