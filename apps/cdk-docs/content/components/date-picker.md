---
title: DatePicker
description: DatePicker from @rivetjs/cdk combines a segmented DateInput with a Calendar in a popover. RAC parts, typed or picked dates and times, validation, forms.
template: guide
status: experimental
related: [components/date-field, components/date-range-picker, components/calendar, components/popover, components/time-field, foundations/dates]
---

`DatePicker` is a port of React Aria Components' `DatePicker` (with react-aria `useDatePicker` / `useDatePickerGroup` and react-stately `useDatePickerState`). It combines a [DateField](date-field.md)'s segments with a [Calendar](calendar.md) in a [Popover](popover.md): you compose the parts (`Label`, `Group`, `DateInput`, `Button`, `Popover`, `Dialog`, `Calendar`, `Text`, `FieldError`), the picker wires them together through contexts. The button (or :kbd[Alt]+:kbd[ArrowDown] on a segment) opens the calendar under the group; focus moves to the calendar's focused date, picking a date closes it and fills the field, :kbd[Escape] closes it and focus returns. The server renders the label, the segments, the button and a hidden form input; a closed picker renders no popover. For a range, see [DateRangePicker](date-range-picker.md).

::example{id=date-picker-basic}

## Anatomy

```tsx
<DatePicker>
  <Label />
  <Group>
    <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
    <Button />
  </Group>
  <Text slot="description" />
  <FieldError />
  <Popover>
    <Dialog>
      <Calendar>
        <header>
          <Button slot="previous" />
          <Heading />
          <Button slot="next" />
        </header>
        <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </Calendar>
    </Dialog>
  </Popover>
</DatePicker>
```

Without children, `DatePicker` renders that anatomy itself (no label: pass `aria-label`; the buttons have no icons: headless). The `Calendar` inside is any [Calendar](calendar.md) composition (several months, custom cells, month / year pickers).

Server HTML of the hero example, closed (segment attributes trimmed):

```html
<div class="rv-DatePicker" data-rv-date-picker="">
  <span id="trip-label" class="rv-Label">Departure</span>
  <div id="trip" role="group" class="rv-Group" aria-labelledby="trip-label" aria-describedby="trip-description">
    <div id="trip-field" role="presentation" class="rv-DateInput" data-rv-date-field="" data-rk="ArrowUp ArrowDown … 0 1 … 9 A a P p" style="unicode-bidi:isolate">
      <span id="trip-field-month" role="spinbutton" class="rv-DateSegment" data-type="month" data-placeholder="true" aria-label="month, " aria-labelledby="trip-field-month trip-label" aria-valuetext="Empty" contenteditable="true" inputmode="numeric" tabindex="0">mm</span>
      <span aria-hidden="true" data-type="literal" class="rv-DateSegment">/</span>
      <span id="trip-field-day" role="spinbutton" class="rv-DateSegment" data-type="day" …>dd</span>
      <span aria-hidden="true" data-type="literal" class="rv-DateSegment">/</span>
      <span id="trip-field-year" role="spinbutton" class="rv-DateSegment" data-type="year" …>yyyy</span>
    </div>
    <input id="trip-field-input" type="text" hidden value="" />
    <button type="button" id="trip-button" class="rv-Button" aria-label="Calendar" aria-labelledby="trip-button trip-label" aria-describedby="trip-description" aria-expanded="false" aria-haspopup="dialog"><svg aria-hidden="true" …></svg></button>
  </div>
  <span id="trip-description" slot="description" class="rv-Text">Type a date or pick one.</span>
  <span data-rv-overlay-anchor="" style="display:contents"></span>
</div>
<span id="trip-value" hidden><!-- "Selected Date: October 15, 2026" --></span>
<div aria-hidden="true" data-testid="hidden-dateinput-container" style="(visually hidden, fixed)"><input type="date" tabindex="-1" form="" /></div>
```

Open, in the overlay layer at the end of `<body>` (the page behind is inert):

