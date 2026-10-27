---
title: TimePicker
description: "A segmented time field with a popover of wheel controls."
template: reference
status: experimental
related: [components/time-field, components/date-input-group, components/popover]
---

`TimePicker` — A segmented time field with a popover of wheel controls.

## Usage

```tsx
import { TimePicker } from "@rivetjs/ui/time-picker";
```

::example{id=time-picker-basic}

## Anatomy

Compose TimePicker with Label and TimeField.Group/Input/Segment. Put TimePicker.Trigger and TriggerIndicator in TimeField.Suffix, then render Popover with Wheels. The root inherits TimeField props; use a render-function child for the popover content.

Public parts: `TimePicker.Root`, `TimePicker.Trigger`, `TimePicker.TriggerIndicator`, `TimePicker.Popover`, `TimePicker.Wheels`.

## Styling Reference

The component emits these `data-slot` values across its parts: `time-picker`, `time-picker-trigger`, `time-picker-trigger-indicator`, `time-picker-popover`.

Base and part classes: `time-picker`, `time-picker__item`, `time-picker__popover`, `time-picker__trigger`, `time-picker__trigger-indicator`, `time-picker__wheel`, `time-picker__wheels`.

## API Reference

The root accepts [TimeField props](/components/time-field/#api-reference) plus:

| Prop           | Type                                            | Default      |
| -------------- | ----------------------------------------------- | ------------ |
| `isOpen`       | `boolean \| Signal<boolean> \| (() => boolean)` | uncontrolled |
| `defaultOpen`  | `boolean`                                       | `false`      |
| `onOpenChange` | `(isOpen: boolean) => void`                     | unset        |

Trigger accepts Button props; TriggerIndicator accepts children, class and a render function. Popover accepts the cdk Popover props and defaults to `placement="bottom end"`; omitted children render Wheels. Wheels accepts the cdk TimeWheels props and defaults to `autoFocus={true}`. See [Time Picker Options](/components/time-field/#time-picker-options) for wheel steps and ranges.

## Accessibility

The TimeField supplies labelled segments. Name the trigger and wheel group, and keep the label associated with the field. The popover renders a dialog; wheel controls support keyboard interaction and Escape closes the overlay. Wheels autofocus by default.

## Related Components

- [TimeField](/components/time-field/)
- [DateInputGroup](/components/date-input-group/)
- [Popover](/components/popover/)
