---
title: TimePicker
description: "A TimeField with a popover of looped wheel drums for hours, minutes, seconds and AM / PM; the drums and the segments edit the same value."
template: reference
status: experimental
related: [components/time-field, components/date-input-group, components/popover, components/date-picker]
---

`TimePicker` is a [TimeField](/components/time-field/) with a trigger that opens a popover of iOS-style wheel drums. Users can type the time into the segments, or open the popover and drag, flick, scroll or key through looped hour and minute drums (seconds with `granularity="second"`, an AM / PM drum when the locale uses a 12-hour clock). Both edit the same value. Use it where touch input matters or the time is picked from a small set of steps; use a plain TimeField where typing is enough. The drums are the [cdk TimeWheels](site:cdk/components/wheel-picker/); the root takes every TimeField prop.

## Usage

```tsx
import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";
import { TimePicker } from "@rivetjs/ui/time-picker";

const time = signal<string | null>("07:30:00");

<TimePicker value={time}>
  <Label>Alarm</Label>
  <TimeField.Group>
    <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
    <TimeField.Suffix>
      <TimePicker.Trigger aria-label="Choose time">
        <TimePicker.TriggerIndicator />
      </TimePicker.Trigger>
    </TimeField.Suffix>
  </TimeField.Group>
  <TimePicker.Popover>{() => <TimePicker.Wheels />}</TimePicker.Popover>
</TimePicker>;
```

::example{id=time-picker-basic}

## Anatomy

| Part | Element | Notes |
| --- | --- | --- |
| `TimePicker` (`.Root`) | TimeField root | `.time-picker`; holds the time value and the open state (`isOpen`, `defaultOpen`, `onOpenChange`). |
| `TimeField.Group` / `.Input` / `.Segment` / `.Suffix` | [DateInputGroup](/components/date-input-group/) parts | The segmented time input. |
| `TimePicker.Trigger` | `button` | `.time-picker__trigger`; toggles the popover, disabled with a disabled or read-only field. Needs an `aria-label`. |
| `TimePicker.TriggerIndicator` | `span` | `.time-picker__trigger-indicator`; default icon lucide `Clock`. |
| `TimePicker.Popover` | `div role="dialog"` on the overlay layer | `.time-picker__popover`; `placement="bottom end"` by default. No children = the default Wheels. |
| `TimePicker.Wheels` | drums, each `role="spinbutton"` | `.time-picker__wheels` / `__wheel` / `__item`; `autoFocus` by default. |

## Examples

### Value

`value` takes a two-way Signal of the time string (such as `"07:30:00"`) or `null`; `defaultValue` an initial value. The segments and the drums update together.

### Options

The drums follow the field: the locale's hour cycle and digits, `granularity`, and `minValue` / `maxValue` (rows outside the range are disabled and skipped; a value that lands outside is clamped). `minuteStep` and `secondStep` on `TimePicker.Wheels` space the rows. Below: `de-DE` 24-hour time (no AM / PM drum), seconds, 5-minute and 15-second steps, 08:00 to 18:00.

::example{id=time-picker-options}

### Controlled open state

`isOpen` (a value, a Signal or an accessor) with `onOpenChange`, or `defaultOpen`, controls the popover from outside, for example to open it from another button.

### Popover content

Pass the popover content as a render function (`{() => <TimePicker.Wheels />}`): nothing inside it renders before the popover first opens. Add your own content next to the Wheels (a "Now" button, a hint) in the same function.

## Styling Reference

| Class | Part |
| --- | --- |
| `.time-picker` | Root. |
| `.time-picker__trigger`, `.time-picker__trigger-indicator` | Trigger and its icon. |
| `.time-picker__popover` | Popover. |
| `.time-picker__wheels`, `.time-picker__wheel`, `.time-picker__item` | Drum container, one drum, one row (`TimePicker.Wheels` `class` / `wheelClass` / `itemClass`). |

The input shell is styled as a [DateInputGroup](/components/date-input-group/#styling-reference).

## API Reference

The root accepts [TimeField props](/components/time-field/#api-reference) plus:

| Prop           | Type                                            | Default      |
| -------------- | ----------------------------------------------- | ------------ |
| `isOpen`       | `boolean \| Signal<boolean> \| (() => boolean)` | uncontrolled |
| `defaultOpen`  | `boolean`                                       | `false`      |
| `onOpenChange` | `(isOpen: boolean) => void`                     | unset        |

Trigger accepts Button props; TriggerIndicator accepts children, class and a render function. Popover accepts the cdk Popover props and defaults to `placement="bottom end"`; omitted children render Wheels. Wheels accepts the cdk TimeWheels props (`minuteStep`, `secondStep`, `loop` default `true`, `visibleItems` default 5, `aria-label`) and defaults to `autoFocus={true}`.

## Accessibility

- The segments are labelled by the field's `Label`; name the trigger (`aria-label="Choose time"`), since it shows only an icon.
- The popover is a dialog; when it opens, the first drum gets the focus, and :kbd[Escape] closes it and returns the focus to the trigger.
- On a focused drum: :kbd[ArrowUp] / :kbd[ArrowDown] step (wrapping), :kbd[PageUp] / :kbd[PageDown] jump 2 hours or 15 minutes, :kbd[Home] / :kbd[End] go to the first / last allowed row, digits and A / P type ahead, :kbd[Tab] moves to the next drum.
- With reduced motion, the drums jump to the new row instead of animating.

## Common mistakes

- **A trigger without a name.** The indicator is an icon; the button needs `aria-label`.
- **Popover children as plain JSX.** Plain children are built with the page; a render function defers them until the popover opens.
- **A Date or Time object as the value.** The value is a time string (or a Signal of one), so it can be written into the page and resumed.

## Related Components

- [TimeField](/components/time-field/)
- [DateInputGroup](/components/date-input-group/)
- [Popover](/components/popover/)
- [DatePicker](/components/date-picker/)
