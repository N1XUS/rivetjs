---
title: Checkbox
description: "Checkboxes allow users to select multiple items from a list of individual items, or to mark one individual item as selected."
template: reference
status: experimental
related: [components/checkbox-group, components/switch, components/radio-group]
---

`Checkbox` is a labelled two-state (or indeterminate) control: the [cdk CheckboxField + CheckboxButton](site:cdk/components/checkbox/) (a visually hidden native `<input type="checkbox">` inside a `<label>`, form validation) with the Rivet UI parts and classes. Inside a [CheckboxGroup](/components/checkbox-group/) it takes the group's value, name and `variant`.

Notes:

- `class`, not `className`.
- `isSelected` takes a two-way signal (`isSelected={on}`) or a value; render props are accessors (`({ isSelected }) => isSelected()`).
- Default indicator icons are lucide `Check` (with the draw animation) / `Minus`; `Checkbox.Indicator` takes `span` props only.
- Shorthand (Rivet addition): `label` / `description` without children render the Content / Control / Indicator / Description parts.

## Usage

```tsx
import { Checkbox } from "@rivetjs/ui/checkbox";
```

::example{id=checkbox-basic}

## Anatomy

```tsx
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";

export default () => (
  <Checkbox>
    <Checkbox.Content>
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      Label {/* plain text — the clickable label + accessible name */}
    </Checkbox.Content>
    <Description /> {/* Optional — field-level help text */}
    <FieldError /> {/* Optional — validation message */}
  </Checkbox>
);
```

Additional exported parts: `Checkbox.Root`.

## Examples

### Shorthand

Rivet addition: without children, `label` and `description` render the Content, Control, Indicator and Description parts for you, with the same markup and accessibility as the compound form. Use the parts for a custom indicator or label content. Explicit children win: next to children the shorthand props are ignored, with a development warning.

::example{id=checkbox-shorthand}

### Variants

The Checkbox component supports two visual variants:

- **`primary`** (default) - Standard styling with default background, suitable for most use cases
- **`secondary`** - Lower emphasis variant, suitable for use in Surface components

::example{id=checkbox-variants}

### Full Rounded

::example{id=checkbox-full-rounded}

### Disabled

::example{id=checkbox-disabled}

### External Label

::example{id=checkbox-external-label}

### With Description

::example{id=checkbox-with-description}

### Default Selected

::example{id=checkbox-default-selected}

### Invalid

::example{id=checkbox-invalid}

### Controlled

::example{id=checkbox-controlled}

### Indeterminate

::example{id=checkbox-indeterminate}

### Form Integration

::example{id=checkbox-form}

### Render Props

::example{id=checkbox-render-props}

### Render Function

::example{id=checkbox-render-function}

### Custom Indicator

::example{id=checkbox-custom-indicator}

## Customization

### Tailwind CSS

::example{id=checkbox-custom-styles}

### Global CSS

To customize the Checkbox component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .checkbox {
    @apply inline-flex gap-3 items-center;
  }

  .checkbox__control {
    @apply size-5 border-2 border-gray-400 rounded data-[selected=true]:bg-blue-500 data-[selected=true]:border-blue-500;

    /* Animated background indicator */
    &::before {
      @apply bg-accent pointer-events-none absolute inset-0 z-0 origin-center scale-50 rounded-md opacity-0 content-[''];

      transition:
        scale 200ms linear,
        opacity 200ms linear,
        background-color 200ms ease-out;
    }

    /* Show indicator when selected */
    &[data-selected="true"]::before {
      @apply scale-100 opacity-100;
    }
  }

  .checkbox__indicator {
    @apply text-white;
  }

  .checkbox__content {
    @apply items-center gap-3;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `checkbox-content`, `checkbox-indicator`, `checkbox-default-indicator--indeterminate`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Checkbox component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/checkbox.css)):

#### Base Classes

- `.checkbox` - Base checkbox container (the field)
- `.checkbox__content` - Clickable label wrapping the control and label text
- `.checkbox__control` - Checkbox control box
- `.checkbox__indicator` - Checkbox checkmark indicator

### Interactive States

The checkbox supports both CSS pseudo-classes and data attributes for flexibility:

- **Selected**: `[data-selected="true"]` or `[aria-checked="true"]` (shows checkmark and background color change)
- **Indeterminate**: `[data-indeterminate="true"]` (shows indeterminate state with dash)
- **Invalid**: `[data-invalid="true"]` or `[aria-invalid="true"]` (shows error state with danger colors)
- **Hover**: `:hover` or `[data-hovered="true"]` on `Checkbox.Control` (button)
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on the button (shows focus ring on control)
- **Disabled**: `[data-disabled="true"]` on the field (reduced opacity, including help text)
- **Pressed**: `:active` or `[data-pressed="true"]`

### Zero-JS native path

Where the build proves a checkbox call site closed (declared data props only, no handlers, no controlled state, no render props, no live values, no context-reading components inside, no state selectors in the calling module), it renders native markup and ships no JavaScript, before or after an interaction: a visually hidden `<input type="checkbox">` inside the `<label>` (`.checkbox[data-native]`, the `id` on the input), selected = `.checkbox[data-native]:has(input:checked)`; indeterminate, a description, a group, a field provider or a form validation provider keep the interactive path. Classes, slots and `data-disabled` stay the same; style state with the selectors above that include the native form (`:checked`, `[open]`, `:focus-visible`), not with a state attribute alone. Any other call site keeps the interactive path. See the framework guide "Native automata".

