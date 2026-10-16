---
title: InputOTP
description: "A one-time password input component for verification codes and secure authentication"
template: reference
status: experimental
related: [components/input, components/text-field, components/form]
---

`InputOTP` is a one-time-code input: one transparent `<input autocomplete="one-time-code">` over styled slots, so paste, autofill (SMS codes), password managers and the platform caret / selection all work. Built on the in-tree signals port of [input-otp](https://github.com/guilhermerodz/input-otp) 1.5.0.

Notes:

- `class` (container) and `inputClass` (hidden input), not `className` / `inputClassName`.
- `value` takes a two-way signal (`value={code}`) or a string; `onChange` receives the string.
- No `<noscript>` CSS fallback: Rivet JSX rejects inline `<style>` content (the `noScriptCSSFallback` prop is accepted and ignored).
- Shorthand (Rivet addition): no children renders one Group with a Slot per `maxLength` position.

Accessibility: A single native `<input>` holds the value (`inputmode="numeric"` by default, `maxlength`, `pattern`), so screen readers, autofill and paste see one text field; the slots are presentational. Label it with `aria-label` / `aria-labelledby` or a visible `Label`.

## Usage

```tsx
import { InputOTP } from "@rivetjs/ui/input-otp";
```

::example{id=input-otp-basic}

## Anatomy

```tsx
import { InputOTP } from "@rivetjs/ui/input-otp";

export default () => (
  <InputOTP maxLength={6}>
    <InputOTP.Group>
      <InputOTP.Slot index={0} />
      <InputOTP.Slot index={1} />
      {/* ...rest of the slots */}
    </InputOTP.Group>
    <InputOTP.Separator />
    <InputOTP.Group>
      <InputOTP.Slot index={3} />
      {/* ...rest of the slots */}
    </InputOTP.Group>
  </InputOTP>
)
```

> **InputOTP** is built on top of [input-otp](https://github.com/guilhermerodz/input-otp) by [@guilherme_rodz](https://twitter.com/guilherme_rodz), providing a flexible and accessible foundation for OTP input components.

## Examples

### Shorthand

Rivet addition: without children, InputOTP renders one Group with a Slot per `maxLength` position. Use the parts for separators between groups.

::example{id=input-otp-shorthand}

### Variants

The InputOTP component supports two visual variants:

- **`primary`** (default) - Standard styling with shadow, suitable for most use cases
- **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

::example{id=input-otp-variants}

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=input-otp-on-surface}

### Disabled State

::example{id=input-otp-disabled}

### Four Digits

::example{id=input-otp-four-digits}

### Controlled

Control the value to synchronize with state, clear the input, or implement custom validation.

::example{id=input-otp-controlled}

### On Complete

Use the `onComplete` callback to trigger actions when all slots are filled.

::example{id=input-otp-on-complete}

### Form Example

A complete two-factor authentication form with validation and submission.

::example{id=input-otp-form-example}

### With Pattern

Use the `pattern` prop to restrict input to specific characters. `@rivetjs/ui/input-otp` exports common patterns like `REGEXP_ONLY_CHARS` and `REGEXP_ONLY_DIGITS`.

::example{id=input-otp-with-pattern}

### With Validation

Use `isInvalid` together with validation messages to surface errors.

::example{id=input-otp-with-validation}

## Customization

### Tailwind CSS

::example{id=input-otp-custom-styles}

### Global CSS

To customize the InputOTP component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .input-otp {
    @apply gap-3;
  }

  .input-otp__slot {
    @apply size-12 rounded-xl border-2 font-bold;
  }

  .input-otp__slot[data-active="true"] {
    @apply border-accent-500 ring-2 ring-accent-200;
  }

  .input-otp__separator {
    @apply w-2 h-1 bg-border-strong rounded-full;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The InputOTP component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/input-otp.css)):

#### Base Classes
- `.input-otp` - Base container
- `.input-otp__container` - Inner container from input-otp library
- `.input-otp__group` - Group of slots
- `.input-otp__slot` - Individual input slot
- `.input-otp__slot-value` - The character inside a slot
- `.input-otp__caret` - Blinking caret indicator
- `.input-otp__separator` - Visual separator between groups

