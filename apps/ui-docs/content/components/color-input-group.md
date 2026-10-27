---
title: ColorInputGroup
description: "The styled input shell, prefix and suffix used by ColorField."
template: reference
status: experimental
related: [components/color-field, components/color-picker, components/color-swatch]
---

`ColorInputGroup` — The styled input shell, prefix and suffix used by ColorField.

## Usage

```tsx
import { ColorInputGroup } from "@rivetjs/ui/color-input-group";
```

::example{id=color-field-basic}

## Anatomy

Place Input inside the root and add Prefix or Suffix as needed. ColorField exposes the same parts as Group, Input, Prefix and Suffix; the live example uses those aliases.

Public parts: `ColorInputGroup.Root`, `ColorInputGroup.Input`, `ColorInputGroup.Prefix`, `ColorInputGroup.Suffix`.

## Styling Reference

The component emits these `data-slot` values across its parts: `color-input-group`, `color-input-group-prefix`, `color-input-group-input`, `color-input-group-suffix`.

Base and part classes: `color-input-group`, `color-input-group__input`, `color-input-group__prefix`, `color-input-group__suffix`.

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

Compose the group inside ColorField, which provides the label, validation and color value. The group and its input alone do not create a color-field state. Keep the field label and textual value available alongside any swatch.

## Related Components

- [ColorField](/components/color-field/)
- [ColorPicker](/components/color-picker/)
- [ColorSwatch](/components/color-swatch/)
