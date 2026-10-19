---
title: ErrorMessage
description: "A low-level error message component for displaying errors."
template: reference
status: experimental
related: []
---

`ErrorMessage` is error text you render yourself. For the validation errors of a cdk field use [FieldError](field-error.md), which shows only while the field is invalid.

Notes:

- `class`, not `className`.
- Always renderable (no `FieldSlotsGate`, as for [Description](description.md)).

## Usage

```tsx
import { ErrorMessage } from "@rivetjs/ui/error-message";
```

::example{id=error-message-basic}

`ErrorMessage` is a low-level component built on React Aria's `Text` component with an `errorMessage` slot. It's designed for displaying error messages in **non-form components** such as `TagGroup`, `Calendar`, and other collection-based components.

## Anatomy

```tsx
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";
import { Label } from "@rivetjs/ui/label";
import { Description } from "@rivetjs/ui/description";
import { ErrorMessage } from "@rivetjs/ui/error-message";

<TagGroup>
  <Label />
  <TagGroup.List>
    <Tag />
  </TagGroup.List>
  <Description />
  <ErrorMessage />
</TagGroup>;
```

## When to Use

`ErrorMessage` is **not tied to forms**. It's a generic error display component for non-form contexts.

- **Recommended for** non-form components (e.g., `TagGroup`, `Calendar`, collection components)
- **For form fields**, we recommend using [`FieldError`](/components/field-error/) instead, which provides form-specific validation features and automatic error handling, following standardized form validation patterns.

## ErrorMessage vs FieldError

| Component      | Use Case                  | Form Integration | Example Components                   |
| -------------- | ------------------------- | ---------------- | ------------------------------------ |
| `ErrorMessage` | Non-form components       | No               | `TagGroup`, `Calendar`               |
| `FieldError`   | Form fields (recommended) | Yes              | `TextField`, `NumberField`, `Select` |

For form validation, we recommend using `FieldError` as it follows standardized form validation patterns and provides form-specific features. See the [FieldError documentation](/components/field-error/) and the [Form guide](/components/form/) for examples and best practices.

## Customization

### Tailwind CSS

::example{id=error-message-custom-styles}

### Global CSS

To customize the ErrorMessage component classes, you can use the `@layer components` directive. [Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .error-message {
    @apply text-sm font-medium text-danger;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ErrorMessage component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/error-message.css)):

#### Base Classes

- `.error-message` - Base error message styles with danger color and text truncation

#### Slot Classes

- `[slot="errorMessage"]` - ErrorMessage slot styles for React Aria integration

## API Reference

### ErrorMessage

| Prop       | Type      | Default | Description               |
| ---------- | --------- | ------- | ------------------------- |
| `class`    | `string`  | -       | Additional CSS classes    |
| `children` | `Content` | -       | The error message content |

::api{symbol="@rivetjs/ui/error-message#ErrorMessageRootProps"}

## Note

`ErrorMessage` is built on React Aria's `Text` component with `slot="errorMessage"`. It can be targeted using the `[slot=errorMessage]` CSS selector.

## Accessibility

Inside a cdk field it fills the `errorMessage` slot (linked by `aria-describedby`). Not announced by itself: for an error that appears, use `role="alert"` or a FieldError.

The ErrorMessage component enhances accessibility by:

- Using semantic HTML that screen readers can identify
- Providing the `slot="errorMessage"` attribute for React Aria integration
- Supporting proper text contrast ratios for error states
- Following WAI-ARIA best practices for error messaging

## Related Components

- [TagGroup](/components/tag-group/): Focusable list of tags with selection and removal support.
