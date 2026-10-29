---
title: DateInputGroup
description: "The input shell of DateField, TimeField and the pickers: a bordered group with editable segments, an input container and prefix / suffix slots."
template: reference
status: experimental
related: [components/date-field, components/time-field, components/date-picker]
---

`DateInputGroup` is the styled shell of every segmented date or time input in Rivet UI: [DateField](/components/date-field/), [TimeField](/components/time-field/), [DatePicker](/components/date-picker/), [DateRangePicker](/components/date-range-picker/) and [TimePicker](/components/time-picker/). It draws the border and the field states, holds the editable segments (month, day, year, hour…), and has prefix and suffix slots for an icon, a unit or a picker trigger. Those components re-export its parts (`DateField.Group`, `.Input`, `.Segment`, `.Prefix`, `.Suffix`, `.InputContainer`). The group keeps no date state: place it inside a DateField or a TimeField, whose state its `Input` reads.

## Usage

```tsx
import { DateField } from "@rivetjs/ui/date-field";
import { DateInputGroup } from "@rivetjs/ui/date-input-group";
import { Label } from "@rivetjs/ui/label";

<DateField name="day">
  <Label>Delivery day</Label>
  <DateInputGroup>
    <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
  </DateInputGroup>
</DateField>;
```

::example{id=date-input-group-parts}

## Anatomy

```tsx
<DateInputGroup>
  <DateInputGroup.Prefix />
  <DateInputGroup.InputContainer>
    <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
  </DateInputGroup.InputContainer>
  <DateInputGroup.Suffix />
</DateInputGroup>
```

| Part | Element | Notes |
| --- | --- | --- |
| `DateInputGroup` (`.Root`) | `div role="presentation"` (cdk Group) | `data-slot="date-input-group"`; field state as `data-*` attributes. |
| `DateInputGroup.Input` | `div` (cdk DateInput) | `data-slot="date-input-group-input"`; its function child renders one `Segment` per date part of the locale's format. |
| `DateInputGroup.Segment` | `span role="spinbutton"` (literal separators: `aria-hidden`) | `data-slot="date-input-group-segment"`, `data-type` (`month`, `day`, `year`, `hour`, `literal`…), `data-placeholder` while empty. |
| `DateInputGroup.InputContainer` | `div` | Holds two inputs side by side (start and end of a range) with a separator. |
| `DateInputGroup.Prefix`, `.Suffix` | `div` | Content before / after the segments. |

## Examples

### In a DateField and a TimeField

The example uses the same parts in both fields: in the DateField, a calendar icon in the prefix and a text in the suffix, with the value as a two-way Signal of an ISO date string (`"2026-03-14"`); :kbd[ArrowUp] on the day segment moves it to the 15th. In the TimeField, `variant="secondary"` with `fullWidth`.

### Ranges

For a date range, put two inputs (`slot="start"` and `slot="end"`) in `DateInputGroup.InputContainer`, with the picker's range separator between them. See [DateRangePicker](/components/date-range-picker/).

### Variants

`variant="primary"` (default) for fields on the page background, `variant="secondary"` (no shadow) for fields inside a Surface or a card; `fullWidth` stretches the group to its container.

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.date-input-group`, `--primary`, `--secondary`, `--full-width` | Root and its variants. |
| `.date-input-group__input`, `__input-container`, `__segment`, `__prefix`, `__suffix` | Parts. |
| `[data-type]`, `[data-placeholder]`, `[data-invalid]`, `[data-disabled]`, `[data-readonly]` | Segment state. |
| `[data-focus-within]`, `[data-hovered]`, `[data-invalid]`, `[data-disabled]` | Root state. |

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

- Each editable segment is a `spinbutton` named by the segment name (such as "month") followed by the field label; the field's `Label`, description and error message come from the DateField or TimeField.
- :kbd[ArrowUp] / :kbd[ArrowDown] change the focused segment, digits type into it, :kbd[ArrowLeft] / :kbd[ArrowRight] (or typing a full segment) move to the next one, :kbd[Backspace] clears it.
- Icons in the prefix and suffix are decorative; a picker trigger placed there must have an accessible name.

## Common mistakes

- **Rendering segments yourself.** Always render them from the `Input` function child: the locale decides their order and separators.
- **A group outside a DateField or TimeField.** `DateInputGroup.Input` reads that field's state; on its own there is no value to edit.

## Related Components

- [DateField](/components/date-field/)
- [TimeField](/components/time-field/)
- [DatePicker](/components/date-picker/)