```html
<div class="rv-Popover" data-trigger="DatePicker" data-rv-overlay="" data-placement="bottom" style="position: absolute; z-index: 100000; --rv-trigger-width: …; …">
  <div style="(visually hidden)"><button type="button" aria-label="Dismiss" tabindex="-1"></button></div>
  <section id="trip-dialog" role="dialog" class="rv-Dialog" tabindex="-1" aria-labelledby="trip-button trip-label">
    <div role="application" class="rv-Calendar" aria-label="October 2026" data-rv-calendar="…">
      <header>
        <button type="button" class="rv-Button" slot="previous" aria-label="Previous">…</button>
        <h2 aria-hidden="true" class="rv-Heading">October 2026</h2>
        <button type="button" class="rv-Button" slot="next" aria-label="Next">…</button>
      </header>
      <table role="grid" class="rv-CalendarGrid" aria-label="October 2026">
        <thead aria-hidden="true" class="rv-CalendarGridHeader"><tr><th class="rv-CalendarHeaderCell">S</th>…</tr></thead>
        <tbody class="rv-CalendarGridBody">
          <tr>… <td role="gridcell"><div role="button" tabindex="0" class="rv-CalendarCell" data-date="2026-10-14" data-focused="true" aria-label="Wednesday, October 14, 2026">14</div></td> …</tr>
        </tbody>
      </table>
    </div>
  </section>
  <div style="(visually hidden)"><button type="button" aria-label="Dismiss" tabindex="-1"></button></div>
</div>
```

