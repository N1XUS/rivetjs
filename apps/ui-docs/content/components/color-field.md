---
title: ColorField
description: "Color input field with labels, descriptions, validation and channel editing."
template: reference
status: experimental
related: [components/color-picker, components/color-swatch]
---

`ColorField` is a text input for a color: a hex value by default, or one channel (`channel="hue"`, …) as a number. The root is the [cdk ColorField](site:cdk/components/color-field/) (React Aria `ColorField`); `ColorField.Group` / `Input` / `Prefix` / `Suffix` are the `ColorInputGroup` parts (`@rivetjs/ui/color-input-group`).

Notes:

- `class`, not `className`. `parseColor` and the `Color` / `ColorSpace` / `ColorChannel` types come from `@rivetjs/cdk/color` (the React Stately color port).
- A controlled `value` is a two-way signal of the color string (`signal<string | null>("#0485F7")`; no `onChange` setter needed; the component writes back a lossless string such as `hsla(200, 100%, 50%, 1)`). `Color` objects in props (`defaultValue={parseColor("…")}`) reach the cdk part as strings so the page resumes; a `Color` held in a component local and read by resumable code must be its string form.
- Render props are accessors (`({ isInvalid }) => isInvalid()`).

Accessibility: the input is a `role="textbox"` labelled by the `Label`; typing commits on blur or Enter, arrow keys / Page Up / Down step the value (hex: by 1; a channel: by its step).

## Usage

```tsx
import { ColorField } from "@rivetjs/ui/color-field";
```

::example{id=color-field-basic}

## Anatomy

```tsx
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";

export default () => (
  <ColorField>
    <Label />
    <ColorField.Group>
      <ColorField.Prefix>
        <ColorSwatch color="#000000" />
      </ColorField.Prefix>
      <ColorField.Input />
    </ColorField.Group>
    <Description />
    <FieldError />
  </ColorField>
)
```

> **ColorField** combines label, color input, description, and error into a single accessible component.

## Examples

### Variants

The ColorField.Group component supports two visual variants:

- **`primary`** (default) - Standard styling with shadow, suitable for most use cases
- **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

::example{id=color-field-variants}

### On Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` on ColorField.Group to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=color-field-on-surface}

### With Description

::example{id=color-field-with-description}

### Required Field

::example{id=color-field-required}

### Disabled State

::example{id=color-field-disabled}

### Full Width

::example{id=color-field-full-width}

### Validation

Use `isInvalid` together with `FieldError` to surface validation messages.

::example{id=color-field-invalid}

### Channel Editing

ColorField supports editing individual color channels (hue, saturation, lightness, red, green, blue, alpha) by setting the `colorSpace` and `channel` props.

::example{id=color-field-channel-editing}

### Controlled

Control the value to synchronize with other components or state management.

::example{id=color-field-controlled}

### Form Example

Complete form example with validation and submission handling.

::example{id=color-field-form-example}

### Render Function

::example{id=color-field-render-function}

## Customization

### Tailwind CSS

::example{id=color-field-custom-styles}

### Global CSS

ColorField has minimal default styling. Override the `.color-field` class to customize the container styling.

