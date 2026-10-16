---
title: TimeField
description: "Segmented time input with keyboard editing, validation, prefix / suffix slots and form support."
template: reference
status: experimental
related: [components/date-field, components/calendar, components/date-picker]
---

`TimeField` is a segmented time input: hour, minute (and second / AM-PM) are editable spinbutton segments. The root is the [cdk TimeField](site:cdk/components/time-field/) (React Aria `TimeField`); `TimeField.Group` / `Input` / `Segment` / `InputContainer` / `Prefix` / `Suffix` are the `DateInputGroup` parts (`@rivetjs/ui/date-input-group`).

Notes:

- `class`, not `className`. Times come from `@rivetjs/cdk/date` (`Time`, `parseTime`; the `@internationalized/date` port); `I18nProvider` from `@rivetjs/cdk/i18n-provider`.
- A controlled `value` is a two-way signal of the time string (`signal<string | null>("09:30:00")`; no `onChange` setter needed). Uncontrolled props (`defaultValue`, `minValue`, `maxValue`, `placeholderValue`) take `Time` / date-time objects or strings; they reach the cdk field as strings so the page resumes. A `Time` held in a component local and read by resumable code must be its string form (`.toString()`, Disabled demo).
- `isInvalid` takes a value or an accessor (`isInvalid={() => value() !== null && value()! < "09:00:00"}`: `HH:MM:SS` strings compare like the times).
- Render props are accessors (`({ isInvalid }) => isInvalid()`).
- Icons are lucide (`Clock`, `ChevronDown`).

Accessibility: the group is `role="group"` labelled by the `Label`; each segment is a `role="spinbutton"` (arrow keys step it, digits / A / P type into it, Backspace clears it, Left / Right move between segments); a hidden `<input>` carries the value for forms.

## Usage

```tsx
import { TimeField } from "@rivetjs/ui/time-field";
```

::example{id=time-field-basic}

## Anatomy

```tsx
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";

export default () => (
  <TimeField>
    <Label />
    <TimeField.Group>
      <TimeField.Input>
        {(segment) => <TimeField.Segment segment={segment} />}
      </TimeField.Input>
    </TimeField.Group>
    <Description />
    <FieldError />
  </TimeField>
)
```

> **TimeField** combines label, time input, description, and error into a single accessible component.

## Examples

### With Icons

Add prefix or suffix icons to enhance the time field.

::example{id=time-field-with-prefix-icon}

::example{id=time-field-with-suffix-icon}

::example{id=time-field-with-prefix-and-suffix}

### On Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` on TimeField.Group to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=time-field-on-surface}

### With Description

::example{id=time-field-with-description}

### Required Field

::example{id=time-field-required}

### Disabled State

::example{id=time-field-disabled}

### Full Width

::example{id=time-field-full-width}

### Validation

Use `isInvalid` together with `FieldError` to surface validation messages.

::example{id=time-field-invalid}

### Controlled

Control the value to synchronize with other components or state management.

::example{id=time-field-controlled}

### Form Example

Complete form example with validation and submission handling.

::example{id=time-field-form-example}

### With Validation

TimeField supports validation with `minValue`, `maxValue`, and custom validation logic.

::example{id=time-field-with-validation}

### Render Function

::example{id=time-field-render-function}

### Time Picker

`TimePicker` is a TimeField whose trigger opens a popover of iOS-style wheel drums: looped hour and minute drums (and seconds with `granularity="second"`), an AM / PM drum when the locale uses a 12-hour clock. Drag or flick a drum (it settles on a row with momentum), turn the mouse wheel or swipe the trackpad, press a row, or use the keys. The drums and the segments edit the same value. Drums come from the [cdk TimeWheels](site:cdk/components/wheel-picker/); the motion is the house motion (embla physics), reduced motion jumps.

```tsx
import { TimePicker } from "@rivetjs/ui/time-picker";

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
</TimePicker>
```

::example{id=time-picker-basic}

