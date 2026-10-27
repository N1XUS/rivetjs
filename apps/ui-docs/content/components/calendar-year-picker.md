---
title: CalendarYearPicker
description: "Composable year-selection controls for Calendar and RangeCalendar."
template: reference
status: experimental
related: [components/calendar, components/range-calendar, components/date-picker]
---

`CalendarYearPicker` — Composable year-selection controls for Calendar and RangeCalendar.

## Usage

```tsx
import { CalendarYearPicker } from "@rivetjs/ui/calendar-year-picker";
```

::example{id=calendar-year-picker}

## Anatomy

This export is a parts object, not a JSX root. Compose Trigger with TriggerHeading and TriggerIndicator, then Grid with GridBody and Cell inside Calendar or RangeCalendar. Those calendar components expose aliases prefixed with YearPicker.

Public parts: `CalendarYearPicker.Trigger`, `CalendarYearPicker.TriggerHeading`, `CalendarYearPicker.TriggerIndicator`, `CalendarYearPicker.Grid`, `CalendarYearPicker.GridBody`, `CalendarYearPicker.Cell`.

## Styling Reference

The component emits these `data-slot` values across its parts: `calendar-year-picker-trigger`, `calendar-year-picker-trigger-heading`, `calendar-year-picker-trigger-indicator`, `calendar-year-picker-grid`, `calendar-year-picker-year-cell`.

Base and part classes: `calendar-year-picker__trigger`, `calendar-year-picker__trigger-heading`, `calendar-year-picker__trigger-indicator`, `calendar-year-picker__year-cell`, `calendar-year-picker__year-grid`.

## API Reference

See the [full module API](/api/rivetjs/ui/calendar-year-picker/) for every named export and part prop type.

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerCellProps"}

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerGridBodyProps"}

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerGridProps"}

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerTriggerHeadingProps"}

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerTriggerIndicatorProps"}

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerTriggerProps"}

## Accessibility

The trigger reports expanded state and names the year selector. The year list uses `role="listbox"`; year cells expose selection and keyboard focus. The implementation moves focus between the day and year views. These parts require Calendar or RangeCalendar context.

## Related Components

- [Calendar](/components/calendar/)
- [RangeCalendar](/components/range-calendar/)
- [DatePicker](/components/date-picker/)