```css
@layer components {
  .color-field {
    @apply flex flex-col gap-1;

    &[data-invalid="true"],
    &[aria-invalid="true"] {
      [data-slot="description"] {
        @apply hidden;
      }
    }

    [data-slot="label"] {
      @apply w-fit;
    }

    [data-slot="description"] {
      @apply px-1;
    }
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

- `.color-field` – Root container with minimal styling (`flex flex-col gap-1`)

> **Note:** Child components ([Label](/components/label/), [Description](/components/description/), [FieldError](/components/field-error/)) have their own CSS classes and styling. See their respective documentation for customization options. ColorField.Group styling is documented below in the API Reference section.

### Interactive States

ColorField automatically manages these data attributes based on its state:

- **Invalid**: `[data-invalid="true"]` or `[aria-invalid="true"]` - Automatically hides the description slot when invalid
- **Required**: `[data-required="true"]` - Applied when `isRequired` is true
- **Disabled**: `[data-disabled="true"]` - Applied when `isDisabled` is true
- **Focus Within**: `[data-focus-within="true"]` - Applied when any child input is focused

## API Reference

### ColorField

ColorField inherits all props from the [cdk ColorField](site:cdk/components/color-field/) (React Aria `ColorField`).

#### Base Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Content \| (values: ColorFieldRenderProps) => Content` | - | Child components (Label, ColorField.Group, etc.) or render function. |
| `class` | `string \| (values: ColorFieldRenderProps) => string` | - | CSS classes for styling, supports render props. |
| `style` | `JSX.CSSProperties \| (values: ColorFieldRenderProps) => JSX.CSSProperties` | - | Inline styles, supports render props. |
| `fullWidth` | `boolean` | `false` | Whether the color field should take full width of its container |
| `id` | `string` | - | The element's unique identifier. |
| `render` | `DOMRenderFunction<keyof JSX.IntrinsicElements, ColorFieldRenderProps>` | - | Overrides the default DOM element with a custom render function.|

#### Value Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string \| Color \| null \| Signal<string \| Color \| null>` | - | Current value (controlled; Rivet: a signal is two-way). |
| `defaultValue` | `string \| Color \| null` | - | Default value (uncontrolled). |
| `onChange` | `(color: Color \| null) => void` | - | Handler called when the value changes. |

#### Channel Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `colorSpace` | `ColorSpace` | - | The color space that the color field operates in when `channel` is provided. |
| `channel` | `ColorChannel` | - | The color channel to edit. If not provided, edits hex value. |

#### Validation Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isRequired` | `boolean` | `false` | Whether user input is required before form submission. |
| `isInvalid` | `boolean \| (() => boolean)` | - | Whether the value is invalid (Rivet: or an accessor). |
| `validate` | `(value: Color) => ValidationError \| true \| null \| undefined` | - | Custom validation function. |
| `validationBehavior` | `'native' \| 'aria'` | `'native'` | Whether to use native HTML form validation or ARIA attributes. |

#### State Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isDisabled` | `boolean` | - | Whether the input is disabled. |
| `isReadOnly` | `boolean` | - | Whether the input can be selected but not changed. |
| `isWheelDisabled` | `boolean` | - | Whether to disable changing the value with scroll. |

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

ColorField works with these separate components that should be imported and used directly:

- **Label** - Field label component from `@rivetjs/ui/label`
- **ColorField.Group** - Color input group component (documented below)
- **ColorField.Input** - Input element within ColorField.Group
- **ColorField.Prefix** / **ColorField.Suffix** - Prefix and suffix slots for the input group
- **ColorSwatch** - Color preview component from `@rivetjs/ui/color-swatch`
- **Description** - Helper text component from `@rivetjs/ui/description`
- **FieldError** - Validation error message from `@rivetjs/ui/field-error`

Each of these components has its own props API. Use them directly within ColorField for composition:

```tsx
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { signal } from "@rivetjs/reactivity";

const color = signal<string | null>(null);

<ColorField isRequired isInvalid={hasError} value={color}>
  <Label>Brand Color</Label>
  <ColorField.Group>
    <ColorField.Prefix>
      <ColorSwatch color={() => color() ?? "#E4E4E7"} />
    </ColorField.Prefix>
    <ColorField.Input />
  </ColorField.Group>
  <Description>Select your brand's primary color.</Description>
  <FieldError>Please enter a valid color.</FieldError>
</ColorField>
```

### Color Types

ColorField uses `Color` objects from `@rivetjs/cdk/color` (the React Stately color port); a controlled value is a two-way signal of the color string:

```tsx
import { parseColor } from "@rivetjs/cdk/color";
import { signal } from "@rivetjs/reactivity";

// Parse from hex string
const color = parseColor('#3B82F6');

// Get hex string from color
const hex = color.toString('hex'); // "#3b82f6"

// Get RGB values
const rgb = color.toString('rgb'); // "rgb(59, 130, 246)"

// Use in ColorField (Rivet: a two-way signal of the string form)
const value = signal<string | null>("#3B82F6");
<ColorField value={value}>
  {/* ... */}
</ColorField>
```

