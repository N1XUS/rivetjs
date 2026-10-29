---
title: DateField
description: DateField from @rivetjs/cdk lets users type a date and time segment by segment. Server-rendered segments, locale formats, granularity, validation, forms.
template: guide
status: experimental
related: [components/time-field, components/date-picker, components/date-range-picker, components/calendar, components/text-field, foundations/dates]
---

`DateField`, `DateInput`, `DateSegment` and `HiddenDateInput` build an editable date field. Each part of a date (month, day, year and, with a time, hour, minute, second, AM/PM and the time zone) is an individually editable segment, ordered and formatted for the locale. Each segment is a `role="spinbutton"`: type digits and focus moves on when the segment is full, or spin it with the arrow keys. The server renders every segment with its text and ARIA plus a hidden input that posts the ISO string; the value is that string in a signal.

::example{id=date-field-basic}

## Anatomy

```tsx
<DateField>
  <Label />
  <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
  <Text slot="description" />
  <FieldError />
</DateField>
```

Without children, `DateField` renders the `DateInput` of every segment (no label: pass `aria-label`).

Server HTML of the hero example (segment attributes trimmed):

```html
<div class="rv-DateField">
  <span id="appt-label" class="rv-Label">Appointment</span>
  <div id="appt" role="group" class="rv-DateInput" aria-labelledby="appt-label" aria-describedby="appt-description" data-rv-date-field="" data-rk="ArrowUp ArrowDown … 0 1 … 9 A a P p" style="unicode-bidi:isolate">
    <span id="appt-month" role="spinbutton" class="rv-DateSegment" data-type="month" data-placeholder="true" aria-label="month, " aria-labelledby="appt-month appt-label" aria-describedby="appt-description" aria-valuetext="Empty" aria-valuemin="1" aria-valuemax="12" contenteditable="true" inputmode="numeric" tabindex="0">mm</span>
    <span aria-hidden="true" data-type="literal" class="rv-DateSegment">/</span>
    <span id="appt-day" role="spinbutton" class="rv-DateSegment" data-type="day" …>dd</span>
    <span aria-hidden="true" data-type="literal" class="rv-DateSegment">/</span>
    <span id="appt-year" role="spinbutton" class="rv-DateSegment" data-type="year" …>yyyy</span>
  </div>
  <input id="appt-input" type="text" hidden value="" />
  <span id="appt-description" slot="description" class="rv-Text">Type digits or use the arrow keys.</span>
</div>
<span id="appt-value" hidden><!-- "Selected Date: October 14, 2026" --></span>
<div aria-hidden="true" data-testid="hidden-dateinput-container" style="(visually hidden, fixed)"><input type="date" tabindex="-1" form="" /></div>
```

| Part | Element | Default class | Id | Attributes |
| --- | --- | --- | --- | --- |
| `DateField` | `div` | `rv-DateField` | none (the `id` prop is the base of the part ids) | `data-invalid`, `data-disabled`, `data-readonly`, `data-required` |
| `Label` | `span` | `rv-Label` | `<id>-label` | a click focuses the first segment |
| `DateInput` | `div[role=group]` (a `Group`) | `rv-DateInput` | `<id>` | `aria-labelledby`, `aria-describedby`, `aria-disabled`, `data-rk`, plus the Group states `data-hovered`, `data-focus-within`, `data-focus-visible`, `data-disabled`, `data-invalid` |
| `DateSegment` | `span[role=spinbutton]` (time zone: `role="textbox"`) | `rv-DateSegment` | `<id>-<type>` (`appt-month`, `appt-hour`, `appt-dayPeriod`, …) | `data-type`, `data-placeholder`, `data-focused`, `data-focus-visible`, `data-hovered`, `data-invalid`, `data-readonly`, `data-disabled`, `aria-valuenow`, `aria-valuetext`, `aria-valuemin`, `aria-valuemax`, `aria-invalid`, `aria-required`, `aria-readonly` |
| Literal (`DateSegment` of type `literal`) | `span[aria-hidden]` | `rv-DateSegment` | none | `data-type="literal"` |
| Form input (`Input` after the group) | `input` | none | `<id>-input` | `name`, `form`, `required`, `disabled`, value = ISO string; `type="text" hidden` with native validation, `type="hidden"` with `aria` |
| `Text slot="description"` | `span` | `rv-Text` | `<id>-description` | |
| `FieldError` | `span` | `rv-FieldError` | `<id>-error` | rendered only while invalid |
| Value description | `span[hidden]` | none | `<id>-value` | "Selected Date: …", in `aria-describedby` while there is a value |
| `HiddenDateInput` | `input[type=date]` in a visually hidden `div` | none | none | `tabindex="-1"`, `form=""` (not submitted); browser autofill fills the field through it |