| Part | Element | Default class | Id | Attributes |
| --- | --- | --- | --- | --- |
| `DatePicker` | `div` | `rv-DatePicker` | none (the `id` prop is the base of the part ids) | `data-open`, `data-invalid`, `data-disabled`, `data-readonly`, `data-required`, `data-focus-within`, `data-focus-visible` |
| `Label` | `span` | `rv-Label` | `<id>-label` | a click focuses the first segment |
| `Group` | `div[role=group]` | `rv-Group` | `<id>` | `aria-labelledby`, `aria-describedby`, `aria-disabled`, Group states (`data-hovered`, `data-focus-within`, `data-focus-visible`, `data-disabled`, `data-invalid`) |
| `DateInput` | `div[role=presentation]` | `rv-DateInput` | `<id>-field` | as in [DateField](date-field.md#anatomy) |
| `DateSegment` | `span[role=spinbutton]` | `rv-DateSegment` | `<id>-field-<type>` (`trip-field-month`, …) | as in [DateField](date-field.md#anatomy) |
| Form input | `input` | none | `<id>-field-input` | `name`, `form`, `required`, `disabled`, value = ISO string |
| `Button` | `button` | `rv-Button` | `<id>-button` | `aria-label="Calendar"` (localized), `aria-labelledby` (button + label), `aria-haspopup="dialog"`, `aria-expanded`, `data-pressed` while open, `disabled` when disabled or read-only |
| `Text slot="description"` | `span` | `rv-Text` | `<id>-description` | |
| `FieldError` | `span` | `rv-FieldError` | `<id>-error` | rendered only while invalid |
| Value description | `span[hidden]` | none | `<id>-value` | "Selected Date: …", in `aria-describedby` while there is a value |
| `HiddenDateInput` | `input[type=date]` in a visually hidden `div` | none | none | browser autofill (`autoComplete`); not submitted |
| `Popover` | `div` (overlay layer) | `rv-Popover` | none | `data-trigger="DatePicker"`, `data-placement`, `data-entering`, `data-exiting` |
| `Dialog` | `section[role=dialog]` | `rv-Dialog` | `<id>-dialog` | named by the button and the label |
| `Calendar` and its parts | | `rv-Calendar`, `rv-Heading`, `rv-CalendarGrid`, `rv-CalendarCell`, … | generated | see [Calendar](calendar.md#anatomy) |

- The value description and `HiddenDateInput` render as siblings after the root.
- The `Popover` renders only while open; it positions against the `Group` (`placement="bottom start"`).
- Group, button and dialog are named by the `Label` (or `aria-label` / `aria-labelledby` of the picker).

## Import

```tsx
import { DatePicker, DatePickerContext, DatePickerStateContext } from "@rivetjs/cdk/date-picker";
import type { DatePickerProps, DatePickerRenderProps, DateValue, DateValueString, Granularity } from "@rivetjs/cdk/date-picker";
import { DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { Group } from "@rivetjs/cdk/group";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
```

`DateRangePicker` comes from the same module. The state (`createDatePickerState`, `setOpen`, `setDateValue`, `setTimeValue`, `formatValue`, …: react-stately's `DatePickerState` methods as functions) is `@rivetjs/cdk/state/date-picker`; the attribute bags and handlers (`datePickerProps`, `datePickerGroupKeyDown`, …) are `@rivetjs/cdk/date-picker/behaviour`.

## Props

### DatePicker

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `DateValue \| string \| null`, or `Signal<string \| null>` | none | Controlled value. A signal is two-way and holds the ISO string. |
| `defaultValue` | `DateValue \| string \| null` | none | Uncontrolled initial value; a form reset restores it. |
| `placeholderValue` | `DateValue \| string \| null` | today at midnight | Kind of value while empty, where spinning starts, the date the calendar opens on and the time a picked date gets. |
| `minValue`, `maxValue` | `DateValue \| string \| null` | none | Built-in validation; days outside are disabled in the calendar. |
| `isDateUnavailable` | `(date: DateValue) => boolean` | none | Built-in validation; unavailable days are marked and cannot be picked. |
| `granularity` | `"day" \| "hour" \| "minute" \| "second"` | `"day"` for dates, `"minute"` for date-times | Smallest segment shown. Must exist in the value. |
| `hourCycle` | `12 \| 24` | the locale's | |
| `hideTimeZone` | `boolean` | `false` | Hide the time zone segment of a zoned value. |
| `shouldForceLeadingZeros` | `boolean` | the locale's | |
| `createCalendar` | `(identifier) => Calendar` | `createCalendar` of `@rivetjs/cdk/date` | Calendar system factory of the field (the `Calendar` part takes its own). |
| `isOpen` | `boolean \| Signal<boolean>` | none | Controlled open state; a signal is two-way. |
| `defaultOpen` | `boolean` | `false` | Uncontrolled initial open state. |
| `shouldCloseOnSelect` | `boolean \| () => boolean` | `true` | Close the popover when a date is picked. |
| `firstDayOfWeek` | `"sun" \| "mon" \| "tue" \| "wed" \| "thu" \| "fri" \| "sat"` | the locale's | Passed to the calendar. |
| `pageBehavior` | `"visible" \| "single"` | `"visible"` | Passed to the calendar: page by the visible months or by one. |
| `isDisabled` | `boolean` | `false` | Segments not focusable, button and form input disabled. |
| `isReadOnly` | `boolean` | `false` | Segments focusable, value fixed, button disabled; still submitted. |
| `isRequired` | `boolean` | `false` | `aria-required`; with native validation the form input is `required`. |
| `isInvalid` | `boolean \| () => boolean` | none | Controlled invalid state; an accessor stays live. |
| `validationState` | `"valid" \| "invalid"` | none | Deprecated: use `isInvalid`. |
| `validate` | `(value: DateValue \| null) => string \| string[] \| true \| null \| undefined` | none | Custom validation of the value (a date object). |
| `validationBehavior` | `"native" \| "aria"` | `"native"`, or the enclosing `<Form>`'s | As in [DateField](date-field.md#validation). |
| `name` | `string` | none | Name of the hidden form input; `<Form validationErrors>` server errors apply by it. |
| `form` | `string` | none | Id of the form the input belongs to. |
| `autoComplete` | `string` | none | `autocomplete` of the hidden autofill input. |
| `id` | `string` | generated | Base id of the parts. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | Naming / description of the group (use `aria-label` without a `Label`). |
| `slot` | `string` | none | Slot name for a `DatePickerContext` with `slots`. |
| `class` | `string \| (renderProps) => string` | `rv-DatePicker` | A function gets `DatePickerRenderProps`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `DatePicker`; see [Render](#render). |
| `style` | `StyleObject \| (renderProps) => StyleObject` | none | |
| `children` | content or `(renderProps) => content` | the preset anatomy | The parts. |
| `ref` | `Ref<HTMLDivElement>` | none | The root. |
| Global DOM attributes | `GlobalDOMAttributes` | none | `onPointerEnter`, `onDblClick`, `lang`, `dir`, `translate`, … on the root. |

`DatePickerRenderProps` (accessors): `isFocusWithin()`, `isFocusVisible()`, `isDisabled()`, `isReadOnly()`, `isInvalid()`, `isRequired()`, `isOpen()`, and `state`.

The parts take their own props: [DateInput / DateSegment](date-field.md#props), [Group](group.md), [Button](button.md), [Popover](popover.md), [Dialog](dialog.md), [Calendar](calendar.md#props) (the picker passes it the value, `minValue`, `maxValue`, `isDateUnavailable`, `firstDayOfWeek`, `pageBehavior`, `isDisabled`, `isReadOnly` and the invalid state), [Label](label.md), `Text`, [FieldError](form.md).

### Events

| Event | Type | Fires |
| --- | --- | --- |
| `onChange` | `(value: DateValue \| null) => void` | The user typed, spun or picked another date, or cleared the field. Not for programmatic writes to `value`. |
| `onOpenChange` | `(isOpen: boolean) => void` | The popover opened or closed. |
| `onFocus`, `onBlur` | `(event: FocusEvent) => void` | Focus enters / leaves the group; not while the popover is open, not between the segments and the button. |
| `onFocusChange` | `(isFocused: boolean) => void` | Both of the above. |
| `onKeyDown`, `onKeyUp` | `(event: KeyboardEvent) => void` | A key in the group, after the picker handled it; not keys in the calendar. |

## Value

### Controlled and uncontrolled

`value` takes a date object, an ISO string or a two-way signal of the string; `isOpen` a boolean or a two-way signal. Buttons outside can set or clear the date and open the calendar. The calendar opens on the selected date, else on `placeholderValue`. `onChange` gets the date object (in the calendar system of the value). Strings: see [DateField](date-field.md#controlled-and-uncontrolled) and [Dates](../foundations/dates.md).

::example{id=date-picker-controlled}

### Date and time

With `granularity` `"hour"`, `"minute"` or `"second"` (or a date-time value) the field adds time segments. A date picked in the calendar keeps the current time, else takes the placeholder's (midnight by default). With `shouldCloseOnSelect={false}` and no time yet, the picked date waits: closing the popover commits it with the placeholder time. Zoned values show their time zone unless `hideTimeZone`.

::example{id=date-picker-granularity}

### International calendars

The `I18nProvider` locale orders and names the segments, names the button ("Kalender") and formats the calendar (month names, first day of the week). A locale with a calendar extension (`-u-ca-japanese`, …) displays the date in that calendar system; `onChange` still gets a date in the calendar of the `value` / `defaultValue` (Gregorian without one).

::example{id=date-picker-format}

## Calendar options

`firstDayOfWeek`, `pageBehavior`, `minValue` / `maxValue` (days outside are disabled) and `isDateUnavailable` (days are marked `data-unavailable` and cannot be picked) reach the calendar; `shouldCloseOnSelect={false}` keeps it open after a pick, and closing it (:kbd[Escape], an outside press) commits.

::example{id=date-picker-calendar}

## Content

`Label` and `Text slot="description"` take any content. The `Button` holds an icon (it keeps its "Calendar" name, plus the label) or text. The `Dialog` holds any `Calendar` composition: here two months with a heading each and composed header / body parts (see [Calendar](calendar.md)). `aria-label` on the picker names a picker without a `Label`: the group, every segment and the dialog.

::example{id=date-picker-slots}

## Validation

Validation works as in [DateField](date-field.md#validation) and covers what is picked: out-of-range and unavailable dates are invalid when typed and cannot be picked; the invalid state is passed to the calendar. `FieldError` shows the messages, or its children (content, or a function of `{ isInvalid(), validationErrors(), validationDetails() }`).

::example{id=date-picker-validation}

## Forms

`name` posts the ISO string from a hidden input (`""` while empty); `form` ties it to a form elsewhere by id. With `isRequired` and native validation an empty picker blocks the submit, focuses its first segment and shows the error. A form reset restores `defaultValue`. Inside `<Form validationErrors>` server errors apply by `name` (see [Form](form.md)).

::example{id=date-picker-form}

:::gotcha
A date picked in the calendar does not commit the validation yet: an error shown by a blocked submit stays until the field is edited and blurred (the form input itself is valid again and submits).
:::

## Disabled and read-only

`isDisabled` disables the segments, the button and the form input. `isReadOnly` keeps the segments focusable with a fixed value and disables the button.

::example{id=date-picker-disabled}

## Events

The picker handles a key first, then calls `onKeyDown`; focus and key events stop while the popover is open (focus is in the calendar). :kbd[Alt]+:kbd[ArrowDown] opens the calendar, so `onKeyDown` sees only the :kbd[Alt] key.

::example{id=date-picker-events}

## DOM events and attributes

| Where you pass them | Element |
| --- | --- |
| props of `DatePicker` | the root `div.rv-DatePicker` |
| props of `Group` | the group `div[role=group]` |
| props of `DateInput` / `DateSegment` | the `div[role=presentation]` / each segment `span` |
| props of `Button` | the calendar `button` |
| props of `Popover` | the popover `div.rv-Popover` (overlay layer) |
| props of `Dialog` | the `section[role=dialog]` |
| props of `Calendar` and its parts | see [Calendar](calendar.md#dom-events-and-attributes) |

The group owns `onPointerDown` / `onPointerUp` (a press focuses a segment) and the button its press (opens the popover): their behaviour runs first, then your handler. Keys and focus of the field go through `onKeyDown` / `onKeyUp` / `onFocus` / `onBlur` / `onFocusChange` on `DatePicker`. `on…Capture` handlers do not resume yet.

::example{id=date-picker-dom-events}

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-DatePicker[data-open]` | Popover open | `group-data-[open]:` |
| `.rv-DatePicker[data-focus-within]`, `[data-focus-visible]` | Focus (keyboard focus) in the picker | `group-data-[focus-visible]:` |
| `.rv-DatePicker[data-invalid]`, `[data-disabled]`, `[data-readonly]`, `[data-required]` | State | `group-data-[invalid]:` |
| `.rv-Button[aria-expanded="true"]`, `[data-pressed]` | Button while open | `aria-expanded:`, `data-[pressed]:` |
| `.rv-DateSegment[data-placeholder]`, `:focus`, `[data-type=…]` | Segments | `data-[placeholder]:`, `focus:` |
| `.rv-Popover[data-trigger="DatePicker"]` | The popover | |
| `.rv-Popover[data-placement="bottom"]` | Side it opened on | `placement-bottom:`, `placement-top:` |
| `.rv-Popover[data-entering]`, `[data-exiting]` | Transition phases | `entering:`, `exiting:` |
| `.rv-CalendarCell[data-selected]`, `[data-focused]`, `[data-disabled]`, `[data-unavailable]`, `[data-outside-month]`, `[data-today]` | Calendar days | `data-[selected]:`, or a `class` function |

`class` / `style` of each part replace its default; as functions they get the part's render props (accessors: `class={({ isOpen }) => isOpen() ? "…" : "…"}`). The popover renders in the overlay layer: select it by its class and `data-trigger`, not as a descendant of the picker.

### Tailwind

::example{id=date-picker-tailwind}

### Plain CSS

::example{id=date-picker-css}

### Starter theme

`@rivetjs/cdk/theme.css` (used by most examples) draws the picker's `Group` as an input box (red border on `[data-invalid]`), the segments, the button, the popover and dialog boxes, and fades the popover on `[data-entering]` / `[data-exiting]`. It has no rules for the calendar: the examples add a few on the `rv-Calendar*` classes. Its rules use `:where(…)`, so any rule of yours wins.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `DatePicker` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<DatePicker render={(props) => <div {...(props as {})} />}>…</DatePicker>
```

## Accessibility

- The group is `role="group"`, named by the label; the `DateInput` is `role="presentation"`; segments are spin buttons named by their type and the label (see [DateField](date-field.md#accessibility)).
- The button is named "Calendar" (localized) plus the label, `aria-haspopup="dialog"`, `aria-expanded`. The dialog is named by the button and the label.
- On open, focus moves to the calendar's focused date (the value, else the placeholder); on close it returns to where it was (the button or a segment). The page behind the popover is inert; hidden dismiss buttons let screen reader users close it.
- The selected date is described ("Selected Date: October 15, 2026") on the group and the button.

### Keyboard

| Key | Where | Action |
| --- | --- | --- |
| Digits, :kbd[ArrowUp] / :kbd[ArrowDown], :kbd[PageUp] / :kbd[PageDown], :kbd[Home] / :kbd[End], :kbd[Backspace] | segment | As in [DateField](date-field.md#keyboard). |
| :kbd[ArrowLeft], :kbd[ArrowRight] | group | Previous / next segment, and the button. |
| :kbd[Alt]+:kbd[ArrowDown], :kbd[Alt]+:kbd[ArrowUp] | group | Open the calendar. |
| :kbd[Enter], :kbd[Space] | button | Open the calendar. |
| Arrow keys, :kbd[PageUp] / :kbd[PageDown], :kbd[Home] / :kbd[End] | calendar | Move the focused date (see [Calendar](calendar.md#keyboard)). |
| :kbd[Enter], :kbd[Space] | calendar | Pick the focused date (closes with `shouldCloseOnSelect`). |
| :kbd[Escape] | calendar | Close; focus returns. |

## Resumability

- Server HTML: the label, the segments (with `data-rk`: Rivet holds those keys while the code loads), the button, the hidden inputs. A closed picker ships no popover and no calendar markup.
- The picker state (value, open state, focus flags) is region state: the first open creates only the popover and its calendar, from serializable locals.
- `onChange`, `onOpenChange`, `isDateUnavailable`, `validate`, render-prop functions and the event handlers: inline arrows or local functions (module-level functions are not serializable). The `DateInput` and `CalendarGrid` children functions are slots: write them inline.
- Popover content as plain JSX works (as in the examples); content holding your own stateful components is safest as a render function (`{() => …}`).
- `on…Capture` handlers do not resume yet.

## Testing

`@rivetjs/testing` has no DatePicker tester yet. In a browser test, click `#<id>-button` (or press :kbd[Alt]+:kbd[ArrowDown] on `#<id>-field-month`), wait for `#<id>-dialog`, press keys on the focused `[data-date="…"]` cell, and read the value from your signal or `#<id>-field-input`.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `DatePicker`, `DatePickerContext`, `DatePickerStateContext` | RAC `DatePicker.tsx` |
| `@rivetjs/cdk/date-picker/behaviour` | react-aria `useDatePicker`, `useDatePickerGroup` |
| `@rivetjs/cdk/state/date-picker` | react-stately `useDatePickerState` |
| Parts | RAC `Label`, `Group`, `DateInput`, `DateSegment`, `Button`, `Popover` (div overlay layer), `Dialog`, `Calendar`, `Text`, `FieldError` |

Deviations:

- No `locale` prop: the locale comes from `I18nProvider`.
- Values may be ISO strings and `value` / `isOpen` two-way signals (`onChange` still gets the date object).
- Render props are accessors (`isOpen()`).
- The popover is a div overlay (not native `popover`), rendered only while open; Rivet's `Popover` does not clear the contexts (RAC `clearContexts`): the `Calendar` re-provides its own.
- Closing the popover any way (:kbd[Escape], outside press, pick) commits the pending date / time from the component (React Stately does it in `setOpen(false)`).

### Not yet supported

- `autoFocus` on `DatePicker`.
- A calendar pick does not commit the field's validation (see [Forms](#forms)).
- After the value changed by typing on a resumed page, the first calendar pick does not return focus to the field (it lands on `<body>`); later picks do.
