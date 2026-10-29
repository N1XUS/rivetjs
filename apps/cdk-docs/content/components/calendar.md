---
title: Calendar
description: Calendar from @rivetjs/cdk displays one or more month grids for picking a date or several. Composed RAC parts, min / max, unavailable dates, locales.
template: guide
status: experimental
related: [components/range-calendar, components/date-picker, components/date-field, foundations/dates, foundations/i18n, foundations/announcements]
---

A calendar displays one or more date grids and allows users to select a single date. `Calendar` is composed from grid, heading, cell and month/year picker parts. Click or :kbd[Enter] selects a day, arrow keys move focus, :kbd[PageUp] / :kbd[PageDown] page. The value is the ISO string of the date in a signal (`"2026-10-14"`), or an array of strings with `selectionMode="multiple"`. The server renders the whole grid; no calendar code runs until the first interaction. For a range of dates use [RangeCalendar](range-calendar.md); in a field with a popover, [DatePicker](date-picker.md).

::example{id=calendar-basic}

## Anatomy

```tsx
<Calendar>
  <header>
    <Button slot="previous" />
    <Heading />            {/* or <CalendarHeading />, <CalendarMonthPicker>, <CalendarYearPicker> */}
    <Button slot="next" />
  </header>
  <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
  {/* or, composed: */}
  <CalendarGrid>
    <CalendarGridHeader>{(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}</CalendarGridHeader>
    <CalendarGridBody>{(date) => <CalendarCell date={date} />}</CalendarGridBody>
  </CalendarGrid>
  <Text slot="errorMessage" />
</Calendar>
```

