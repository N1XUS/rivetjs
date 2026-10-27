---
title: DateField
description: "Segmented date input with keyboard editing, validation, prefix / suffix slots and form support."
template: reference
status: experimental
related: [components/time-field, components/calendar]
---

`DateField` is a segmented date input: each part of the date (month, day, year, and with a time granularity hour, minute, …) is an editable spinbutton segment. The root is the [cdk DateField](site:cdk/components/date-field/) (React Aria `DateField`); `DateField.Group` / `Input` / `Segment` / `InputContainer` / `Prefix` / `Suffix` are the `DateInputGroup` parts (`@rivetjs/ui/date-input-group`).

Notes:

- `class`, not `className`. Dates come from `@rivetjs/cdk/date` (the `@internationalized/date` port); `I18nProvider` from `@rivetjs/cdk/i18n-provider`.
- A controlled `value` is a two-way signal of the date string (`signal<string | null>("2026-08-15")`; no `onChange` setter needed). Uncontrolled props (`defaultValue`, `minValue`, `maxValue`, `placeholderValue`) take date objects or strings; they reach the cdk field as strings so the page resumes. A date object held in a component local and read by resumable code must be its string form (`.toString()`).
- `isInvalid` takes a value or an accessor (`isInvalid={() => value() !== null && value()! < today}`: ISO date strings compare like the dates). `granularity` is read once: the Granularity demo re-creates the field with `<Show keyed>` (upstream a re-render); the granularity Select holds a two-way key signal.
- Render props are accessors (`({ isInvalid }) => isInvalid()`).
- Icons are lucide (`Calendar`, `ChevronDown`, `CircleQuestionMark`).

## Usage

```tsx
import { DateField } from "@rivetjs/ui/date-field";
```

::example{id=date-field-basic}

## Anatomy

```tsx
import { DateField } from "@rivetjs/ui/date-field";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";

export default () => (
  <DateField>
    <Label />
    <DateField.Group>
      <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
    </DateField.Group>
    <Description />
    <FieldError />
  </DateField>
);
```

> **DateField** combines label, date input, description, and error into a single accessible component.

Additional exported parts: `DateField.Root`.

## Examples

### With Icons

Add prefix or suffix icons to enhance the date field.

::example{id=date-field-with-prefix-icon}

::example{id=date-field-with-suffix-icon}

::example{id=date-field-with-prefix-and-suffix}

### Variants

The DateField.Group component supports two visual variants:

- **`primary`** (default) - Standard styling with shadow, suitable for most use cases
- **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

