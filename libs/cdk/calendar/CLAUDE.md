# @rivetjs/cdk/calendar
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `Calendar` + `RangeCalendar` parts port (react-aria-components Calendar.tsx), react-aria calendar hooks, react-stately calendar state.

## Entry points
- `@rivetjs/cdk/calendar` -> `index.tsx`: `Calendar`, `RangeCalendar`, `CalendarGrid`, `CalendarGridHeader`, `CalendarHeaderCell`, `CalendarGridBody`, `CalendarCell`, `CalendarHeading`, `CalendarMonthPicker`, `CalendarYearPicker`; contexts `CalendarContext` (rv-calendar), `RangeCalendarContext` (rv-range-calendar), `CalendarStateContext` (rv-calendar-state), `RangeCalendarStateContext` (rv-range-calendar-state); render-props types
- `@rivetjs/cdk/calendar/behaviour` -> `behaviour.tsx` (explicit export): `calendarProps` / `rangeCalendarProps(props, state)` ({ calendarProps, prevButtonProps, nextButtonProps, errorMessageProps, title }), `calendarGridProps({ startDate?, endDate?, weekdayStyle }, state)`, `calendarCellProps({ date, isOutsideMonth, isDisabled }, state)`, `calendarHeadingProps`, `calendarMonthPickerProps` / `calendarYearPickerProps` ({ aria-label, value(), onChange, items() }) (year picker: one year list per input set — focused date, locale, time zone, min / max — shared by `value` / `items` / `onChange`, `yearItemsMemo`); handlers `(event, state)`: `calendarGridKeyDown`, `calendarGridFocusIn/Out`, `calendarGridMouseDown`, `calendarGridPointerDown/Up/Over/Out`, `calendarGridClick`, `calendarGridContextMenu`, `rangeCalendarFocusOut`, `calendarPreviousPress` / `calendarNextPress`; helpers `focusCell`, `cellState`, `gridWeeks`, `gridStartDate`, `weekDays`, `cellKey`, `GRID_KEYS`
- `@rivetjs/cdk/state/calendar` -> `../state/calendar.ts`: `createCalendarState`, `createRangeCalendarState`, React Stately methods as `fn(state, …)`; state signals `hoveredCell` / `pressedCell` / `focusVisibleCell`; `state.aria` = hookData (plain data)

## Layout
- `index.tsx` parts; `calendarRoot` shared by Calendar / RangeCalendar: provides ButtonContext slots `previous` / `next`, HeadingContext (title), state context, Calendar(Range)Context `{ firstDayOfWeek }`, TextContext slot `errorMessage`
- Preset (no children): `<header><Button slot="previous"/><Heading/><Button slot="next"/></header>` + one `CalendarGrid` per visible month; passed lazily (`defaultChildren: () => …`) so it renders inside the Provider
- `behaviour.tsx` (.tsx: closures resume) · `intl.ts` generated · `../range-calendar/` re-exports
- tests: `tests-components/calendar-state.test.ts`, `calendar-keyboard.test.ts`, `calendar-parts.test.ts` (Rivet-name adapters at file top), `dates-calendar.test.ts` (`/calendar`), `dom-events-dates.test.ts`

## Rules / invariants
- Grid handlers delegated on `<table role="grid">` (`data-rk={GRID_KEYS}`); user handlers destructured into locals, chained after own
- Body rows = one binding over the computed `startDate` key (`gridRows`): outside `focusedValue` writes move the grid
- Resume: structural bindings (body rows, weekday header, page buttons) must not read `focused` / `anchor` — a resumed region wakes on the first change of any leaf signal read on the server (runtime: region entries record the leaf signals behind a computed) and re-creates the focused cell. `visibleStart` reads only `start` unless `focusControlled` (`focusedValue` signal); every internal focus write keeps `start` corrected (`syncStart` → `correctedStart`). `availableRange` reads `anchor` only with `isDateUnavailable` and contiguous ranges
- CalendarCell spreads `tabindex` (lowercase key): a `tabIndex` key makes the resumed spread binding drop + re-set the attribute on activation, blurring the focused cell (runtime spread diff: rendered `tabindex` vs key `tabIndex`)
- focusout to nowhere from a cell that is no longer the focused date (paged out → disabled → Chrome blurs it before the body re-renders) is an internal move (`movedAway`): neither `isFocused` nor the range commit change
- Cell hover / press / focus-visible = state signals (render props reactive); root `data-rv-calendar={state.id}` (focusCell re-finds a re-created root)
- Accessor context values (`defaultValue`, `defaultFocusedValue`, `isInvalid`) from a picker are resolved once (`resolveAccessors`); `autoFocus` = clientEffect focusing the focused cell
- No `locale` / `timeZone` props: I18nProvider

## Gotchas
- `dates-calendar` "server ARIA … cold arrow key": no calendar code loads before interaction (visible preload only for one symbol on ≥3 rows of one `For` list), but after the cold ArrowDown the new cell keeps `tabindex="-1"` (known failure, 2026-10-06); range "focus leaving mid-selection" still flaky on the first load after a fresh build (a PageDown typed right after ArrowRight is sometimes lost)
- Controlled `focusedValue` (signal): the grid still reads `focused`, so its rows re-create on the first focus move of a resumed page (until the runtime tracks computeds in region entries); `focusCell` re-focuses the new cell
- Callbacks (`isDateUnavailable`, `onChange`, `createCalendar`) must be inline arrows / local consts

## See also
- [../CLAUDE.md](../CLAUDE.md), [../range-calendar/CLAUDE.md](../range-calendar/CLAUDE.md), [../date-picker/CLAUDE.md](../date-picker/CLAUDE.md), `apps/cdk-docs/content/components/calendar.md`
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element (default path unchanged); reactive attrs are accessors, handlers inline arrows; parts: Calendar, RangeCalendar, CalendarGrid (render path keeps the grid Provider outside), CalendarGridHeader, CalendarHeaderCell, CalendarGridBody, CalendarCell (the `<td>` stays, `render` replaces the inner div); tests `tests/render-date-color.browser.test.tsx`
- `CalendarHeading` `render` (RAC: Heading render prop) forwards to cdk `Heading`: a custom element keeps the month text and follows paging (`tests/render-date-color.browser.test.tsx`). Preset parts (`defaultChildren`) have no RAC counterpart / `render`.
- Resume: props hold date values as captured by the root's closures: pass strings (or Signals of strings); a `CalendarDate` instance in `defaultValue` / `minValue` / … fails the server render ("Cannot resume …: CalendarDate instance is not serializable"; dev names the capture). `@rivetjs/ui` converts (`libs/ui/src/utils/date-value.ts`).
- Live flags (LIVE-REST 2026-10-09): Calendar / RangeCalendar `isDisabled` / `isReadOnly` / `isInvalid` live (`untrack` body + `liveOptions(CALENDAR_LIVE)`; `resolveAccessors` keeps a live `isInvalid`); state keeps creation `isDisabled` / `isReadOnly` / `invalidProp` + accessors `disabled` / `readOnly` / `invalid`, read `isCalendarDisabled` / `isCalendarReadOnly` (cells, prev / next, `setValue` / `selectDate`, presses); grid `aria-*` via `calendarFlagAttr`; root `data-disabled` only in the spread bag. CalendarCell's own `isDisabled` prop stays read once
