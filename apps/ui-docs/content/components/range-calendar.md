---
title: RangeCalendar
description: "Composable date range picker with month grid, navigation, and year picker support built on React Aria RangeCalendar"
template: reference
status: experimental
related: [components/calendar]
---

`RangeCalendar` lets users pick a contiguous date range from a month grid. The root is the [cdk RangeCalendar](site:cdk/components/range-calendar/) (React Aria `RangeCalendar`): heading, previous / next buttons, a grid of `RangeCalendar.Cell`s (each wraps its label in a `range-calendar__cell-button`), plus the year picker parts shared with [Calendar](calendar.md).

Notes:

- `class`, not `className`. Dates come from `@rivetjs/cdk/date` (the `@internationalized/date` port); `I18nProvider` from `@rivetjs/cdk/i18n-provider`, `useLocale` from `@rivetjs/cdk/i18n`.
- Controlled `value` / `focusedValue` / `isYearPickerOpen` take a two-way signal; dates in a signal are their string form (a range: `{ start: "2025-12-20", end: "2025-12-31" }`). Uncontrolled props (`defaultValue`, `minValue`, …) take date objects or strings; they reach the cdk calendar as strings so the page resumes.
- `visibleDuration` and the bounds are read once (as React Aria's memoized state): re-create the calendar to change them (Week View / Day View demos use `<Show keyed>`; upstream a `key`). `isInvalid` follows the prop (`isInvalid={isInvalid()}` in the Invalid demo: calendar and message follow the range).
- Cell render props are accessors (`({ isUnavailable }) => isUnavailable()`; `formattedDate` is a string). A reactive child inside a cell is captured for resume: read plain values from the date first (Real-World Example).
- Navigation icons are lucide `ChevronLeft` / `ChevronRight`.
- The Week View / Day View demos hold the Select value in a two-way key signal (`signal<Key | null>("1")`) and re-create the calendar per count with `<Show keyed>`.

## Usage

```tsx
import { RangeCalendar } from "@rivetjs/ui/range-calendar";
```

::example{id=range-calendar-basic}

## Anatomy

```tsx
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export default () => (
  <RangeCalendar aria-label="Trip dates">
    <RangeCalendar.Header>
      <RangeCalendar.Heading />
      <RangeCalendar.NavButton slot="previous" />
      <RangeCalendar.NavButton slot="next" />
    </RangeCalendar.Header>
    <RangeCalendar.Grid>
      <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
      <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
    </RangeCalendar.Grid>
  </RangeCalendar>
);
```

## Examples

### Disabled

::example{id=range-calendar-disabled}

### Year Picker

`RangeCalendar.YearPickerTrigger`, `RangeCalendar.YearPickerGrid`, and their body/cell subcomponents provide an integrated year navigation pattern.

::example{id=range-calendar-year-picker}

### Default Value

::example{id=range-calendar-default-value}

### Controlled

::example{id=range-calendar-controlled}

### Min and Max Dates

::example{id=range-calendar-min-max-dates}

### Unavailable Dates

Use `isDateUnavailable` to block dates such as weekends, holidays, or booked slots.

::example{id=range-calendar-unavailable-dates}

### Anchor-Based Unavailable Dates

When selecting a range, `isDateUnavailable` receives a second argument, `anchorDate`, set to the first selected date. Use it to limit which end dates are valid (for example, within 7 days of the start).

::example{id=range-calendar-anchor-unavailable-dates}

### Weeks in Month

Set `weeksInMonth` to a fixed value (for example, `6`) to keep the grid height stable when navigating between months.

::example{id=range-calendar-weeks-in-month}

### Week View

Set `visibleDuration={{ weeks: n }}` to show one or more weeks at a time. Navigation advances by the visible week range. Use `pageBehavior="single"` to move one week at a time when showing multiple weeks.

::example{id=range-calendar-week-view}

### Day View

Set `visibleDuration={{ days: n }}` to show a rolling window of consecutive days. Navigation advances by the visible day range. Use `pageBehavior="single"` to move one day at a time when showing multiple days.

::example{id=range-calendar-day-view}

### Allows Non-Contiguous Ranges

Enable `allowsNonContiguousRanges` to allow selection across unavailable dates.

::example{id=range-calendar-allows-non-contiguous-ranges}

### Read Only

::example{id=range-calendar-read-only}

### Invalid

::example{id=range-calendar-invalid}

### Focused Value

::example{id=range-calendar-focused-value}

### Cell Indicators

You can customize `RangeCalendar.Cell` children and use `RangeCalendar.CellIndicator` to display metadata like events.

::example{id=range-calendar-with-indicators}

### Real-World Example

::example{id=range-calendar-booking-calendar}

### Multiple Months

Render multiple grids with `visibleDuration` and `offset` for booking and planning experiences.

::example{id=range-calendar-multiple-months}

### International Calendars

By default, RangeCalendar displays dates using the calendar system for the user's locale. You can override this by wrapping your RangeCalendar with `I18nProvider` and setting the [Unicode calendar locale extension](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/calendar#adding_a_calendar_in_the_locale_string).

The example below shows the Indian calendar system:

::example{id=range-calendar-international-calendar}

**Note:** The `onChange` event always returns a date in the same calendar system as the `value` or `defaultValue` (Gregorian if no value is provided), regardless of the displayed locale.

## Customization

### Tailwind CSS

::example{id=range-calendar-custom-styles}

### Global CSS

```css
@layer components {
  .range-calendar {
    @apply w-80 rounded-2xl border border-border bg-surface p-3 shadow-sm;
  }

  .range-calendar__heading {
    @apply text-sm font-semibold text-default;
  }

  .range-calendar__cell[data-selected="true"] .range-calendar__cell-button {
    @apply bg-accent text-accent-foreground;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `range-calendar-header`, `range-calendar-heading`, `range-calendar-nav-button`, `range-calendar-nav-button-icon`, `range-calendar-grid`, `range-calendar-grid-header`, `range-calendar-grid-body`, `range-calendar-header-cell`, `range-calendar-cell`, `range-calendar-cell-button`, `range-calendar-cell-indicator`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

RangeCalendar uses these classes in `packages/styles/components/range-calendar.css` and `packages/styles/components/calendar-year-picker.css`:

- `.range-calendar` - Root container.
- `.range-calendar__header` - Header row containing nav buttons and heading.
- `.range-calendar__heading` - Current month label.
- `.range-calendar__nav-button` - Previous/next navigation controls.
- `.range-calendar__grid` - Main day grid.
- `.range-calendar__grid-header` - Weekday header row wrapper.
- `.range-calendar__grid-body` - Date rows wrapper.
- `.range-calendar__header-cell` - Weekday header cell.
- `.range-calendar__cell` - Interactive day cell wrapper.
- `.range-calendar__cell-button` - Interactive day button inside each cell.
- `.range-calendar__cell-indicator` - Dot indicator inside a day cell.
- `.calendar-year-picker__trigger` - Year picker toggle button.
- `.calendar-year-picker__trigger-heading` - Heading text inside year picker trigger.
- `.calendar-year-picker__trigger-indicator` - Indicator icon inside year picker trigger.
- `.calendar-year-picker__year-grid` - Overlay grid of selectable years.
- `.calendar-year-picker__year-cell` - Individual year option.

### Interactive States

RangeCalendar supports both pseudo-classes and React Aria data attributes:

- **Selected**: `[data-selected="true"]`
- **Selection start**: `[data-selection-start="true"]`
- **Selection end**: `[data-selection-end="true"]`
- **Range middle**: `[data-selection-in-range="true"]`
- **Today**: `[data-today="true"]`
- **Unavailable**: `[data-unavailable="true"]`
- **Outside month**: `[data-outside-month="true"]`
- **Hovered**: `:hover` or `[data-hovered="true"]`
- **Pressed**: `:active` or `[data-pressed="true"]`
- **Focus visible**: `:focus-visible` or `[data-focus-visible="true"]`
- **Disabled**: `:disabled` or `[data-disabled="true"]`

## API Reference

See the [full module API](/api/rivetjs/ui/range-calendar/) for every named export and part prop type.

### RangeCalendar

RangeCalendar inherits all props from the [cdk RangeCalendar](site:cdk/components/range-calendar/) (React Aria `RangeCalendar`).

| Prop                        | Type                                                             | Default                     | Description                                                                                                                |
| --------------------------- | ---------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `value`                     | `Signal<{ start: string; end: string } \| null>`                 | -                           | Controlled selected range, a two-way signal of the string forms (Rivet).                                                   |
| `defaultValue`              | `RangeValue<DateValue> \| null`                                  | -                           | Initial selected range (uncontrolled).                                                                                     |
| `onChange`                  | `(value: RangeValue<DateValue>) => void`                         | -                           | Called when selection changes.                                                                                             |
| `focusedValue`              | `Signal<string>`                                                 | -                           | Controlled focused date (two-way signal of the string form).                                                               |
| `onFocusChange`             | `(value: DateValue) => void`                                     | -                           | Called when focus moves to another date.                                                                                   |
| `minValue`                  | `DateValue`                                                      | Calendar-aware `1900-01-01` | Earliest selectable date.                                                                                                  |
| `maxValue`                  | `DateValue`                                                      | Calendar-aware `2099-12-31` | Latest selectable date.                                                                                                    |
| `weeksInMonth`              | `number`                                                         | -                           | The number of weeks in a month. This overrides the default set by the locale.                                              |
| `isDateUnavailable`         | `(date: DateValue, anchorDate: CalendarDate \| null) => boolean` | -                           | Marks dates as unavailable. When `anchorDate` is set, it is the first date the user selected in the current range gesture. |
| `firstDayOfWeek`            | `'sun' \| 'mon' \| 'tue' \| 'wed' \| 'thu' \| 'fri' \| 'sat'`    | -                           | Overrides the locale default for the first day of the week.                                                                |
| `pageBehavior`              | `'visible' \| 'single'`                                          | `'visible'`                 | Whether paging advances by the visible duration or one unit at a time.                                                     |
| `selectionAlignment`        | `'start' \| 'center' \| 'end'`                                   | `'center'`                  | Aligns the visible range to the selection on initial render.                                                               |
| `allowsNonContiguousRanges` | `boolean`                                                        | `false`                     | Allows ranges that span unavailable dates.                                                                                 |
| `isDisabled`                | `boolean`                                                        | `false`                     | Disables interaction and selection.                                                                                        |
| `isReadOnly`                | `boolean`                                                        | `false`                     | Keeps content readable but prevents selection changes.                                                                     |
| `isInvalid`                 | `boolean`                                                        | `false`                     | Marks the calendar as invalid for validation UI.                                                                           |
| `visibleDuration`           | `{months?: number; weeks?: number; days?: number}`               | `{months: 1}`               | Visible time range. Use `{ months: n }` for month view, `{ weeks: n }` for week view, or `{ days: n }` for day view.       |
| `defaultYearPickerOpen`     | `boolean`                                                        | `false`                     | Initial open state of internal year picker.                                                                                |
| `isYearPickerOpen`          | `boolean \| Signal<boolean>`                                     | -                           | Controlled year picker open state (a signal is two-way).                                                                   |
| `onYearPickerOpenChange`    | `(isOpen: boolean) => void`                                      | -                           | Called when year picker open state changes.                                                                                |

### Composition Parts

| Component                                  | Description                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `RangeCalendar.Header`                     | Header container for navigation and heading.                                                                                |
| `RangeCalendar.Heading`                    | Formatted heading for the visible range. Supports `offset` (for multi-month layouts) and `format` (month/year/day options). |
| `RangeCalendar.NavButton`                  | Previous/next navigation control (`slot="previous"` or `slot="next"`).                                                      |
| `RangeCalendar.Grid`                       | Day grid for one month (`offset` supported for multi-month layouts).                                                        |
| `RangeCalendar.GridHeader`                 | Weekday header container.                                                                                                   |
| `RangeCalendar.GridBody`                   | Date cell body container.                                                                                                   |
| `RangeCalendar.HeaderCell`                 | Weekday label cell.                                                                                                         |
| `RangeCalendar.Cell`                       | Individual date cell.                                                                                                       |
| `RangeCalendar.CellIndicator`              | Optional indicator element for custom metadata.                                                                             |
| `RangeCalendar.YearPickerTrigger`          | Trigger to toggle year-picker mode.                                                                                         |
| `RangeCalendar.YearPickerTriggerHeading`   | Localized heading content inside the year-picker trigger.                                                                   |
| `RangeCalendar.YearPickerTriggerIndicator` | Toggle icon inside the year-picker trigger.                                                                                 |
| `RangeCalendar.YearPickerGrid`             | Overlay year selection grid container.                                                                                      |
| `RangeCalendar.YearPickerGridBody`         | Body renderer for year grid cells.                                                                                          |
| `RangeCalendar.YearPickerCell`             | Individual year option cell.                                                                                                |

### Year Picker Parts

Year picker subcomponents inherit formatting props from React Aria [`useCalendarHeading`](https://react-aria.adobe.com/useCalendar#usecalendarheading) and [`useCalendarYearPicker`](https://react-aria.adobe.com/useCalendar#usecalendaryearpicker).

| Component                                | Prop           | Type                   | Default              | Description                                                                                                                  |
| ---------------------------------------- | -------------- | ---------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `RangeCalendar.YearPickerTriggerHeading` | `format`       | `DateFormatterOptions` | -                    | Customize month/year label (e.g. `{month: 'short'}`).                                                                        |
| `RangeCalendar.YearPickerTriggerHeading` | `offset`       | `{months?: number}`    | -                    | Shift the heading relative to the focused date (multi-month layouts).                                                        |
| `RangeCalendar.YearPickerGrid`           | `format`       | `DateFormatterOptions` | `{year: 'numeric'}`  | Customize year cell labels (era, calendar system, etc.).                                                                     |
| `RangeCalendar.YearPickerGrid`           | `visibleYears` | `number`               | min–max span or `20` | Number of years shown in the sliding window. Defaults to the full range between `minValue` and `maxValue` when both are set. |

### RangeCalendar.Cell Render Props

When `RangeCalendar.Cell` children is a function, the cdk render props are available (accessors except `formattedDate`: call them, e.g. `isSelected()`):

| Prop               | Type            | Description                                          |
| ------------------ | --------------- | ---------------------------------------------------- |
| `formattedDate`    | `string`        | Localized day label for the cell.                    |
| `isSelected`       | `() => boolean` | Whether the date is selected.                        |
| `isSelectionStart` | `() => boolean` | Whether the date is the start of the selected range. |
| `isSelectionEnd`   | `() => boolean` | Whether the date is the end of the selected range.   |
| `isUnavailable`    | `() => boolean` | Whether the date is unavailable.                     |
| `isDisabled`       | `() => boolean` | Whether the cell is disabled.                        |
| `isOutsideMonth`   | `() => boolean` | Whether the date belongs to adjacent month.          |

For a complete list of supported calendar systems and their identifiers, see:

- [React Aria Calendar Implementations](https://react-aria.adobe.com/internationalized/date/Calendar#implementations)
- [React Aria International Calendars](https://react-aria.adobe.com/Calendar#international-calendars)

### Related packages

- `@rivetjs/cdk/date` (port of [`@internationalized/date`](https://react-aria.adobe.com/internationalized/date/)) — date types (`CalendarDate`, `CalendarDateTime`, `ZonedDateTime`) and utilities used by all date components
- `I18nProvider` (`@rivetjs/cdk/i18n-provider`) — override locale for a subtree
- `useLocale` (`@rivetjs/cdk/i18n`) — read the current locale and layout direction

::api{symbol="@rivetjs/ui/range-calendar#RangeCalendar"}

## Accessibility

the root is `role="application"` labelled by `aria-label` + the visible month; the grid is a `role="grid"` with roving focus (arrow keys, Page Up / Down, Home / End). The year picker trigger has `aria-expanded`; its grid takes arrow keys, Home / End, Enter and Escape.

## Related Components

- [Calendar](/components/calendar/): Interactive month grid for selecting dates.
- [DateField](/components/date-field/): Date input field with labels, descriptions, and validation.
- [DatePicker](/components/date-picker/): Composable date picker with date field trigger and calendar popover.
- [DateRangePicker](/components/date-range-picker/): Composable date range picker with date field trigger and range calendar popover.
- [TimeField](/components/time-field/): Time input field with labels, descriptions, and validation.
- [InputGroup](/components/input-group/): Group related input controls with prefix and suffix elements.
- [Form](/components/form/): Form validation and submission handling.
