---
title: RangeCalendar
description: RangeCalendar from @rivetjs/cdk selects a contiguous range of dates by press, drag or keyboard, built from Calendar parts. Limits, commit behaviour, months.
template: guide
status: experimental
related: [components/calendar, components/date-range-picker, components/date-picker, foundations/dates, foundations/i18n]
---

`RangeCalendar` displays a grid of days in one or more months and lets the user select a contiguous range of dates. The first press (or :kbd[Enter]) anchors the range, moving the pointer or the arrow keys previews it, the second press completes it; dragging selects in one gesture, and dragging an end of an existing range moves that end. The value is `{ start, end }` of ISO strings in a signal. The server renders the whole grid; no calendar code runs until the first interaction. In a field with a popover, use [DateRangePicker](date-range-picker.md).

::example{id=range-calendar-basic}

## Anatomy

```html
<div role="application" id="trip" aria-label="Trip, October 2026" class="rv-RangeCalendar" data-rv-calendar="trip" data-commit-behavior="select">
  <div style="(visually hidden)"><h2>Trip, October 2026</h2></div>
  <header>
    <button type="button" class="rv-Button" slot="previous" aria-label="Previous"><svg aria-hidden="true">…</svg></button>
    <h2 aria-hidden="true" class="rv-Heading">October 2026</h2>
    <button type="button" class="rv-Button" slot="next" aria-label="Next"><svg aria-hidden="true">…</svg></button>
  </header>
  <table role="grid" aria-label="Trip, October 2026" aria-multiselectable="true" class="rv-CalendarGrid" data-rk="ArrowUp ArrowDown …">
    <thead aria-hidden="true" class="rv-CalendarGridHeader">
      <tr><th class="rv-CalendarHeaderCell">S</th>…</tr>
    </thead>
    <tbody class="rv-CalendarGridBody">
      <tr>
        <td role="gridcell" aria-disabled="true">
          <div role="button" aria-disabled="true" aria-label="Sunday, September 27, 2026" data-date="2026-09-27"
            data-disabled="true" data-outside-visible-range="true" data-outside-month="true" class="rv-CalendarCell">27</div>
        </td>
        …
        <td role="gridcell" aria-selected="true">
          <div role="button" tabindex="0" data-date="2026-10-05" data-selected="true" data-selection-start="true" class="rv-CalendarCell"
            aria-label="Selected Range: Monday, October 5 to Friday, October 9, 2026, Monday, October 5, 2026 selected">5</div>
        </td>
        …
      </tr>
    </tbody>
  </table>
  <span id="trip-error" slot="errorMessage" class="rv-Text">…</span>
  <span id="trip-start-prompt" hidden>Click to start selecting date range</span>
  <span id="trip-finish-prompt" hidden>Click to finish selecting date range</span>
  <div style="(visually hidden)"><button type="button" aria-label="Next" tabindex="-1"></button></div>
</div>
```

| Part | Element | Default class | Data attributes / ids |
| --- | --- | --- | --- |
| `RangeCalendar` | `div[role=application]` | `rv-RangeCalendar` | `id` (state id, prefix of the part ids), `data-commit-behavior`, `data-disabled`, `data-invalid`, `data-rv-calendar` |
| `Button slot="previous"` / `slot="next"` | `button` | `rv-Button` | DOM `slot` attribute, `aria-label` "Previous" / "Next", `disabled` at the min / max; button states as in [Button](button.md) |
| `Heading` / `CalendarHeading` | `h2[aria-hidden]` | `rv-Heading` / `rv-CalendarHeading` | the visible month(s); the accessible title is the root label |
| `CalendarGrid` | `table[role=grid]` | `rv-CalendarGrid` | `aria-multiselectable`, `aria-readonly`, `aria-disabled`; no id |
| `CalendarGridHeader` / `CalendarHeaderCell` | `thead[aria-hidden]` / `th` | `rv-CalendarGridHeader` / `rv-CalendarHeaderCell` | weekday names |
| `CalendarGridBody` | `tbody` | `rv-CalendarGridBody` | |
| `CalendarCell` | `td[role=gridcell]` > `div[role=button]` | `rv-CalendarCell` (on the `div`) | `data-date`, `data-selected`, `data-selection-start`, `data-selection-end`, `data-today`, `data-unavailable`, `data-outside-month`, `data-outside-visible-range`, `data-disabled`, `data-invalid`, `data-hovered`, `data-pressed`, `data-focused`, `data-focus-visible` |
| `Text slot="errorMessage"` | `span` | `rv-Text` | id `<id>-error`; describes the invalid cells |
| `CalendarMonthPicker` / `CalendarYearPicker` | none (render function) | | hands `{ "aria-label", value(), onChange, items() }` to a select |

