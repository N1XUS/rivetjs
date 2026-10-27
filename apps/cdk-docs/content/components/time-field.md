---
title: TimeField
description: TimeField from @rivetjs/cdk lets users type a time segment by segment. Hour cycles, granularity, time zones, min / max validation and forms, server-rendered.
template: guide
status: experimental
related: [components/date-field, components/date-picker, components/form, foundations/dates]
---

`TimeField` provides a localized, segmented time input. It shares `DateInput` and `DateSegment` with [DateField](date-field.md): each part of the time (hour, minute, second, AM/PM, time zone) is an individually editable `role="spinbutton"`, ordered and formatted for the locale. The value is a time: a `Time` (`"09:30:00"`), or a date-time / zoned date-time whose time part is shown.

::example{id=time-field-basic}

## Anatomy

```tsx
<TimeField>
  <Label />
  <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
  <Text slot="description" />
  <FieldError />
</TimeField>
```

Without children, `TimeField` renders the `DateInput` of every segment (no label: pass `aria-label`).

Server HTML of the hero example (segment attributes trimmed):

```html
<div class="rv-TimeField">
  <span id="start-label" class="rv-Label">Event time</span>
  <div id="start" role="group" class="rv-DateInput" aria-labelledby="start-label" aria-describedby="start-description" data-rv-date-field="" data-rk="ArrowUp ArrowDown … 0 1 … 9 A a P p" style="unicode-bidi:isolate">
    <span aria-hidden="true" data-type="literal" class="rv-DateSegment">⁦</span>
    <span id="start-hour" role="spinbutton" class="rv-DateSegment" data-type="hour" data-placeholder="true" aria-label="hour, " aria-labelledby="start-hour start-label" aria-valuetext="Empty" aria-valuemin="1" aria-valuemax="12" contenteditable="true" inputmode="numeric" tabindex="0">––</span>
    <span aria-hidden="true" data-type="literal" class="rv-DateSegment">:</span>
    <span id="start-minute" role="spinbutton" class="rv-DateSegment" data-type="minute" …>––</span>
    <span aria-hidden="true" data-type="literal" class="rv-DateSegment">⁩</span>
    <span aria-hidden="true" data-type="literal" class="rv-DateSegment"> </span>
    <span id="start-dayPeriod" role="spinbutton" class="rv-DateSegment" data-type="dayPeriod" aria-label="AM/PM, " …>AM</span>
  </div>
  <input id="start-input" type="text" hidden value="" />
  <span id="start-description" slot="description" class="rv-Text">Type digits, A / P, or use the arrow keys.</span>
</div>
<span id="start-value" hidden></span>
```

