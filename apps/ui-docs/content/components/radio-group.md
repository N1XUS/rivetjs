---
title: RadioGroup
description: "Radio group for selecting a single option from a list"
template: reference
status: experimental
related: [components/checkbox-group, components/toggle-button-group, components/fieldset]
---

`RadioGroup` + `Radio` pick one option from a set: the [cdk RadioGroup](site:cdk/components/radio-group/) compound form (`RadioField` + `RadioButton`: native radio inputs, arrow-key roving focus, form validation) with the Rivet UI parts and classes.

Notes:

- `class`, not `className`.
- `value` takes a two-way signal (`value={plan}`) or a value; render props are accessors (`({ isSelected }) => isSelected()`).
- `Radio.Indicator` takes `span` props only.
- Shorthand (Rivet addition): `label` / `description` / `errorMessage` / `items` render the Label, Description, FieldError and one Radio per item.

Accessibility: `role="radiogroup"` labelled by its `Label`; one tab stop, arrow keys move and select (React Aria). Each `Radio.Content` is the radio's `<label>`.

## Usage

```tsx
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";
```

::example{id=radio-group-basic}

## Anatomy

```tsx
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

export default () => (
  <RadioGroup>
    <Label />
    <Description />
    <Radio value="option1">
      <Radio.Content> {/* The clickable area: control + label */}
        <Radio.Control>
          <Radio.Indicator>
            <span>✓</span> {/* Custom indicator (optional) */}
          </Radio.Indicator>
        </Radio.Control>
        Label {/* plain text — the clickable label */}
      </Radio.Content>
      <Description /> {/* Sibling — stays outside the button (announced via aria-describedby) */}
      <FieldError /> {/* Optional — per-radio validation message */}
    </Radio>
    <FieldError /> {/* Optional — group-level validation */}
  </RadioGroup>
)
```

## Examples

### Shorthand

Rivet addition: `label`, `description` and `errorMessage` render the group's Label, Description and FieldError; `items` (`{ value, label, description?, isDisabled? }[]`, live: a keyed list by `value`, so each `value` must be unique) renders one Radio per option. Same markup and accessibility as the compound form. Explicit children win: next to children the shorthand props are ignored, with a development warning.

::example{id=radio-group-shorthand}

### Horizontal Orientation

::example{id=radio-group-horizontal}

### Variants

The RadioGroup component supports two visual variants:

- **`primary`** (default) - Standard styling with default background, suitable for most use cases
- **`secondary`** - Lower emphasis variant, suitable for use in Surface components

::example{id=radio-group-variants}

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=radio-group-on-surface}

### Disabled

::example{id=radio-group-disabled}

### Controlled

::example{id=radio-group-controlled}

### Uncontrolled

Combine `defaultValue` with `onChange` when you only need to react to updates.

::example{id=radio-group-uncontrolled}

### Validation

::example{id=radio-group-validation}

### Delivery & Payment

::example{id=radio-group-delivery-and-payment}

### Custom Indicator

::example{id=radio-group-custom-indicator}

### Render Function

::example{id=radio-group-render-function}

## Customization

### Tailwind CSS

::example{id=radio-group-custom-styles}

### Global CSS

To customize the RadioGroup component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .radio-group {
    @apply gap-2;
  }

  .radio {
    @apply gap-4 rounded-lg border border-border p-3 hover:bg-surface-hovered;
  }

  .radio__control {
    @apply border-2 border-accent;
  }

  .radio__indicator {
    @apply bg-primary;
  }

  .radio__content {
    @apply gap-1;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The RadioGroup component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/radio-group.css)):

#### Base Classes

- `.radio-group` - Base radio group container
- `.radio` - Individual radio item
- `.radio__content` - Radio button (RAC label wrapper for control + label text)
- `.radio__control` - Radio control (circular button)
- `.radio__indicator` - Radio indicator (inner dot)

#### Modifier Classes

Disabled state is applied via `[data-disabled="true"]` / `[aria-disabled="true"]` (and `:disabled`) on `.radio` — there is no `.radio--disabled` modifier class.

### Interactive States

The radio supports both CSS pseudo-classes and data attributes for flexibility:

