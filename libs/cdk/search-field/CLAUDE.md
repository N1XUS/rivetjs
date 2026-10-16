# @rivetjs/cdk/search-field
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC SearchField port: labelled `<input type="search">` with a clear button; Enter submits, Escape clears.

## Entry points
- `@rivetjs/cdk/search-field` -> `index.tsx`: `SearchField`, `SearchFieldContext` (rv-search-field), `SearchFieldProps`, `SearchFieldRenderProps`
- `@rivetjs/cdk/search-field/behaviour` -> `behaviour.tsx` (explicit export): `searchFieldProps(props, state, inputRef?)` (RA useSearchField) -> `{labelProps, inputProps, clearButtonProps, descriptionProps, errorMessageProps, ids, textState, isInvalid, validationErrors, validationDetails}`; `searchFieldKeyDown`, `searchFieldClear`, `searchFieldClearPressStart`
- state: `@rivetjs/cdk/state/search-field` (react-stately useSearchFieldState): `createSearchFieldState`, `searchFieldValue`, `setSearchFieldValue`
- `intl.ts`: generated react-aria `intl/searchfield` strings ("Clear search")

## Parts / contexts provided
LabelContext, InputContext, ButtonContext (clear button: `excludeFromTabOrder`, `preventFocusOnPress`), TextContext (description / errorMessage), GroupContext, FieldErrorContext. Merges `SearchFieldContext` then `FieldInputContext` (enclosing `<Autocomplete>`).

## Rules / invariants
- `value`: plain = controlled, Signal = two-way, accessor = controlled read live
- Root `rv-SearchField` with `data-empty/disabled/invalid/readonly/required`; render props are accessors + `state`
- Hidden in a collection build pass (`isHidden()`, RAC createHideableComponent)
- FieldErrorContext value = object-literal function `fieldError.validation` (a const arrow in the `values` array did not resume: the FieldError of a resumed SearchField never rendered; docs `search-field-validation`)
- input `aria-describedby`: Description / FieldError slot ids via `slotIdRef(id, false)` (server: a slot probe, `probeSlots(values, children)`, runs first, so the attribute names only the parts that render — UIID 2026-10-12; the FieldError id is kept while invalid, `slotIdRef(errorId, isInvalid())`: RAC FieldError renders only then; inside another field's probe the owner returns `null`; before, the description id was kept by expectation and stayed a dangling IDREF on resumed pages: dev `aria-idref`)
- Live props (P5): body untracked; `liveOptions(ctxMerged, LIVE_KEYS, ["value"])` — live by default (LIVE-SWEEP 2026-10-11): state flags, `type`, `placeholder`, `pattern`, `min` / `maxLength`, `autoComplete` / `autoCapitalize` / `autoCorrect` / `spellCheck` / `inputMode` / `enterKeyHint`, `form`, `excludeFromTabOrder`, `aria-describedby` / `-details` / `-errormessage` / `-controls` / `-activedescendant` / `-autocomplete` / `-haspopup` (the input's `aria-describedby` binding reads the accessor with `read`). Read once: `id`, `name`, `aria-label` / `aria-labelledby`, `autoFocus`, `defaultValue`, `validationBehavior`, `validate`, handlers; `liveWithoutData` instead of `removeDataAttributes`; `data-disabled` / `data-readonly` bindings, `GroupContext.isDisabled` + clear button `isDisabled` get the accessor (`behaviour.tsx` `clearDisabled`, key handlers check the flags at key time)
- Live `isRequired` (LIVE-REST 2026-10-09): in `LIVE_KEYS`; root `data-required` binding + render prop read it; the input's `required` / `aria-required` follow through `textFieldProps`

## Tests
- `tests/search-field-state.test.ts` (useSearchFieldState port + Signal / accessor), `tests/search-field.browser.test.tsx` (RAC SearchField.test.js + RA useSearchField.test.js ports; `render` covered in render-forms)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../text-field/CLAUDE.md](../text-field/CLAUDE.md), [../autocomplete/CLAUDE.md](../autocomplete/CLAUDE.md)
