---
title: NumberField
description: "Number input fields with increment/decrement buttons, validation, and internationalized formatting"
template: reference
status: experimental
related: [components/text-field, components/input-group, components/input]
---

`NumberField` is a locale-formatted number input with increment / decrement buttons: the [cdk NumberField](site:cdk/components/number-field/) (arrow keys, wheel, step snapping, min / max, `formatOptions`) with the Rivet UI parts and classes.

Notes:

- `class`, not `className`.
- `value` takes a two-way signal (`value={amount}`) or a value; `onChange` receives the number.
- Stepper defaults = lucide `Plus` / `Minus`; any children replace them (also text or a function result, not only an element).
- Shorthand (Rivet addition): `label` / `description` / `errorMessage` / `placeholder` without children render the Label, Group, Description and FieldError parts.

Accessibility: The input has `aria-roledescription="Number field"`; the steppers are labelled "Increase" / "Decrease" + the field label and excluded from the tab order (arrow keys step from the input).

## Usage

```tsx
import { NumberField } from "@rivetjs/ui/number-field";
```

::example{id=number-field-basic}

## Anatomy

```tsx
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";

export default () => (
  <NumberField>
    <Label />
    <NumberField.Group>
      <NumberField.DecrementButton />
      <NumberField.Input />
      <NumberField.IncrementButton />
    </NumberField.Group>
    <Description />
    <FieldError />
  </NumberField>
)
```

> **NumberField** allows users to enter numeric values with optional increment/decrement buttons. It supports internationalized formatting, validation, and keyboard navigation.

## Examples

### Shorthand

Rivet addition: without children, `label`, `description`, `errorMessage` and `placeholder` render the Label, Group (decrement button, input, increment button), Description and FieldError parts for you, with the same markup and accessibility as the compound form. Use the parts for chevron steppers or custom buttons. Explicit children win: next to children the shorthand props are ignored, with a development warning.

::example{id=number-field-shorthand}

### Variants

The NumberField component supports two visual variants:

- **`primary`** (default) - Standard styling with shadow, suitable for most use cases
- **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

::example{id=number-field-variants}

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=number-field-on-surface}

### With Description

::example{id=number-field-with-description}

### Required Field

::example{id=number-field-required}

### Disabled State

::example{id=number-field-disabled}

### Full Width

::example{id=number-field-full-width}

### Validation

Use `isInvalid` together with `FieldError` to surface validation messages.

::example{id=number-field-validation}

### Controlled

Control the value to synchronize with other components or perform custom formatting.

::example{id=number-field-controlled}

### Step Values

Configure increment/decrement step values for precise control.

::example{id=number-field-with-step}

### Format Options

Format numbers as currency, percentages, decimals, or units with internationalization support.

::example{id=number-field-with-format-options}

### Form Example

Complete form integration with validation and submission handling.

::example{id=number-field-form-example}

### With Validation

Implement custom validation logic with controlled values.

::example{id=number-field-with-validation}

### Custom Icons

Customize the increment and decrement button icons.

::example{id=number-field-custom-icons}

### With Chevrons

Use chevron icons in a vertical layout for a different visual style.

::example{id=number-field-with-chevrons}

### Render Function

::example{id=number-field-render-function}

## Customization

### Tailwind CSS

::example{id=number-field-custom-styles}

### Global CSS

NumberField uses CSS classes that can be customized. Override the component classes to match your design system.

