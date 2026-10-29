---
title: ColorInputGroup
description: "The input shell of a ColorField: a bordered group with the text input and optional prefix and suffix slots, in two variants."
template: reference
status: experimental
related: [components/color-field, components/color-picker, components/color-swatch]
---

`ColorInputGroup` is the styled shell around the text input of a [ColorField](/components/color-field/): the border, the hover / focus / invalid states, and a prefix and a suffix slot for a swatch, an icon or a unit. ColorField re-exports its parts as `ColorField.Group`, `ColorField.Input`, `ColorField.Prefix` and `ColorField.Suffix`; import `ColorInputGroup` when you build your own color field markup or style the group in one place. The group has no color state of its own: always place it inside a ColorField, which parses, formats and validates the value.

## Usage

```tsx
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorInputGroup } from "@rivetjs/ui/color-input-group";
import { Label } from "@rivetjs/ui/label";

<ColorField name="brand" defaultValue="#7C3AED">
  <Label>Brand color</Label>
  <ColorInputGroup>
    <ColorInputGroup.Input />
  </ColorInputGroup>
</ColorField>;
```

::example{id=color-input-group-parts}

## Anatomy

| Part | Element | Notes |
| --- | --- | --- |
| `ColorInputGroup` (`.Root`, `ColorField.Group`) | `div role="presentation"` (cdk Group) | `data-slot="color-input-group"`; `data-hovered`, `data-focus-within`, `data-invalid`, `data-disabled` from the field. |
| `ColorInputGroup.Input` (`ColorField.Input`) | `input` | The text input of the field (`data-slot="color-input-group-input"`); labelled by the field's `Label`. |
| `ColorInputGroup.Prefix` (`ColorField.Prefix`) | `div` | Content before the input (`data-slot="color-input-group-prefix"`), such as a `ColorSwatch`. |
| `ColorInputGroup.Suffix` (`ColorField.Suffix`) | `div` | Content after the input (`data-slot="color-input-group-suffix"`). |

The input's padding adjusts when a prefix or a suffix is present.

## Examples

### Prefix and suffix

In the first field of the example, a `ColorSwatch` in the prefix follows the field's value (a two-way Signal of the color string) and an icon sits in the suffix. Typing a new value and pressing :kbd[Enter] commits it. Keep interactive controls out of the prefix and suffix unless they have their own accessible name.

### Variants

`variant="primary"` (default) is for fields on the page background; `variant="secondary"` is the lower-emphasis variant without a shadow, for fields inside a [Surface](/components/surface/) or a card. `fullWidth` stretches the group to its container. The second field of the example uses both.

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.color-input-group`, `--primary`, `--secondary`, `--full-width` | Root and its variants. |
| `.color-input-group__input`, `__prefix`, `__suffix` | Input and slots. |
| `[data-hovered]`, `[data-focus-within]`, `[data-invalid]`, `[data-disabled]` (and `:hover` / `:focus-within`) | Root state. |

## API Reference

See the [full module API](/api/rivetjs/ui/color-input-group/) for every named export and part prop type.

| Prop        | Values                 | Default   |
| ----------- | ---------------------- | --------- |
| `fullWidth` | `false`, `true`        | `false`   |
| `variant`   | `primary`, `secondary` | `primary` |

::api{symbol="@rivetjs/ui/color-input-group#ColorInputGroupInputProps"}

::api{symbol="@rivetjs/ui/color-input-group#ColorInputGroupPrefixProps"}

::api{symbol="@rivetjs/ui/color-input-group#ColorInputGroupRootProps"}

::api{symbol="@rivetjs/ui/color-input-group#ColorInputGroupSuffixProps"}

## Accessibility

- The ColorField gives the input its label, description and error message; the group itself is `role="presentation"`.
- A swatch in the prefix is decorative next to the text value; keep the value readable as text (the input) for screen readers and for users who can not tell the colors apart.
- :kbd[ArrowUp] / :kbd[ArrowDown] in the input change the value by one step, as in the ColorField.

## Common mistakes

- **A group outside a ColorField.** The input then has no color state, no parsing and no label.
- **Setting `variant` on the field instead of the group.** The variant classes are on `ColorInputGroup` (or `ColorField.Group`).

## Related Components

- [ColorField](/components/color-field/)
- [ColorPicker](/components/color-picker/)
- [ColorSwatch](/components/color-swatch/)