| Part | Props | Notes |
| --- | --- | --- |
| `TimePicker` | every TimeField prop + `isOpen` (value / Signal / accessor), `defaultOpen`, `onOpenChange` | Root (`.time-picker`); the popover state lives here. |
| `TimePicker.Trigger` | Button props | Toggles the popover; disabled with a disabled or read-only field. |
| `TimePicker.TriggerIndicator` | `children` | Default lucide `Clock`. |
| `TimePicker.Popover` | Popover props (`placement` default `bottom end`) | No children = the default Wheels. Pass a render function (`{() => …}`) so nothing renders before it opens. |
| `TimePicker.Wheels` | `minuteStep`, `secondStep`, `loop` (default `true`), `visibleItems` (default 5), `autoFocus` (default `true`), `class` / `wheelClass` / `itemClass`, `aria-label` | The drums (`.time-picker__wheels`, `.time-picker__wheel`, `.time-picker__item`). |

Keys on a focused drum: :kbd[ArrowUp] / :kbd[ArrowDown] step (wrapping), :kbd[PageUp] / :kbd[PageDown] jump 2 hours or 15 minutes, :kbd[Home] / :kbd[End] go to the first / last allowed row, digits and A / P type ahead; :kbd[Escape] closes and focuses the trigger. Each drum is a `role="spinbutton"`.

### Time Picker Options

The drums follow the field: the locale's hour cycle and digits (24-hour `de-DE` below: no AM / PM drum), `granularity`, and `minValue` / `maxValue` (rows outside the range are disabled and skipped; a change that lands outside clamps to the bound). `minuteStep` / `secondStep` space the drum rows.

::example{id=time-picker-options}

## Customization

### Tailwind CSS

::example{id=time-field-custom-styles}

### Global CSS

TimeField has minimal default styling. Override the `.time-field` class to customize the container styling.

```css
@layer components {
  .time-field {
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

- `.time-field` – Root container with minimal styling (`flex flex-col gap-1`)
- `.time-picker`, `.time-picker__trigger`, `.time-picker__trigger-indicator`, `.time-picker__popover`, `.time-picker__wheels`, `.time-picker__wheel`, `.time-picker__item` – TimePicker (Rivet addition); drum rows also read `--rv-wheel-offset` / `--rv-wheel-distance` (rows from the centre) and the band height `--time-picker-item-height`

> **Note:** Child components ([Label](/components/label/), [Description](/components/description/), [FieldError](/components/field-error/)) have their own CSS classes and styling. See their respective documentation for customization options. TimeField.Group styling is documented below in the API Reference section.

### Interactive States

TimeField automatically manages these data attributes based on its state:

- **Invalid**: `[data-invalid="true"]` or `[aria-invalid="true"]` - Automatically hides the description slot when invalid
- **Required**: `[data-required="true"]` - Applied when `isRequired` is true
- **Disabled**: `[data-disabled="true"]` - Applied when `isDisabled` is true
- **Focus Within**: `[data-focus-within="true"]` - Applied when any child input is focused

## API Reference

### TimeField

TimeField inherits all props from the [cdk TimeField](site:cdk/components/time-field/) (React Aria `TimeField`).

#### Base Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `Content \| (values: TimeFieldRenderProps) => Content` | - | Child components (Label, TimeField.Group, etc.) or render function. |
| `class` | `string \| (values: TimeFieldRenderProps) => string` | - | CSS classes for styling, supports render props. |
| `style` | `JSX.CSSProperties \| (values: TimeFieldRenderProps) => JSX.CSSProperties` | - | Inline styles, supports render props. |
| `fullWidth` | `boolean` | `false` | Whether the time field should take full width of its container |
| `id` | `string` | - | The element's unique identifier. |
| `render` | `DOMRenderFunction<keyof JSX.IntrinsicElements, TimeFieldRenderProps>` | - | Overrides the default DOM element with a custom render function.|

#### Value Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `TimeValue \| null` | - | Current value (controlled). Date / time objects from `@rivetjs/cdk/date` or their strings; a controlled `value` is a two-way signal of the string. |
| `defaultValue` | `TimeValue \| null` | - | Default value (uncontrolled). Date / time objects from `@rivetjs/cdk/date` or their strings; a controlled `value` is a two-way signal of the string. |
| `onChange` | `(value: TimeValue \| null) => void` | - | Handler called when the value changes. |
| `placeholderValue` | `TimeValue \| null` | - | Placeholder time that influences the format of the placeholder. Defaults to 12:00 AM or 00:00 depending on the hour cycle. |

#### Validation Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isRequired` | `boolean` | `false` | Whether user input is required before form submission. |
| `isInvalid` | `boolean` | - | Whether the value is invalid. |
| `minValue` | `TimeValue \| null` | - | The minimum allowed time that a user may select. Date / time objects from `@rivetjs/cdk/date` or their strings; a controlled `value` is a two-way signal of the string. |
| `maxValue` | `TimeValue \| null` | - | The maximum allowed time that a user may select. Date / time objects from `@rivetjs/cdk/date` or their strings; a controlled `value` is a two-way signal of the string. |
| `validate` | `(value: TimeValue) => ValidationError \| true \| null \| undefined` | - | Custom validation function. |
| `validationBehavior` | `'native' \| 'aria'` | `'native'` | Whether to use native HTML form validation or ARIA attributes. |

