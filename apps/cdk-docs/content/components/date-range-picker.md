---
title: DateRangePicker
description: DateRangePicker from @rivetjs/cdk combines two date fields and a RangeCalendar popover. Typed or picked ranges, times, unavailable dates, validation, forms.
template: guide
status: experimental
related: [components/date-picker, components/date-field, components/range-calendar, components/popover, foundations/dates]
---

`DateRangePicker` combines two editable date fields with a range calendar. You compose it from parts: a `Label`, a `Group` with two [DateField](date-field.md) inputs (`DateInput slot="start"` and `slot="end"`) and a calendar `Button`, and a `Popover` with a `Dialog` holding a [RangeCalendar](range-calendar.md). Type in either field, or open the calendar: the first click anchors the range, the second completes it and closes the popover. Everything but the popover is in the server HTML; the popover renders only while open. The single-date version is [DatePicker](date-picker.md).

::example{id=date-range-picker-basic}

- The value is `{ start, end }` ISO strings in a two-way signal (`signal<{ start: string; end: string } | null>()`), or `null` until both ends are set. `onChange` gets `{ start, end }` date objects ([Dates](../foundations/dates.md)).
- The locale comes from the enclosing `I18nProvider` (`@rivetjs/cdk/i18n-provider`); there is no `locale` prop.

## Anatomy

```tsx
<DateRangePicker>
  <Label />
  <Group>
    <DateInput slot="start">{(segment) => <DateSegment segment={segment} />}</DateInput>
    <span aria-hidden="true">–</span>
    <DateInput slot="end">{(segment) => <DateSegment segment={segment} />}</DateInput>
    <Button />
  </Group>
  <Text slot="description" />
  <FieldError />
  <Popover>
    <Dialog>
      <RangeCalendar />
    </Dialog>
  </Popover>
</DateRangePicker>
```

Without children, `DateRangePicker` renders this anatomy without the label, description and error (pass `aria-label`); the preset button and the preset calendar's page buttons have no content (headless). The parts get their props from the picker through contexts (RAC slots): any `Group`, `DateInput`, `Button`, `Label`, `Text`, `FieldError`, `Popover`, `Dialog` and `RangeCalendar` inside it is the picker's. The separator is your own markup.

Server HTML of the hero example (segment attributes trimmed):

```html
<div class="rv-DateRangePicker" data-rv-date-picker="">
  <span id="stay-label" class="rv-Label">Stay</span>
  <div id="stay" role="group" class="rv-Group" aria-labelledby="stay-label" aria-describedby="stay-description">
    <div id="stay-start" role="presentation" slot="start" class="rv-DateInput" data-rv-date-field="" data-rv-focus-scope="stay" data-rk="ArrowUp ArrowDown … 0 1 … 9 A a P p" style="unicode-bidi:isolate">
      <span id="stay-start-month" role="spinbutton" class="rv-DateSegment" data-type="month" data-placeholder="true" aria-label="month, Start Date, " aria-labelledby="stay-start-month stay-start stay-label" aria-valuetext="Empty" …>mm</span>
      <span aria-hidden="true" data-type="literal" class="rv-DateSegment">/</span>
      …
    </div>
    <input id="stay-start-input" type="text" hidden value="" />
    <span aria-hidden="true">–</span>
    <div id="stay-end" role="presentation" slot="end" class="rv-DateInput" …>…</div>
    <input id="stay-end-input" type="text" hidden value="" />
    <button type="button" id="stay-button" class="rv-Button" aria-label="Calendar" aria-labelledby="stay-button stay-label" aria-describedby="stay-description" aria-haspopup="dialog" aria-expanded="false"><svg aria-hidden="true" …></svg></button>
  </div>
  <span id="stay-description" slot="description" class="rv-Text">Check-in to check-out.</span>
  <span data-rv-overlay-anchor="" style="display:contents"></span>
</div>
<span id="stay-value" hidden><!-- "Selected Range: October 16 to 20, 2026" --></span>
```