::example{id=date-field-variants}

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` on DateField.Group to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=date-field-on-surface}

### With Description

::example{id=date-field-with-description}

### Required Field

::example{id=date-field-required}

### Disabled State

::example{id=date-field-disabled}

### Full Width

::example{id=date-field-full-width}

### Validation

Use `isInvalid` together with `FieldError` to surface validation messages.

::example{id=date-field-invalid}

### Granularity

::example{id=date-field-granularity}

### Controlled

Control the value to synchronize with other components or state management.

::example{id=date-field-controlled}

### Form Example

Complete form example with validation and submission handling.

::example{id=date-field-form-example}

### With Validation

DateField supports validation with `minValue`, `maxValue`, and custom validation logic.

::example{id=date-field-with-validation}

### Render Function

::example{id=date-field-render-function}

### DateField.Group Styling

#### Customizing the component classes

The base classes power every instance. Override them once with `@layer components`.

```css
@layer components {
  .date-input-group {
    @apply inline-flex h-9 items-center overflow-hidden rounded-field border bg-field text-sm text-field-foreground shadow-field outline-none;

    &:hover,
    &[data-hovered="true"] {
      @apply bg-field-hover;
    }

    &[data-focus-within="true"],
    &:focus-within {
      @apply status-focused-field;
    }

    &[data-invalid="true"] {
      @apply status-invalid-field;
    }

    &[data-disabled="true"],
    &[aria-disabled="true"] {
      @apply status-disabled;
    }
  }

  .date-input-group__input {
    @apply flex flex-1 items-center gap-px rounded-none border-0 bg-transparent px-3 py-2 shadow-none outline-none;
  }

  .date-input-group__segment {
    @apply inline-block rounded-md px-0.5 text-end tabular-nums outline-none;

    &:focus,
    &[data-focused="true"] {
      @apply bg-accent-soft text-accent-soft-foreground;
    }
  }

  .date-input-group__input-container {
    @apply flex flex-1 items-center;
    overflow-x: auto;
    overflow-y: clip;
    scrollbar-width: none;
  }

  .date-input-group__prefix,
  .date-input-group__suffix {
    @apply pointer-events-none shrink-0 text-field-placeholder flex items-center;
  }
}
```

#### DateField.Group CSS Classes

- `.date-input-group` – Root container styling
- `.date-input-group__input` – Input wrapper styling
- `.date-input-group__input-container` – Scrollable container for grouping multiple inputs
- `.date-input-group__segment` – Individual date segment styling
- `.date-input-group__prefix` – Prefix element styling
- `.date-input-group__suffix` – Suffix element styling

#### DateField.Group Interactive States

- **Hover**: `:hover` or `[data-hovered="true"]`
- **Focus Within**: `[data-focus-within="true"]` or `:focus-within`
- **Invalid**: `[data-invalid="true"]` (also syncs with `aria-invalid`)
- **Disabled**: `[data-disabled="true"]` or `[aria-disabled="true"]`
- **Segment Focus**: `:focus` or `[data-focused="true"]` on segment elements
- **Segment Placeholder**: `[data-placeholder="true"]` on segment elements

## Customization

### Tailwind CSS

::example{id=date-field-custom-styles}

### Global CSS

DateField has minimal default styling. Override the `.date-field` class to customize the container styling.

```css
@layer components {
  .date-field {
    @apply flex flex-col gap-1;

    &[data-invalid="true"],
    &[aria-invalid="true"] {
      [data-slot="description"] {
        @apply hidden;
      }
    }

    [data-slot="label"] {
      @apply w-fit;
    }

    [data-slot="description"] {
      @apply px-1;
    }
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

- `.date-field` – Root container with minimal styling (`flex flex-col gap-1`)

> **Note:** Child components ([Label](/components/label/), [Description](/components/description/), [FieldError](/components/field-error/)) have their own CSS classes and styling. See their respective documentation for customization options. DateField.Group styling is documented below in the API Reference section.

### Interactive States

DateField automatically manages these data attributes based on its state:

- **Invalid**: `[data-invalid="true"]` or `[aria-invalid="true"]` - Automatically hides the description slot when invalid
- **Required**: `[data-required="true"]` - Applied when `isRequired` is true
- **Disabled**: `[data-disabled="true"]` - Applied when `isDisabled` is true
- **Focus Within**: `[data-focus-within="true"]` - Applied when any child input is focused

## API Reference

See the [full module API](/api/rivetjs/ui/date-field/) for every named export and part prop type.

### DateField

DateField inherits all props from the [cdk DateField](site:cdk/components/date-field/) (React Aria `DateField`).

#### Base Props

| Prop        | Type                                                                       | Default | Description                                                         |
| ----------- | -------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| `children`  | `Content \| (values: DateFieldRenderProps) => Content`                     | -       | Child components (Label, DateField.Group, etc.) or render function. |
| `class`     | `string \| (values: DateFieldRenderProps) => string`                       | -       | CSS classes for styling, supports render props.                     |
| `style`     | `JSX.CSSProperties \| (values: DateFieldRenderProps) => JSX.CSSProperties` | -       | Inline styles, supports render props.                               |
| `fullWidth` | `boolean`                                                                  | `false` | Whether the date field should take full width of its container      |
| `id`        | `string`                                                                   | -       | The element's unique identifier.                                    |
| `render`    | `DOMRenderFunction<keyof JSX.IntrinsicElements, DateFieldRenderProps>`     | -       | Overrides the default DOM element with a custom render function.    |

#### Value Props

| Prop               | Type                                 | Default | Description                                                                                                                                          |
| ------------------ | ------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`            | `DateValue \| null`                  | -       | Current value (controlled). Date / time objects from `@rivetjs/cdk/date` or their strings; a controlled `value` is a two-way signal of the string.   |
| `defaultValue`     | `DateValue \| null`                  | -       | Default value (uncontrolled). Date / time objects from `@rivetjs/cdk/date` or their strings; a controlled `value` is a two-way signal of the string. |
| `onChange`         | `(value: DateValue \| null) => void` | -       | Handler called when the value changes.                                                                                                               |
| `placeholderValue` | `DateValue \| null`                  | -       | Placeholder date that influences the format of the placeholder.                                                                                      |

#### Validation Props

| Prop                 | Type                                                                 | Default    | Description                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isRequired`         | `boolean`                                                            | `false`    | Whether user input is required before form submission.                                                                                                                  |
| `isInvalid`          | `boolean`                                                            | -          | Whether the value is invalid.                                                                                                                                           |
| `minValue`           | `DateValue \| null`                                                  | -          | The minimum allowed date that a user may select. Date / time objects from `@rivetjs/cdk/date` or their strings; a controlled `value` is a two-way signal of the string. |
| `maxValue`           | `DateValue \| null`                                                  | -          | The maximum allowed date that a user may select. Date / time objects from `@rivetjs/cdk/date` or their strings; a controlled `value` is a two-way signal of the string. |
| `isDateUnavailable`  | `(date: DateValue) => boolean`                                       | -          | Callback that is called for each date. If it returns true, the date is unavailable.                                                                                     |
| `validate`           | `(value: DateValue) => ValidationError \| true \| null \| undefined` | -          | Custom validation function.                                                                                                                                             |
| `validationBehavior` | `'native' \| 'aria'`                                                 | `'native'` | Whether to use native HTML form validation or ARIA attributes.                                                                                                          |

#### Format Props

| Prop                      | Type          | Default | Description                                                                                  |
| ------------------------- | ------------- | ------- | -------------------------------------------------------------------------------------------- |
| `granularity`             | `Granularity` | -       | Determines the smallest unit displayed. Defaults to `"day"` for dates, `"minute"` for times. |
| `hourCycle`               | `12 \| 24`    | -       | Whether to display time in 12 or 24 hour format. By default, determined by locale.           |
| `hideTimeZone`            | `boolean`     | `false` | Whether to hide the time zone abbreviation.                                                  |
| `shouldForceLeadingZeros` | `boolean`     | -       | Whether to always show leading zeros in month, day, and hour fields.                         |

#### State Props

| Prop         | Type      | Default | Description                                        |
| ------------ | --------- | ------- | -------------------------------------------------- |
| `isDisabled` | `boolean` | -       | Whether the input is disabled.                     |
| `isReadOnly` | `boolean` | -       | Whether the input can be selected but not changed. |

#### Form Props

| Prop           | Type      | Default | Description                                                                      |
| -------------- | --------- | ------- | -------------------------------------------------------------------------------- |
| `name`         | `string`  | -       | Name of the input element, for HTML form submission. Submits as ISO 8601 string. |
| `autoFocus`    | `boolean` | -       | Whether the element should receive focus on render.                              |
| `autoComplete` | `string`  | -       | Type of autocomplete functionality the input should provide.                     |

#### Accessibility Props

| Prop               | Type     | Default | Description                                           |
| ------------------ | -------- | ------- | ----------------------------------------------------- |
| `aria-label`       | `string` | -       | Accessibility label when no visible label is present. |
| `aria-labelledby`  | `string` | -       | ID of elements that label this field.                 |
| `aria-describedby` | `string` | -       | ID of elements that describe this field.              |
| `aria-details`     | `string` | -       | ID of elements with additional details.               |

### Composition Components

DateField works with these separate components that should be imported and used directly:

- **Label** - Field label component from `@rivetjs/ui`
- **DateField.Group** - Date input group component (documented below)
- **DateField.Input** - Input component with segmented editing from `@rivetjs/ui`
- **DateField.InputContainer** - Scrollable container for grouping multiple inputs (e.g. start/end range inputs) with horizontal overflow
- **DateField.Segment** - Individual date segment (year, month, day, etc.)
- **DateField.Prefix** / **DateField.Suffix** - Prefix and suffix slots for the input group
- **Description** - Helper text component from `@rivetjs/ui`
- **FieldError** - Validation error message from `@rivetjs/ui`

Each of these components has its own props API. Use them directly within DateField for composition:

```tsx
import { parseDate } from "@rivetjs/cdk/date";
import { DateField } from "@rivetjs/ui/date-field";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";

<DateField
  isRequired
  isInvalid={hasError}
  minValue={today(getLocalTimeZone())}
  value={date} // a signal<string | null>: two-way
>
  <Label>Appointment Date</Label>
  <DateField.Group>
    <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
  </DateField.Group>
  <Description>Select a date from today onwards.</Description>
  <FieldError>Please select a valid date.</FieldError>
</DateField>;
```

### DateValue Types

DateField uses types from `@rivetjs/cdk/date` (port of [`@internationalized/date`](https://react-aria.adobe.com/internationalized/date/)):

- `CalendarDate` - Date without time or timezone
- `CalendarDateTime` - Date with time but no timezone
- `ZonedDateTime` - Date with time and timezone
- `Time` - Time only

Example:

```tsx
import { parseDate, today, getLocalTimeZone } from "@rivetjs/cdk/date";

// Parse from string
const date = parseDate("2024-01-15");

// Today's date
const todayDate = today(getLocalTimeZone());

// Use in DateField
<DateField defaultValue={date}>{/* ... */}</DateField>;
```

> **Note:** DateField uses `@rivetjs/cdk/date` (port of the [`@internationalized/date`](https://react-aria.adobe.com/internationalized/date/) package) for date manipulation, parsing, and type definitions. See the [Internationalized Date documentation](https://react-aria.adobe.com/internationalized/date/) for more information about available types and functions.

### Render Props

Render functions receive the following values. Call accessor members to read their current value:

| Prop         | Type             | Description                          |
| ------------ | ---------------- | ------------------------------------ |
| `isDisabled` | `() => boolean`  | Whether the date field is disabled.  |
| `isInvalid`  | `() => boolean`  | Whether the date field is invalid.   |
| `isReadOnly` | `() => boolean`  | Whether the date field is read only. |
| `isRequired` | `() => boolean`  | Whether the date field is required.  |
| `state`      | `DateFieldState` | State of the date field.             |

### DateField.Group

DateField.Group accepts all props from the cdk `Group` (React Aria `Group`) plus the following:

| Prop        | Type                       | Default     | Description                                                                                                                                                        |
| ----------- | -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`     | `string`                   | -           | Tailwind classes merged with the component styles.                                                                                                                 |
| `fullWidth` | `boolean`                  | `false`     | Whether the date input group should take full width of its container                                                                                               |
| `variant`   | `"primary" \| "secondary"` | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |

### DateField.Input

DateField.Input accepts all props from the cdk `DateInput` (React Aria `DateInput`) plus the following:

| Prop      | Type                       | Default     | Description                                                                                                                                                    |
| --------- | -------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`   | `string`                   | -           | Tailwind classes merged with the component styles.                                                                                                             |
| `variant` | `"primary" \| "secondary"` | `"primary"` | Visual variant of the input. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |

The `DateField.Input` component accepts a render prop function that receives date segments. Each segment represents a part of the date (year, month, day, etc.).

### DateField.Segment

DateField.Segment accepts all props from the cdk `DateSegment` (React Aria `DateSegment`):

| Prop      | Type          | Default | Description                                                   |
| --------- | ------------- | ------- | ------------------------------------------------------------- |
| `segment` | `DateSegment` | -       | The date segment object from the DateField.Input render prop. |
| `class`   | `string`      | -       | Tailwind classes merged with the component styles.            |

### DateField.InputContainer

DateField.InputContainer accepts standard HTML `div` attributes:

| Prop       | Type      | Default | Description                                                                                           |
| ---------- | --------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `class`    | `string`  | -       | Tailwind classes merged with the component styles.                                                    |
| `children` | `Content` | -       | Content to display inside the scrollable container (typically multiple `DateField.Input` components). |

### DateField.Prefix

DateField.Prefix accepts standard HTML `div` attributes:

| Prop       | Type      | Default | Description                                        |
| ---------- | --------- | ------- | -------------------------------------------------- |
| `class`    | `string`  | -       | Tailwind classes merged with the component styles. |
| `children` | `Content` | -       | Content to display in the prefix slot.             |

### DateField.Suffix

DateField.Suffix accepts standard HTML `div` attributes:

| Prop       | Type      | Default | Description                                        |
| ---------- | --------- | ------- | -------------------------------------------------- |
| `class`    | `string`  | -       | Tailwind classes merged with the component styles. |
| `children` | `Content` | -       | Content to display in the suffix slot.             |

::api{symbol="@rivetjs/ui/date-field#DateField"}

## Accessibility

the group is `role="group"` labelled by the `Label`; each segment is a `role="spinbutton"` (arrow keys step it, digits type into it, Backspace clears it, Left / Right move between segments); a hidden `<input>` carries the value for forms.

## Related Components

- [DatePicker](/components/date-picker/): Composable date picker with date field trigger and calendar popover.
- [Calendar](/components/calendar/): Interactive month grid for selecting dates.
- [Label](/components/label/): Accessible label for form controls.
- [FieldError](/components/field-error/): Inline validation messages for form fields.
- [Description](/components/description/): Helper text for form fields.
- [Form](/components/form/): Form validation and submission handling.
- [Surface](/components/surface/): Base container surface.