#### Format Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `granularity` | `'hour' \| 'minute' \| 'second'` | `'minute'` | Determines the smallest unit displayed in the time picker. |
| `hourCycle` | `12 \| 24` | - | Whether to display time in 12 or 24 hour format. By default, determined by locale. |
| `hideTimeZone` | `boolean` | `false` | Whether to hide the time zone abbreviation. |
| `shouldForceLeadingZeros` | `boolean` | - | Whether to always show leading zeros in the hour field. By default, determined by locale. |

#### State Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isDisabled` | `boolean` | - | Whether the input is disabled. |
| `isReadOnly` | `boolean` | - | Whether the input can be selected but not changed. |

#### Form Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | - | Name of the input element, for HTML form submission. Submits as ISO 8601 string. |
| `autoFocus` | `boolean` | - | Whether the element should receive focus on render. |

#### Accessibility Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `aria-label` | `string` | - | Accessibility label when no visible label is present. |
| `aria-labelledby` | `string` | - | ID of elements that label this field. |
| `aria-describedby` | `string` | - | ID of elements that describe this field. |
| `aria-details` | `string` | - | ID of elements with additional details. |

### Composition Components

TimeField works with these separate components that should be imported and used directly:

- **Label** - Field label component from `@rivetjs/ui`
- **TimeField.Group** - Time input group component (documented below)
- **TimeField.Input** - Input component with segmented editing from `@rivetjs/ui`
- **TimeField.Segment** - Individual time segment (hour, minute, second, etc.)
- **TimeField.Prefix** / **TimeField.Suffix** - Prefix and suffix slots for the input group
- **Description** - Helper text component from `@rivetjs/ui`
- **FieldError** - Validation error message from `@rivetjs/ui`

Each of these components has its own props API. Use them directly within TimeField for composition:

```tsx
import { parseTime } from "@rivetjs/cdk/date";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";

<TimeField
  isRequired
  isInvalid={hasError}
  minValue={parseTime('09:00')}
  maxValue={parseTime('17:00')}
  value={time} // a signal<string | null>: two-way
>
  <Label>Appointment Time</Label>
  <TimeField.Group>
    <TimeField.Input>
      {(segment) => <TimeField.Segment segment={segment} />}
    </TimeField.Input>
  </TimeField.Group>
  <Description>Select a time between 9:00 AM and 5:00 PM.</Description>
  <FieldError>Please select a valid time.</FieldError>
</TimeField>
```

### TimeValue Types

