---
title: TextArea
description: "Primitive multiline text input component that accepts standard HTML attributes"
template: reference
status: experimental
related: [components/text-field, components/input]
---

`TextArea` is a multiline text input: the [cdk TextArea](site:cdk/components/text-field/) with the Rivet UI classes. Inside a [TextField](/components/text-field/) it takes the field's label, description and validation.

Notes:

- `class`, not `className`.
- React's `onChange` on a native textarea fires per keystroke; in Rivet that is `onInput`.

## Usage

```tsx
import { TextArea } from "@rivetjs/ui/textarea";
```

::example{id=textarea-basic}

:::note
For validation, labels, and error messages, see **[TextField](/components/text-field/)**.
:::

## Anatomy

`TextArea` exposes `TextArea.Root`.

Use the composition in the live example above; the API reference below describes the props.

## Examples

### Variants

The TextArea component supports two visual variants:

- **`primary`** (default) - Standard styling with shadow, suitable for most use cases
- **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

::example{id=textarea-variants}

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=textarea-on-surface}

### Full Width

::example{id=textarea-full-width}

### Controlled

::example{id=textarea-controlled}

### Rows and Resizing

::example{id=textarea-rows}

## Customization

### Tailwind CSS

::example{id=text-area-custom-styles}

### Global CSS

Override the shared `.textarea` class once with Tailwind's `@layer components`.

```css
@layer components {
  .textarea {
    @apply rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-6 shadow-sm;

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

- `.textarea` – Underlying `<textarea>` element styling

### Interactive States

- **Hover**: `:hover` or `[data-hovered="true"]`
- **Focus Visible**: `:focus-visible` or `[data-focus-visible="true"]`
- **Invalid**: `[data-invalid="true"]`
- **Disabled**: `:disabled` or `[aria-disabled="true"]`

## API Reference

See the [full module API](/api/rivetjs/ui/textarea/) for every named export and part prop type.

### TextArea

TextArea accepts all standard HTML `<textarea>` attributes plus the following:

| Prop           | Type                                           | Default         | Description                                                                                                                                                        |
| -------------- | ---------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`        | `string`                                       | -               | Tailwind classes merged with the base styles.                                                                                                                      |
| `rows`         | `number`                                       | browser default | Number of visible text lines.                                                                                                                                      |
| `cols`         | `number`                                       | -               | Visible width of the text control.                                                                                                                                 |
| `value`        | `string`                                       | -               | Controlled value for the textarea.                                                                                                                                 |
| `defaultValue` | `string`                                       | -               | Initial uncontrolled value.                                                                                                                                        |
| `onInput`      | `JSX.IntrinsicElements["textarea"]["onInput"]` | -               | Fires while the user edits. Read `event.currentTarget.value`.                                                                                                      |
| `placeholder`  | `string`                                       | -               | Placeholder text.                                                                                                                                                  |
| `disabled`     | `boolean`                                      | `false`         | Disables the textarea.                                                                                                                                             |
| `readOnly`     | `boolean`                                      | `false`         | Makes the textarea read-only.                                                                                                                                      |
| `required`     | `boolean`                                      | `false`         | Marks the textarea as required.                                                                                                                                    |
| `name`         | `string`                                       | -               | Name for form submission.                                                                                                                                          |
| `autoComplete` | `string`                                       | -               | Autocomplete hint for the browser.                                                                                                                                 |
| `maxLength`    | `number`                                       | -               | Maximum number of characters.                                                                                                                                      |
| `minLength`    | `number`                                       | -               | Minimum number of characters.                                                                                                                                      |
| `wrap`         | `'soft' \| 'hard'`                             | -               | How text wraps when submitted.                                                                                                                                     |
| `fullWidth`    | `boolean`                                      | `false`         | Whether the textarea should take full width of its container                                                                                                       |
| `variant`      | `"primary" \| "secondary"`                     | `"primary"`     | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |

> For validation props like `isInvalid`, `isRequired`, and error handling, use **[TextField](/components/text-field/)** with TextArea as a child component.

::api{symbol="@rivetjs/ui/textarea#TextAreaRootProps"}

## Accessibility

A native `<textarea>`; give it a label (`aria-label`, a `Label`, or a TextField).

## Related Components

- [TextField](/components/text-field/): Composition-friendly fields with labels and validation.
- [Input](/components/input/): Single-line text input built on React Aria.
- [Label](/components/label/): Accessible label for form controls.