### Render Props

When using render props with `class`, `style`, or `children`, these values are available (Rivet: accessors, call them):

| Prop | Type | Description |
|------|------|-------------|
| `isDisabled` | `() => boolean` | Whether the field is disabled. |
| `isInvalid` | `() => boolean` | Whether the field is currently invalid. |
| `isReadOnly` | `() => boolean` | Whether the field is read-only. |
| `isRequired` | `() => boolean` | Whether the field is required. |
| `isFocused` | `() => boolean` | Whether the field is currently focused. |
| `isFocusWithin` | `() => boolean` | Whether any child element is focused. |
| `isFocusVisible` | `() => boolean` | Whether focus is visible (keyboard navigation). |

### ColorField.Group

ColorField.Group accepts all props from the cdk `Group` (React Aria `Group`) plus the following:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Tailwind classes merged with the component styles. |
| `fullWidth` | `boolean` | `false` | Whether the color input group should take full width of its container |
| `variant` | `"primary" \| "secondary"` | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `render` | `DOMRenderFunction<keyof JSX.IntrinsicElements, GroupRenderProps>` | - | Overrides the default DOM element with a custom render function.|

### ColorField.Input

ColorField.Input accepts all props from the cdk `Input` (React Aria `Input`) plus the following:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Tailwind classes merged with the component styles. |
| `placeholder` | `string` | - | Placeholder text shown when empty. |

### ColorField.Prefix

ColorField.Prefix accepts standard HTML `div` attributes:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Tailwind classes merged with the component styles. |
| `children` | `Content` | - | Content to display in the prefix slot. |

### ColorField.Suffix

ColorField.Suffix accepts standard HTML `div` attributes:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Tailwind classes merged with the component styles. |
| `children` | `Content` | - | Content to display in the suffix slot. |

::api{symbol="@rivetjs/ui/color-field#ColorField"}

## ColorField.Group Styling

### Customizing the component classes

The base classes power every instance. Override them once with `@layer components`.

```css
@layer components {
  .color-input-group {
    @apply inline-flex h-9 items-center overflow-hidden rounded-field border bg-field text-sm text-field-foreground shadow-field outline-none;

    &:hover,
    &[data-hovered="true"] {
      @apply bg-field-hover;
    }

    &[data-focus-within="true"],
    &:focus-within {
      @apply status-focused-field;
    }

    &[data-invalid="true"] {
      @apply status-invalid-field;
    }

    &[data-disabled="true"],
    &[aria-disabled="true"] {
      @apply status-disabled;
    }
  }

  .color-input-group__input {
    @apply flex flex-1 items-center rounded-none border-0 bg-transparent px-3 py-2 shadow-none outline-none;
  }

  .color-input-group__prefix,
  .color-input-group__suffix {
    @apply shrink-0 text-field-placeholder flex items-center;
  }
}
```

### ColorField.Group CSS Classes

- `.color-input-group` – Root container styling
- `.color-input-group__input` – Input wrapper styling
- `.color-input-group__prefix` – Prefix element styling
- `.color-input-group__suffix` – Suffix element styling

### ColorField.Group Interactive States

- **Hover**: `:hover` or `[data-hovered="true"]`
- **Focus Within**: `[data-focus-within="true"]` or `:focus-within`
- **Invalid**: `[data-invalid="true"]` (also syncs with `aria-invalid`)
- **Disabled**: `[data-disabled="true"]` or `[aria-disabled="true"]`

## Related Components

- [ColorSwatch](/components/color-swatch/): Visual preview of a color value.
- [ColorSwatchPicker](/components/color-swatch-picker/): Color swatch selection from a list of colors.
- [ColorPicker](/components/color-picker/): Composable color picker with popover.
- [Form](/components/form/): Form validation and submission handling.
- [Label](/components/label/): Accessible label for form controls.
- [Description](/components/description/): Helper text for form fields.
- [FieldError](/components/field-error/): Inline validation messages for form fields.
