---
title: Calendar
description: "Composable date picker with month grid, navigation, and year picker support built on React Aria Calendar"
template: reference
status: experimental
related: [components/range-calendar, components/popover]
---

`Calendar` lets users pick a date from a month grid. The root is the [cdk Calendar](site:cdk/components/calendar/) (React Aria `Calendar`): heading, previous / next buttons, a grid of `Calendar.Cell`s, plus the optional year picker parts (`Calendar.YearPickerTrigger`, `Calendar.YearPickerGrid`, also exported as `CalendarYearPicker`).

Notes:

- `class`, not `className`. Dates come from `@rivetjs/cdk/date` (the `@internationalized/date` port); `I18nProvider` from `@rivetjs/cdk/i18n-provider`, `useLocale` from `@rivetjs/cdk/i18n`.
- Controlled `value` / `focusedValue` / `isYearPickerOpen` take a two-way signal; dates in a signal are their string form (`"2025-12-25"`, multiple selection: an array of strings). Uncontrolled props (`defaultValue`, `minValue`, …) take date objects or strings; they reach the cdk calendar as strings so the page resumes.
- `visibleDuration` and the bounds are read once (as React Aria's memoized state): re-create the calendar to change them (Week View / Day View demos use `<Show keyed>`).
- Cell render props are accessors (`({ isUnavailable }) => isUnavailable()`; `formattedDate` is a string). A reactive child inside a cell is captured for resume: read plain values from the date first (Real-World Example).
- Navigation icons are lucide `ChevronLeft` / `ChevronRight`.
- The Week View / Day View demos hold the Select value in a two-way key signal (`signal<Key | null>("1")`) and re-create the calendar per count with `<Show keyed>`.

Accessibility: the root is `role="application"` labelled by `aria-label` + the visible month; the grid is a `role="grid"` with roving focus (arrow keys, Page Up / Down, Home / End). The year picker trigger has `aria-expanded`; its grid takes arrow keys, Home / End, Enter and Escape.

## Usage

```tsx
import { Calendar } from "@rivetjs/ui/calendar";
```

::example{id=calendar-basic}

## Anatomy

```tsx
import { Calendar } from "@rivetjs/ui/calendar";

export default () => (
  <Calendar aria-label="Event date">
    <Calendar.Header>
      <Calendar.Heading />
      <Calendar.NavButton slot="previous" />
      <Calendar.NavButton slot="next" />
    </Calendar.Header>
    <Calendar.Grid>
      <Calendar.GridHeader>
        {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
      </Calendar.GridHeader>
      <Calendar.GridBody>
        {(date) => <Calendar.Cell date={date} />}
      </Calendar.GridBody>
    </Calendar.Grid>
  </Calendar>
)
```

The month and year text comes from `Calendar.Heading` (with the year picker, from `Calendar.YearPickerTrigger`, which shows it as a button). A `Calendar.Header` with only the two `NavButton`s shows arrows and no title.

## Examples

### Disabled

::example{id=calendar-disabled}

### Read Only

::example{id=calendar-read-only}

### Default Value

::example{id=calendar-default-value}

### Year Picker

`Calendar.YearPickerTrigger`, `Calendar.YearPickerGrid`, and their body/cell subcomponents provide an integrated year navigation pattern.

::example{id=calendar-year-picker}

### Controlled

Use controlled `value` and `focusedValue` for external state coordination and custom shortcuts.

::example{id=calendar-controlled}

### Min and Max Dates

::example{id=calendar-min-max-dates}

### Unavailable Dates

Use `isDateUnavailable` to block dates such as weekends, holidays, or booked slots.

::example{id=calendar-unavailable-dates}

### Weeks in Month

Set `weeksInMonth` to a fixed value (for example, `6`) to keep the grid height stable when navigating between months. Use with care in non-Gregorian locales, similar to `firstDayOfWeek`.

::example{id=calendar-weeks-in-month}

### Week View

Set `visibleDuration={{ weeks: n }}` to show one or more weeks at a time. Navigation advances by the visible week range. Use `pageBehavior="single"` to move one week at a time when showing multiple weeks.

::example{id=calendar-week-view}

### Day View

Set `visibleDuration={{ days: n }}` to show a rolling window of consecutive days. Navigation advances by the visible day range. Use `pageBehavior="single"` to move one day at a time when showing multiple days.

::example{id=calendar-day-view}

### Multiple Selection

Set `selectionMode="multiple"` to let users select several dates. `value`, `defaultValue`, and `onChange` use an array of dates.

::example{id=calendar-multiple-selection}

### Focused Value

Programmatically control which date is focused using `focusedValue` and `onFocusChange`.

::example{id=calendar-focused-value}

### Cell Indicators

You can customize `Calendar.Cell` children and use `Calendar.CellIndicator` to display metadata like events.

::example{id=calendar-with-indicators}

### Custom Navigation Icons

Pass children to `Calendar.NavButton` to replace the default chevron icons.

::example{id=calendar-custom-icons}

### Multiple Months

Render multiple grids with `visibleDuration` and `offset` for booking and planning experiences.

::example{id=calendar-multiple-months}

### Real-World Example

::example{id=calendar-booking-calendar}

### International Calendars

By default, Calendar displays dates using the calendar system for the user's locale. You can override this by wrapping your Calendar with `I18nProvider` and setting the [Unicode calendar locale extension](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/calendar#adding_a_calendar_in_the_locale_string).

The example below shows the Indian calendar system:

::example{id=calendar-international-calendar}

**Note:** The `onChange` event always returns a date in the same calendar system as the `value` or `defaultValue` (Gregorian if no value is provided), regardless of the displayed locale. This ensures your application logic works consistently with a single calendar system while still displaying dates in the user's preferred format.

## Customization

### Tailwind CSS

::example{id=calendar-custom-styles}

### Global CSS

```css
@layer components {
  .calendar {
    @apply w-72 rounded-2xl border border-border bg-surface p-3 shadow-sm;
  }

  .calendar__heading {
    @apply text-sm font-semibold text-default-700;
  }

  .calendar__cell[data-selected="true"] {
    @apply bg-accent text-accent-foreground;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

Calendar uses these classes in `packages/styles/components/calendar.css` and `packages/styles/components/calendar-year-picker.css`:

- `.calendar` - Root container.
- `.calendar__header` - Header row containing nav buttons and heading.
- `.calendar__heading` - Current month label.
- `.calendar__nav-button` - Previous/next navigation controls.
- `.calendar__grid` - Main day grid.
- `.calendar__grid-header` - Weekday header row wrapper.
- `.calendar__grid-body` - Date rows wrapper.
- `.calendar__header-cell` - Weekday header cell.
- `.calendar__cell` - Interactive day cell.
- `.calendar__cell-indicator` - Dot indicator inside a day cell.
- `.calendar-year-picker__trigger` - Year picker toggle button.
- `.calendar-year-picker__trigger-heading` - Heading text inside year picker trigger.
- `.calendar-year-picker__trigger-indicator` - Indicator icon inside year picker trigger.
- `.calendar-year-picker__year-grid` - Overlay grid of selectable years.
- `.calendar-year-picker__year-cell` - Individual year option.

### Interactive States

Calendar supports both pseudo-classes and React Aria data attributes:

- **Selected**: `[data-selected="true"]`
- **Today**: `[data-today="true"]`
- **Unavailable**: `[data-unavailable="true"]`
- **Outside month**: `[data-outside-month="true"]`
- **Hovered**: `:hover` or `[data-hovered="true"]`
- **Pressed**: `:active` or `[data-pressed="true"]`
- **Focus visible**: `:focus-visible` or `[data-focus-visible="true"]`
- **Disabled**: `:disabled` or `[data-disabled="true"]`

## API Reference

### Calendar

Calendar inherits all props from the [cdk Calendar](site:cdk/components/calendar/) (React Aria `Calendar`).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selectionMode` | `'single' \| 'multiple'` | `'single'` | Whether one or many dates can be selected. |
| `value` | `Signal<string \| null>` or `Signal<string[]>` | - | Controlled selected date(s), a two-way signal of the string form (Rivet). Use an array when `selectionMode` is `multiple`. |
| `defaultValue` | `DateValue \| null` or `DateValue[] \| null` | - | Initial selected date(s) (uncontrolled). |
| `onChange` | `(value: DateValue \| null)` or `(value: DateValue[] \| null) => void` | - | Called when selection changes. |
| `focusedValue` | `Signal<string>` | - | Controlled focused date (two-way signal of the string form). |
| `onFocusChange` | `(value: DateValue) => void` | - | Called when focus moves to another date. |
| `minValue` | `DateValue` | Calendar-aware `1900-01-01` | Earliest selectable date. |
| `maxValue` | `DateValue` | Calendar-aware `2099-12-31` | Latest selectable date. |
| `weeksInMonth` | `number` | - | The number of weeks in a month. This overrides the default set by the locale. |
| `isDateUnavailable` | `(date: DateValue) => boolean` | - | Marks dates as unavailable. |
| `firstDayOfWeek` | `'sun' \| 'mon' \| 'tue' \| 'wed' \| 'thu' \| 'fri' \| 'sat'` | - | Overrides the locale default for the first day of the week. |
| `pageBehavior` | `'visible' \| 'single'` | `'visible'` | Whether paging advances by the visible duration or one unit at a time. |
| `selectionAlignment` | `'start' \| 'center' \| 'end'` | `'center'` | Aligns the visible range to the selection on initial render. |
| `isDisabled` | `() => boolean` | `false` | Disables interaction and selection. |
| `isReadOnly` | `boolean` | `false` | Keeps content readable but prevents selection changes. |
| `isInvalid` | `boolean` | `false` | Marks the calendar as invalid for validation UI. |
| `visibleDuration` | `{months?: number; weeks?: number; days?: number}` | `{months: 1}` | Visible time range. Use `{ months: n }` for month view, `{ weeks: n }` for week view, or `{ days: n }` for day view. |
| `defaultYearPickerOpen` | `boolean` | `false` | Initial open state of internal year picker. |
| `isYearPickerOpen` | `boolean \| Signal<boolean>` | - | Controlled year picker open state (a signal is two-way). |
| `onYearPickerOpenChange` | `(isOpen: boolean) => void` | - | Called when year picker open state changes. |

### Composition Parts

| Component | Description |
|-----------|-------------|
| `Calendar.Header` | Header container for navigation and heading. |
| `Calendar.Heading` | Formatted heading for the visible range. Supports `offset` (for multi-month layouts) and `format` (month/year/day options). |
| `Calendar.NavButton` | Previous/next navigation control (`slot=\"previous\"` or `slot=\"next\"`). |
| `Calendar.Grid` | Day grid for one month (`offset` supported for multi-month layouts). |
| `Calendar.GridHeader` | Weekday header container. |
| `Calendar.GridBody` | Date cell body container. |
| `Calendar.HeaderCell` | Weekday label cell. |
| `Calendar.Cell` | Individual date cell. |
| `Calendar.CellIndicator` | Optional indicator element for custom metadata. |
| `Calendar.YearPickerTrigger` | Trigger to toggle year-picker mode. |
| `Calendar.YearPickerTriggerHeading` | Localized heading content inside the year-picker trigger. |
| `Calendar.YearPickerTriggerIndicator` | Toggle icon inside the year-picker trigger. |
| `Calendar.YearPickerGrid` | Overlay year selection grid container. |
| `Calendar.YearPickerGridBody` | Body renderer for year grid cells. |
| `Calendar.YearPickerCell` | Individual year option cell. |

### Year Picker Parts

Year picker subcomponents inherit formatting props from React Aria [`useCalendarHeading`](https://react-aria.adobe.com/useCalendar#usecalendarheading) and [`useCalendarYearPicker`](https://react-aria.adobe.com/useCalendar#usecalendaryearpicker).

| Component | Prop | Type | Default | Description |
|-----------|------|------|---------|-------------|
| `Calendar.YearPickerTriggerHeading` | `format` | `DateFormatterOptions` | - | Customize month/year label (e.g. `{month: 'short'}`). |
| `Calendar.YearPickerTriggerHeading` | `offset` | `{months?: number}` | - | Shift the heading relative to the focused date (multi-month layouts). |
| `Calendar.YearPickerGrid` | `format` | `DateFormatterOptions` | `{year: 'numeric'}` | Customize year cell labels (era, calendar system, etc.). |
| `Calendar.YearPickerGrid` | `visibleYears` | `number` | min–max span or `20` | Number of years shown in the sliding window. Defaults to the full range between `minValue` and `maxValue` when both are set. |

### Calendar.Cell Render Props

When `Calendar.Cell` children is a function, the cdk render props are available (accessors: call them, e.g. `isSelected()`):

| Prop | Type | Description |
|------|------|-------------|
| `formattedDate` | `string` | Localized day label for the cell. |
| `isSelected` | `() => boolean` | Whether the date is selected. |
| `isUnavailable` | `() => boolean` | Whether the date is unavailable. |
| `isDisabled` | `() => boolean` | Whether the cell is disabled. |
| `isOutsideMonth` | `() => boolean` | Whether the date belongs to adjacent month. |

For a complete list of supported calendar systems and their identifiers, see:
- [React Aria Calendar Implementations](https://react-aria.adobe.com/internationalized/date/Calendar#implementations)
- [React Aria International Calendars](https://react-aria.adobe.com/Calendar#international-calendars)

### Related packages
- `@rivetjs/cdk/date` (port of [`@internationalized/date`](https://react-aria.adobe.com/internationalized/date/)) — date types (`CalendarDate`, `CalendarDateTime`, `ZonedDateTime`) and utilities used by all date components
- `I18nProvider` (`@rivetjs/cdk/i18n-provider`) — override locale for a subtree
- `useLocale` (`@rivetjs/cdk/i18n`) — read the current locale and layout direction

::api{symbol="@rivetjs/ui/calendar#Calendar"}

## Related Components

- [RangeCalendar](/components/range-calendar/): Interactive month grid for selecting date ranges.
- [DateField](/components/date-field/): Date input field with labels, descriptions, and validation.
- [DatePicker](/components/date-picker/): Composable date picker with date field trigger and calendar popover.
- [TimeField](/components/time-field/): Time input field with labels, descriptions, and validation.
- [InputGroup](/components/input-group/): Group related input controls with prefix and suffix elements.
- [Form](/components/form/): Form validation and submission handling.
