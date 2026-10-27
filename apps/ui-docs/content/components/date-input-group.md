---
title: DateInputGroup
description: "The styled input shell and editable segments shared by date and time fields."
template: reference
status: experimental
related: [components/date-field, components/time-field, components/date-picker]
---

`DateInputGroup` — The styled input shell and editable segments shared by date and time fields.

## Usage

```tsx
import { DateInputGroup } from "@rivetjs/ui/date-input-group";
```

::example{id=date-field-basic}

## Anatomy

Compose Root with Input; render each segment with `Segment` inside Input’s function child. Prefix, Suffix and InputContainer arrange surrounding content. DateField and TimeField expose these same parts as Group, Input, Segment, Prefix and Suffix.

Public parts: `DateInputGroup.Root`, `DateInputGroup.Input`, `DateInputGroup.InputContainer`, `DateInputGroup.Segment`, `DateInputGroup.Prefix`, `DateInputGroup.Suffix`.

## Styling Reference

The component emits these `data-slot` values across its parts: `date-input-group`, `date-input-group-prefix`, `date-input-group-input`, `date-input-group-segment`, `date-input-group-input-container`, `date-input-group-suffix`.

Base and part classes: `date-input-group`, `date-input-group__input`, `date-input-group__input-container`, `date-input-group__prefix`, `date-input-group__segment`, `date-input-group__suffix`.

## API Reference

See the [full module API](/api/rivetjs/ui/date-input-group/) for every named export and part prop type.

| Prop        | Values                 | Default   |
| ----------- | ---------------------- | --------- |
| `fullWidth` | `false`, `true`        | `false`   |
| `variant`   | `primary`, `secondary` | `primary` |

::api{symbol="@rivetjs/ui/date-input-group#DateInputGroupInputContainerProps"}

::api{symbol="@rivetjs/ui/date-input-group#DateInputGroupInputProps"}

::api{symbol="@rivetjs/ui/date-input-group#DateInputGroupPrefixProps"}

::api{symbol="@rivetjs/ui/date-input-group#DateInputGroupRootProps"}

::api{symbol="@rivetjs/ui/date-input-group#DateInputGroupSegmentProps"}

::api{symbol="@rivetjs/ui/date-input-group#DateInputGroupSuffixProps"}

## Accessibility

The owning DateField or TimeField provides the label, validation and segment state. Keep Input and Segment inside that field, and use its Label. The group alone does not create a date value or a standalone date editor.

## Related Components

- [DateField](/components/date-field/)
- [TimeField](/components/time-field/)
- [DatePicker](/components/date-picker/)
