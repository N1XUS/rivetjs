---
title: DateRangePicker
description: "Start / end date fields with a range calendar popover: validation, format options and form support."
template: reference
status: experimental
related: [components/date-picker, components/range-calendar]
---

`DateRangePicker` combines start / end date fields with a range calendar in a popover. The root is the [cdk DateRangePicker](site:cdk/components/date-range-picker/) (React Aria `DateRangePicker`); the fields are [DateField](date-field.md) inputs with `slot="start"` / `slot="end"` split by `DateRangePicker.RangeSeparator`, `DateRangePicker.Trigger` is the cdk `Button` that opens the popover, `DateRangePicker.Popover` the cdk `Popover` holding a [RangeCalendar](range-calendar.md).

Notes:

- `class`, not `className`. Dates come from `@rivetjs/cdk/date` (the `@internationalized/date` port); `I18nProvider` from `@rivetjs/cdk/i18n-provider`.
- A controlled `value` is a two-way signal of `{ start, end }` date strings (no `onChange` setter needed); uncontrolled date props take date objects or strings and reach the cdk picker as strings so the page resumes. `isInvalid` takes a value or an accessor (`isInvalid={() => { const r = value(); return r != null && r.start < today; }}`: ISO date strings compare like the dates).
- Format props (`granularity`, `hourCycle`, `hideTimeZone`, `shouldForceLeadingZeros`) are read once: the Format Options demo re-creates the range picker with `<Show keyed>` (upstream `key` + re-renders); the option Selects are uncontrolled (`defaultValue` + `onChange`). Render props are accessors (`({ state }) => …`; state helpers such as `timeRange(state)` / `setTimeRange(state, range)` / `dateRange(state)` come from `@rivetjs/cdk/state/date-picker`).
- After the popover closes following keyboard input, focus returns to the trigger in a frame, found by the cdk trigger id (`<picker id>-button`).
- Icons are lucide (`Calendar` default indicator, `ChevronDown`).

## Usage

```tsx
import { DateField } from "@rivetjs/ui/date-field";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";
```

::example{id=date-range-picker-basic}

## Anatomy

`DateRangePicker` follows a composition-first API. Compose `DateField` and `RangeCalendar` explicitly to control structure and styling.

```tsx
import { DateField } from "@rivetjs/ui/date-field";
import { DateRangePicker } from "@rivetjs/ui/date-range-picker";
import { Label } from "@rivetjs/ui/label";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";

export default () => (
  <DateRangePicker>
    <Label />
    <DateField.Group>
      <DateField.InputContainer>
        <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateRangePicker.RangeSeparator />
        <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      </DateField.InputContainer>
      <DateField.Suffix>
        <DateRangePicker.Trigger>
          <DateRangePicker.TriggerIndicator />
        </DateRangePicker.Trigger>
      </DateField.Suffix>
    </DateField.Group>
    <DateRangePicker.Popover>
      <RangeCalendar aria-label="Choose trip dates">
        <RangeCalendar.Header>
          <RangeCalendar.YearPickerTrigger>
            <RangeCalendar.YearPickerTriggerHeading />
            <RangeCalendar.YearPickerTriggerIndicator />
          </RangeCalendar.YearPickerTrigger>
          <RangeCalendar.NavButton slot="previous" />
          <RangeCalendar.NavButton slot="next" />
        </RangeCalendar.Header>
        <RangeCalendar.Grid>
          <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
          <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
        </RangeCalendar.Grid>
      </RangeCalendar>
    </DateRangePicker.Popover>
  </DateRangePicker>
);
```

## Examples

### Disabled

::example{id=date-range-picker-disabled}

### Controlled

::example{id=date-range-picker-controlled}

### Presets

Compose small `Button` shortcuts inside `DateRangePicker.Popover` and write `{ start, end }` date strings to the picker’s two-way value signal. Last 7 days and Last 30 days include today; This month and This year select the full calendar period. Set the calendar’s `focusedValue` signal to the range start so that period is visible.

Pass the same `value` signal to the calendar to keep its selection highlight in sync while the popover stays open. The shortcuts sit to the left of the calendar on wide screens and above it on narrow screens. No additional picker API is needed.

::example{id=date-range-picker-presets}

### Validation

::example{id=date-range-picker-with-validation}

### Format Options

Control how DateRangePicker values are displayed with props such as `granularity`, `hourCycle`, `hideTimeZone`, and `shouldForceLeadingZeros`.

::example{id=date-range-picker-format-options}

### Form Example

::example{id=date-range-picker-form-example}

### Custom Indicator

`DateRangePicker.TriggerIndicator` renders the default `IconCalendar` when no children are provided. Pass children to replace it.

::example{id=date-range-picker-with-custom-indicator}

### Render Function

::example{id=date-range-picker-render-function}

### International Calendar

By default, DateRangePicker displays dates using the calendar system for the user's locale. You can override this by wrapping your DateRangePicker with `I18nProvider` and setting the [Unicode calendar locale extension](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/calendar#adding_a_calendar_in_the_locale_string).

The example below shows the Indian calendar system:

::example{id=date-range-picker-international-calendar}

**Note:** The `onChange` event always returns dates in the same calendar system as the `value` or `defaultValue` (Gregorian if no value is provided), regardless of the displayed locale.

For a complete list of supported calendar systems and their identifiers, see:

