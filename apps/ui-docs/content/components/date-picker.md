---
title: DatePicker
description: "Date field with a calendar popover: keyboard editing, validation, format options and form support."
template: reference
status: experimental
related: [components/date-field, components/calendar]
---

`DatePicker` combines a segmented date field with a calendar in a popover. The root is the [cdk DatePicker](site:cdk/components/date-picker/) (React Aria `DatePicker`); the field is built from the [DateField](date-field.md) group parts, `DatePicker.Trigger` is the cdk `Button` that opens the popover, `DatePicker.Popover` the cdk `Popover` holding a [Calendar](calendar.md).

Notes:

- `class`, not `className`. Dates come from `@rivetjs/cdk/date` (the `@internationalized/date` port); `I18nProvider` from `@rivetjs/cdk/i18n-provider`.
- A controlled `value` is a two-way signal of the date string (no `onChange` setter needed); uncontrolled date props take date objects or strings and reach the cdk picker as strings so the page resumes. `isInvalid` takes a value or an accessor (`isInvalid={() => value() !== null && value()! < today}`).
- Format props (`granularity`, `hourCycle`, `hideTimeZone`, `shouldForceLeadingZeros`) are read once: the Format Options demo re-creates the picker with `<Show keyed>` (upstream `key` + re-renders); the option Selects are uncontrolled (`defaultValue` + `onChange`). Render props are accessors (`({ state }) => …`; state helpers such as `timeValue(state)` / `setTimeValue(state, v)` come from `@rivetjs/cdk/state/date-picker`).
- After the popover closes following keyboard input, focus returns to the trigger in a frame, found by the cdk trigger id (`<picker id>-button`).
- Icons are lucide (`Calendar` default indicator, `ChevronDown`).

Accessibility: the group is `role="group"` labelled by the `Label`; the trigger has `aria-haspopup="dialog"` / `aria-expanded`; the popover is a dialog holding the calendar grid (arrow keys, Page Up / Down, Enter to select, Escape to close).

## Usage

```tsx
import { Calendar } from "@rivetjs/ui/calendar";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { Label } from "@rivetjs/ui/label";
```

::example{id=date-picker-basic}

## Anatomy

`DatePicker` follows a composition-first API. Compose `DateField` and `Calendar` explicitly to control structure and styling.

```tsx
import { Calendar } from "@rivetjs/ui/calendar";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { Label } from "@rivetjs/ui/label";

export default () => (
  <DatePicker>
    <Label />
    <DateField.Group>
      <DateField.Input>
        {(segment) => <DateField.Segment segment={segment} />}
      </DateField.Input>
      <DateField.Suffix>
        <DatePicker.Trigger>
          <DatePicker.TriggerIndicator />
        </DatePicker.Trigger>
      </DateField.Suffix>
    </DateField.Group>
    <DatePicker.Popover>
      <Calendar aria-label="Choose date">
        <Calendar.Header>
          <Calendar.YearPickerTrigger>
            <Calendar.YearPickerTriggerHeading />
            <Calendar.YearPickerTriggerIndicator />
          </Calendar.YearPickerTrigger>
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>
            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
          </Calendar.GridHeader>
          <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>
    </DatePicker.Popover>
  </DatePicker>
)
```

## Examples

### Disabled

::example{id=date-picker-disabled}

### Controlled

::example{id=date-picker-controlled}

### Validation

::example{id=date-picker-with-validation}

### Format Options

Control how DatePicker values are displayed with props such as `granularity`, `hourCycle`, `hideTimeZone`, and `shouldForceLeadingZeros`.

::example{id=date-picker-format-options}

### Form Example

::example{id=date-picker-form-example}

### Custom Indicator

`DatePicker.TriggerIndicator` renders the default `IconCalendar` when no children are provided. Pass children to replace it.

::example{id=date-picker-with-custom-indicator}

### Render Function

::example{id=date-picker-render-function}

### International Calendar

By default, DatePicker displays dates using the calendar system for the user's locale. You can override this by wrapping your DatePicker with `I18nProvider` and setting the [Unicode calendar locale extension](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/calendar#adding_a_calendar_in_the_locale_string).

The example below shows the Indian calendar system:

::example{id=date-picker-international-calendar}

**Note:** The `onChange` event always returns a date in the same calendar system as the `value` or `defaultValue` (Gregorian if no value is provided), regardless of the displayed locale. This ensures your application logic works consistently with a single calendar system while still displaying dates in the user's preferred format.