## API Reference

See the [full module API](/api/rivetjs/ui/checkbox/) for every named export and part prop type.

### Checkbox

Inherits from [React Aria CheckboxField](https://react-spectrum.adobe.com/react-aria/Checkbox.html).

| Prop                 | Type                                                                       | Default     | Description                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isSelected`         | `boolean \| Signal<boolean> \| (() => boolean)`                            | `false`     | Whether the checkbox is checked                                                                                                                                    |
| `defaultSelected`    | `boolean`                                                                  | `false`     | Whether the checkbox is checked by default (uncontrolled)                                                                                                          |
| `isIndeterminate`    | `boolean \| (() => boolean)`                                               | `false`     | Whether the checkbox is in an indeterminate state                                                                                                                  |
| `isDisabled`         | `boolean`                                                                  | `false`     | Whether the checkbox is disabled                                                                                                                                   |
| `isInvalid`          | `boolean \| (() => boolean)`                                               | `false`     | Whether the checkbox is invalid                                                                                                                                    |
| `isReadOnly`         | `boolean \| (() => boolean)`                                               | `false`     | Whether the checkbox is read only                                                                                                                                  |
| `isRequired`         | `boolean \| (() => boolean)`                                               | `false`     | Whether the checkbox must be selected                                                                                                                              |
| `validate`           | `(value: boolean) => ValidationError \| true \| null \| undefined`         | -           | Custom validation function                                                                                                                                         |
| `validationBehavior` | `'native' \| 'aria'`                                                       | `'native'`  | Whether to use native HTML form validation or ARIA                                                                                                                 |
| `variant`            | `"primary" \| "secondary"`                                                 | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `name`               | `string`                                                                   | -           | The name of the input element, used when submitting an HTML form                                                                                                   |
| `value`              | `string`                                                                   | -           | The value of the input element, used when submitting an HTML form                                                                                                  |
| `onChange`           | `(isSelected: boolean) => void`                                            | -           | Handler called when the checkbox value changes                                                                                                                     |
| `children`           | `Content \| (values: CheckboxFieldRenderProps) => Content`                 | -           | Checkbox content or field render prop                                                                                                                              |
| `label`              | `Content`                                                                  | -           | Shorthand (no children): the label next to the control.                                                                                                            |
| `description`        | `Content`                                                                  | -           | Shorthand (no children): a Description under the label.                                                                                                            |
| `render`             | `DOMRenderFunction<keyof JSX.IntrinsicElements, CheckboxFieldRenderProps>` | -           | Overrides the default DOM element with a custom render function.                                                                                                   |

### Checkbox.Content

The clickable `<label>` that wraps the control and label text. Put `Checkbox.Control` and the `Label` inside it; keep `Description`/`FieldError` as siblings of `Checkbox.Content`. For a checkbox with no label, omit the `Label` and pass an `aria-label` on `Checkbox`.

| Prop       | Type                                                        | Default | Description                                               |
| ---------- | ----------------------------------------------------------- | ------- | --------------------------------------------------------- |
| `children` | `Content \| (values: CheckboxButtonRenderProps) => Content` | -       | Button content (control + label), or a button render prop |
| `class`    | `string \| (values: CheckboxButtonRenderProps) => string`   | -       | Classes applied to the clickable label                    |

### CheckboxFieldRenderProps

When using a render prop on the root `Checkbox`, these field-level values are provided:

| Prop              | Type            | Description                                       |
| ----------------- | --------------- | ------------------------------------------------- |
| `isSelected`      | `() => boolean` | Whether the checkbox is currently checked         |
| `isIndeterminate` | `() => boolean` | Whether the checkbox is in an indeterminate state |
| `isDisabled`      | `() => boolean` | Whether the checkbox is disabled                  |
| `isReadOnly`      | `() => boolean` | Whether the checkbox is read only                 |
| `isInvalid`       | `() => boolean` | Whether the checkbox is invalid                   |
| `isRequired`      | `() => boolean` | Whether the checkbox is required                  |

### CheckboxButtonRenderProps

`Checkbox.Control` and `Checkbox.Indicator` use button-level render props (`isHovered`, `isPressed`, `isFocusVisible`, etc.). Pass a function as `Checkbox.Control` children or to `Checkbox.Indicator` to access them.

::api{symbol="@rivetjs/ui/checkbox#CheckboxRootProps"}

## Accessibility

A native checkbox input inside the `Checkbox.Content` `<label>` (keyboard: Tab focuses, Space toggles); a nested `Label` renders as a `span`, so the label has no nested label. `isIndeterminate` sets the input's `indeterminate` property (`aria-checked="mixed"`).

## Related Components

- [Label](/components/label/): Accessible label for form controls.
- [CheckboxGroup](/components/checkbox-group/): Group of checkboxes with shared state.
- [Description](/components/description/): Helper text for form fields.
