---
title: TextField
description: "Composition-friendly text fields with labels, descriptions, and inline validation"
template: reference
status: experimental
related: [components/input, components/text-area, components/label, components/field-error]
---

`TextField` composes a label, an [Input](/components/input/) or [TextArea](/components/text-area/), a description and an error message into one accessible field: the [cdk TextField](site:cdk/components/text-field/) with the Rivet UI classes; its `variant` reaches the Input / TextArea through `TextFieldContext`.

Notes:

- `class`, not `className`.
- `value` takes a two-way signal (`value={name}`) or a value; render props are accessors (`({ isInvalid }) => isInvalid()`).
- `isInvalid` may be an accessor (`isInvalid={() => name().length < 3}`) and stays live.
- Shorthand (Rivet addition): `label`, `description`, `errorMessage` and `placeholder` without children render the same Label / Input / Description / FieldError parts.

Accessibility: The field links the label (`aria-labelledby`), the description and the error (`aria-describedby`) to the input; `isRequired` / `isInvalid` map to native `required` / `aria-invalid`.

## Usage

```tsx
import { TextField } from "@rivetjs/ui/textfield";
```

::example{id=textfield-basic}

## Anatomy

```tsx
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export default () => (
  <TextField>
    <Label />
    <Input />
    <Description />
    <FieldError />
  </TextField>
);
```

> **TextField** combines label, input, description, and error into a single accessible component.
> For standalone inputs, use **[Input](/components/input/)** or **[TextArea](/components/text-area/)**.

## Examples

### Shorthand

Rivet addition: without children, `label`, `description`, `errorMessage` and `placeholder` render the Label, Input, Description and FieldError parts for you, with the same markup and accessibility as the compound form. Use the parts when you need a TextArea, an InputGroup or custom content. Explicit children win: next to children the shorthand props are ignored, with a development warning.

