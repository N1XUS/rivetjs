---
title: CheckboxGroup
description: "A checkbox group component for managing multiple checkbox selections"
template: reference
status: experimental
related: [components/checkbox, components/fieldset, components/radio-group]
---

`CheckboxGroup` collects several [Checkboxes](/components/checkbox/) under one label, value array, name and validation: the [cdk CheckboxGroup](site:cdk/components/checkbox-group/) with the Rivet UI class; its `variant` reaches every Checkbox inside.

Notes:

- `class`, not `className`.
- `value` takes a two-way signal of the value array (`value={selected}`) or an array; `onChange` receives the array.
- Shorthand (Rivet addition): `label` / `description` / `errorMessage` / `items` render the Label, Description, FieldError and one Checkbox per item.

Accessibility: `role="group"` labelled by its `Label`, described by `Description` / `FieldError`; each Checkbox keeps its own label.

## Usage

```tsx
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
```

::example{id=checkbox-group-basic}

## Anatomy

```tsx
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";

export default () => (
  <CheckboxGroup name="interests">
    <Label />
    <Description /> {/* Optional */}
    <Checkbox value="option1">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        Label {/* plain text — the clickable label */}
      </Checkbox.Content>
      <Description /> {/* Optional per-checkbox help text */}
    </Checkbox>
    <FieldError /> {/* Optional */}
  </CheckboxGroup>
);
```

## Examples

### Shorthand

Rivet addition: `label`, `description` and `errorMessage` render the group's Label, Description and FieldError; `items` (`{ value, label, description?, isDisabled? }[]`, live: a keyed list by `value`, so each `value` must be unique) renders one Checkbox per option. Same markup and accessibility as the compound form. Explicit children win: next to children the shorthand props are ignored, with a development warning.

::example{id=checkbox-group-shorthand}

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=checkbox-group-on-surface}

### Disabled

::example{id=checkbox-group-disabled}

### Indeterminate

::example{id=checkbox-group-indeterminate}

### Controlled

::example{id=checkbox-group-controlled}

### Validation

::example{id=checkbox-group-validation}

### Features and Add-ons Example

::example{id=checkbox-group-features-and-addons}

### With Custom Indicator

::example{id=checkbox-group-with-custom-indicator}

### Render Function

::example{id=checkbox-group-render-function}

## Customization

### Tailwind CSS

::example{id=checkbox-group-custom-styles}

### Global CSS

To customize the CheckboxGroup component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .checkbox-group {
    @apply flex flex-col gap-2;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The CheckboxGroup component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/checkbox-group.css)):

#### Base Classes

- `.checkbox-group` - Base checkbox group container

## API Reference

### CheckboxGroup

Inherits from [React Aria CheckboxGroup](https://react-spectrum.adobe.com/react-aria/CheckboxGroup.html).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string[]` | - | The current selected values (controlled) |
| `defaultValue` | `string[]` | - | The default selected values (uncontrolled) |
| `onChange` | `(value: string[]) => void` | - | Handler called when the selected values change |
| `isDisabled` | `boolean` | `false` | Whether the checkbox group is disabled |
| `isRequired` | `boolean` | `false` | Whether the checkbox group is required |
| `isReadOnly` | `boolean` | `false` | Whether the checkbox group is read only |
| `isInvalid` | `boolean` | `false` | Whether the checkbox group is in an invalid state |
| `name` | `string` | - | The name of the checkbox group, used when submitting an HTML form |
| `children` | `Content \| (values: CheckboxGroupRenderProps) => Content` | - | Checkbox group content or render prop |
| `label` | `Content` | - | Shorthand: the group Label (before the children). |
| `description` | `Content` | - | Shorthand: the group Description (after the Label). |
| `errorMessage` | `Content \| (values: FieldErrorRenderProps) => Content` | - | Shorthand: a FieldError after the options, shown while invalid. |
| `items` | `{ value: string; label: Content; description?: Content; isDisabled?: boolean }[]` | - | Shorthand: one Checkbox per item instead of children. Read once at mount. |
| `render` | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, CheckboxGroupRenderProps>` | - | Overrides the default DOM element with a custom render function.|

### Render Props

When using the render prop pattern, these values are provided:

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string[]` | The currently selected values |
| `isDisabled` | `boolean` | Whether the checkbox group is disabled |
| `isReadOnly` | `boolean` | Whether the checkbox group is read only |
| `isInvalid` | `boolean` | Whether the checkbox group is in an invalid state |
| `isRequired` | `boolean` | Whether the checkbox group is required |

::api{symbol="@rivetjs/ui/checkbox-group#CheckboxGroupProps"}

## Related Components

- [Checkbox](/components/checkbox/): Binary choice input control.
- [Label](/components/label/): Accessible label for form controls.
- [Fieldset](/components/fieldset/): Group related form controls with legends.