The visually hidden heading labels the whole visible range; the two hidden prompts are pointed at by the focused cell (`aria-describedby`) while a selection can be started or finished. Cells inside the range have `data-selected`, its first and last `data-selection-start` / `data-selection-end`; while selecting, they follow the anchor and the focused (or hovered) date. Without children, `RangeCalendar` renders the preset: `<header>` with `Button slot="previous"`, `Heading`, `Button slot="next"`, then one `CalendarGrid` per visible month. The preset buttons have no icon (headless): pass your own parts for icons.

## Import

```tsx
import {
  RangeCalendar,
  CalendarGrid,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarGridBody,
  CalendarCell,
  CalendarHeading,
  CalendarMonthPicker,
  CalendarYearPicker,
  RangeCalendarContext,
  RangeCalendarStateContext,
} from "@rivetjs/cdk/range-calendar";
import type { RangeCalendarProps, RangeCalendarRenderProps, CalendarCellRenderProps, DateInput, DateValueString, RangeValue } from "@rivetjs/cdk/range-calendar";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Text } from "@rivetjs/cdk/text";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
```

`@rivetjs/cdk/range-calendar` re-exports the parts of `@rivetjs/cdk/calendar` (one implementation). `CalendarPickerAria` is exported by `@rivetjs/cdk/calendar`.

## Props