| Part | Element | Default class | Id | Attributes |
| --- | --- | --- | --- | --- |
| `TimeField` | `div` | `rv-TimeField` | none (the `id` prop is the base of the part ids) | `data-invalid`, `data-disabled`, `data-readonly`, `data-required` |
| `Label` | `span` | `rv-Label` | `<id>-label` | a click focuses the first segment |
| `DateInput` | `div[role=group]` | `rv-DateInput` | `<id>` | as in [DateField](date-field.md#anatomy) |
| `DateSegment` | `span[role=spinbutton]` (time zone: `role="textbox"`) | `rv-DateSegment` | `<id>-<type>` (`start-hour`, `start-minute`, `start-second`, `start-dayPeriod`, `start-timeZoneName`) | `data-type`, `data-placeholder`, `data-focused`, `data-invalid`, `aria-valuenow`, `aria-valuetext`, … |
| Form input | `input` | none | `<id>-input` | `name`, `form`, `required`, `disabled`, value = ISO string |
| `Text slot="description"`, `FieldError` | `span` | `rv-Text`, `rv-FieldError` | `<id>-description`, `<id>-error` | the error renders only while invalid |
| Value description | `span[hidden]` | none | `<id>-value` | "Selected Time: …" |

Unlike `DateField`, `TimeField` renders no `HiddenDateInput` (browser autofill has no time-only date input). The hour, minute and day period are wrapped in bidi isolates (`⁦…⁩` literals).

## Import

```tsx
import { TimeField, DateInput, DateSegment, TimeFieldContext, TimeFieldStateContext } from "@rivetjs/cdk/date-field";
import type { TimeFieldProps, TimeValue, DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
```

The state is `createTimeFieldState(options)` and `timeValue(state)` (React Stately `state.timeValue`) in `@rivetjs/cdk/state/time-field`; its methods are the date field's (`increment(state, "hour")`, … in `@rivetjs/cdk/state/date-field`). The attribute bags are `timeFieldProps(props, state)` in `@rivetjs/cdk/date-field/behaviour`.

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `TimeValue \| string \| null`, or `Signal<string \| null>` | none | Controlled value. A signal is two-way and holds the ISO string (`"09:30:00"`, or a date-time string when the value has a date). |
| `defaultValue` | `TimeValue \| string \| null` | none | Uncontrolled initial value; a form reset restores it. |
| `placeholderValue` | `TimeValue \| string \| null` | `12:00 AM` / `00:00` | Where spinning an empty segment starts. |
| `minValue`, `maxValue` | `TimeValue \| string \| null` | none | Built-in validation (`rangeUnderflow` / `rangeOverflow`). |
| `granularity` | `"hour" \| "minute" \| "second"` | `"minute"` | Smallest segment shown. |
| `hourCycle` | `12 \| 24` | the locale's | 12- or 24-hour display. |
| `hideTimeZone` | `boolean` | `false` | Hide the time zone segment of a zoned value. |
| `shouldForceLeadingZeros` | `boolean` | the locale's | `09:05` instead of `9:05`. |
| `isDisabled`, `isReadOnly`, `isRequired` | `boolean` | `false` | As in [DateField](date-field.md#props). |
| `isInvalid` | `boolean \| () => boolean` | none | Controlled invalid state; an accessor stays live. |
| `validationState` | `"valid" \| "invalid"` | none | Deprecated: use `isInvalid`. |
| `validate` | `(value: TimeValue \| null) => string \| string[] \| true \| null \| undefined` | none | Custom validation of the time. |
| `validationBehavior` | `"native" \| "aria"` | `"native"`, or the enclosing `<Form>`'s | |
| `name`, `form` | `string` | none | Hidden form input. |
| `autoFocus` | `boolean` | `false` | Focus the first segment on load. |
| `id` | `string` | generated | Base id of the parts. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | |
| `slot` | `string` | none | Slot name for a `TimeFieldContext` with `slots`. |
| `class`, `style` | value or `(renderProps) => value` | `rv-TimeField` | `DateFieldRenderProps`: `isInvalid()`, `isDisabled()`, `isReadOnly()`, `isRequired()`, `state`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `TimeField`; see [Render](#render). |
| `children` | content or `(renderProps) => content` | the preset `DateInput` | |
| `ref`, global DOM attributes | | none | The root. |

`TimeValue` is `Time | CalendarDateTime | ZonedDateTime` (`@rivetjs/cdk/date`). `DateInput` and `DateSegment` props: see [DateField](date-field.md#dateinput).

### Events

| Event | Type | Fires |
| --- | --- | --- |
| `onChange` | `(value: TimeValue \| null) => void` | The user changed the time, or cleared every segment. A `Time` unless the value (or the placeholder) has a date, or the default value has a time zone. |
| `onFocus`, `onBlur`, `onFocusChange` | | Focus enters / leaves the field (not between segments). |
| `onKeyDown`, `onKeyUp` | `(event: KeyboardEvent) => void` | A key on any segment, after the field handled it. |

## Value

`value` takes a time object, an ISO string or a two-way signal of the string; `defaultValue` seeds an uncontrolled field. `TimeField` accepts a plain `Time`, a `CalendarDateTime` or a `ZonedDateTime`, but only displays the time: with a date-time, editing keeps its date.

::example{id=time-field-controlled}

### Format options

The locale decides the hour cycle, the separators and the segment names. `granularity` picks the smallest segment, `hourCycle` forces 12 or 24 hours, `shouldForceLeadingZeros` pads the hour, and a zoned value shows its time zone unless `hideTimeZone`.

::example{id=time-field-format}

## Validation

`minValue` / `maxValue`, `validate`, `isInvalid` and server errors combine into one result, shown by `FieldError` (see [DateField validation](date-field.md#validation)).

::example{id=time-field-validation}

## Forms

`name` posts the ISO time (`09:45:00`) from a hidden input; `isRequired` with native validation blocks an empty submit and shows the browser's message. A form reset restores `defaultValue`.

::example{id=time-field-form}

## Events

::example{id=time-field-events}

## DOM events and attributes

As in [DateField](date-field.md#dom-events-and-attributes): props of `TimeField` land on the root, props of `DateInput` on the group, props of `DateSegment` on each segment; the field owns the keyboard and focus events of the segments. `on…Capture` handlers do not resume yet.

## Styling

Same selectors as [DateField](date-field.md#styling), with `.rv-TimeField` as the root class (`[data-invalid]`, `[data-disabled]`, `[data-readonly]`, `[data-required]`).

### Tailwind

::example{id=time-field-tailwind}

### Plain CSS

::example{id=time-field-css}

`@rivetjs/cdk/theme.css` styles `DateSegment` (placeholder colour, focused accent background); and draws `.rv-TimeField > .rv-DateInput` (like a `DateField`'s) as an input box with a red border on `[data-invalid]`.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `TimeField` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<TimeField render={(props) => <div {...(props as {})} />}>…</TimeField>
```

## Accessibility

- The `DateInput` is a `role="group"` named by the label; each segment is a `role="spinbutton"` named by its type and the label, with `aria-valuetext` ("9 AM", "Empty"). Literals and bidi isolates are `aria-hidden`.
- The keyboard is the [DateField keyboard](date-field.md#keyboard): digits type, :kbd[A] / :kbd[P] set the day period, :kbd[ArrowUp] / :kbd[ArrowDown] spin (wrapping), :kbd[PageUp] / :kbd[PageDown] step 2 hours / 15 minutes / 15 seconds, :kbd[Home] / :kbd[End] jump to the segment limits, :kbd[Backspace] clears, :kbd[ArrowLeft] / :kbd[ArrowRight] move between segments.

## Resumability

- Server HTML has every segment with its text, ARIA and `data-rk` keys; the first key typed into a cold field is held while the code loads.
- The value lives in a signal as a string; `onChange`, `validate` and the event handlers must be inline arrows or local functions.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `TimeField`, `TimeFieldContext`, `TimeFieldStateContext` | RAC `DateField.tsx` (`TimeField`) |
| `timeFieldProps` in `@rivetjs/cdk/date-field/behaviour` | react-aria `useTimeField` |
| `createTimeFieldState`, `timeValue` in `@rivetjs/cdk/state/time-field` | react-stately `useTimeFieldState` |

Deviations: no `locale` prop (`I18nProvider`); values may be ISO strings or a two-way signal; render props are accessors; the date-time conversion runs on read instead of per render. The range error message names the bound as a date and time ("Value must be 10/6/2026, 5:00 PM or earlier."), where React Aria shows the time only.

### Not yet supported

- `DateSegment` `HoverEvents`.