::example{id=textfield-shorthand}

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` on Input or TextArea components to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=textfield-on-surface}

### With Description

::example{id=textfield-with-description}

### Required Field

::example{id=textfield-required}

### Disabled State

::example{id=textfield-disabled}

### Full Width

::example{id=textfield-full-width}

### Validation

Use `isInvalid` together with `FieldError` to surface validation messages.

::example{id=textfield-validation}

### Controlled

Control the value to synchronize counters, previews, or formatting.

::example{id=textfield-controlled}

### Error Message

::example{id=textfield-with-error}

### TextArea

Use [TextArea](/components/text-area/) instead of [Input](/components/input/) for multiline content.

::example{id=textfield-textarea}

### Input Types

::example{id=textfield-input-types}

### Render Function

::example{id=textfield-render-function}

## Customization

### Tailwind CSS

::example{id=text-field-custom-styles}

### Global CSS

TextField has minimal default styling. Override the `.textfield` class to customize the container styling.

```css
@layer components {
  .textfield {
    @apply flex flex-col gap-1;
  }

  /* When invalid, the description is hidden automatically */
  .textfield[data-invalid="true"] [data-slot="description"],
  .textfield[aria-invalid="true"] [data-slot="description"] {
    @apply hidden;
  }

  /* Description has default padding */
  .textfield [data-slot="description"] {
    @apply px-1;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

- `.textfield` – Root container with minimal styling (`flex flex-col gap-1`)

> **Note:** Child components ([Label](/components/label/), [Input](/components/input/), [TextArea](/components/text-area/), [Description](/components/description/), [FieldError](/components/field-error/)) have their own CSS classes and styling. See their respective documentation for customization options.

### Interactive States

TextField automatically manages these data attributes based on its state:

- **Invalid**: `[data-invalid="true"]` or `[aria-invalid="true"]` - Automatically hides the description slot when invalid
- **Disabled**: `[data-disabled="true"]` - Applied when `isDisabled` is true
- **Focus Within**: `[data-focus-within="true"]` - Applied when any child input is focused
- **Focus Visible**: `[data-focus-visible="true"]` - Applied when focus is visible (keyboard navigation)

Additional attributes are available through render props (see TextFieldRenderProps below).

## API Reference

### TextField

TextField inherits all props from React Aria's [TextField](https://react-spectrum.adobe.com/react-aria/TextField.html) component.

#### Base Props

| Prop           | Type                                                                         | Default | Description                                                           |
| -------------- | ---------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| `children`     | `Content \| (values: TextFieldRenderProps) => Content`                       | -       | Child components (Label, Input, etc.) or render function.             |
| `class`        | `string \| (values: TextFieldRenderProps) => string`                         | -       | CSS classes for styling, supports render props.                       |
| `style`        | `StyleObject \| (values: TextFieldRenderProps) => StyleObject`               | -       | Inline styles, supports render props.                                 |
| `fullWidth`    | `boolean`                                                                    | `false` | Whether the text field should take full width of its container        |
| `label`        | `Content`                                                                    | -       | Shorthand (no children): the Label content.                           |
| `description`  | `Content`                                                                    | -       | Shorthand (no children): a Description under the input.               |
| `errorMessage` | `Content \| (values: FieldErrorRenderProps) => Content`                      | -       | Shorthand (no children): the FieldError content, shown while invalid. |
| `placeholder`  | `string`                                                                     | -       | Shorthand (no children): the Input's placeholder.                     |
| `id`           | `string`                                                                     | -       | The element's unique identifier.                                      |
| `render`       | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, TextFieldRenderProps>` | -       | Overrides the default DOM element with a custom render function.      |

#### Validation Props

| Prop                 | Type                                                              | Default    | Description                                                    |
| -------------------- | ----------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| `isRequired`         | `boolean`                                                         | `false`    | Whether user input is required before form submission.         |
| `isInvalid`          | `boolean`                                                         | -          | Whether the value is invalid.                                  |
| `validate`           | `(value: string) => ValidationError \| true \| null \| undefined` | -          | Custom validation function.                                    |
| `validationBehavior` | `'native' \| 'aria'`                                              | `'native'` | Whether to use native HTML form validation or ARIA attributes. |
| `validationErrors`   | `string[]`                                                        | -          | Server-side validation errors.                                 |

#### Value Props

| Prop           | Type                      | Default | Description                            |
| -------------- | ------------------------- | ------- | -------------------------------------- |
| `value`        | `string`                  | -       | Current value (controlled).            |
| `defaultValue` | `string`                  | -       | Default value (uncontrolled).          |
| `onChange`     | `(value: string) => void` | -       | Handler called when the value changes. |

#### State Props

| Prop         | Type      | Default | Description                                        |
| ------------ | --------- | ------- | -------------------------------------------------- |
| `isDisabled` | `boolean` | -       | Whether the input is disabled.                     |
| `isReadOnly` | `boolean` | -       | Whether the input can be selected but not changed. |

#### Form Props

| Prop        | Type      | Default | Description                                          |
| ----------- | --------- | ------- | ---------------------------------------------------- |
| `name`      | `string`  | -       | Name of the input element, for HTML form submission. |
| `autoFocus` | `boolean` | -       | Whether the element should receive focus on render.  |

#### Accessibility Props

| Prop               | Type     | Default | Description                                           |
| ------------------ | -------- | ------- | ----------------------------------------------------- |
| `aria-label`       | `string` | -       | Accessibility label when no visible label is present. |
| `aria-labelledby`  | `string` | -       | ID of elements that label this field.                 |
| `aria-describedby` | `string` | -       | ID of elements that describe this field.              |
| `aria-details`     | `string` | -       | ID of elements with additional details.               |

### Composition Components

TextField works with these separate components that should be imported and used directly:

- **Label** - Field label component from `@rivetjs/ui`
- **Input** - Single-line text input from `@rivetjs/ui`
- **TextArea** - Multi-line text input from `@rivetjs/ui`
- **Description** - Helper text component from `@rivetjs/ui`
- **FieldError** - Validation error message from `@rivetjs/ui`

Each of these components has its own props API. Use them directly within TextField for composition:

```tsx
<TextField isRequired isInvalid={hasError}>
  <Label>Email Address</Label>
  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
  <Description>We'll never share your email.</Description>
  <FieldError>Please enter a valid email address.</FieldError>
</TextField>
```

### Render Props

When using render props with `class`, `style`, or `children`, these values are available:

| Prop             | Type      | Description                                                                |
| ---------------- | --------- | -------------------------------------------------------------------------- |
| `isDisabled`     | `boolean` | Whether the field is disabled.                                             |
| `isInvalid`      | `boolean` | Whether the field is currently invalid.                                    |
| `isReadOnly`     | `boolean` | Whether the field is read-only.                                            |
| `isRequired`     | `boolean` | Whether the field is required.                                             |
| `isFocused`      | `boolean` | Whether the field is currently focused (DEPRECATED - use `isFocusWithin`). |
| `isFocusWithin`  | `boolean` | Whether any child element is focused.                                      |
| `isFocusVisible` | `boolean` | Whether focus is visible (keyboard navigation).                            |

::api{symbol="@rivetjs/ui/textfield#TextFieldRootProps"}

## Related Components

- [Input](/components/input/): Single-line text input built on React Aria.
- [TextArea](/components/text-area/): Multiline text input with focus management.
- [Fieldset](/components/fieldset/): Group related form controls with legends.
