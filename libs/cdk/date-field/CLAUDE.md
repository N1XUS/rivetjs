# @rivetjs/cdk/date-field
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `DateField` / `TimeField` / `DateInput` / `DateSegment` / `HiddenDateInput` parts port; react-aria useDateField / useTimeField / useDateSegment; react-stately useDateFieldState / useTimeFieldState.

## Entry points
- `@rivetjs/cdk/date-field` -> `index.tsx`: `DateField`, `TimeField`, `DateInput` (children `(segment: DateSegmentItem) => <DateSegment segment={segment}/>`), `DateSegment`, `HiddenDateInput`; contexts `DateFieldContext` (rv-date-field; picker passes `pickerField`), `TimeFieldContext` (rv-time-field), `DateFieldStateContext` (rv-date-field-state), `TimeFieldStateContext` (rv-time-field-state)
- `@rivetjs/cdk/date-field/behaviour` -> `behaviour.tsx` (explicit export): `dateFieldProps` / `timeFieldProps(props, state)` ({ labelProps, fieldProps, inputProps, descriptionProps, errorMessageProps, isInvalid, validationErrors, validationDetails }), `dateSegmentProps({ key }, state)`, `hiddenDateInputProps`, `fieldLabelledBy` / `fieldDescribedBy(state)`; handlers `(event, state)`: `dateFieldKeyDown`, `dateFieldBeforeInput`, `dateFieldInput`, `dateFieldFocusIn/Out`, `dateFieldInvalid`, `hiddenDateInputChange`
- `live-value.tsx` (internal, Rivet-only): `liveDateValue` / `liveDateProps` — a live controlled `value={date()}` → string-form accessor (`dateValueText`: single / multiple / range) the date states read and never write (`isWritable` guards in `state/date-field.ts`, `state/date-picker.ts`, `state/calendar.ts`); used by DateField, TimeField, DatePicker, DateRangePicker, Calendar, RangeCalendar (NUMBERFIELD-LIVE 2026-10-09)
- `@rivetjs/cdk/state/date-field`, `@rivetjs/cdk/state/time-field` (`createTimeFieldState`, `timeValue`), `@rivetjs/cdk/state/date-intl` (generated)

## Layout
- `fieldRoot` (DateField / TimeField): provides state ctx, GroupContext(fieldProps), InputContext, LabelContext (span), TextContext slots `description` / `errorMessage`, FieldErrorContext (computed ValidationResult); renders value description + HiddenDateInput (date only); preset (no children) = `DateInput` of segments, lazy
- `DateInput` standalone (inside a picker): reads `slottedContext(DateFieldContext, slot)` and re-provides; inner = `<Group>` + `For` over segment keys + `<Input/>`
- tests: `tests-components/date-picker-state.test.ts`, `date-picker.test.ts` (`/date-picker`, incl. TimeField story), `dom-events-dates.test.ts`