Open, in the overlay layer:

```html
<div class="rv-Popover" data-trigger="DateRangePicker" data-placement="bottom" data-rv-overlay="" style="position:absolute; …">
  <section id="stay-dialog" class="rv-Dialog" role="dialog" tabindex="-1" aria-labelledby="stay-button stay-label">
    <div role="application" class="rv-RangeCalendar" aria-label="October 2026" data-commit-behavior="select">…</div>
  </section>
</div>
```

| Part | Element | Default class | Id | Attributes |
| --- | --- | --- | --- | --- |
| `DateRangePicker` | `div` | `rv-DateRangePicker` | none (the `id` prop is the base of the part ids) | `data-focus-within`, `data-focus-visible`, `data-open`, `data-invalid`, `data-disabled`, `data-readonly`, `data-required` |
| `Label` | `span` | `rv-Label` | `<id>-label` | a click focuses the first segment |
| `Group` | `div[role=group]` | `rv-Group` | `<id>` | `aria-labelledby`, `aria-describedby`, `aria-disabled`; Group states `data-hovered`, `data-focus-within`, `data-focus-visible`, `data-disabled`, `data-invalid` |
| `DateInput slot="start"` / `slot="end"` | `div[role=presentation]` | `rv-DateInput` | `<id>-start`, `<id>-end` | `slot`, `data-rk`; segments `<id>-start-<type>`, `<id>-end-<type>`, named by type, "Start Date" / "End Date" (localized) and the label |
| `DateSegment` | `span[role=spinbutton]` | `rv-DateSegment` | `<id>-start-month`, … | as in [DateField](date-field.md#anatomy) |
| Form inputs | `input` | none | `<id>-start-input`, `<id>-end-input` | `name` from `startName` / `endName`, `form`, `required`, `disabled`, value = ISO string |
| `Button` | `button` | `rv-Button` | `<id>-button` | `aria-label="Calendar"`, `aria-haspopup="dialog"`, `aria-expanded`, `data-pressed` while open, `disabled` when disabled or read-only |
| `Text slot="description"` | `span` | `rv-Text` | `<id>-description` | |
| `FieldError` | `span` | `rv-FieldError` | `<id>-error` | rendered only while invalid |
| Value description | `span[hidden]` | none | `<id>-value` | "Selected Range: …", in `aria-describedby` of the group and the button while there is a value |
| `Popover` | `div` | `rv-Popover` | none | `data-trigger="DateRangePicker"`, `data-placement`, `data-entering`, `data-exiting`; placement `bottom start` against the group |
| `Dialog` | `section[role=dialog]` | `rv-Dialog` | `<id>-dialog` | labelled by the button and the label |
| `RangeCalendar` | `div[role=application]` | `rv-RangeCalendar` | generated | see [RangeCalendar](range-calendar.md#anatomy); focus moves to its focused cell on open |

There is no hidden autofill `<input type="date">` (DatePicker and DateField have one). The value description renders as a sibling after the root.

## Import

```tsx
import { DateRangePicker, DateRangePickerContext, DateRangePickerStateContext } from "@rivetjs/cdk/date-picker";
import type { DateRangePickerProps, DateRangePickerRenderProps, RangeValue, DateValue, DateValueString } from "@rivetjs/cdk/date-picker";
import { DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { RangeCalendar, CalendarGrid, CalendarCell } from "@rivetjs/cdk/calendar";
import { Group } from "@rivetjs/cdk/group";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Popover } from "@rivetjs/cdk/popover";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
```

The state (`createDateRangePickerState`, `setDateRange`, `setTimeRange`, `setDate`, `setTime`, `setOpen`, `formatValue`, …: react-stately's `DateRangePickerState` methods as functions) is `@rivetjs/cdk/state/date-picker`; the attribute bags (`dateRangePickerProps`, `datePickerGroupKeyDown`, …) are `@rivetjs/cdk/date-picker/behaviour`.

## Props

### DateRangePicker

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `{ start, end } \| null` (`DateValue` or ISO strings), or `Signal<{ start: string; end: string } \| null>` | none | Controlled value. A signal is two-way and holds the ISO strings. |
| `defaultValue` | `{ start, end } \| null` (`DateValue` or ISO strings) | none | Uncontrolled initial value; a form reset restores it. |
| `placeholderValue` | `DateValue \| string \| null` | today at midnight | Sets the kind of value while empty (a date-time placeholder shows time segments), where spinning starts, the calendar's first focused day and the time of picked days. |
| `minValue`, `maxValue` | `DateValue \| string \| null` | none | Days outside are disabled in the calendar; ends outside are invalid. |
| `isDateUnavailable` | `(date: DateValue, anchorDate: CalendarDate \| null) => boolean` | none | Unavailable days (`data-unavailable`); gets the anchor (first picked day) while a range is being picked. An end on an unavailable day is invalid. |
| `allowsNonContiguousRanges` | `boolean` | `false` | With `isDateUnavailable`: a range may span unavailable days. Without it, days past the next unavailable one are disabled once a range is anchored. |
| `granularity` | `"day" \| "hour" \| "minute" \| "second"` | `"day"` for dates, `"minute"` for date-times | Smallest segment shown in both fields. |
| `hourCycle` | `12 \| 24` | the locale's | |
| `hideTimeZone` | `boolean` | `false` | Hide the time zone segments of zoned values. |
| `shouldForceLeadingZeros` | `boolean` | the locale's | |
| `createCalendar` | `(identifier) => Calendar` | `createCalendar` of `@rivetjs/cdk/date` | Calendar system factory of the fields' display calendar. |
| `isOpen` | `boolean \| Signal<boolean>` | none | Controlled open state; a signal is two-way. |
| `defaultOpen` | `boolean` | `false` | Uncontrolled initial open state. |
| `shouldCloseOnSelect` | `boolean \| () => boolean` | `true` | Close the popover once a range is picked. |
| `firstDayOfWeek` | `"sun" \| "mon" \| … \| "sat"` | the locale's | Passed to the RangeCalendar. |
| `pageBehavior` | `"visible" \| "single"` | `"visible"` | Passed to the RangeCalendar. |
| `isDisabled` | `boolean` | `false` | Segments not focusable, button and inputs disabled. |
| `isReadOnly` | `boolean` | `false` | Segments focusable, value fixed, button disabled; still submitted. |
| `isRequired` | `boolean` | `false` | `aria-required` on the segments; with native validation both inputs are `required`. |
| `isInvalid` | `boolean \| () => boolean` | none | Controlled invalid state; an accessor stays live. |
| `validationState` | `"valid" \| "invalid"` | none | Deprecated: use `isInvalid`. |
| `validate` | `(value: { start: DateValue; end: DateValue }) => string \| string[] \| true \| null \| undefined` | none | Custom validation of the range (date objects). |
| `validationBehavior` | `"native" \| "aria"` | `"native"`, or the enclosing `<Form>`'s | As in [DateField](date-field.md#validation). |
| `validationErrors` | `ValidationErrors \| () => ValidationErrors` | the `<Form>`'s | Server errors, applied by `startName` / `endName`. |
| `startName`, `endName` | `string` | none | Names of the two form inputs. |
| `name` | `string` | none | Not used by the range picker (shared base option); use `startName` / `endName`. |
| `form` | `string` | none | Id of the form both inputs belong to. |
| `id` | `string` | generated | Base id of the parts. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | Naming / description of the group (use `aria-label` without a `Label`). |
| `slot` | `string` | none | Slot name for a `DateRangePickerContext` with `slots`. |
| `class` | `string \| (renderProps) => string` | `rv-DateRangePicker` | A function gets `DateRangePickerRenderProps`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `DateRangePicker`; see [Render](#render). |
| `style` | `StyleObject \| (renderProps) => StyleObject` | none | |
| `children` | content or `(renderProps) => content` | the preset anatomy | The parts. |
| `ref` | `Ref<HTMLDivElement>` | none | The root. |
| Global DOM attributes | `GlobalDOMAttributes` | none | `dir`, `lang`, `onPointerEnter`, `onDblClick`, … on the root. |

`DateRangePickerRenderProps` (accessors): `isFocusWithin()`, `isFocusVisible()`, `isDisabled()`, `isReadOnly()`, `isInvalid()`, `isRequired()`, `isOpen()`, and `state`.

The parts keep their own props: [DateInput and DateSegment](date-field.md#props), [RangeCalendar](range-calendar.md#props), [Popover](popover.md), `Group`, `Button` (`class` functions get `isPressed()`, `isHovered()`, `isFocusVisible()`, …), `Dialog`, `Label`, `Text`, `FieldError`.

### Events

| Event | Type | Fires |
| --- | --- | --- |
| `onChange` | `(value: { start: DateValue; end: DateValue } \| null) => void` | A complete range changed (typed, spun or picked), or the range was cleared. Not for programmatic writes to `value`. |
| `onOpenChange` | `(isOpen: boolean) => void` | The popover opened or closed. |
| `onFocus`, `onBlur` | `(event: FocusEvent) => void` | Focus enters / leaves the group; moving between the start field, the end field and the button fires neither. |
| `onFocusChange` | `(isFocused: boolean) => void` | Both of the above. |
| `onKeyDown`, `onKeyUp` | `(event: KeyboardEvent) => void` | A key in the group, after the picker handled it. |

## Value

### Controlled and uncontrolled

`value` takes `{ start, end }` date objects or ISO strings, or a two-way signal of the strings: writing the signal updates both fields (`null` clears them), typing or picking writes it. `isOpen` opens the calendar with the range selected. Without `value`, `defaultValue` seeds the picker's own value.

::example{id=date-range-picker-controlled}

- The value is `null` until both ends are complete; while one field is partly typed, the value keeps the last complete range.
- A typed end completes the range at once: no popover needed.

### Format options

`granularity` adds time segments to both fields; `hourCycle`, `hideTimeZone` and `shouldForceLeadingZeros` work as in [DateField](date-field.md#format-options). A picked day keeps the current time of its end, or takes the placeholder's time (midnight by default). Zoned ends may be in different time zones.

::example{id=date-range-picker-granularity}

### International calendars

The `I18nProvider` locale orders and names the segments ("Startdatum" / "Enddatum"), sets the calendar's first day of the week and the value description. A calendar extension (`ja-JP-u-ca-japanese`) displays another calendar system; the value and `onChange` stay in the calendar of the `value` / `defaultValue` (Gregorian without one).

::example{id=date-range-picker-format}

## Calendar options

`isDateUnavailable`, `allowsNonContiguousRanges`, `minValue` / `maxValue`, `firstDayOfWeek` and `pageBehavior` reach the popover's RangeCalendar. `isDateUnavailable` also receives the anchor date while a range is picked, so "at most 7 nights" is a one-liner. `shouldCloseOnSelect={false}` keeps the popover open after a range is complete; closing it (Escape, an outside press) commits.

::example{id=date-range-picker-options}

### The popover calendar

The `Popover` holds any [RangeCalendar](range-calendar.md) composition: page buttons with icons, `CalendarGridHeader` / `CalendarGridBody`, custom cell content, or several months with `visibleDuration` and `CalendarGrid offset`.

::example{id=date-range-picker-calendar}

## Validation

Built-in rules (`minValue`, `maxValue`, `isDateUnavailable`, and a reversed range: "Start date must be before end date."), `validate`, `isInvalid` and server errors combine into one result. It sets `data-invalid` on the root and the group, `aria-invalid` on the segments, the custom validity of both inputs with native validation, and the invalid state of the popover's calendar. `FieldError` shows the messages joined, or its children: content, or a function of `{ isInvalid(), validationErrors(), validationDetails() }`.

::example{id=date-range-picker-validation}

- `native` (default): with `isRequired` both inputs are `required`, so the browser blocks the submit; errors show on commit (blur after a change, submit). `aria`: errors show at once, server HTML included; nothing blocks a submit.
- `<Form validationErrors={{ checkin: "Fully booked" }}>` shows server errors by `startName` / `endName` (see [Form](form.md)).

## Forms

`startName` and `endName` post the two ISO strings (`""` while empty); `form` ties both inputs to a form elsewhere by id. Read-only ranges are submitted, disabled ones are not. A form reset restores `defaultValue`.

::example{id=date-range-picker-form}

## Disabled and read-only

::example{id=date-range-picker-disabled}

## Events

The picker handles a key first (spin, type, move across both fields and the button, :kbd[Alt]+:kbd[ArrowDown] to open), then calls `onKeyDown`. Focus events fire once for the whole group.

::example{id=date-range-picker-events}

## DOM events and attributes

| Where you pass them | Element |
| --- | --- |
| props of `DateRangePicker` | the root `div.rv-DateRangePicker` |
| props of `Group` | the group `div[role=group]` |
| props of each `DateInput` | that field `div` (`event.currentTarget.id` is `<id>-start` / `<id>-end`) |
| props of `DateSegment` | that segment `span` |
| props of `Button` | the calendar `button` |
| props of `Popover`, `Dialog` | the popover `div`, the `section[role=dialog]` |

The root owns `onFocusIn` / `onFocusOut`; the group owns `onKeyDown`, `onPointerDown` and `onPointerUp` and runs yours after its own; the button's press opens the popover, and a `Button` `onClick` runs as well. Keyboard and focus events of the segments are the picker's: use `onKeyDown` / `onKeyUp` / `onFocus` / `onBlur` / `onFocusChange` on `DateRangePicker`. `on…Capture` handlers work on resumed pages too, the first event included.

::example{id=date-range-picker-dom-events}

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-DateRangePicker[data-open]` (also `[data-invalid]`, `[data-disabled]`, `[data-readonly]`, `[data-required]`, `[data-focus-within]`, `[data-focus-visible]`) | Picker state | `group-data-[open]:` on parts (root `class="group"`) |
| `.rv-DateRangePicker > .rv-Group[data-focus-within]` | A segment or the button is focused | `data-[focus-within]:` |
| `.rv-DateInput[slot="start"]`, `[slot="end"]` | One of the two fields | |
| `.rv-DateSegment[data-placeholder]`, `[data-type="literal"]`, `:focus` | Segment states, as in [DateField](date-field.md#styling) | `data-[placeholder]:`, `focus:` |
| `.rv-Group > .rv-Button[data-pressed]` | The calendar button while open | render-prop `isPressed()` |
| `.rv-Popover[data-trigger="DateRangePicker"]` | The popover of a range picker | |
| `.rv-CalendarCell[data-selected]`, `[data-selection-start]`, `[data-selection-end]` | Days inside the range, its ends | render-prop `isSelected()`, `isSelectionStart()`, `isSelectionEnd()` |
| `.rv-CalendarCell[data-unavailable]`, `[data-disabled]`, `[data-outside-month]`, `[data-focus-visible]`, `[data-invalid]` | Other day states, see [RangeCalendar](range-calendar.md#styling) | |
| `.rv-FieldError`, `.rv-Text`, `.rv-Label` | Error, description, label | |

`class` / `style` of each part replace the defaults; as functions they get the part's render props (accessors). No style is needed for behaviour: the popover positions itself inline, the segments hide the caret inline.

### Tailwind

::example{id=date-range-picker-tailwind}

### Plain CSS

::example{id=date-range-picker-css}

### Starter theme

`@rivetjs/cdk/theme.css` (used by the hero example) draws the picker's `Group` as an input box (red border on `[data-invalid]`), the segments and the button, the popover surface and its enter / exit fade. It has no calendar rules: the examples add a small range calendar look. Its rules use `:where(…)`, so any rule of yours wins.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `DateRangePicker` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<DateRangePicker render={(props) => <div {...(props as {})} />}>…</DateRangePicker>
```

## Accessibility

- One `role="group"` named by the label; the two `DateInput`s are `role="presentation"`; each segment is a `role="spinbutton"` named by its type, "Start Date" / "End Date" and the label.
- The selected range is described ("Selected Range: October 16 to 20, 2026") on the group and the button; the description and the error join it.
- The button is named "Calendar" plus the label, `aria-haspopup="dialog"`, `aria-expanded`. The dialog is labelled by the button and the label; on open focus moves to the calendar's focused day, on close back to the group.

### Keyboard

| Key | Action |
| --- | --- |
| Digits, :kbd[ArrowUp], :kbd[ArrowDown], :kbd[PageUp], :kbd[PageDown], :kbd[Home], :kbd[End], :kbd[Backspace] | Edit the focused segment, as in [DateField](date-field.md#keyboard). |
| :kbd[ArrowLeft], :kbd[ArrowRight] | Previous / next segment across both fields and the button. |
| :kbd[Alt]+:kbd[ArrowDown], :kbd[Alt]+:kbd[ArrowUp] | Open the calendar. |
| :kbd[Enter], :kbd[Space] on the button | Open the calendar. |
| In the calendar: arrows, :kbd[PageUp], :kbd[PageDown], :kbd[Home], :kbd[End] | Move the focused day, as in [RangeCalendar](range-calendar.md#keyboard). |
| In the calendar: :kbd[Enter], :kbd[Space] | Anchor the range (focus moves on to the next day, as in React Aria), then complete it on the focused day (closes unless `shouldCloseOnSelect={false}`). |
| :kbd[Escape] | Close the calendar (commits a complete range). |

## Resumability

- Server HTML: the group, both fields with every segment, the two form inputs, the button and the value description. The popover and its calendar render on the first open (nothing calendar-related ships before it).
- The state is plain signals plus strings: the value, the partial input, the open state and the validation resume without re-rendering.
- Parts may come from your own components (`<RangeFields />`, `<RangePopover />` in the examples): they read the picker's contexts.
- `on…Capture` handlers work on resumed pages too, the first event included.

## Testing

`@rivetjs/testing` has no DateRangePicker tester yet. In a browser test, focus a segment (`#<id>-start-month`) and press keys, or click `#<id>-button` and the days (`[data-date="2026-10-16"]`); read the value from your signal or the inputs (`#<id>-start-input`, `#<id>-end-input`).

## Upstream

| Rivet | Upstream |
| --- | --- |
| `DateRangePicker`, `DateRangePickerContext`, `DateRangePickerStateContext` | RAC `DatePicker.tsx` (`DateRangePicker`) |
| `@rivetjs/cdk/date-picker/behaviour` | react-aria `useDateRangePicker`, `useDatePickerGroup` |
| `@rivetjs/cdk/state/date-picker` | react-stately `useDateRangePickerState` |

Deviations:

- No `locale` prop: the locale comes from `I18nProvider`.
- Values may be ISO strings and `value` / `isOpen` two-way signals (`onChange` still gets date objects).
- Render props are accessors (`isOpen()`).
- The popover renders only while open; closing it commits from a component mounted while open (React Stately commits in `setOpen(false)`).

### Not yet supported

- `autoFocus`, and a hidden autofill `<input type="date">` / `autoComplete`.
- Spectrum-only props of the upstream table (`label`, `description`, `errorMessage`, `contextualHelp`, `labelPosition`, `labelAlign`, `necessityIndicator`, `size`, `maxVisibleMonths`, `styles`, `UNSAFE_*`): compose the parts instead.
- `commitBehavior` is a `RangeCalendar` prop, not a picker prop.
