---
title: Input
description: "Primitive single-line text input component that accepts standard HTML attributes"
template: reference
status: experimental
related: [components/text-field, components/text-area, components/label]
---

`Input` is a single-line text input: the [cdk Input](site:cdk/components/input/) (hover / focus / focus-visible / invalid state attributes) with the Rivet UI classes. Inside a [TextField](/components/text-field/) it takes the field's label, description and validation.

Notes:

- `class`, not `className`.
- React's `onChange` on a native input fires per keystroke; in Rivet that is `onInput` (`onChange` is the native change event). Controlled: `value={value()}` + `onInput`.
- The variant falls back to the enclosing TextField's `variant`, then to an enclosing ComboBox's.

## Usage

```tsx
import { Input } from "@rivetjs/ui/input";
```

::example{id=input-basic}

:::note
For validation, labels, and error messages, see **[TextField](/components/text-field/)**.
:::

## Anatomy

`Input` exposes `Input.Root`.

Use the composition in the live example above; the API reference below describes the props.

## Examples

### Variants

The Input component supports two visual variants:

- **`primary`** (default) - Standard styling with shadow, suitable for most use cases
- **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

::example{id=input-variants}

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=input-on-surface}

### Full Width

::example{id=input-full-width}

### Input Types

::example{id=input-types}

### Controlled

::example{id=input-controlled}

## Customization

### Tailwind CSS

::example{id=input-custom-styles}

### Global CSS

The base class `.input` powers every instance. Override it once with `@layer components`.

```css
@layer components {
  .input {
    @apply rounded-lg border border-border bg-surface px-4 py-2 text-sm shadow-sm transition-colors;

    &:hover,
    &[data-hovered="true"] {
      @apply bg-surface-secondary border-border/80;
    }

    &:focus-visible,
    &[data-focus-visible="true"] {
      @apply border-accent ring-2 ring-accent/20;
    }

    &[data-invalid="true"] {
      @apply border-danger bg-danger-soft text-danger;
    }
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

#### Base Classes

- `.input` – Native input element styling

### Interactive States

- **Hover**: `:hover` or `[data-hovered="true"]`
- **Focus Visible**: `:focus-visible` or `[data-focus-visible="true"]`
- **Invalid**: `[data-invalid="true"]` (also syncs with `aria-invalid`)
- **Disabled**: `:disabled` or `[aria-disabled="true"]`
- **Read Only**: `[aria-readonly="true"]`

## API Reference

See the [full module API](/api/rivetjs/ui/input/) for every named export and part prop type.

### Input

Input accepts all standard HTML `<input>` attributes plus the following:

| Prop           | Type                                        | Default     | Description                                                                                                                                                        |
| -------------- | ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`        | `string`                                    | -           | Tailwind classes merged with the component styles.                                                                                                                 |
| `type`         | `string`                                    | `"text"`    | Input type (text, email, password, number, etc.).                                                                                                                  |
| `value`        | `string`                                    | -           | Controlled value.                                                                                                                                                  |
| `defaultValue` | `string`                                    | -           | Uncontrolled initial value.                                                                                                                                        |
| `onInput`      | `JSX.IntrinsicElements["input"]["onInput"]` | -           | Fires while the user edits. Read `event.currentTarget.value`.                                                                                                      |
| `placeholder`  | `string`                                    | -           | Placeholder text.                                                                                                                                                  |
| `disabled`     | `boolean`                                   | `false`     | Disables the input.                                                                                                                                                |
| `readOnly`     | `boolean`                                   | `false`     | Makes the input read-only.                                                                                                                                         |
| `required`     | `boolean`                                   | `false`     | Marks the input as required.                                                                                                                                       |
| `name`         | `string`                                    | -           | Name for form submission.                                                                                                                                          |
| `autoComplete` | `string`                                    | -           | Autocomplete hint for the browser.                                                                                                                                 |
| `maxLength`    | `number`                                    | -           | Maximum number of characters.                                                                                                                                      |
| `minLength`    | `number`                                    | -           | Minimum number of characters.                                                                                                                                      |
| `pattern`      | `string`                                    | -           | Regex pattern for validation.                                                                                                                                      |
| `min`          | `number \| string`                          | -           | Minimum value (for number/date inputs).                                                                                                                            |
| `max`          | `number \| string`                          | -           | Maximum value (for number/date inputs).                                                                                                                            |
| `step`         | `number \| string`                          | -           | Stepping interval (for number inputs).                                                                                                                             |
| `fullWidth`    | `boolean`                                   | `false`     | Whether the input should take full width of its container                                                                                                          |
| `variant`      | `"primary" \| "secondary"`                  | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |

> For validation props like `isInvalid`, `isRequired`, and error handling, use **[TextField](/components/text-field/)** with Input as a child component.

::api{symbol="@rivetjs/ui/input#InputRootProps"}

## Accessibility

A native `<input>`; give it a label (`aria-label`, a `Label` with `for`, or a TextField).

## Related Components

- [TextField](/components/text-field/): Composition-friendly fields with labels and validation.
- [TextArea](/components/text-area/): Multiline text input with focus management.
- [Label](/components/label/): Accessible label for form controls.
