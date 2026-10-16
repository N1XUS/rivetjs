---
title: Fieldset
description: "Group related form controls with legends, descriptions, and actions"
template: reference
status: experimental
related: [components/form, components/text-field]
---

`Fieldset` groups related fields under a legend: a native `<fieldset>` with the Rivet UI parts (`Legend`, `Group`, `Actions`). A `disabled` fieldset also disables the cdk components inside it (Button, CheckboxGroup, RadioGroup, Slider, ToggleButton(Group), Link) through their contexts.

Notes:

- `class`, not `className`.
- Parts are generic over the element (`<Fieldset.Group<"section">>`) and take `render`.

Accessibility: A native `<fieldset>` + `<legend>`: assistive technology announces the legend with the fields.

## Usage

```tsx
import { Fieldset } from "@rivetjs/ui/fieldset";
```

::example{id=fieldset-basic}

## Anatomy

```tsx
import { Fieldset } from "@rivetjs/ui/fieldset";

export default () => (
  <Fieldset>
    <Fieldset.Legend />
    <Fieldset.Group>
      {/* form fields go here */}
    </Fieldset.Group>
    <Fieldset.Actions>
      {/* action buttons go here */}
    </Fieldset.Actions>
  </Fieldset>
)
```

## Examples

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` on form controls (Input, TextArea, etc.) to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=fieldset-on-surface}

## Customization

### Tailwind CSS

::example{id=fieldset-custom-styles}

### Global CSS

Use the `@layer components` directive to target Fieldset [BEM](https://getbem.com/)-style classes.

```css
@layer components {
  .fieldset {
    @apply gap-5 rounded-xl border border-border/60 bg-surface p-6 shadow-field;
  }

  .fieldset__legend {
    @apply text-lg font-semibold;
  }

  .fieldset__field-group {
    @apply gap-3 md:grid md:grid-cols-2;
  }

  .fieldset__actions {
    @apply flex justify-end gap-2 pt-2;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Fieldset compound component exposes these CSS selectors:

#### Base Classes

- `.fieldset` – Root container
- `.fieldset__legend` – Legend element
- `.fieldset__field-group` – Wrapper for grouped fields
- `.fieldset__actions` – Action bar below the fields

## API Reference

### Fieldset

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Tailwind CSS classes applied to the root element. |
| `children` | `Content` | - | Fieldset content (legend, groups, descriptions, actions). |
| `nativeProps` | `React.HTMLAttributes<HTMLFieldSetElement>` | Supports native fieldset attributes and events. |

### Fieldset.Legend

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Tailwind classes for the legend element. |
| `children` | `Content` | - | Legend content, usually plain text. |
| `nativeProps` | `React.HTMLAttributes<HTMLLegendElement>` |  - | Native legend attributes. |

### Fieldset.Group

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Layout and spacing classes for grouped fields. |
| `children` | `Content` | - | Form controls to group inside the fieldset. |
| `nativeProps` | `React.HTMLAttributes<HTMLDivElement>` | - | Native div attributes. |

### Fieldset.Actions

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Tailwind classes to align action buttons or text. |
| `children` | `Content` | - | Action buttons or helper text. |
| `nativeProps` | `React.HTMLAttributes<HTMLDivElement>` | - | Native div attributes. |

::api{symbol="@rivetjs/ui/fieldset#FieldsetRootProps"}
::api{symbol="@rivetjs/ui/fieldset#FieldsetLegendProps"}
::api{symbol="@rivetjs/ui/fieldset#FieldGroupProps"}
::api{symbol="@rivetjs/ui/fieldset#FieldsetActionsProps"}

## Related Components

- [TextField](/components/text-field/): Composition-friendly fields with labels and validation.
- [Label](/components/label/): Accessible label for form controls.
- [CheckboxGroup](/components/checkbox-group/): Group of checkboxes with shared state.