TimeField uses types from `@rivetjs/cdk/date` (port of [`@internationalized/date`](https://react-aria.adobe.com/internationalized/date/)):

- `Time` - Time only (hour, minute, second)
- `CalendarDateTime` - Date with time but no timezone (TimeField displays only the time portion)
- `ZonedDateTime` - Date with time and timezone (TimeField displays only the time portion)

Example:

```tsx
import { parseTime, Time, getLocalTimeZone, now } from "@rivetjs/cdk/date";

// Parse from string
const time = parseTime('14:30');

// Create from current time
const currentTime = now(getLocalTimeZone());
const timeValue = new Time(currentTime.hour, currentTime.minute, currentTime.second);

// Use in TimeField
<TimeField defaultValue={time}>
  {/* ... */}
</TimeField>
```

> **Note:** TimeField uses `@rivetjs/cdk/date` (port of the [`@internationalized/date`](https://react-aria.adobe.com/internationalized/date/) package) for time manipulation, parsing, and type definitions. See the [Internationalized Date documentation](https://react-aria.adobe.com/internationalized/date/) for more information about available types and functions.

### Render Props

When using render props with `class`, `style`, or `children`, these values are available:

| Prop | Type | Description |
|------|------|-------------|
| `isDisabled` | `boolean` | Whether the field is disabled. |
| `isInvalid` | `boolean` | Whether the field is currently invalid. |
| `isReadOnly` | `boolean` | Whether the field is read-only. |
| `isRequired` | `boolean` | Whether the field is required. |
| `isFocused` | `boolean` | Whether the field is currently focused. |
| `isFocusWithin` | `boolean` | Whether any child element is focused. |
| `isFocusVisible` | `boolean` | Whether focus is visible (keyboard navigation). |

### TimeField.Group

TimeField.Group accepts all props from the cdk `Group` (React Aria `Group`) plus the following:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Tailwind classes merged with the component styles. |
| `variant` | `"primary" \| "secondary"` | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |

### TimeField.Input

TimeField.Input accepts all props from the cdk `DateInput` (React Aria `DateInput`) plus the following:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Tailwind classes merged with the component styles. |
| `variant` | `"primary" \| "secondary"` | `"primary"` | Visual variant of the input. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |

The `TimeField.Input` component accepts a render prop function that receives date segments. Each segment represents a part of the time (hour, minute, second, etc.).

### TimeField.Segment

TimeField.Segment accepts all props from the cdk `DateSegment` (React Aria `DateSegment`):

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `segment` | `DateSegment` | - | The date segment object from the TimeField.Input render prop. |
| `class` | `string` | - | Tailwind classes merged with the component styles. |

### TimeField.Prefix

TimeField.Prefix accepts standard HTML `div` attributes:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Tailwind classes merged with the component styles. |
| `children` | `Content` | - | Content to display in the prefix slot. |

### TimeField.Suffix

TimeField.Suffix accepts standard HTML `div` attributes:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Tailwind classes merged with the component styles. |
| `children` | `Content` | - | Content to display in the suffix slot. |

::api{symbol="@rivetjs/ui/time-field#TimeField"}

## TimeField.Group Styling

### Customizing the component classes

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

  .date-input-group__prefix,
  .date-input-group__suffix {
    @apply pointer-events-none shrink-0 text-field-placeholder flex items-center;
  }
}
```

### TimeField.Group CSS Classes

- `.date-input-group` – Root container styling
- `.date-input-group__input` – Input wrapper styling
- `.date-input-group__segment` – Individual time segment styling
- `.date-input-group__prefix` – Prefix element styling
- `.date-input-group__suffix` – Suffix element styling

### TimeField.Group Interactive States

- **Hover**: `:hover` or `[data-hovered="true"]`
- **Focus Within**: `[data-focus-within="true"]` or `:focus-within`
- **Invalid**: `[data-invalid="true"]` (also syncs with `aria-invalid`)
- **Disabled**: `[data-disabled="true"]` or `[aria-disabled="true"]`
- **Segment Focus**: `:focus` or `[data-focused="true"]` on segment elements
- **Segment Placeholder**: `[data-placeholder="true"]` on segment elements

## Related Components

- [Label](/components/label/): Accessible label for form controls.
- [FieldError](/components/field-error/): Inline validation messages for form fields.
- [Description](/components/description/): Helper text for form fields.
- [Form](/components/form/): Form validation and submission handling.
- [Surface](/components/surface/): Base container surface.