For a complete list of supported calendar systems and their identifiers, see:
- [React Aria Calendar Implementations](https://react-aria.adobe.com/internationalized/date/Calendar#implementations)
- [React Aria International Calendars](https://react-aria.adobe.com/Calendar#international-calendars)

## Customization

### Tailwind CSS

::example{id=date-picker-custom-styles}

### Global CSS

To customize DatePicker base classes, use `@layer components`.

```css
@layer components {
  .date-picker {
    @apply inline-flex flex-col gap-1;
  }

  .date-picker__trigger {
    @apply inline-flex items-center justify-between;
  }

  .date-picker__trigger-indicator {
    @apply text-muted;
  }

  .date-picker__popover {
    @apply min-w-[var(--trigger-width)] p-0;
  }
}
```

## Styling Reference

Rivet UI follows [BEM](https://getbem.com/) naming for reusable customization.

### CSS Classes

DatePicker uses these classes in `packages/styles/components/date-picker.css`:

- `.date-picker` - Root wrapper.
- `.date-picker__trigger` - Trigger part that opens the popover.
- `.date-picker__trigger-indicator` - Default/custom indicator slot.
- `.date-picker__popover` - Popover content wrapper.

### Interactive States

DatePicker supports React Aria data attributes and pseudo states:

- **Open**: `[data-open="true"]` on trigger.
- **Disabled**: `[data-disabled="true"]` or `[aria-disabled="true"]` on trigger.
- **Focus visible**: `:focus-visible` or `[data-focus-visible="true"]` on trigger.
- **Hover**: `:hover` or `[data-hovered="true"]` on trigger.

## API Reference

### DatePicker

DatePicker inherits all props from the [cdk DatePicker](site:cdk/components/date-picker/) (React Aria `DatePicker`).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `DateValue \| null` | - | Controlled selected date value. |
| `defaultValue` | `DateValue \| null` | - | Default selected value in uncontrolled mode. |
| `onChange` | `(value: DateValue \| null) => void` | - | Called when selected date changes. |
| `isOpen` | `boolean` | - | Controlled popover open state. |
| `defaultOpen` | `boolean` | `false` | Initial popover open state. |
| `onOpenChange` | `(isOpen: boolean) => void` | - | Called when popover open state changes. |
| `isDisabled` | `boolean` | `false` | Disables date selection and trigger interactions. |
| `isInvalid` | `boolean` | - | Marks the field as invalid for validation state. |
| `minValue` | `DateValue` | - | Minimum selectable date. |
| `maxValue` | `DateValue` | - | Maximum selectable date. |
| `name` | `string` | - | Name used for HTML form submission. |
| `children` | `Content \| (values: DatePickerRenderProps) => Content` | - | Composed content or render function. |
| `render` | `DOMRenderFunction<keyof JSX.IntrinsicElements, DatePickerRenderProps>` | - | Overrides the default DOM element with a custom render function.|

### Composition Parts

| Component | Description |
|-----------|-------------|
| `DatePicker.Root` | Root date picker container and state owner. |
| `DatePicker.Trigger` | Trigger button, usually rendered inside `DateField.Suffix`. |
| `DatePicker.TriggerIndicator` | Indicator slot with default calendar icon. |
| `DatePicker.Popover` | Popover wrapper for `Calendar` content. |

### Related packages
- `@rivetjs/cdk/date` (port of [`@internationalized/date`](https://react-aria.adobe.com/internationalized/date/)) — date types (`CalendarDate`, `CalendarDateTime`, `ZonedDateTime`) and utilities used by all date components
- `I18nProvider` (`@rivetjs/cdk/i18n-provider`) — override locale for a subtree
- `useLocale` (`@rivetjs/cdk/i18n`) — read the current locale and layout direction

::api{symbol="@rivetjs/ui/date-picker#DatePicker"}

## Related Components

- [Calendar](/components/calendar/): Interactive month grid for selecting dates.
- [RangeCalendar](/components/range-calendar/): Interactive month grid for selecting date ranges.
- [DateField](/components/date-field/): Date input field with labels, descriptions, and validation.
- [DateRangePicker](/components/date-range-picker/): Composable date range picker with date field trigger and range calendar popover.
- [TimeField](/components/time-field/): Time input field with labels, descriptions, and validation.
- [InputGroup](/components/input-group/): Group related input controls with prefix and suffix elements.
- [Form](/components/form/): Form validation and submission handling.
- [Popover](/components/popover/): Displays content in context with a trigger.
