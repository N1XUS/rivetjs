---
title: CalendarYearPicker
description: "Year selection for Calendar and RangeCalendar: a heading button that opens a 3-column grid of years over the day grid."
template: reference
status: experimental
related: [components/calendar, components/range-calendar, components/date-picker]
---

`CalendarYearPicker` adds a quick year jump to a [Calendar](/components/calendar/) or a [RangeCalendar](/components/range-calendar/). The month heading becomes a button; pressing it lays a grid of years over the day grid, and choosing a year moves the calendar to that year and closes the grid. Use it when dates are often far from today, such as birth dates or archive searches. It is a parts object (no root component) that only works inside a calendar: Calendar and RangeCalendar expose the same parts as `YearPickerTrigger`, `YearPickerTriggerHeading`, `YearPickerTriggerIndicator`, `YearPickerGrid`, `YearPickerGridBody` and `YearPickerCell`.

## Usage

```tsx
import { Calendar } from "@rivetjs/ui/calendar";

<Calendar aria-label="Event date">
  <Calendar.Header>
    <Calendar.YearPickerTrigger>
      <Calendar.YearPickerTriggerHeading />
      <Calendar.YearPickerTriggerIndicator />
    </Calendar.YearPickerTrigger>
    <Calendar.NavButton slot="previous" />
    <Calendar.NavButton slot="next" />
  </Calendar.Header>
  <Calendar.Grid>{/* day grid */}</Calendar.Grid>
  <Calendar.YearPickerGrid>
    <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
  </Calendar.YearPickerGrid>
</Calendar>;
```

::example{id=calendar-year-picker}

## Anatomy

| Part | Calendar alias | Element | Notes |
| --- | --- | --- | --- |
| `CalendarYearPicker.Trigger` | `YearPickerTrigger` | `button` | Replaces the plain heading; `aria-expanded` follows the grid. Children: content or a function of `{ isOpen, monthYear, toggle }`. |
| `CalendarYearPicker.TriggerHeading` | `YearPickerTriggerHeading` | `span` | The month and year (`format`, `offset` like the calendar heading). |
| `CalendarYearPicker.TriggerIndicator` | `YearPickerTriggerIndicator` | `span` | Chevron (lucide `ChevronRight`). |
| `CalendarYearPicker.Grid` | `YearPickerGrid` | `div role="listbox"` | Laid over the day grid; `data-open` while visible. `visibleYears`, `format`. |
| `CalendarYearPicker.GridBody` | `YearPickerGridBody` | — | Renders one cell per year (a keyed list) from its function child. |
| `CalendarYearPicker.Cell` | `YearPickerCell` | `button` | One year; `aria-selected` / `data-selected` on the shown year. |

## Examples

### Calendar

The example above: the trigger opens the grid with the shown year selected and focused; :kbd[Escape] closes it again.

### RangeCalendar

The same parts work in a RangeCalendar; the chosen year moves the visible months.

::example{id=range-calendar-year-picker}

### Open state

`isYearPickerOpen` (a boolean or a two-way Signal), `defaultYearPickerOpen` and `onYearPickerOpenChange` on the Calendar or RangeCalendar control the grid from outside.

### Year range

The grid shows the years between the calendar's `minValue` and `maxValue`; without both bounds it shows 20 years. `visibleYears` on the grid sets the count, and `format` (`{ year: "2-digit", era: "short" }`) the year label.

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.calendar-year-picker__trigger`, `__trigger-heading`, `__trigger-indicator` | Trigger, heading and chevron. |
| `.calendar-year-picker__year-grid` | Grid (`data-slot="calendar-year-picker-grid"`, `[data-open="true"]` while visible). |
| `.calendar-year-picker__year-cell` | Year (`data-slot="calendar-year-picker-year-cell"`, `[data-selected]`). |

## API Reference

See the [full module API](/api/rivetjs/ui/calendar-year-picker/) for every named export and part prop type.

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerCellProps"}

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerGridBodyProps"}

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerGridProps"}

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerTriggerHeadingProps"}

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerTriggerIndicatorProps"}

::api{symbol="@rivetjs/ui/calendar-year-picker#CalendarYearPickerTriggerProps"}

## Accessibility

- The trigger is a button with `aria-expanded`; the year grid is a `listbox` of year buttons with `aria-selected` on the shown year.
- While the grid is open, only it takes the focus: :kbd[ArrowLeft] / :kbd[ArrowRight] move one year, :kbd[ArrowUp] / :kbd[ArrowDown] one row (3 years), :kbd[Home] / :kbd[End] go to the first / last year, :kbd[Enter] / :kbd[Space] choose, :kbd[Escape] closes the grid and keeps the calendar where it was.
- Choosing a year closes the grid and returns to the day grid of that year.

## Common mistakes

- **Using the parts outside a calendar.** They read the Calendar or RangeCalendar state; on their own they render nothing useful.
- **Keeping a plain heading next to the trigger.** Use `YearPickerTriggerHeading` instead of `Calendar.Heading`; showing both repeats the month.
- **Expecting every year.** Without `minValue` / `maxValue`, the grid lists 20 years; set the bounds (or `visibleYears`) for a wider range.

## Related Components

- [Calendar](/components/calendar/)
- [RangeCalendar](/components/range-calendar/)
- [DatePicker](/components/date-picker/)