#### State Classes
- `.input-otp__slot[data-active="true"]` - Currently active slot
- `.input-otp__slot[data-filled="true"]` - Slot with a character
- `.input-otp__slot[data-disabled="true"]` - Disabled slot
- `.input-otp__slot[data-invalid="true"]` - Invalid slot
- `.input-otp__container[data-disabled="true"]` - Disabled container

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` on slot
- **Active**: `[data-active="true"]` on slot (currently focused)
- **Filled**: `[data-filled="true"]` on slot (contains a character)
- **Disabled**: `[data-disabled="true"]` on container and slots
- **Invalid**: `[data-invalid="true"]` on slots

## API Reference

### InputOTP

InputOTP is built on top of the [input-otp](https://github.com/guilhermerodz/input-otp) library with additional features.

#### Base Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `maxLength` | `number` | - | **Required.** Number of input slots. |
| `value` | `string` | - | Controlled value (uncontrolled if not provided). |
| `onChange` | `(value: string) => void` | - | Handler called when the value changes. |
| `onComplete` | `(value: string) => void` | - | Handler called when all slots are filled. |
| `class` | `string` | - | Additional CSS classes for the container. |
| `containerClassName` | `string` | - | CSS classes for the inner container. |
| `variant` | `"primary" \| "secondary"` | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `children` | `Content` | - | InputOTP.Group, InputOTP.Slot, and InputOTP.Separator components. Omitted: one Group with a Slot per `maxLength` position. |

#### Validation Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isDisabled` | `boolean` | `false` | Whether the input is disabled. |
| `isInvalid` | `boolean` | `false` | Whether the input is in an invalid state. |
| `validationErrors` | `string[]` | - | Server-side or custom validation errors. |
| `validationDetails` | `ValidityState` | - | HTML5 validation details. |

#### Input Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pattern` | `string` | - | Regex pattern for allowed characters (e.g., `REGEXP_ONLY_DIGITS`). |
| `textAlign` | `'left' \| 'center' \| 'right'` | `'left'` | Text alignment within slots. |
| `inputMode` | `'numeric' \| 'text' \| 'decimal' \| 'tel' \| 'search' \| 'email' \| 'url'` | `'numeric'` | Virtual keyboard type on mobile devices. |
| `placeholder` | `string` | - | Placeholder text for empty slots. |
| `pasteTransformer` | `(text: string) => string` | - | Transform pasted text (e.g., remove hyphens). |

#### Form Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | - | Name attribute for form submission. |
| `autoFocus` | `boolean` | - | Whether to focus the first slot on mount. |

### InputOTP.Group

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes for the group. |
| `children` | `Content` | - | InputOTP.Slot components. |

### InputOTP.Slot

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `index` | `number` | - | **Required.** Zero-based index of the slot. |
| `class` | `string` | - | Additional CSS classes for the slot. |

### InputOTP.Separator

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes for the separator. |

### Exported Patterns

Common regex patterns are re-exported from input-otp for convenience:

```tsx
import { REGEXP_ONLY_CHARS, REGEXP_ONLY_DIGITS, REGEXP_ONLY_DIGITS_AND_CHARS } from "@rivetjs/ui/input-otp";

// Use with pattern prop
<InputOTP pattern={REGEXP_ONLY_DIGITS} maxLength={6}>
  {/* ... */}
</InputOTP>
```

- **REGEXP_ONLY_DIGITS** - Only numeric characters (0-9)
- **REGEXP_ONLY_CHARS** - Only alphabetic characters (a-z, A-Z)
- **REGEXP_ONLY_DIGITS_AND_CHARS** - Alphanumeric characters (0-9, a-z, A-Z)

::api{symbol="@rivetjs/ui/input-otp#InputOTPRootProps"}

## Related Components

- [Input](/components/input/): Single-line text input built on React Aria.
- [Form](/components/form/): Form validation and submission handling.
- [Surface](/components/surface/): Base container surface.
