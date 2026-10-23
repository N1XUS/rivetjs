# @rivetjs/cdk/text-field
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `TextField` / `TextArea` (label, input, description, FieldError, validation) + Angular CDK text-field (textarea autosize, AutofillMonitor) in one module.

## Entry points
- `@rivetjs/cdk/text-field` -> `index.tsx`: `TextField`, `TextFieldContext` (rv-text-field), `TextFieldProps`, `TextFieldRenderProps`, type `ValidationResult`; `export * from "./autosize.ts"`
- `@rivetjs/cdk/text-field/behaviour` -> `behaviour.tsx` (explicit entry; closures): `createTextFieldState`, `textFieldProps(props, inputRef?, state?)`, handlers `textFieldInput` / `textFieldChange` / `textFieldInvalid` / `textFieldFocus` / `textFieldBlur`, `formattedTextFieldProps` + `formattedTextField*` handlers (NumberField / ColorField), types `AriaTextFieldProps` (incl. legacy `validationState`), `TextFieldState`, `TextFieldAria`, `InputRef`; re-exports the pure helpers
- `text-field/fields.ts` (no export entry, imported relatively): pure `errorText`, `fieldDescribedBy`, `isInvalid`, `HasValidation`, `ErrorMessage` (date-field, date-picker, select, radio-group)
- `@rivetjs/cdk/text-field/autosize`, `@rivetjs/cdk/text-field.css`: Angular CDK autosize / AutofillMonitor; Rivet `autosizeProps({ minRows, maxRows, native })` → `{ class, rows: 1, style? }`, `style` an object of the CSS variables (`--cdk-autosize-min-rows` / `-max-rows`) so it spreads onto the TextArea part or a `<textarea>` (was a string: "Unsafe style property: 0")

## Layout
- `index.tsx` RAC TextField: root `<div class="rv-TextField">` provides `LabelContext`, `InputContext`, `TextAreaContext` (no type/pattern), `TextContext` slots (description / errorMessage via `createSlotId`), `FieldErrorContext`; compose `<Label/><Input/>|<TextArea/><Text slot="description"/><FieldError/>` (Input / TextArea / Label / Text are B1 parts)
- `InputContext` bag = `definedProps(inputProps)` + the label / describedby accessors (LIVE-FAST 2026-10-09: the RA bag's ~30 unset keys dropped; same attributes, an own `<Input>` prop the bag left unset lands after the bag's keys in attribute order; cdk TextField × 1000 mount 33–35 → 21–23 ms, heap −20%)
- merges `FieldInputContext` (`autocomplete/contexts.ts`, Autocomplete / ComboBox) after `TextFieldContext`, before the state; root DOM props come from the TextField's own props only; context `onPointerDown` goes on the input
- tests: `tests/text-field.browser.test.tsx` (RAC TextField.test.js Input + TextArea, 30 + 4 skipped), `tests/text-field-behaviour.browser.test.tsx` (RA useTextField.test.js, 9); stories `tests-components/text-field.test.ts` (route `text-field.tsx`), `dom-events-forms`, `widgets` "form fields" + `axe`; `tests/browser/text-field.test.ts` (Angular autosize)
- docs examples: `apps/cdk-docs/examples/text-field-*/`, `text-area-*/` (parts API)