```css
@layer components {
  .number-field {
    @apply flex flex-col gap-1;
  }

  /* When invalid, the description is hidden automatically */
  .number-field[data-invalid="true"] [data-slot="description"],
  .number-field[aria-invalid="true"] [data-slot="description"] {
    @apply hidden;
  }

  .number-field__group {
    @apply bg-field text-field-foreground shadow-field rounded-field inline-flex h-9 items-center overflow-hidden border;
  }

  .number-field__input {
    @apply flex-1 rounded-none border-0 bg-transparent px-3 py-2 tabular-nums;
  }

  .number-field__increment-button,
  .number-field__decrement-button {
    @apply flex h-full w-10 items-center justify-center rounded-none bg-transparent;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

#### Base Classes

- `.number-field` – Root container with minimal styling (`flex flex-col gap-1`)
- `.number-field__group` – Container for input and buttons with border and background styling
- `.number-field__input` – The numeric input field
- `.number-field__increment-button` – Button to increment the value
- `.number-field__decrement-button` – Button to decrement the value

#### Variant Classes

- `.number-field--primary` – Primary variant with shadow (default)
- `.number-field--secondary` – Secondary variant without shadow, suitable for use in surfaces

> **Note:** Child components ([Label](/components/label/), [Description](/components/description/), [FieldError](/components/field-error/)) have their own CSS classes and styling. See their respective documentation for customization options.

### Interactive States

NumberField automatically manages these data attributes based on its state:

- **Invalid**: `[data-invalid="true"]` or `[aria-invalid="true"]` - Automatically hides the description slot when invalid
- **Disabled**: `[data-disabled="true"]` - Applied when `isDisabled` is true
- **Focus Within**: `[data-focus-within="true"]` - Applied when the input or buttons are focused
- **Focus Visible**: `[data-focus-visible="true"]` - Applied when focus is visible (keyboard navigation)
- **Hovered**: `[data-hovered="true"]` - Applied when hovering over buttons

Additional attributes are available through render props (see NumberFieldRenderProps below).

## API Reference

### NumberField

NumberField inherits all props from React Aria's [NumberField](https://react-spectrum.adobe.com/react-aria/NumberField.html) component.

#### Base Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Content \| (values: NumberFieldRenderProps) => Content` | - | Child components (Label, Group, Input, etc.) or render function. |
| `label` | `Content` | - | Shorthand (no children): the Label content. |
| `description` | `Content` | - | Shorthand (no children): a Description under the group. |
| `errorMessage` | `Content \| (values: FieldErrorRenderProps) => Content` | - | Shorthand (no children): the FieldError content, shown while invalid. |
| `placeholder` | `string` | - | Shorthand (no children): the input's placeholder. |
| `class` | `string \| (values: NumberFieldRenderProps) => string` | - | CSS classes for styling, supports render props. |
| `style` | `StyleObject \| (values: NumberFieldRenderProps) => StyleObject` | - | Inline styles, supports render props. |
| `fullWidth` | `boolean` | `false` | Whether the number field should take full width of its container |
| `id` | `string` | - | The element's unique identifier. |
| `variant` | `"primary" \| "secondary"` | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `render` | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, NumberFieldRenderProps>` | - | Overrides the default DOM element with a custom render function.|

#### Value Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | - | Current value (controlled). |
| `defaultValue` | `number` | - | Default value (uncontrolled). |
| `onChange` | `(value: number \| undefined) => void` | - | Handler called when the value changes. |

#### Formatting Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `formatOptions` | `Intl.NumberFormatOptions` | - | Options for formatting numbers (currency, percent, decimal, unit). |
| `locale` | `string` | - | Locale for number formatting. |

#### Validation Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isRequired` | `boolean` | `false` | Whether user input is required before form submission. |
| `isInvalid` | `boolean` | - | Whether the value is invalid. |
| `validate` | `(value: number) => ValidationError \| true \| null \| undefined` | - | Custom validation function. |
| `validationBehavior` | `'native' \| 'aria'` | `'native'` | Whether to use native HTML form validation or ARIA attributes. |
| `validationErrors` | `string[]` | - | Server-side validation errors. |

#### Range Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `minValue` | `number` | - | Minimum allowed value. |
| `maxValue` | `number` | - | Maximum allowed value. |
| `step` | `number` | `1` | Step value for increment/decrement operations. |

#### State Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isDisabled` | `boolean` | - | Whether the input is disabled. |
| `isReadOnly` | `boolean` | - | Whether the input can be selected but not changed. |

#### Form Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | - | Name of the input element, for HTML form submission. |
| `autoFocus` | `boolean` | - | Whether the element should receive focus on render. |