Rendered (from [calendar-slots](#slots), trimmed):

```html
<div role="application" id="cal" class="rv-Calendar" aria-label="October 2026" aria-labelledby="trip-label" data-rv-calendar="cal" data-invalid="true">
  <div style="(visually hidden)"><h2>October 2026</h2></div>
  <header>
    <button type="button" class="rv-Button" slot="previous" aria-label="Previous"><svg …/> Prev</button>
    <h2 aria-hidden="true" class="rv-Heading">October 2026</h2>
    <button type="button" class="rv-Button" slot="next" aria-label="Next">Next <svg …/></button>
  </header>
  <table role="grid" class="rv-CalendarGrid" aria-label="October 2026" aria-labelledby="trip-label" data-rk="ArrowUp ArrowDown …">
    <thead aria-hidden="true" class="rv-CalendarGridHeader">
      <tr><th class="rv-CalendarHeaderCell">S</th> …</tr>
    </thead>
    <tbody class="rv-CalendarGridBody">
      <tr>
        <td role="gridcell" aria-disabled="true">
          <div role="button" class="rv-CalendarCell" data-date="2026-09-27" aria-disabled="true" aria-label="Sunday, September 27, 2026" data-disabled="true" data-outside-visible-range="true" data-outside-month="true">27</div>
        </td>
        …
        <td role="gridcell" aria-selected="true" aria-invalid="true">
          <div role="button" class="rv-CalendarCell" data-date="2026-10-14" tabindex="0" aria-label="Wednesday, October 14, 2026 selected" aria-invalid="true" aria-describedby="cal-error" data-selected="true" data-invalid="true">14</div>
        </td>
      </tr>
    </tbody>
  </table>
  <span id="cal-error" slot="errorMessage" class="rv-Text"><strong>Sold out.</strong> Pick another day.</span>
  <div style="(visually hidden)"><button type="button" tabindex="-1" aria-label="Next"></button></div>
</div>
```

| Part | Element | Class (default) | Data attributes | Id |
| --- | --- | --- | --- | --- |
| `Calendar` | `div[role=application]` | `rv-Calendar` | `data-disabled`, `data-invalid`, `data-rv-calendar` | `id` prop, else generated |
| `Button slot="previous"` / `"next"` | `button[slot=previous\|next]` | `rv-Button` | `data-disabled`, `data-pressed`, … (see [Button](button.md)) | generated |
| `Heading` | `h2[aria-hidden]` (the visible range) | `rv-Heading` | | |
| `CalendarHeading` | `h2[aria-hidden]` (the month at `offset`) | `rv-CalendarHeading` | | |
| `CalendarGrid` | `table[role=grid]` | `rv-CalendarGrid` | | |
| `CalendarGridHeader` | `thead[aria-hidden]` > `tr` | `rv-CalendarGridHeader` | | |
| `CalendarHeaderCell` | `th` | `rv-CalendarHeaderCell` | | `id` prop |
| `CalendarGridBody` | `tbody` | `rv-CalendarGridBody` | | |
| `CalendarCell` | `td[role=gridcell]` > `div[role=button][data-date]` | `rv-CalendarCell` (the inner `div`) | see [Styling](#styling) | |
| `Text slot="errorMessage"` | `span[slot=errorMessage]` | `rv-Text` | | `<calendar id>-error` |

A calendar without children renders the preset anatomy: the header (previous button, `Heading`, next button) and one `CalendarGrid` per visible month. The preset buttons have no content (headless): pass the anatomy yourself to give them icons. Every cell of the grid's weeks is rendered, including the days of the neighbouring months (`data-outside-month`, disabled, not focusable): hide them with CSS if you like. A visually hidden `h2` names the whole visible range for heading navigation, and a trailing visually hidden "Next" button lets touch screen reader users page forward.

## Import

```tsx
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Text } from "@rivetjs/cdk/text";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarHeading,
  CalendarMonthPicker,
  CalendarYearPicker,
  CalendarContext,
  CalendarStateContext,
} from "@rivetjs/cdk/calendar";
import type { CalendarCellRenderProps, CalendarPickerAria, CalendarProps, CalendarRenderProps, DateInput, DateValueString } from "@rivetjs/cdk/calendar";
import type { CalendarDate } from "@rivetjs/cdk/date";
```

Date objects and string helpers (`CalendarDate`, `parseDate`, `today`, calendar systems) come from `@rivetjs/cdk/date`, see [Dates](../foundations/dates.md). The locale comes from the nearest `I18nProvider` (`useLocale()`); there is no `locale` prop.

## Props

### Calendar

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `Signal<string \| null>`; multiple: `Signal<string[]>`; or a date (array) | none | Controlled value: a two-way signal of ISO strings (resumable), or a date object / ISO string. |
| `defaultValue` | `DateInput \| null`; multiple: `DateInput[]` | none | Uncontrolled initial value: a string (`"2026-10-14"`, `"2026-10-14T09:30"`, `"2026-10-14T09:30[Europe/Paris]"`) or a date object. |
| `selectionMode` | `"single" \| "multiple"` | `"single"` | `multiple`: every press toggles a day. |
| `focusedValue` | `Signal<string>` or a date | none | Controlled focused date; it also decides the visible months. |
| `defaultFocusedValue` | `DateInput \| null` | the value, else today | Uncontrolled initial focused date. |
| `minValue`, `maxValue` | `DateInput \| null` | none | Dates outside are disabled; the page buttons disable at the edges. |
| `isDateUnavailable` | `(date: CalendarDate) => boolean` | none | Dates that cannot be selected (`data-unavailable`); a value on one is invalid. |
| `isDisabled` | `boolean` | `false` | Every cell and both page buttons disabled; no tab stop in the grid. |
| `isReadOnly` | `boolean` | `false` | Focus and paging work; the value never changes. |
| `isInvalid` | `boolean` | `false` | Whether the current selection is invalid according to application logic. |
| `validationState` | `"valid" \| "invalid"` | none | Deprecated: use `isInvalid`. |
| `autoFocus` | `boolean` | `false` | Focuses the focused cell once the page has loaded. |
| `visibleDuration` | `DateDuration` | `{ months: 1 }` | The amount of days displayed at once: `{ months: n }` (one `CalendarGrid` per month), `{ weeks: n }`, `{ days: n }`. |
| `pageBehavior` | `"visible" \| "single"` | `"visible"` | The page buttons move by the whole visible duration or by one unit of it. |
| `selectionAlignment` | `"start" \| "center" \| "end"` | `"center"` | Where the initial value / focused date sits among several visible months. |
| `firstDayOfWeek` | `"sun" \| "mon" \| … \| "sat"` | the locale's | First column of the week. |
| `weeksInMonth` | `number` | the month's | Fixed number of rows per month (6 keeps the height constant). |
| `createCalendar` | `(identifier: CalendarIdentifier) => Calendar` | `createCalendar` of `@rivetjs/cdk/date` | Builds the display calendar system: return only the systems you use, or a custom one. |
| `aria-label` | `string` | none | Accessible name; the visible range is appended (`"Event date, October 2026"`). |
| `aria-labelledby` | `string` | none | Id of a visible label (on the root and the grids). |
| `aria-describedby`, `aria-details` | `string` | none | On the root. |
| `children` | content, or `(renderProps: CalendarRenderProps) => content` | the preset anatomy | The parts. |
| `class` | `string \| (renderProps) => string` | `rv-Calendar` | Root class (replaces the default). |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `Calendar`; see [Render](#render). |
| `style` | `StyleObject \| (renderProps) => StyleObject` | none | Root inline style. |
| `slot` | `string \| null` | none | Slot name, to take props from a parent's `CalendarContext` (see [Slots](../foundations/slots.md)). |
| `id` | `string` | generated | Root id; the error message id derives from it. |
| `ref` | `RefValue<HTMLDivElement>` | none | The root element. |
| global DOM props | `GlobalDOMAttributes` | none | On the root, see [DOM events and attributes](#dom-events-and-attributes). |

`CalendarRenderProps`: `isDisabled()`, `isInvalid()`, `state` (the [state](#state-functions)).

### CalendarGrid

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `(date: CalendarDate) => content`, or `CalendarGridHeader` + `CalendarGridBody` | none | A render function for the cells (the header row is added for you), or the composed parts. |
| `offset` | `DateDuration` | none | Offset from the start of the visible range: the month this grid shows in a multi-month calendar. |
| `weekdayStyle` | `"narrow" \| "short" \| "long"` | `"narrow"` | Weekday names in the header row. |
| `class`, `style` | `string`, `StyleObject` | `rv-CalendarGrid` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<table>` of `CalendarGrid`; see [Render](#render). |
| `ref`, global DOM props | | | On the `table`. |

### CalendarGridHeader, CalendarHeaderCell, CalendarGridBody

| Part | Prop | Type | Description |
| --- | --- | --- | --- |
| `CalendarGridHeader` | `children` | `(day: string) => content` | Renders a `CalendarHeaderCell` per weekday name. `class` (`rv-CalendarGridHeader`), `style`, `ref`, global DOM props. |
| `CalendarHeaderCell` | `children` | content | The weekday name. `id`, `class` (`rv-CalendarHeaderCell`), `style`, `ref`, global DOM props. |
| `CalendarGridBody` | `children` | `(date: CalendarDate) => content` | Renders a `CalendarCell` per date. `class` (`rv-CalendarGridBody`), `style`, `ref`, global DOM props. |

### CalendarCell

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `date` | `CalendarDate` | required | The date of the cell (the argument of the grid's render function). |
| `children` | content, or `(renderProps: CalendarCellRenderProps) => content` | `formattedDate` | Cell content. |
| `class` | `string \| (renderProps) => string` | `rv-CalendarCell` | On the inner `div[role=button]`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `CalendarCell`; see [Render](#render). |
| `style` | `StyleObject \| (renderProps) => StyleObject` | none | |
| `ref` | `RefValue<HTMLTableCellElement>` | none | The `td`. |
| global DOM props | `GlobalDOMAttributes` | none | On the inner `div[role=button]`. |

`CalendarCellRenderProps` (accessors, call them): `date()`, `formattedDate` (a string), `isHovered()`, `isPressed()`, `isSelected()`, `isSelectionStart()`, `isSelectionEnd()`, `isFocused()`, `isFocusVisible()`, `isDisabled()`, `isOutsideVisibleRange()`, `isOutsideMonth()`, `isUnavailable()`, `isInvalid()`, `isToday()`.

### CalendarHeading, CalendarMonthPicker, CalendarYearPicker

| Part | Prop | Type | Description |
| --- | --- | --- | --- |
| `CalendarHeading` | `offset` | `DateDuration` | The month at this offset from the visible start (multi-month calendars). |
| | `format` | `{ day?, month?, year?, era? }` (Intl options) | Format of the heading (default: long month, numeric year). |
| | `level`, `class` (`rv-CalendarHeading`), `style`, `ref`, HTML props | | Like [Heading](heading.md). |
| `CalendarMonthPicker` | `children` | `(picker: CalendarPickerAria) => content` | Renders a month picker from `{ "aria-label", value(), onChange, items() }`. |
| | `format` | `"numeric" \| "2-digit" \| "long" \| "short" \| "narrow"` | Month names (default `"short"`). |
| `CalendarYearPicker` | `children` | `(picker: CalendarPickerAria) => content` | Renders a year picker from `{ "aria-label", value(), onChange, items() }`. |
| | `format` | `{ year?: "numeric" \| "2-digit"; era? }` | Year format. |
| | `visibleYears` | `number` | Number of years listed around the focused one (default 20, kept within `minValue` / `maxValue`). |

`CalendarPickerAria`: `"aria-label"` (localized "month" / "year"), `value()` (the selected item id), `onChange(id)` (focuses that month / year), `items()` (`{ id, date, formatted }[]`).

### Events

| Event | Type | Fires |
| --- | --- | --- |
| `onChange` | `(value) => void` | With a `CalendarDate` (an array in multiple mode) when the selection changes. A value with a time (`CalendarDateTime`, `ZonedDateTime`) keeps its time and type. |
| `onFocusChange` | `(date: CalendarDate) => void` | With every newly focused date (arrows, paging, presses, a written `focusedValue`). |

Callbacks get date objects in the calendar of the original value; the signals always hold Gregorian ISO strings.

::example{id=calendar-events}

## Value

`value` is a two-way signal: the calendar writes the ISO string of the selected day, and writing the signal from outside selects that day. `defaultValue` takes a string or a date object for an uncontrolled calendar. Date objects from `@rivetjs/cdk/date` (`parseDate("2026-10-14")`, `new CalendarDate(2026, 10, 14)`) work wherever a string does.

### Controlling the focused date

`focusedValue` / `defaultFocusedValue` control the focused date (the roving tab stop), which also decides the visible month: writing a date in another month pages there. `onFocusChange` fires when the user moves focus.

::example{id=calendar-controlled}

### Multiple selection

`selectionMode="multiple"` makes the value an array of strings, in the order they were picked; pressing a selected day removes it. The grids get `aria-multiselectable="true"`.

::example{id=calendar-multiple}

### International calendars

The calendar shows the value in the calendar system of the locale. Wrap it in an `I18nProvider` and set the [Unicode calendar extension](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/calendar) (`ar-EG-u-ca-islamic-umalqura`, `ja-JP-u-ca-japanese`) to display another one: the language, week start and digits follow too. `data-date`, the signals and `minValue` / `maxValue` stay Gregorian ISO strings; `onChange` gets a date in the calendar of the value (Gregorian when none). `createCalendar` builds the calendar system from its identifier: pass your own to bundle only the systems you use. Arrow keys follow the reading direction of the nearest `dir` ancestor (else the locale's).

::example{id=calendar-locale}

### Custom calendar systems

`createCalendar` can also return a custom calendar system with its own business rules, such as a [4-5-4](https://nrf.com/resources/4-5-4-calendar) fiscal calendar whose months are four or five whole weeks. See [Calendar systems](../foundations/dates.md#calendar-systems) for the built-in ones.

::example{id=calendar-custom-calendar}

## Validation

`minValue` / `maxValue` set the valid range: the days outside are disabled (`data-disabled`, `aria-disabled`), and so are the page buttons at the edges; the first and last available days say so in their label. `isDateUnavailable` marks days that cannot be picked (`data-unavailable`): they still take focus, but a press or :kbd[Enter] selects nothing. Write the predicate inline or as a local const so it resumes.

::example{id=calendar-limits}

The value is invalid when it is unavailable or outside `minValue` / `maxValue` (set from outside, or a `defaultValue`), or whenever `isInvalid` is set (custom rules). Then the root has `data-invalid` (the `isInvalid()` render prop), the selected cell `aria-invalid` and `data-invalid`, and invalid cells point at the `Text slot="errorMessage"` with `aria-describedby`. The error text is yours to show only while invalid (here: CSS on `[data-invalid]`). Picking a valid day clears it. Calendar has no form input; to post a date, use a [DatePicker](date-picker.md) or a hidden input bound to the signal.

::example{id=calendar-validation}

## Disabled and read-only

::example{id=calendar-disabled}

## Display options

Set `visibleDuration` and render one `CalendarGrid` per month, each with an `offset` (`{ months: 1 }`, …), to show several months; a `CalendarHeading` with the same `offset` labels each. `pageBehavior="single"` pages one month at a time, `selectionAlignment` places the starting date in the first, middle or last month. `{ weeks: 1 }` renders one row (:kbd[Home] / :kbd[End] go to the ends of the week, :kbd[PageDown] to the next week); `{ days: n }` renders n days. As in React Aria, a week grid's `aria-label` spans to the end of the month.

::example{id=calendar-months}

`firstDayOfWeek` and `weeksInMonth` override the locale's week start and the month's row count; `weekdayStyle` on `CalendarGrid` picks the weekday names.

::example{id=calendar-layout}

## Slots

The calendar provides its parts through contexts: `Button slot="previous"` / `slot="next"` get the page actions, the localized `aria-label` and the disabled state (any content, here icons and text); `Heading` gets the visible range; `Text slot="errorMessage"` gets the error id. Name the calendar with `aria-label`, or with `aria-labelledby` pointing at a visible heading: there is no visible label part.

::example{id=calendar-slots}

### Composed parts

Pass `CalendarGridHeader` and `CalendarGridBody` as `CalendarGrid` children to customize the weekday row and the body. `CalendarHeading` shows the month at its `offset` with its own `format`.

::example{id=calendar-parts}

### Cell render props

`CalendarCell` `class`, `style` and `children` take functions of the render props. They are accessors: `isSelected()`, `date()`; `formattedDate` is a string. Here a dot marks days with events.

::example{id=calendar-cells}

### Month and year pickers

`CalendarMonthPicker` and `CalendarYearPicker` give a render function the props of a picker: `aria-label`, `value()`, `onChange` and `items()`, each item `{ id, date, formatted }`. Render any select: a native `select` here. Destructure `id` / `formatted` in the `map`: an item's `date` is a `CalendarDate` object, which a resumable closure cannot capture.

::example{id=calendar-pickers}

## State functions

Every part inside a calendar reads its state from `CalendarStateContext` (`useContext(CalendarStateContext)`). The state is plain signals plus JSON (`state.value()`, `state.focused()`), and every React Stately `CalendarState` method is an exported function of `@rivetjs/cdk/state/calendar` taking the state first: `focusNextPage(state)`, `focusPreviousPage`, `focusSectionStart`, `setValue(state, date)`, `setFocusedDate(state, date)`, `selectDate`, `focusNextDay`, …; reads (`focusedDate`, `calendarValue`, `visibleRange`, `isSelected`, `isCellUnavailable`, `isValueInvalid`, …) are reactive. `@rivetjs/cdk/calendar/behaviour` has the react-aria hooks as functions (`calendarProps`, `calendarGridProps`, `calendarCellProps`, `calendarHeadingProps`, `calendarMonthPickerProps`, `selectedDateDescription`, the grid handlers) for fully custom markup.

::example{id=calendar-state}

## DOM events and attributes

Every part takes the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`: mouse, touch, pointer, scroll, wheel, animation and transition events with their `…Capture` forms, plus `dir`, `lang`, `hidden`, `inert`, `translate`); see [DOM props](../foundations/dom-props.md).

| Part | Element |
| --- | --- |
| `Calendar` | root `div[role=application]` (owns `onFocusOut`; yours runs after) |
| `Heading` / `CalendarHeading` | `h2` |
| `CalendarGrid` | `table[role=grid]` (owns the delegated cell handlers, see below) |
| `CalendarGridHeader` / `CalendarGridBody` | `thead` / `tbody` |
| `CalendarHeaderCell` | `th` |
| `CalendarCell` | the inner `div[role=button]` (`event.currentTarget.dataset.date` is its date) |

`CalendarGrid` handles `onKeyDown`, `onFocusIn`, `onFocusOut`, `onMouseDown`, `onPointerDown`, `onPointerUp`, `onPointerOver`, `onPointerOut`, `onClick` and `onContextMenu` itself, delegated for all cells; your handlers of those names run right after its own. A long press on a cell shows no context menu (the grid's `onContextMenu` prevents it). Cells own no events.

::example{id=calendar-dom-events}

`on…Capture` handlers work on resumed pages too, the first event included.

## Styling

Each part has a default class (`rv-Calendar`, `rv-CalendarGrid`, `rv-CalendarCell`, …; see [Anatomy](#anatomy)); a `class` prop replaces it. The states are data attributes:

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-Calendar[data-disabled]`, `[data-invalid]` | calendar state | `data-[disabled]:`, `data-[invalid]:` |
| `.rv-Calendar .rv-Button:disabled` | page button at min / max, or disabled | `disabled:` |
| `.rv-CalendarCell[data-selected]` | selected day | `data-[selected]:` |
| `.rv-CalendarCell[data-focused]` | focused day (focus in the grid) | `focused:` |
| `.rv-CalendarCell[data-focus-visible]` | keyboard focus | `data-[focus-visible]:` |
| `.rv-CalendarCell[data-hovered]`, `[data-pressed]` | pointer over / pressed | `data-[hovered]:`, `data-[pressed]:` |
| `.rv-CalendarCell[data-today]` | today | `data-[today]:` |
| `.rv-CalendarCell[data-unavailable]` | `isDateUnavailable` | `data-[unavailable]:` |
| `.rv-CalendarCell[data-disabled]`, `[aria-disabled="true"]` | outside min / max / visible range, disabled, or (aria only) unavailable | `data-[disabled]:`, `aria-disabled:` |
| `.rv-CalendarCell[data-outside-month]` | day of a neighbouring month | `data-[outside-month]:` |
| `.rv-CalendarCell[data-outside-visible-range]` | outside the visible range | `data-[outside-visible-range]:` |
| `.rv-CalendarCell[data-invalid]` | selected day of an invalid value | `data-[invalid]:` |
| `td[aria-selected="true"]` | cell of the selected day | `aria-selected:` |
| `.rv-Calendar [slot="errorMessage"]` | the error message | |

Range calendars add `data-selection-start` / `data-selection-end`, see [RangeCalendar](range-calendar.md). `focused:` comes from `@rivetjs/cdk/tailwind.css`.

### Tailwind

`class` on every part takes utilities; on `Calendar` and `CalendarCell` it can also be a function of the render props.

::example{id=calendar-tailwind}

### Plain CSS

::example{id=calendar-css}

### Starter theme

`@rivetjs/cdk/theme.css` gives the default classes a starter look: header row (buttons, centred heading), muted weekday headers, 2rem cells, outside-month cells hidden, hovered / selected / focus-visible / unavailable (struck through) / invalid states. Its rules use `:where(…)`, so any rule of yours wins. The examples on this page use their own small stylesheet on the default class names instead.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Calendar` (`<div>`), `CalendarGrid` (`<table>`), `CalendarGridHeader` (`<thead>`), `CalendarHeaderCell` (`<th>`), `CalendarGridBody` (`<tbody>`), `CalendarCell` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<Calendar render={(props) => <div {...(props as {})} />}>…</Calendar>
```

## Accessibility

- The root is `role="application"` named by `aria-label` plus the visible range ("Event date, October 2026"), or by `aria-labelledby`; a visually hidden `h2` repeats that name for heading navigation. The visible heading is `aria-hidden`.
- Each grid is `role="grid"` named by the label and its month; `aria-multiselectable`, `aria-readonly` and `aria-disabled` follow the props. Weekday headers are `aria-hidden` (cell labels carry the full date).
- Cells are `role="button"` with a full label ("Wednesday, October 14, 2026 selected", "Today, …", "…, First available date"), a roving `tabindex` (one tab stop: the focused date), `aria-disabled` on unselectable days and `aria-invalid` plus `aria-describedby` → error message on invalid ones. The `td` carries `role="gridcell"` and `aria-selected`.
- Page buttons have localized `aria-label`s. Pressing them announces the new range through the live announcer (see [Announcements](../foundations/announcements.md)) when focus is not in the grid; a selection is announced politely ("Selected Date: …"). If a focused page button becomes disabled, focus moves into the grid.
- Labels and messages are localized (34 locales, from react-aria's `intl/calendar`).

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[ArrowLeft], :kbd[ArrowRight] | Previous / next day (swapped in RTL); crossing the visible range pages. |
| :kbd[ArrowUp], :kbd[ArrowDown] | Same day of the previous / next week. |
| :kbd[Home], :kbd[End] | First / last day of the visible month (week view: of the week). |
| :kbd[PageUp], :kbd[PageDown] | Previous / next month (week view: week), same day. |
| :kbd[Shift]+:kbd[PageUp], :kbd[Shift]+:kbd[PageDown] | Previous / next year (week view: month). |
| :kbd[Enter], :kbd[Space] | Select the focused day (multiple: toggle). Nothing for unavailable, disabled or read-only. |
| :kbd[Tab] | Leaves the grid; the page buttons are separate tab stops. |

Pointer: a press selects on release over the pressed cell; cells do not steal focus on mouse down. `data-pressed` shows while pressed, `data-focus-visible` only after keyboard focus.

## Resumability

- The server renders the full markup: heading, labels, every cell with its state attributes. No calendar code loads before the first interaction; the grid's `data-rk` keys are held while the handler chunk loads, so the first arrow key is not lost.
- Cells carry no handlers: one set of handlers per grid finds the cell from `data-date`. Paging re-renders only the body rows; focus and selection changes patch attributes in place. The first change re-creates the body rows once.
- State is signals plus JSON, so `value` / `focusedValue` signals resume as they were, and so does a state read from `CalendarStateContext`.
- `on…Capture` handlers work on resumed pages too, the first event included.

## Testing

There is no calendar tester in `@rivetjs/testing` (React Aria has none either). Two ways that work:

- Browser tests: cells are `[data-date="2026-10-15"]` (add `:not([data-outside-month])` when neighbouring months may repeat a date), page buttons `[slot="previous"]` / `[slot="next"]` (or `button[aria-label="Previous"]`), grids `table[role=grid]`, the heading `.rv-Heading`. Wrap the calendar in an `I18nProvider` with a fixed locale and set a `defaultValue` / `defaultFocusedValue` so nothing depends on today.
- Unit tests without a DOM: build the state and read it with the behaviour functions, as the ported RAC tests do.

```ts
import { createCalendarState, focusNextPage } from "@rivetjs/cdk/state/calendar";
import { calendarCellProps, calendarHeadingProps } from "@rivetjs/cdk/calendar/behaviour";

const state = createCalendarState({ locale: "en-US", defaultValue: "2026-10-14" });
expect(calendarCellProps({ date: "2026-10-14", isOutsideMonth: false }, state).isSelected()).toBe(true);
focusNextPage(state);
expect(calendarHeadingProps({}, state)).toBe("November 2026");
```

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Calendar`, `CalendarGrid`, `CalendarGridHeader`, `CalendarHeaderCell`, `CalendarGridBody`, `CalendarCell`, `CalendarHeading`, `CalendarMonthPicker`, `CalendarYearPicker`, `CalendarContext`, `CalendarStateContext` | react-aria-components `Calendar.tsx` |
| `@rivetjs/cdk/calendar/behaviour` | react-aria `useCalendarBase`, `useCalendar`, `useCalendarGrid`, `useCalendarCell`, `useCalendarHeading`, `useCalendarMonthPicker`, `useCalendarYearPicker` |
| `@rivetjs/cdk/state/calendar` | react-stately `useCalendarState` (+ `calendar/utils`) |
| strings | react-aria `intl/calendar/*.json` |

Deviations:

- Values are ISO strings in two-way signals (or date objects) instead of value + callback pairs; callbacks still get date objects.
- Render props are accessors (`isSelected()`, `date()`); `formattedDate` is a plain string.
- No `locale` prop: the nearest `I18nProvider`.
- A calendar without children renders a preset anatomy (header + one grid per month), with empty page buttons.
- State methods are functions taking the state (`focusNextPage(state)`) instead of methods.
- `CalendarContext` provides `{ firstDayOfWeek }` only (RAC: all props). `CalendarCell` has no `onHoverStart` / `onHoverEnd` / `onHoverChange` (the `isHovered()` render prop only).
- `CalendarMonthPicker` / `CalendarYearPicker` children must be a render function (`(picker) => …`).

### Not yet supported

- Hover events on `CalendarCell`.