- [React Aria Calendar Implementations](https://react-aria.adobe.com/internationalized/date/Calendar#implementations)
- [React Aria International Calendars](https://react-aria.adobe.com/Calendar#international-calendars)

## Customization

### Tailwind CSS

::example{id=date-range-picker-custom-styles}

### Global CSS

To customize DateRangePicker base classes, use `@layer components`.

```css
@layer components {
  .date-range-picker {
    @apply inline-flex flex-col gap-1;
  }

  .date-range-picker__trigger {
    @apply inline-flex items-center justify-between;
  }

  .date-range-picker__trigger-indicator {
    @apply text-muted;
  }

  .date-range-picker__range-separator {
    @apply px-2 text-default;
  }

  .date-range-picker__popover {
    @apply min-w-[var(--trigger-width)] p-0;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `date-range-picker-trigger`, `date-range-picker-trigger-indicator`, `date-range-picker-range-separator`, `date-range-picker-popover`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

DateRangePicker uses these classes in `packages/styles/components/date-range-picker.css`:

- `.date-range-picker` - Root wrapper.
- `.date-range-picker__trigger` - Trigger part that opens the popover.
- `.date-range-picker__trigger-indicator` - Default/custom indicator slot.
- `.date-range-picker__range-separator` - Separator between start and end date inputs.
- `.date-range-picker__popover` - Popover content wrapper.

### Interactive States

DateRangePicker supports React Aria data attributes and pseudo states:

- **Open**: `[data-open="true"]` on trigger.
- **Disabled**: `[data-disabled="true"]` or `[aria-disabled="true"]` on trigger.
- **Focus visible**: `:focus-visible` or `[data-focus-visible="true"]` on trigger.
- **Hover**: `:hover` or `[data-hovered="true"]` on trigger.

## API Reference

See the [full module API](/api/rivetjs/ui/date-range-picker/) for every named export and part prop type.

### DateRangePicker

DateRangePicker inherits all props from the [cdk DateRangePicker](site:cdk/components/date-range-picker/) (React Aria `DateRangePicker`).

| Prop           | Type                                                                         | Default | Description                                                      |
| -------------- | ---------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `value`        | `{ start: DateValue; end: DateValue } \| null`                               | -       | Controlled selected date range value.                            |
| `defaultValue` | `{ start: DateValue; end: DateValue } \| null`                               | -       | Default selected range in uncontrolled mode.                     |
| `onChange`     | `(value: { start: DateValue; end: DateValue } \| null) => void`              | -       | Called when selected range changes.                              |
| `isOpen`       | `boolean`                                                                    | -       | Controlled popover open state.                                   |
| `defaultOpen`  | `boolean`                                                                    | `false` | Initial popover open state.                                      |
| `onOpenChange` | `(isOpen: boolean) => void`                                                  | -       | Called when popover open state changes.                          |
| `isDisabled`   | `boolean`                                                                    | `false` | Disables range selection and trigger interactions.               |
| `isInvalid`    | `boolean`                                                                    | -       | Marks the field as invalid for validation state.                 |
| `minValue`     | `DateValue`                                                                  | -       | Minimum selectable date.                                         |
| `maxValue`     | `DateValue`                                                                  | -       | Maximum selectable date.                                         |
| `startName`    | `string`                                                                     | -       | Name used for the start date in HTML form submission.            |
| `endName`      | `string`                                                                     | -       | Name used for the end date in HTML form submission.              |
| `children`     | `Content \| (values: DateRangePickerRenderProps) => Content`                 | -       | Composed content or render function.                             |
| `render`       | `DOMRenderFunction<keyof JSX.IntrinsicElements, DateRangePickerRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Composition Parts

| Component                          | Description                                                 |
| ---------------------------------- | ----------------------------------------------------------- |
| `DateRangePicker.Root`             | Root date range picker container and state owner.           |
| `DateRangePicker.Trigger`          | Trigger button, usually rendered inside `DateField.Suffix`. |
| `DateRangePicker.TriggerIndicator` | Indicator slot with default calendar icon.                  |
| `DateRangePicker.RangeSeparator`   | Separator part between start and end date inputs.           |
| `DateRangePicker.Popover`          | Popover wrapper for `RangeCalendar` content.                |

### Related packages

- `@rivetjs/cdk/date` (port of [`@internationalized/date`](https://react-aria.adobe.com/internationalized/date/)) — date types (`CalendarDate`, `CalendarDateTime`, `ZonedDateTime`) and utilities used by all date components
- `I18nProvider` (`@rivetjs/cdk/i18n-provider`) — override locale for a subtree
- `useLocale` (`@rivetjs/cdk/i18n`) — read the current locale and layout direction

::api{symbol="@rivetjs/ui/date-range-picker#DateRangePicker"}

## Accessibility

the group is `role="group"` labelled by the `Label`; the trigger has `aria-haspopup="dialog"` / `aria-expanded`; the popover is a dialog holding the calendar grid (arrow keys, Page Up / Down, Enter to select, Escape to close).

## Related Components

- [RangeCalendar](/components/range-calendar/): Interactive month grid for selecting date ranges.
- [Calendar](/components/calendar/): Interactive month grid for selecting dates.
- [DateField](/components/date-field/): Date input field with labels, descriptions, and validation.
- [DatePicker](/components/date-picker/): Composable date picker with date field trigger and calendar popover.
- [TimeField](/components/time-field/): Time input field with labels, descriptions, and validation.
- [InputGroup](/components/input-group/): Group related input controls with prefix and suffix elements.
- [Form](/components/form/): Form validation and submission handling.
- [Popover](/components/popover/): Displays content in context with a trigger.