## Rules / invariants
- No `locale` prop (I18nProvider); onChange typed per value type (no `any`)
- Bags: handlers are inline arrows inside object literals; props destructured into locals (props-capture)
- Nested field groups (HeroUI DateInputGroup: `<Group>` around DateInput's own `<Group>`, both merging the field's GroupContext props, as RAC): the delegated keydown / focusin / focusout / pointer handlers act only on the innermost `[data-rv-date-field]` around the target (`innermostField`; React Aria: the segment's `useKeyboard` stops propagation) — else ArrowUp stepped twice
- `state.aria` plain data (`hasLabel` = createSlot fn or boolean, SlotIds, strings); error id in describedby only while invalid (FieldError renders only then); description id `slotIdRef(id, false)`: server slot probe first (`probeSlots(values, children)`, `#server`, UIID 2026-10-12), so a field without a Description names no id (it was kept by expectation: a dangling IDREF on resumed pages); inside another field's probe `fieldRoot` returns `null`
- HiddenDateInput renders as the root's sibling (`.rv-DateField:has(#id) ~ [data-testid=hidden-dateinput-container]`)
- picker fields (`isPresentation`, `state.aria.presentation`): `fieldDescribedBy` = only the `aria-describedby` the picker passes (`base.describedBy` accessor: picker value + description + error; RA useDateField `roleSymbol`); the field's own value / slot ids are not used
- validation messages: `ownerFormat` carries a standalone field's `maxGranularity` (TimeField "hour" → "Value must be 5:00 PM or earlier.", RS formatOpts); pickers have none
- `state.aria.ownLabelledBy` (`AriaDateFieldOptions["aria-labelledby"]`) = a string or an accessor (pickers pass `base.labelledBy`); `fieldLabelledBy` reads it per call.

## Gotchas
- Day period labels (`behaviour.tsx` `dayPeriods`, PERF-REST P12 2026-10-27, Rivet-only): formatted once per locale (`dayPeriodCache`; upstream formats AM + PM on each call: 12-hour `fieldKeys`, day period input / composition); 1,000 calls 1.7 ms → 17 µs. Assumes untampered `Intl` and a fixed time zone per page.
- Id root (FACTS-GAP 2026-10-27): DateField / TimeField pass the state `id: props.id || resumedId()` (caller's id, else `createId()` in a keyed signal): a resumed page's adopt run reuses the server id; see `../date-picker/CLAUDE.md`.
- Description id stays in server markup until the slot-id effect runs (RA useSlotId)
- `isDateUnavailable`, `validate`, `onChange` must be inline / local
- `segmentKeys` / `segmentOf` (behaviour.tsx) derive keys once per `segments(state)` array (WeakMap; `segmentKeys` returns a copy): every segment attribute binding asks `segmentOf`, which rebuilt the keys + called `segments` twice. `textValueOf` / `segmentStyle` read `resolvedOptionsOf(formatter)` (state/date-field.ts). DatePicker 300 mounts 93.1 → 75.1 ms with the i18n memos (HOTPATH 2026-10-09)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../date-picker/CLAUDE.md](../date-picker/CLAUDE.md), `apps/cdk-docs/content/components/date-field.md`, `apps/cdk-docs/content/components/time-field.md`
- DateSegment hover / focus are delegated (HOTPATH 2026-10-09): `onPointerOver` / `onPointerOut` with a `relatedTarget`-outside check = enter / leave (`data-hovered`), `onFocusIn` / `onFocusOut` with `target === currentTarget` = focus / blur (`data-focused` / `data-focus-visible`); the user's `onPointerEnter` / `onPointerLeave` bind only when given. No native listener per segment: DatePicker ×300 listeners 7500 → 300, dispose 4.7 → 3.8 ms, heap −6%, mount 73.7 → 71.1 ms.
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element (default path unchanged); reactive attrs are accessors, handlers inline arrows; parts: DateField, TimeField (the value-description span + HiddenDateInput stay siblings), DateSegment; DateInput renders `<Group>` (no `render` until Group has it); tests `tests/render-date-color.browser.test.tsx`
- DateInput forwards `render` to its Group.
- Live flags (LIVE-REST 2026-10-09): `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid` value forms stay live (DateField / TimeField: `untrack` body + `liveOptions(FIELD_LIVE)`); the owner keeps creation `isX` + accessor `disabled` / `readOnly` / `required` (`state/date-field.ts` `ownerBase`), read via `ownerDisabled` / `ownerReadOnly` / `ownerRequired` at event time (keys, typing, `setValue`, `confirmPlaceholder`, time-wheels); attribute values from `behaviour.tsx` `ownerFlag` / `ownerFlagAttr` / `ownerFlagTrue` / `segmentTabIndex` (creation value when static, returned arrow when live); root `data-*` flags only in the spread bag `dom` (no plain JSX attribute); tests `tests/live-controlled.browser.test.tsx` "live flags: date parts", `tests/live-flags-ssr.test.ts`, story `/live-props` `#lf-date-*`

- ID-RESUME (2026-10-27): DateField / TimeField roots (the existing FACTS-GAP helper now comes from utils/resumed-id.tsx via utils/id.ts) use the shared `resumedId()` keyed-signal helper. The resume record retains the server id when parts adopt independently. Existing explicit-id fallback and ARIA behaviour are unchanged.
