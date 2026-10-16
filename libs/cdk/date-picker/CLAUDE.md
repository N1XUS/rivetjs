# @rivetjs/cdk/date-picker
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `DatePicker` / `DateRangePicker` parts port; react-aria useDatePicker / useDateRangePicker / useDatePickerGroup; react-stately picker states.

## Entry points
- `@rivetjs/cdk/date-picker` -> `index.tsx`: `DatePicker`, `DateRangePicker`; contexts `DatePickerContext` (rv-date-picker), `DateRangePickerContext`, `DatePickerStateContext`, `DateRangePickerStateContext`; render-props types
- `@rivetjs/cdk/date-picker/behaviour` -> `behaviour.tsx` (explicit export): `datePickerProps` / `dateRangePickerProps(props, state)` ({ groupProps, labelProps, fieldProps | startFieldProps / endFieldProps, buttonProps, dialogProps, calendarProps, descriptionProps, errorMessageProps, isInvalid, validationErrors, validationDetails }); handlers `datePickerGroupKeyDown`, `datePickerLabelClick`, `datePickerFocusIn/Out`, `datePickerUserEvent`, `datePickerFieldEvent`; `syncPickerInputs`, ids
- `@rivetjs/cdk/state/date-picker`

## Layout
- `pickerRoot` provides GroupContext (+ `ref` = popover trigger), ButtonContext, LabelContext, Calendar / RangeCalendarContext (accessor values read on open), OverlayTriggerStateContext, PopoverContext (`placement: "bottom start"`), DialogContext, TextContext, FieldErrorContext, DateFieldContext (range: slots `start` / `end`)
- Anatomy: `<Label/><Group><DateInput>{(s) => <DateSegment segment={s}/>}</DateInput><Button/></Group><Popover><Dialog><Calendar/></Dialog></Popover>`; preset only when there are no children (RAC)
- `PickerCommit` (mounted while open): clientEffect commits (`commitOnClose` + `syncPickerInputs`) once `isOpen` turns false
- tests: `tests-components/date-picker.test.ts`, `date-picker-state.test.ts`, `dom-events-dates.test.ts`; story `app/src/routes/date-picker.tsx` (`PickerBody` / `RangePickerBody` helpers)

## Rules / invariants
- Ids: group = `<id>`, `<id>-label`, `<id>-field` / `-start` / `-end`, `<id>-button`, `<id>-dialog`, `<id>-value`, `<id>-description`, `<id>-error`
- Never wrap `onOpenChange` with a closure over the state (state → closure → state cycle: "Cyclic reference")
- Fields forward keydown / focusin / focusout to the picker (`forward`): a resumed page runs only the nearest handler
- HiddenDateInput renders after the root (sibling)
- fieldProps / start / endFieldProps pass `"aria-describedby": base.describedBy` (segments described by the picker)
- group `aria-describedby`: description id `slotIdRef(id, false)` (server slot probe first: `probeSlots(providerValues, children)`, `#server`, UIID 2026-10-12; Popover content not probed), error id while invalid; inside another field's probe `pickerRoot` returns `null`
- calendar `onChange` → `setDateValue` / `setDateRange(state, value, beforeCommit)`: `beforeCommit` = `syncPickerInputs` so the validation commit reads the hidden inputs' new native validity (RS commitValue; docs `date-picker-form`, `date-range-picker-validation`)
- Picker fields get the picker's labelling as an accessor (`fieldProps["aria-labelledby"] = base.labelledBy`, CDK-PINS 2026-10-12): a call froze the client value before the picker `Label` mounted (`createSlot` is `false` until then), so a client render named segments `month` while the server (RAC first render: label `true`) wrote `month, ` + `aria-labelledby="<segment> <id>-label"` (RA useDateSegment); both renders now match RA.

## Gotchas
- `calendarProps.isDateUnavailable` is the user's function as is (RA): a wrapping arrow in a ternary does not serialize, which dropped the whole CalendarContext entry on resumed pages (popover calendar lost firstDayOfWeek / min / max / unavailable / value) — `tests/date-picker-calendar-props.test.ts`
- SSR "nothing loads before interaction" fails: repeated handler symbols (9 pickers) are preloaded as "visible" by the runtime planner
- Popover drops a user `id` (Popover lane)
- A conditional child's `onCleanup` did not run on close on a resumed page (hence the effect-based PickerCommit) — runtime question
- PickerCommit presence wrapped in `span[data-rv-overlay-anchor] style=display:contents` (own region, no first-change re-creation of the picker → focus returns to the typed segment, onFocus once; D1-D1d-1/2); it unmounts on close, so commit-on-close runs in the effect cleanup (`!untrack(state.isOpen)`)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../date-field/CLAUDE.md](../date-field/CLAUDE.md), [../calendar/CLAUDE.md](../calendar/CLAUDE.md), `apps/cdk-docs/content/components/date-picker.md`
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element (default path unchanged); reactive attrs are accessors, handlers inline arrows; DatePicker / DateRangePicker (the value-description span + overlay anchor stay siblings); tests `tests/render-date-color.browser.test.tsx`
- Live flags (LIVE-REST 2026-10-09): DatePicker / DateRangePicker `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid` live (`untrack` body + `liveOptions(PICKER_LIVE)`; the picker state is the owner, `date-field/CLAUDE.md`): root `data-*` in the spread bag, group / field segments / hidden input via `ownerFlag*`, calendar button `buttonDisabled` (disabled or read-only, accessor while live), CalendarContext `isDisabled` / `isReadOnly` passed as accessors