### RangeCalendar

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `Signal<{ start: string; end: string } \| null>` or `RangeValue<DateValue \| string> \| null` | none | Controlled value. A signal is two-way (the calendar writes completed ranges); a plain value only sets the start. |
| `defaultValue` | `RangeValue<DateValue \| string> \| null` | none | Uncontrolled initial range: ISO strings or date objects. |
| `onChange` | `(value: RangeValue<MappedDateValue<T>>) => void` | none | Completed range, as date objects. See [Events](#events). |
| `focusedValue` | `Signal<string>` or `DateValue \| null` | none | Controlled focused date (decides the visible month). |
| `defaultFocusedValue` | `DateInput \| null` | the range start, else today | Uncontrolled initial focused date. |
| `onFocusChange` | `(date: CalendarDate) => void` | none | Each newly focused date. |
| `minValue`, `maxValue` | `DateInput \| null` | none | Bounds; days outside are disabled, paging stops there. |
| `isDateUnavailable` | `(date: CalendarDate, anchorDate: CalendarDate \| null) => boolean` | none | Days that cannot be picked; `anchorDate` is the day the current selection started on (null when not selecting). |
| `allowsNonContiguousRanges` | `boolean` | `false` | With `isDateUnavailable`: a range may span unavailable days (they stay unselected). Without it, the days past the nearest unavailable one are disabled once a start is picked. |
| `commitBehavior` | `"select" \| "clear" \| "reset"` | `"select"` | Focus leaving (or the pointer released outside) mid-selection: commit anchor → focused date, clear the value, or keep the previous range. |
| `isDisabled` | `boolean` | `false` | No interaction; every cell disabled, the buttons too. |
| `isReadOnly` | `boolean` | `false` | Focus moves, the value does not change. |
| `isInvalid` | `boolean` | `false` | Marks the selection invalid (application logic); read once at creation. |
| `validationState` | `"valid" \| "invalid"` | none | Deprecated: use `isInvalid`. |
| `visibleDuration` | `DateDuration` | `{ months: 1 }` | Days shown at once; render one `CalendarGrid` per month with `offset`. |
| `pageBehavior` | `"visible" \| "single"` | `"visible"` | Page by the visible duration or by one month. |
| `selectionAlignment` | `"start" \| "center" \| "end"` | start when the range is longer than the visible months, else center | Alignment of the visible months around the selection (or today) on first render. |
| `firstDayOfWeek` | `"sun" \| "mon" \| … \| "sat"` | the locale's | Day that starts the week. |
| `weeksInMonth` | `number` | the locale's | Rows per month. |
| `createCalendar` | `(identifier: CalendarIdentifier) => Calendar` | `createCalendar` of `@rivetjs/cdk/date` | Display calendar system factory. |
| `autoFocus` | `boolean` | `false` | Focuses the focused cell once mounted. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | Labelling: a range calendar has no visible label part. The root label is `"<aria-label>, <visible range>"`. |
| `id` | `string` | generated | Root id and prefix of `<id>-error`, `<id>-start-prompt`, `<id>-finish-prompt`. |
| `slot` | `string \| null` | none | Slot name (RAC slots). |
| `class` | `string \| (renderProps) => string` | `rv-RangeCalendar` | Class, or a function of `{ isDisabled, isInvalid, state }`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `RangeCalendar`; see [Render](#render). |
| `style` | `StyleObject \| (renderProps) => StyleObject` | none | Inline style, or a function of the render props. |
| `children` | `Content \| (renderProps) => Content` | the preset | Parts; a function receives the render props. |
| `ref` | `RefValue<HTMLDivElement>` | none | Root element. |
| global DOM props | `GlobalDOMAttributes` | | Events and attributes on the root ([DOM events](#dom-events-and-attributes)). |

No `locale` / `timeZone` props: the locale comes from the enclosing `I18nProvider`, the time zone is the runtime's unless the value is a `ZonedDateTime` (see [Dates](../foundations/dates.md)).

### Parts

| Part | Props |
| --- | --- |
| `CalendarGrid` | `offset?: DateDuration` (month of a multi-month calendar), `weekdayStyle?: "narrow" \| "short" \| "long"` (default `"narrow"`), `children: (date: CalendarDate) => Content` or `CalendarGridHeader` + `CalendarGridBody`, `class`, `style`, `ref`, global DOM props. |
| `CalendarGridHeader` | `children: (day: string) => Content` (a `CalendarHeaderCell` per weekday), `class`, `style`, `ref`, global DOM props. |
| `CalendarHeaderCell` | `children`, `id`, `class`, `style`, `ref`, global DOM props. |
| `CalendarGridBody` | `children: (date: CalendarDate) => Content`, `class`, `style`, `ref`, global DOM props. |
| `CalendarCell` | `date: CalendarDate` (required), `class` / `style` / `children` (render props, see [Styling](#styling)), `ref` (the `td`), global DOM props (on the `div`). |
| `CalendarHeading` | `offset?: DateDuration`, `format?` (Intl options of the heading), plus the `Heading` props. |
| `CalendarMonthPicker` | `format?: "numeric" \| "2-digit" \| "long" \| "short" \| "narrow"` (default `"short"`), `children: (picker: CalendarPickerAria) => Content`. |
| `CalendarYearPicker` | `format?: { year?, era? }`, `visibleYears?: number` (default 20), `children: (picker: CalendarPickerAria) => Content`. |

### Events

| Event | Type | Fires |
| --- | --- | --- |
| `onChange` | `(range: { start, end }) => void` | Once per completed range, with date objects (the calendar and time of the previous value kept). Not while selecting. |
| `onFocusChange` | `(date: CalendarDate) => void` | With every newly focused date; during a selection, the moving end. |

## Value

The value is `{ start, end }` with `start <= end`, whichever order the days were picked in. A two-way signal follows the calendar; writing it from outside selects that range, `null` clears it. `focusedValue` as a signal moves the focus (and the visible month) from outside.

::example{id=range-calendar-controlled}

## Validation

`minValue` / `maxValue` bound the range. Once a start is picked, the range cannot cross an unavailable day: the days beyond the nearest unavailable one on each side become disabled (and the focus stays inside). `allowsNonContiguousRanges` lifts that: the range spans the unavailable days, which are not marked selected.

::example{id=range-calendar-limits}

`isDateUnavailable` gets the anchor as its second argument, so the rule can depend on where the range started (here: at most a week). A range whose start or end is unavailable or outside `minValue` / `maxValue` (or `isInvalid`) is invalid: the root gets `data-invalid`, every cell of the range `aria-invalid` and `data-invalid`, and `<Text slot="errorMessage">` describes them (`aria-describedby`). The error text is always rendered: hide it with CSS while the root has no `data-invalid`.

::example{id=range-calendar-validation}

## Disabled and read-only

`isReadOnly` keeps focus and paging but ignores selection; `isDisabled` disables every cell and both buttons.

::example{id=range-calendar-states}

## Commit behaviour

A selection is in progress after the first press: if focus leaves the calendar (or a drag ends outside it) before the second, `commitBehavior` decides. :kbd[Escape] always cancels it and keeps the old range; the key keeps propagating, so an enclosing popover closes too. Paging inside the calendar keeps the selection going.

::example{id=range-calendar-commit}

## Display options

`visibleDuration={{ months: 2 }}` shows two months: render a `CalendarGrid` (and a `CalendarHeading`) per month with `offset={{ months: i }}`. `pageBehavior="single"` pages one month at a time. A range may cross the month boundary; arrow keys move between the grids. `firstDayOfWeek` and `weeksInMonth` override the locale.

::example{id=range-calendar-months}

## Month and year pickers

`CalendarMonthPicker` / `CalendarYearPicker` give their render function `{ "aria-label", value(), onChange, items() }` (`value` / `items` are accessors; each item is `{ id, date, formatted }`). Picking moves the focused date, so the visible month follows; the range stays. Bind plain fields of the items: their `date` is a `CalendarDate`, which a resumable binding cannot capture.

::example{id=range-calendar-pickers}

## International calendars

The calendar system and weekday names come from the `I18nProvider` locale (a `-u-ca-` extension picks the calendar system). `onChange` receives dates in the calendar of `value` / `defaultValue` (Gregorian if none). `createCalendar` plugs a custom calendar system (for example a 4-5-4 fiscal calendar). See [Calendar](calendar.md) and [Dates](../foundations/dates.md).

## State functions

The parts read `RangeCalendarStateContext`: a child component can read it with `useContext` and drive the calendar with the React Stately `RangeCalendarState` methods as functions of `@rivetjs/cdk/state/calendar` (`setRangeValue(state, range)`, `setAnchorDate`, `selectDate`, `highlightDate`, `commitSelection`, `clearSelection`, `setDragging`, `focusNextPage` and the other focus movers) and read `rangeValue(state)` / `highlightedRange(state)` / `anchorDate(state)` / `isValueInvalid(state)` reactively. `selectedDateDescription(state)` (`@rivetjs/cdk/range-calendar/behaviour`) is the announced description.

::example{id=range-calendar-state}

For fully custom markup, `@rivetjs/cdk/range-calendar/behaviour` exports the react-aria hooks as attribute bags and handlers: `rangeCalendarProps(props, state)`, `calendarGridProps`, `calendarCellProps`, `calendarHeadingProps`, the picker props, the grid handlers (`calendarGridKeyDown`, `calendarGridPointerDown`, …) and `rangeCalendarFocusOut`, over `createRangeCalendarState(options)`.

## Events

::example{id=range-calendar-events}

## DOM events and attributes

Every part takes the global DOM events and attributes: `RangeCalendar` on the root (it handles `focusout` itself, for `commitBehavior`, and runs yours after), `Heading` on the `h2`, `CalendarGrid` on the `table` (after the grid's own `onKeyDown`, `onFocusIn`, `onFocusOut`, `onMouseDown`, `onPointerDown`, `onPointerUp`, `onPointerOver`, `onPointerOut`, `onClick` and `onContextMenu`), `CalendarCell` on the cell `div`. `on…Capture` handlers work on resumed pages too, the first event included.

::example{id=range-calendar-dom-events}

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-RangeCalendar` | root | `class` on `RangeCalendar` |
| `.rv-RangeCalendar[data-invalid]`, `[data-disabled]` | invalid / disabled calendar | `data-[invalid]:` / `data-[disabled]:` |
| `.rv-RangeCalendar[data-commit-behavior]` | the `commitBehavior` in use | `data-[commit-behavior=clear]:` |
| `.rv-CalendarCell[data-selected]` | day inside the range or the live preview | `data-[selected]:` |
| `.rv-CalendarCell[data-selection-start]` / `[data-selection-end]` | first / last day of the range | `data-[selection-start]:` / `data-[selection-end]:` |
| `.rv-CalendarCell[data-unavailable]`, `[data-disabled]`, `[data-invalid]` | unavailable, disabled, invalid day | `data-[unavailable]:` … |
| `.rv-CalendarCell[data-outside-month]` | day of another month (hide it) | `data-[outside-month]:invisible` |
| `.rv-CalendarCell[data-today]`, `[data-hovered]`, `[data-pressed]`, `[data-focus-visible]` | interaction states | `data-[focus-visible]:` … |
| `.rv-RangeCalendar [slot="errorMessage"]` | the error text | `class` on `Text` |

`class` / `style` / `children` of `RangeCalendar` and `CalendarCell` also take functions of the render props. They are accessors: `class={({ isSelectionStart }) => (isSelectionStart() ? "start" : "")}`. `CalendarCell` children: `({ formattedDate, isToday }) => …`. Round the ends with logical properties (`border-start-start-radius`, Tailwind `rounded-s-full` / `rounded-e-full`) so RTL needs nothing. `@rivetjs/cdk/theme.css` styles the default classes (range cells tinted, `[data-selection-start]` / `[data-selection-end]` in the accent colour; `:where(…)`, so your rules win).

### Tailwind

::example{id=range-calendar-tailwind}

### Plain CSS

::example{id=range-calendar-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `RangeCalendar` (`<div>`), `CalendarGrid` (`<table>`), `CalendarGridHeader` (`<thead>`), `CalendarHeaderCell` (`<th>`), `CalendarGridBody` (`<tbody>`), `CalendarCell` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<RangeCalendar render={(props) => <div {...(props as {})} />}>…</RangeCalendar>
```

## Accessibility

- Root `role="application"` labelled `"<aria-label>, <visible range>"`; a visually hidden `h2` repeats it; each grid `role="grid"` with the same label, `aria-multiselectable="true"`.
- One roving tab stop: the focused cell has `tabindex="0"`. Cells are `role="button"` inside `role="gridcell"` (`aria-selected`, `aria-disabled`, `aria-invalid`).
- The range's first and last cells start their label with the selected range ("Selected Range: Monday, October 5 to Friday, October 9, 2026, …"); today's label starts with "Today".
- The focused selectable cell is described by the start or finish prompt ("Click to start selecting date range"); invalid cells by the error message.
- A completed range is announced politely through the live announcer. A visually hidden Next button after the grid helps touch screen readers.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[ArrowLeft], :kbd[ArrowRight] | Previous / next day (mirrored in RTL); while selecting, the preview follows. |
| :kbd[ArrowUp], :kbd[ArrowDown] | Same day of the previous / next week. |
| :kbd[Home], :kbd[End] | First / last day of the month. |
| :kbd[PageUp], :kbd[PageDown] | Previous / next month; with :kbd[Shift], year. |
| :kbd[Enter], :kbd[Space] | First press: anchor the range on the focused day and move focus one day on. Second press: complete the range. |
| :kbd[Escape] | Cancel the selection in progress (the old range stays). |

Pointer: mouse press anchors, hover previews, a second press (or the release of a drag) completes. Pressing the start or end of the current range and dragging moves that end; pressing it without dragging starts a new range there. Touch waits 200 ms before dragging so the page can scroll.

## Resumability

- The server renders every grid, cell state and label; no calendar code ships before the first interaction. Grid handlers are delegated (one per `table`, `data-rk` keys).
- State is signals plus JSON (dates as strings). `isDateUnavailable` takes two arguments.
- Render functions (`CalendarGrid` children, picker children) must not capture date objects or other class instances in bindings: read plain fields into locals.
- `on…Capture` handlers work on resumed pages too, the first event included.

## Testing

No helper in `@rivetjs/testing`. In browser tests, press `[data-date="…"]` cells and assert `data-selection-start` / `data-selection-end` / `data-selected`; select the buttons by `[slot="previous"]` / `button[aria-label="Next"]` and grids by `table`. Playwright refuses to click `aria-disabled` cells, so reach unavailable ones with the keyboard. Unit tests can drive `createRangeCalendarState` with `selectDate` and read `rangeValue`.

```ts
import { CalendarDate } from "@rivetjs/cdk/date";
import { createRangeCalendarState, selectDate, rangeValue } from "@rivetjs/cdk/state/calendar";

const state = createRangeCalendarState({ locale: "en-US", defaultFocusedValue: "2026-10-14" });
selectDate(state, new CalendarDate(2026, 10, 16));
selectDate(state, new CalendarDate(2026, 10, 12));
expect(rangeValue(state)!.start.toString()).toBe("2026-10-12");
```

## Upstream

| Rivet | Upstream |
| --- | --- |
| `RangeCalendar` and the parts (`CalendarGrid`, `CalendarGridHeader`, `CalendarHeaderCell`, `CalendarGridBody`, `CalendarCell`, `CalendarHeading`, `CalendarMonthPicker`, `CalendarYearPicker`), `RangeCalendarContext`, `RangeCalendarStateContext` | RAC `RangeCalendar` (with `Button slot`, `Heading`, `Text slot="errorMessage"`) |
| `@rivetjs/cdk/range-calendar/behaviour` | react-aria `useRangeCalendar` (+ the shared `useCalendarBase` / grid / cell hooks) |
| `createRangeCalendarState` and the range functions | react-stately `useRangeCalendarState` |

Deviations:

- Values are ISO strings in signals (date objects accepted as input); `onChange` / `onFocusChange` get date objects.
- Render props are accessors (`isSelected()`); `CalendarCell`'s `date` render prop is an accessor too.
- No `locale` prop (`I18nProvider`); `RangeCalendarContext` provides `{ firstDayOfWeek }` only (RAC: all props).
- The error message is not conditional: `<Text slot="errorMessage">` is always rendered.
- `CalendarCell` takes no hover events (`isHovered` render prop and `data-hovered` only).
- Escape handling, drag to modify, touch drag delay and commit on focus leave follow RAC.

### Not yet supported

- Resumed pages: the first key on a range calendar can only wake it (focus drops); with several range calendars (or a `CalendarCell` `class` function) the first click can complete a one-day range. Tracked in the cdk.