- Segment types: `era`, `year`, `month`, `day`, `hour`, `minute`, `second`, `dayPeriod`, `timeZoneName`, `literal`. A segment's name is its type in the locale before the field's label (`aria-label="month, "`, `aria-labelledby="appt-month appt-label"`).
- `aria-describedby` sits on the first editable segment, or on every segment while the field is invalid.
- Time segments are wrapped in bidi isolates (`⁦9:30⁩`): read the value from the signal, not the text.
- The value description and `HiddenDateInput` render as siblings after the root.

## Import

```tsx
import { DateField, DateInput, DateSegment, HiddenDateInput, DateFieldContext, DateFieldStateContext } from "@rivetjs/cdk/date-field";
import type { DateFieldProps, DateFieldRenderProps, DateInputProps, DateSegmentProps, DateSegmentItem, DateValue, DateValueString, Granularity } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
```

The state (`createDateFieldState`, `increment`, `setSegment`, `clearSegment`, …: react-stately's `DateFieldState` methods as functions) is `@rivetjs/cdk/state/date-field`; the attribute bags and handlers (`dateFieldProps`, `dateSegmentProps`, `hiddenDateInputProps`, `dateFieldKeyDown`, …) are `@rivetjs/cdk/date-field/behaviour`.

## Props

### DateField

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `DateValue \| string \| null`, or `Signal<string \| null>` | none | Controlled value. A signal is two-way and holds the ISO string. |
| `defaultValue` | `DateValue \| string \| null` | none | Uncontrolled initial value; a form reset restores it. |
| `placeholderValue` | `DateValue \| string \| null` | today at midnight | Sets the kind of value while empty (a date-time placeholder shows time segments) and where spinning an empty segment starts. |
| `minValue`, `maxValue` | `DateValue \| string \| null` | none | Built-in validation (`rangeUnderflow` / `rangeOverflow`). |
| `isDateUnavailable` | `(date: DateValue) => boolean` | none | Built-in validation: an unavailable date is invalid ("Selected date unavailable."). |
| `granularity` | `"day" \| "hour" \| "minute" \| "second"` | `"day"` for dates, `"minute"` for date-times | Smallest segment shown. Must exist in the value (`"hour"` on a `"2026-10-14"` value throws). |
| `maxGranularity` | `"year" \| "month" \| Granularity` | `"year"` | Largest segment shown: `"month"` drops the year, `"hour"` shows only the time. |
| `hourCycle` | `12 \| 24` | the locale's | 12- or 24-hour time segments. |
| `hideTimeZone` | `boolean` | `false` | Hide the time zone segment of a zoned value. |
| `shouldForceLeadingZeros` | `boolean` | the locale's | `03/04/2026` instead of `3/4/2026`. |
| `createCalendar` | `(identifier) => Calendar` | `createCalendar` of `@rivetjs/cdk/date` | Calendar system factory for the display calendar (bundle only the calendars you use). |
| `isDisabled` | `boolean` | `false` | Segments not focusable, form input disabled. |
| `isReadOnly` | `boolean` | `false` | Segments focusable, value fixed; still submitted. |
| `isRequired` | `boolean` | `false` | `aria-required`; with native validation the form input is `required`. |
| `isInvalid` | `boolean \| () => boolean` | none | Controlled invalid state; an accessor stays live. |
| `validationState` | `"valid" \| "invalid"` | none | Deprecated: use `isInvalid`. |
| `validate` | `(value: DateValue \| null) => string \| string[] \| true \| null \| undefined` | none | Custom validation of the value (a date object). |
| `validationBehavior` | `"native" \| "aria"` | `"native"`, or the enclosing `<Form>`'s | `native`: constraint validation, errors shown on commit (blur after a change, submit); `aria`: errors shown at once, submit never blocked. |
| `name` | `string` | none | Name of the hidden form input; `<Form validationErrors>` server errors apply by it. |
| `form` | `string` | none | Id of the form the input belongs to. |
| `autoComplete` | `string` | none | `autocomplete` of the autofill input (`"bday"`). |
| `autoFocus` | `boolean` | `false` | Focus the first segment on load. |
| `id` | `string` | generated | Base id of the parts. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | Naming / description of the group (use `aria-label` without a `Label`). |
| `slot` | `string` | none | Slot name for a `DateFieldContext` with `slots`. |
| `class` | `string \| (renderProps) => string` | `rv-DateField` | A function gets `DateFieldRenderProps`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `DateField`; see [Render](#render). |
| `style` | `StyleObject \| (renderProps) => StyleObject` | none | |
| `children` | content or `(renderProps) => content` | the preset `DateInput` | The parts. |
| `ref` | `Ref<HTMLDivElement>` | none | The root. |
| Global DOM attributes | `GlobalDOMAttributes` | none | `onPointerEnter`, `onDblClick`, `lang`, `dir`, `translate`, … on the root. |

`DateFieldRenderProps` (accessors): `isInvalid()`, `isDisabled()`, `isReadOnly()`, `isRequired()`, and `state`.

### DateInput

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `(segment: DateSegmentItem) => content` | required | Renders each segment: `(segment) => <DateSegment segment={segment} />`. |
| `class` | `string \| (renderProps) => string` | `rv-DateInput` | `DateInputRenderProps`: `isHovered()`, `isFocusWithin()`, `isFocusVisible()`, `isDisabled()`, `isInvalid()`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `DateInput`; see [Render](#render). |
| `style` | `StyleObject \| (renderProps) => StyleObject` | none | |
| `slot` | `string` | none | `start` / `end` inside a [DateRangePicker](date-range-picker.md). |
| `ref`, global DOM attributes | | none | The group `div`. |

`DateSegmentItem`: `key` (type + occurrence, `literal-1`), `type`, and accessors `text()`, `value()`, `minValue()`, `maxValue()`, `isPlaceholder()`, `placeholder()`, `isEditable()`.

### DateSegment

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `segment` | `DateSegmentItem` | required | The `DateInput` children argument. |
| `class` | `string \| (renderProps) => string` | `rv-DateSegment` | `DateSegmentRenderProps`: `type`, `text()`, `value()`, `minValue()`, `maxValue()`, `placeholder()`, `isPlaceholder()`, `isHovered()`, `isFocused()`, `isFocusVisible()`, `isReadOnly()`, `isDisabled()`, `isInvalid()`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<span>` of `DateSegment`; see [Render](#render). |
| `style` | `StyleObject \| (renderProps) => StyleObject` | none | Merged after the segment's own inline style. |
| `children` | content or `(renderProps) => content` | the segment text | |
| `ref`, global DOM attributes | | none | The segment `span`. |

### HiddenDateInput

`<HiddenDateInput state={…} name? autoComplete? isDisabled? />`: `DateField` renders it already; render it yourself only around a custom field state.

### Events

| Event | Type | Fires |
| --- | --- | --- |
| `onChange` | `(value: DateValue \| null) => void` | The user changed the value to another complete date, or cleared every segment. Not for programmatic writes to `value`. The date is in the calendar system of the original value. |
| `onFocus`, `onBlur` | `(event: FocusEvent) => void` | Focus enters / leaves the field (not when it moves between segments). |
| `onFocusChange` | `(isFocused: boolean) => void` | Both of the above. |
| `onKeyDown`, `onKeyUp` | `(event: KeyboardEvent) => void` | A key on any segment, after the field handled it. |

## Value

### Controlled and uncontrolled

`value` takes a date object, an ISO string or a two-way signal of the string: writing the signal (`date.set("2026-12-25")`, `date.set(null)`) updates the segments, editing writes it. Without `value`, `defaultValue` seeds the field's own value. Strings: `"2026-10-14"` (date), `"2026-10-14T09:30:00"` (date-time), `"2026-10-14T09:30:00+02:00[Europe/Paris]"` (zoned), `"2026-10-14[u-ca=japanese]"` (another calendar system); see [Dates](../foundations/dates.md).

::example{id=date-field-controlled}

- While some segments are empty (or the date does not exist, like February 30), the value stays the last complete date; the field shows the partial input. Clearing every segment sets it to `null`.
- An impossible complete date is constrained on blur (February 30 → February 28 / 29).

### Format options

The kind of value decides the segments: a date shows date segments, a date-time adds hour and minute, a zoned value adds the time zone. `granularity` picks the smallest segment, `maxGranularity` the largest, `hourCycle` 12 or 24 hours. An empty field takes the kind from `placeholderValue`.

::example{id=date-field-granularity}

### International calendars

The `I18nProvider` locale orders the segments and names them; the placeholders follow the browser's `<input type="date">` strings (`mm/dd/yyyy`, `tt.mm.jjjj`, …). A locale with a calendar extension (`-u-ca-japanese`, `-u-ca-buddhist`, …) displays the date in that calendar system; `onChange` still gets a date in the calendar of the `value` / `defaultValue` (Gregorian without one).

::example{id=date-field-format}

## Validation

Built-in rules (`minValue`, `maxValue`, `isDateUnavailable`), `validate`, `isInvalid` and server errors combine into one result. It sets `aria-invalid` on the segments, `data-invalid` on the root, group and segments, and with native validation the form input's custom validity. `FieldError` shows the messages joined, or its children: content, or a function of `{ isInvalid(), validationErrors(), validationDetails() }`.

::example{id=date-field-validation}

- `native` (default): the form input is `required` with `isRequired` and carries the custom validity, so the browser blocks the submit and focuses the first invalid segment. Errors show on commit: blur after a change, or submit.
- `aria`: errors show as soon as the value is invalid, including in the server HTML; nothing blocks the submit.
- Inside `<Form validationBehavior="aria">` the fields take the form's behaviour; `<Form validationErrors={{ start: "Fully booked" }}>` shows server errors by `name` until the field is edited (see [Form](form.md)).

## Forms

`name` posts the ISO string from a hidden input (`""` while empty); `form` ties it to a form elsewhere by id. A form reset restores `defaultValue`. `HiddenDateInput` lets browser autofill (`autoComplete`) fill the segments; it is not submitted.

::example{id=date-field-form}

## Disabled and read-only

::example{id=date-field-disabled}

## Events

The field handles a key first (spin, type, move), then calls `onKeyDown`. Focus events fire once for the whole field.

::example{id=date-field-events}

## DOM events and attributes

| Where you pass them | Element |
| --- | --- |
| props of `DateField` | the root `div.rv-DateField` |
| props of `DateInput` | the group `div[role=group]` |
| props of `DateSegment` | that segment `span` (literals included) |

The group owns `onPointerDown` / `onPointerUp` (a press on the group focuses a segment) and runs your handlers of the same name after its own; `DateSegment` owns `onPointerEnter` / `onPointerLeave` (hover state) the same way. Keyboard, input and focus events of the segments are the field's: use `onKeyDown` / `onKeyUp` / `onFocus` / `onBlur` / `onFocusChange` on `DateField`. `on…Capture` handlers work on resumed pages too, the first event included.

::example{id=date-field-dom-events}

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-DateField[data-invalid]` (also `[data-disabled]`, `[data-readonly]`, `[data-required]`) | Field state | `data-[invalid]:` on the root, `group-data-[invalid]:` on parts |
| `.rv-DateInput[data-focus-within]`, `:focus-within` | A segment is focused | `focus-within:` |
| `.rv-DateInput[data-invalid]`, `[data-disabled]` | Group state | `data-[invalid]:` |
| `.rv-DateSegment[data-focused]`, `:focus` | The focused segment | `focus:` |
| `.rv-DateSegment[data-placeholder]` | Empty segment | `data-[placeholder]:` |
| `.rv-DateSegment[data-type="literal"]` (`month`, `hour`, `dayPeriod`, …) | Segment of a type | `data-[type=literal]:` |
| `.rv-DateSegment[data-invalid]`, `[aria-invalid="true"]` | Segment of an invalid field | `data-[invalid]:` |
| `.rv-FieldError`, `.rv-Text`, `.rv-Label` | Error, description, label | |

`class` / `style` of each part replace the defaults; as functions they get the render props (accessors: `class={({ isPlaceholder }) => isPlaceholder() ? "…" : "…"}`). The caret is hidden inline (`caret-color: transparent`) and the group isolates its direction (`unicode-bidi: isolate`); in RTL locales numeric segments embed left-to-right. No other style is needed for behaviour.

### Tailwind

::example{id=date-field-tailwind}

### Plain CSS

::example{id=date-field-css}

### Starter theme

`@rivetjs/cdk/theme.css` (used by the hero example) draws the `DateInput` of a `DateField` as an input box, dims placeholder segments, highlights the focused segment with the accent colour and turns the border red on `[data-invalid]`. Its rules use `:where(…)`, so any rule of yours wins.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `DateField` (`<div>`), `DateInput` (`<div>`), `DateSegment` (`<span>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<DateField render={(props) => <div {...(props as {})} />}>…</DateField>
```

## Accessibility

- The `DateInput` is a `role="group"` named by the label; each editable segment is a `role="spinbutton"` named by its type and the label, with `aria-valuenow` / `aria-valuetext` ("Empty" when unset; months read as "10 – October", hours with AM/PM), `aria-valuemin` / `aria-valuemax`.
- Literals are `aria-hidden`. The selected value is described ("Selected Date: October 14, 2026") through a hidden span.
- A label click focuses the first segment. A press on the group outside the segments focuses the segment before the press point (the last one past the end), stepping back over trailing empty segments (mouse on press start, touch and pen on release).
- After each change the new value text of the focused segment is announced (assertive live region, as `useSpinButton`).

### Keyboard

| Key | Action |
| --- | --- |
| Digits | Type into the segment; focus moves on when no further digit fits (`2` in a month moves on, `1` waits for `0`–`2`). |
| :kbd[A], :kbd[P] (the locale's day period letters), era letters | Set AM / PM, the era. |
| :kbd[ArrowUp], :kbd[ArrowDown] | Increment / decrement the segment, wrapping; an empty segment starts from the placeholder date. |
| :kbd[PageUp], :kbd[PageDown] | Larger steps: 5 years, 2 months, 7 days, 2 hours, 15 minutes, 15 seconds. |
| :kbd[Home], :kbd[End] | Segment minimum / maximum. |
| :kbd[Backspace], :kbd[Delete] | Remove the last digit; on an empty segment, focus the previous one. |
| :kbd[ArrowLeft], :kbd[ArrowRight] | Previous / next segment (by position, so RTL works). |
| :kbd[Tab] | Next segment, then out of the field. |

## Resumability

- Server HTML: every segment with its text, ARIA and `data-rk` (the spin, navigation and digit keys, plus the day period letters). Rivet holds those keys while the field's code loads, so the first key typed into a cold field is not lost or inserted as text.
- The state is plain signals plus strings; the value, the partial input and the validation resume without re-rendering. Segments are rows keyed by type + occurrence, so the nodes (and focus) stay while values change.
- The `DateInput` children function is a slot: write it inline.
- `on…Capture` handlers work on resumed pages too, the first event included.

## Testing

`@rivetjs/testing` has no DateField tester yet. In a browser test, focus a segment (`#<id>-month`) and press keys; read the value from your signal or the hidden input (`#<id>-input`).

## Upstream

| Rivet | Upstream |
| --- | --- |
| `DateField`, `DateInput`, `DateSegment`, `HiddenDateInput`, `DateFieldContext`, `DateFieldStateContext` | RAC `DateField.tsx`, `HiddenDateInput.tsx` |
| `@rivetjs/cdk/date-field/behaviour` | react-aria `useDateField`, `useDateSegment`, `useDatePickerGroup`, `useDisplayNames`, `useSpinButton` (keyboard / ARIA part), `useHiddenDateInput` |
| `@rivetjs/cdk/state/date-field` | react-stately `useDateFieldState`, `IncompleteDate`, placeholders, `getFormatOptions` / validation utils |
| Dates | `@internationalized/date` ported as `@rivetjs/cdk/date` |

Deviations:

- No `locale` prop: the locale comes from `I18nProvider` (as in RAC, where `locale` is a hook option only).
- Values may be ISO strings and `value` a two-way signal of the string (`onChange` still gets the date object).
- Render props are accessors (`isPlaceholder()`), and `DateInput`'s children function gets a `DateSegmentItem` (key, type + accessors) instead of React Stately's segment object.
- Typing is handled on `keydown` (and `beforeinput` for IME / virtual keyboards), so a cold first key is held instead of inserted.
- The time zone segment is a `textbox` (React Aria switches every segment to `textbox` on iOS at runtime; Rivet renders on the server).

### Not yet supported

- `DateSegment` `HoverEvents` (`onHoverStart`, …; the `isHovered` render prop works).
