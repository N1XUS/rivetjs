---
title: FieldError
description: "Displays validation error messages for form fields."
template: reference
status: experimental
related: []
---

`FieldError` shows a field's errors. It is the cdk form [FieldError](site:cdk/components/form/): it renders only while the field is invalid, and without children it lists the field's validation errors.

Notes:

- `class`, not `className`.
- Render props are accessors, not snapshots.
- A live `class` is read once (cdk gap).

## Usage

```tsx
import { FieldError } from "@rivetjs/ui/field-error";
```

::example{id=field-error-basic}

The FieldError component displays validation error messages for form fields. It automatically appears when the parent field is marked as invalid and provides smooth opacity transitions.

## Anatomy

`FieldError` exposes `FieldError.Root`.

Use the composition in the live example above; the API reference below describes the props.

## Examples

### Basic Validation

```tsx
export function Basic() {
  const [value, setValue] = useState("");
  const isInvalid = value.length > 0 && value.length < 3;

  return (
    <TextField class="w-64" isInvalid={isInvalid}>
      <Label for="username">Username</Label>
      <Input id="username" placeholder="Enter username" value={value} onChange={(e) => setValue(e.target.value)} />
      <FieldError>Username must be at least 3 characters</FieldError>
    </TextField>
  );
}
```

### With Dynamic Messages

```tsx
<TextField isInvalid={errors.length > 0}>
  <Label>Password</Label>
  <Input type="password" />
  <FieldError>{(validation) => validation.validationErrors.join(", ")}</FieldError>
</TextField>
```

### Custom Validation Logic

```tsx
function EmailField() {
  const [email, setEmail] = useState("");
  const isInvalid = email.length > 0 && !email.includes("@");

  return (
    <TextField isInvalid={isInvalid}>
      <Label>Email</Label>
      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <FieldError>Email must include @ symbol</FieldError>
    </TextField>
  );
}
```

### Multiple Error Messages

```tsx
<TextField isInvalid={hasErrors}>
  <Label>Username</Label>
  <Input />
  <FieldError>
    {errors.map((error, i) => (
      <div key={i}>{error}</div>
    ))}
  </FieldError>
</TextField>
```

## Customization

### Tailwind CSS

::example{id=field-error-custom-styles}

### Global CSS

To customize the FieldError component classes, you can use the `@layer components` directive. [Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .field-error {
    @apply font-medium text-danger;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The FieldError component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/field-error.css)):

#### Base Classes

- `.field-error` - Base error styles with danger color
- Only shows when the `data-visible` attribute is present
- Text is truncated with ellipsis for long messages

## API Reference

See the [full module API](/api/rivetjs/ui/field-error/) for every named export and part prop type.

### FieldError

| Prop       | Type                                                     | Default | Description                              |
| ---------- | -------------------------------------------------------- | ------- | ---------------------------------------- |
| `class`    | `string`                                                 | -       | Additional CSS classes                   |
| `children` | `Content \| ((validation: ValidationResult) => Content)` | -       | Error message content or render function |

::api{symbol="@rivetjs/ui/field-error#FieldErrorRootProps"}

## Accessibility

The field links the error with `aria-describedby` and sets `aria-invalid` on the input while it is invalid.

The FieldError component ensures accessibility by:

- Using proper ARIA attributes for error announcement
- Supporting screen readers with semantic HTML
- Providing visual and programmatic error indication
- Automatically managing visibility based on validation state

## Related Components

- [TextField](/components/text-field/): Composition-friendly fields with labels and validation.
- [Input](/components/input/): Single-line text input built on React Aria.
- [TextArea](/components/text-area/): Multiline text input with focus management.
