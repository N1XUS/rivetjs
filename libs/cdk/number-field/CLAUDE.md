# libs/cdk/number-field
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `NumberField` + RA `useNumberField`: locale-formatted text input with steppers, keys, wheel, snapping, validation, hidden form input.

## Entry points
- `index.tsx` (`@rivetjs/cdk/number-field`): `NumberField`, `NumberFieldContext`, `NumberFieldStateContext`, `NumberFieldProps`, `NumberFieldRenderProps` (accessors + `state`). Provides `GroupContext`, `InputContext`, `LabelContext`, `ButtonContext` (slots `increment` / `decrement`), `TextContext` (slots `description` / `errorMessage`), `FieldErrorContext`.
- `behaviour.tsx` (`@rivetjs/cdk/number-field/behaviour`, explicit export): `numberFieldProps(props, state)` → bags (`labelProps`, `groupProps`, `inputProps`, `incrementButtonProps`, `decrementButtonProps`, `descriptionProps`, `errorMessageProps`, accessors `isInvalid` / `validationErrors` / `validationDetails`, `spin` + `edit` JSON) + free handlers `numberField<Event>(event, props, state, aria)` (input, change, invalid, focus, blur, keydown/up, paste, beforeinput, composition*, group focusin/out, increment/decrement press start/up/end, button focus/blur, scroll, dispose).
- `intl.ts`: generated strings (Increase / Decrease / Number field).
- State: `../number` `createNumberFieldState` (react-stately useNumberFieldState).

## Upstream
- react-aria `numberfield/useNumberField.ts`, react-aria-components `NumberField.tsx`; tests `tests/number-field.browser.test.tsx` (RAC), `tests/number-field-behaviour.browser.test.tsx` (RA hook).

## Rules / invariants
- Spin button: `../spinbutton/behaviour.tsx`; `numberFieldSpinProps` builds its props at event time.
- Validation: `change` / Enter / blur-after-change call `commitNumberValidation` = `afterChange` (syncValidity + native min/max/step validity) then `commitValidation` (RA commits after render; Rivet's commit is synchronous, so native validity is re-synced first). `aria.edit.changed` marks a change during the current edit.
- `onCopy` / `onCut` / `onSelect` / `onCompositionUpdate` pass through `inputProps` (RA merge).
- Resumability: bag closures are inline arrows in object literals; `buttonProps` closures capture plain values only (an arrow passed as an argument is not wrapped → "function is not serializable"); `aria` excludes children / class / style / ref / slot.
- input `aria-describedby`: Description / FieldError slot ids via `slotIdRef(id, false)` (server: a slot probe, `probeSlots(values, children)`, runs first, so the attribute names only the parts that render — UIID 2026-10-12; the FieldError id is kept while invalid, `slotIdRef(errorId, isInvalid())`: RAC FieldError renders only then; inside another field's probe the owner returns `null`; before, the description id was kept by expectation and stayed a dangling IDREF on resumed pages: dev `aria-idref`)
- Live props (P5): body untracked; `liveOptions(merged, LIVE_KEYS, [value])` (state + behaviour read them with `read`); class / style / children via `renderPropsOf`. A live controlled `value={n()}` is an accessor in the state (`state.value`, `fixed`: read on every use, never written; the input text re-formats on read when it changes — NUMBERFIELD-LIVE 2026-10-09, `tests/live-controlled.browser.test.tsx`); a Signal stays two-way. Live by default (LIVE-SWEEP 2026-10-11): `minValue` / `maxValue` / `step` / `formatOptions` (the state already `read`s them on every use: clamp, snap, can-increment, parser / formatter, native validity), `isWheelDisabled` (read at scroll time), `aria-describedby` (read in the input binding) / `-details` / `-errormessage` (replaces the earlier read-once ruling). Read once (JSDoc "Read once at mount"): `id`, `name`, `form`, `aria-label` / `aria-labelledby`, `increment` / `decrementAriaLabel` (they decide the steppers' labelling ids), `autoFocus`, `defaultValue`, `validationBehavior`, `validate`, handlers
- Live `isRequired` (LIVE-REST 2026-10-09): in `LIVE_KEYS`; root `data-required` binding + render prop; `numberFieldProps` input `required` / `aria-required` returned-arrow accessors when it is an accessor (`requiredWhen`)

## Gotchas / deviations
- `id` lands on the input (RAC); the root has no id.
- Stepper labelledby = `${buttonId} ${labelId}` → accessible name "Decrease <label>".
- Holding a stepper that becomes disabled (user `isDisabled` accessor) keeps spinning until release: Button does not cancel the press on disable (RA usePress effect; routed to B2). RAC test skipped.
- Resumed page: the input carries `data-rk` = `SPIN_KEYS` (`spinKeysAttr`; none while disabled / read-only): a cold ArrowUp / PageUp / Home / End is held and replayed, and the stepped value stays in the input (SLIDER-KEY: the replay used to put the pre-replay text back). Other keys typed while chunks load act natively and replay (`tests/number-field.browser.test.tsx` data-rk case).
- `FieldErrorContext` value = object-literal arrow (`fieldError.validation`, index.tsx): a plain const arrow did not resume, so a resumed page's `<FieldError>` never rendered (tests-components `slider-number-field` "FieldError renders after resume").
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element; reactive attrs are accessors, handlers inline arrows; tests `tests/render-forms.browser.test.tsx`; hidden form input stays a sibling of the rendered element

- ID-RESUME (2026-10-27): Generated input and increment / decrement button IDREF roots use the shared `resumedId()` keyed-signal helper. The resume record retains the server id when parts adopt independently. Existing explicit-id fallback and ARIA behaviour are unchanged.