#### Accessibility Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `aria-label` | `string` | - | Accessibility label when no visible label is present. |
| `aria-labelledby` | `string` | - | ID of elements that label this field. |
| `aria-describedby` | `string` | - | ID of elements that describe this field. |
| `aria-details` | `string` | - | ID of elements with additional details. |

### Composition Components

NumberField works with these separate components that should be imported and used directly:

- **NumberField.Group** - Container for input and buttons
- **NumberField.Input** - The numeric input field
- **NumberField.IncrementButton** - Button to increment the value
- **NumberField.DecrementButton** - Button to decrement the value
- **Label** - Field label component from `@rivetjs/ui`
- **Description** - Helper text component from `@rivetjs/ui`
- **FieldError** - Validation error message from `@rivetjs/ui`

Each of these components has its own props API. Use them directly within NumberField for composition:

```tsx
<NumberField isRequired isInvalid={hasError} minValue={0} maxValue={100}>
  <Label>Quantity</Label>
  <NumberField.Group>
    <NumberField.DecrementButton />
    <NumberField.Input />
    <NumberField.IncrementButton />
  </NumberField.Group>
  <Description>Enter a value between 0 and 100</Description>
  <FieldError>Value must be between 0 and 100</FieldError>
</NumberField>
```

#### NumberField.Group Props

NumberField.Group inherits props from React Aria's [Group](https://react-spectrum.adobe.com/react-aria/Group.html) component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Content \| (values: GroupRenderProps) => Content` | - | Child components (Input, Buttons) or render function. |
| `class` | `string \| (values: GroupRenderProps) => string` | - | CSS classes for styling. |

#### NumberField.Input Props

NumberField.Input inherits props from React Aria's [Input](https://react-spectrum.adobe.com/react-aria/Input.html) component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | CSS classes for styling. |
| `variant` | `"primary" \| "secondary"` | `"primary"` | Visual variant of the input. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |

#### NumberField.IncrementButton Props

NumberField.IncrementButton inherits props from React Aria's [Button](https://react-spectrum.adobe.com/react-aria/Button.html) component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Content` | `<IconPlus />` | Icon or content for the button. Defaults to plus icon. |
| `class` | `string` | - | CSS classes for styling. |
| `slot` | `"increment"` | `"increment"` | Must be set to "increment" (automatically set). |

#### NumberField.DecrementButton Props

NumberField.DecrementButton inherits props from React Aria's [Button](https://react-spectrum.adobe.com/react-aria/Button.html) component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Content` | `<IconMinus />` | Icon or content for the button. Defaults to minus icon. |
| `class` | `string` | - | CSS classes for styling. |
| `slot` | `"decrement"` | `"decrement"` | Must be set to "decrement" (automatically set). |

### Render Props

When using render props with `class`, `style`, or `children`, these values are available:

| Prop | Type | Description |
|------|------|-------------|
| `isDisabled` | `boolean` | Whether the field is disabled. |
| `isInvalid` | `boolean` | Whether the field is currently invalid. |
| `isReadOnly` | `boolean` | Whether the field is read-only. |
| `isRequired` | `boolean` | Whether the field is required. |
| `isFocused` | `boolean` | Whether the field is currently focused (DEPRECATED - use `isFocusWithin`). |
| `isFocusWithin` | `boolean` | Whether any child element is focused. |
| `isFocusVisible` | `boolean` | Whether focus is visible (keyboard navigation). |
| `value` | `number \| undefined` | Current value. |
| `minValue` | `number \| undefined` | Minimum allowed value. |
| `maxValue` | `number \| undefined` | Maximum allowed value. |
| `step` | `number` | Step value for increment/decrement. |

::api{symbol="@rivetjs/ui/number-field#NumberFieldRootProps"}

## Related Components

- [Label](/components/label/): Accessible label for form controls.
- [Description](/components/description/): Helper text for form fields.
- [FieldError](/components/field-error/): Inline validation messages for form fields.