## Rules / invariants
- input id is an `idSignal`: `<Input id>` merges into it (RA mergeIds) so the label `for` follows (client; server keeps the label's first `for`)
- `aria-describedby`: description + error slot ids (RA useSlotId; `slotIdRef(id, false)` (server: a slot probe, `probeSlots(values, children)`, runs first, so the attribute names only the parts that render — UIID 2026-10-12; the FieldError id is kept while invalid, `slotIdRef(errorId, isInvalid())`: RAC FieldError renders only then; inside another field's probe the owner returns `null`; before, the description id was kept by expectation and stayed a dangling IDREF on resumed pages: dev `aria-idref`); no client check effect: no idle boot, UI-COLD 2026-10-08) + own; `aria-labelledby` accessor follows the Label slot
- `value` plain (controlled, reports onChange) / Signal (two-way) / accessor; `isInvalid` accessor stays live
- validation default `native` (or Form's); `data-rv-error` on the input for cold Form submit
- closures: inline arrows in object literals; focus: delegated `onFocusIn` → `textFieldFocusIn(e, state)` (target === input → validity sync); user `onFocus` / `onBlur` / `onFocusChange` → native `onFocus` / `onBlur` on the input bag, only when given (conditional object-literal spreads), so `<Input onFocus>` merged after the bag runs after them (RA chain order; `tests/interaction-delegation.browser.test.tsx`); without callbacks 2 listeners per field (`change`, `invalid`)
- live props (P5): `TextField` runs `liveOptions(merged, LIVE_KEYS, ["value"])` (isDisabled / isReadOnly / isInvalid / type / pattern / min/maxLength / aria-describedby / -details / -errormessage / -controls / -activedescendant / -autocomplete → accessors resolved by the input bag spread); body in `textField()` under `untrack`; `data-disabled` / `data-readonly` bindings. Read once: `aria-label` / `aria-labelledby` (combined by `fieldProps`), `name`, `id`. Test `tests/live-props.browser.test.tsx`; a computed password `type` follows visibility in place, preserving value, focus and selection.
- Live `isRequired` (LIVE-REST 2026-10-09): in `LIVE_KEYS`; root `data-required={isRequired() || undefined}`, render prop accessor; `textFieldProps` turns an accessor `isRequired` into `required` / `aria-required` returned-arrow accessors (`requiredWhen`; static path unchanged) — also used by SearchField / ComboBox
- Live by default (LIVE-SWEEP 2026-10-11, user rule: every prop live unless design forces read once): `LIVE_KEYS` also holds `autoComplete` / `autoCapitalize` / `autoCorrect` / `spellCheck` / `inputMode` / `enterKeyHint`, `form`, `aria-haspopup`, `excludeFromTabOrder` (`textFieldProps`: `haspopupAttr` / `tabIndexAttr` returned-arrow accessors when live); `liveOptions` runs only when `hasLive` (static path: 0 descriptor checks). Read once (JSDoc "Read once at mount" in `AriaTextFieldProps`): `id`, `name`, `aria-label` / `aria-labelledby`, `autoFocus`, `inputElementType`, `defaultValue`, `validationBehavior`, `validate`, handlers. This supersedes the P5 "Read once" list above

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/text-field.browser.test.tsx libs/cdk/tests/text-field-behaviour.browser.test.tsx`
- `STORIES_DIST=dist-x npx vitest run --project cdk-components libs/cdk/tests-components/text-field.test.ts`
- `npx vitest run --project cdk libs/cdk/tests/browser/text-field.test.ts`

## Gotchas
- `autosize.ts` STYLES string (autosize.ts:23-29) duplicates `text-field.css` (minus the native rule): change both
- `loadStyles` injects a `<style data-cdk-text-field>` (nonce via `getNonce`) on first monitor/autosize use - conflicts with package "no style injection" rule; SSR pages can import `text-field.css` instead
- TextArea is `@rivetjs/cdk/text-area` (B1); the old `TextArea` export from text-field is gone
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element; reactive attrs are accessors, handlers inline arrows; tests `tests/render-forms.browser.test.tsx`; GroupContext not provided (RAC provides it for `<Group>` inside TextField)
- TextArea `value` / `defaultValue` render as a `value` attribute on the server (empty textarea until resume): runtime/compiler server lowering, scratchpad runtime-bugs.md [K1]; docs `text-area-controlled` keeps that step out

## See also
- [../CLAUDE.md](../CLAUDE.md)
- `apps/cdk-docs/content/components/text-field.md`, `text-area.md`
- [../form/CLAUDE.md](../form/CLAUDE.md), [../label/CLAUDE.md](../label/CLAUDE.md)