- **Selected**: `[aria-checked="true"]` or `[data-selected="true"]` (indicator appears)
- **Hover**: `:hover` or `[data-hovered="true"]` (border color changes)
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` (shows focus ring)
- **Pressed**: `:active` or `[data-pressed="true"]` (scale transform)
- **Disabled**: `:disabled` or `[aria-disabled="true"]` (reduced opacity, no pointer events)
- **Invalid**: `[data-invalid="true"]` or `[aria-invalid="true"]` (error border color)

## API Reference

### RadioGroup

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | The current value (controlled) |
| `defaultValue` | `string` | - | The default value (uncontrolled) |
| `onChange` | `(value: string) => void` | - | Handler called when the value changes |
| `isDisabled` | `boolean` | `false` | Whether the radio group is disabled |
| `isRequired` | `boolean` | `false` | Whether the radio group is required |
| `isReadOnly` | `boolean` | `false` | Whether the radio group is read only |
| `isInvalid` | `boolean` | `false` | Whether the radio group is in an invalid state |
| `variant` | `"primary" \| "secondary"` | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `name` | `string` | - | The name of the radio group, used when submitting an HTML form |
| `orientation` | `'horizontal' \| 'vertical'` | `'vertical'` | The orientation of the radio group |
| `children` | `Content \| (values: RadioGroupRenderProps) => Content` | - | Radio group content or render prop |
| `label` | `Content` | - | Shorthand: the group Label (before the children). |
| `description` | `Content` | - | Shorthand: the group Description (after the Label). |
| `errorMessage` | `Content \| (values: FieldErrorRenderProps) => Content` | - | Shorthand: a FieldError after the options, shown while invalid. |
| `items` | `{ value: string; label: Content; description?: Content; isDisabled?: boolean }[]` | - | Shorthand: one Radio per item instead of children. Read once at mount. |
| `render` | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, RadioGroupRenderProps>` | - | Overrides the default DOM element with a custom render function.|

### Radio

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | The value of the radio button |
| `isDisabled` | `boolean` | `false` | Whether the radio button is disabled |
| `name` | `string` | - | The name of the radio button, used when submitting an HTML form |
| `children` | `Content \| (values: RadioFieldRenderProps) => Content` | - | Radio content or field render prop |
| `label` | `Content` | - | Shorthand (no children): the label next to the control. |
| `description` | `Content` | - | Shorthand (no children): a Description under the label. |
| `render` | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, RadioFieldRenderProps>` | - | Overrides the default DOM element with a custom render function.|

### Radio.Control

Extends `React.HTMLAttributes<HTMLSpanElement>`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Content` | - | The content to render inside the control wrapper (typically Radio.Indicator) |

### Radio.Indicator

Extends `React.HTMLAttributes<HTMLSpanElement>`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Content \| (values: RadioButtonRenderProps) => Content` | - | Optional content or render prop that receives the current radio button state. |

### Radio.Content

The clickable area of the radio (the `<label>` wrapping the hidden input). Place `Radio.Control` and the `Label` inside it. `class` accepts a render function that receives `RadioButtonRenderProps`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Content \| (values: RadioButtonRenderProps) => Content` | - | The clickable content (typically Radio.Control and Label) |

### RadioFieldRenderProps

When using a render prop on the root `Radio`, these field-level values are provided:

| Prop | Type | Description |
|------|------|-------------|
| `isSelected` | `boolean` | Whether the radio is currently selected |
| `isDisabled` | `boolean` | Whether the radio is disabled |
| `isReadOnly` | `boolean` | Whether the radio is read only |
| `isInvalid` | `boolean` | Whether the radio is in an invalid state |
| `isRequired` | `boolean` | Whether the radio is required |

### RadioButtonRenderProps

`Radio.Control` and `Radio.Indicator` use button-level render props (`isHovered`, `isPressed`, `isFocusVisible`, etc.). Pass a function as `Radio.Control` children or to `Radio.Indicator` to access them.

::api{symbol="@rivetjs/ui/radio-group#RadioGroupRootProps"}
::api{symbol="@rivetjs/ui/radio#RadioRootProps"}

## Related Components

- [Fieldset](/components/fieldset/): Group related form controls with legends.
- [Surface](/components/surface/): Base container surface.
- [Description](/components/description/): Helper text for form fields.
