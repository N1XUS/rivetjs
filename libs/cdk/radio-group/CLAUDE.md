# @rivetjs/cdk/radio-group
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`<div role=radiogroup>` + `<span>` label + native radios sharing a `name`: arrow keys, single tab stop, form submit native (zero JS); handlers keep state/read-only/validation in step.

## Entry points
- `@rivetjs/cdk/radio-group` -> `index.tsx`: `RadioGroup` (overloads: compound without `items`, preset with `items`), `RadioGroupProps` (union), `RadioGroupItemsProps`, `RadioItem`, type `RadioGroupState`; re-exports `parts.tsx`: `RadioGroupParts`, `RadioField`, `RadioButton`, `Radio` (deprecated all-in-one), `radioProps` (RA useRadio), contexts `RadioGroupContext`, `RadioContext`, `RadioFieldContext`, `RadioGroupStateContext`, types `RadioGroupPartsProps`, `AriaRadioProps`, `RadioProps`, `RadioFieldProps`, `RadioButtonProps`, `*RenderProps` (accessors), `RadioGroupData`, `RadioAria`
- `@rivetjs/cdk/radio-group/behaviour` -> `behaviour.ts`: `syncRadioValidity`, `radioChange`, `radioFocus`, `radioGroupFocusOut`, `radioInvalid`, `setSelectedValue`
- `@rivetjs/cdk/state/radio-group` -> `state/radio-group.ts`: `createRadioGroupState`, `setSelectedValue`, `setLastFocusedValue`, `isRadioInvalid`, `radioTabIndex`, `RadioGroupStateOptions`, `RadioGroupState`

## Layout
- `index.tsx` - `<RadioGroup>`: no `items` → `RadioGroupParts` (RAC compound); `items` → `RadioGroupItems` (data-driven preset: `<For>` keyed by `value`, optional render slot `children(item)`)
- `parts.tsx` - RAC compound port: group root (`role=radiogroup`, provides LabelContext `elementType: span`, TextContext description / errorMessage slots, FieldErrorContext, `RadioGroupStateContext`, SharedElementTransition), `RadioField` (label wrapper + context), `RadioButton` (native radio in an inline visually hidden span + render-prop content), `Radio` = RadioField + RadioButton in one label; `state.data` = `{ form, descriptionId, errorMessageId, validationBehavior }` (RA `radioGroupData`)
- `behaviour.ts` - RA `useRadioGroup` / `useRadio` handlers (change, focus, focus-out, invalid, validity sync)
- `../state/radio-group.ts` - React Stately `useRadioGroupState` (+ RA useRadio `radioTabIndex`, unused by the component: native tab stop)
- deps: `state/form-validation.ts`, `form/` (`FieldError`, `FieldErrorContext` from `form/field-error.tsx`), `label/` (`fieldAria`), `text-field/fields.ts` (`errorText`, `fieldDescribedBy`)
- tests: `tests-components/radio-group.test.ts` (route `tests-components/app/src/routes/radio-group.tsx`); `tests-components/dom-events-forms.test.ts` "RadioGroup (focus-within) and Radio item events" (route `dom-events-forms.tsx`); `tests-components/widgets.test.ts` "form fields:" + `axe.test.ts` (route `forms.tsx`)
- docs examples: `apps/cdk-docs/examples/radio-group-*/`

## Upstream
- RAC `RadioGroup.tsx` (`RadioGroup` / `Radio`), react-aria `radio/useRadioGroup.ts`, `radio/useRadio.ts`, react-stately `radio/useRadioGroupState.ts` (Apache-2.0)
- Deviations: items preset (index.tsx) = data-driven `items` + render slot, native radios stay visible (hide via `inputClass`, e.g. `sr-only`). Compound (parts.tsx): native radios sharing `name` keep arrows / tab stop / submit native (RA's JS roving tab index not ported); label activation native (press state from `pressProps`, no action); label `onMouseDown` → `preventDefault`; items preset: label `onMouseDown` → `preventDefault` except when the target is the visible native radio itself (canceling it canceled the radio's focus, so arrow keys after a click on the circle had no target; RA input `usePress` focuses on pointerdown; the resumed cold replay reproduces the native cancel — fix 2026-10-19); class props typed `ClassNameOrFunction<…>` (TS2430-safe in `.d.ts`)

## Rules / invariants
- group root: `role="radiogroup"`, `aria-orientation` + `data-orientation` (default `vertical`), `aria-invalid/disabled/readonly/required`, `data-disabled/readonly/required/invalid`; default class `rv-RadioGroup`
- radio label: `rv-Radio` (`itemClass`), `data-selected="true"`, `data-disabled`, `data-readonly`, `data-invalid`, `data-required`; group label `rv-Label` `<span data-slot="label">`; descriptions `rv-Text` `data-slot="description"`
- `name` default = generated id (`state.name`): both callers (`RadioGroupItems`, `RadioGroupParts`) pass `props.name ?? resumedId()` — `createId()` in `state/radio-group.ts` is `rvc…` in an adopt run, so adopted radios left the server radios' group (arrows checked nothing; SELECT-B 2026-10-28); item `id` default generated; item description id = `<inputId>-description`
- input `aria-describedby` = item description + error (when shown) + group description; group + inputs read `slotIdRef(id, false)`: RadioGroup / RadioField (server: a slot probe, `probeSlots(values, children)`, runs first, so the attribute names only the parts that render — UIID 2026-10-12; the FieldError id is kept while invalid, `slotIdRef(errorId, isInvalid())`: RAC FieldError renders only then; inside another field's probe the owner returns `null`; before, the description id was kept by expectation and stayed a dangling IDREF on resumed pages: dev `aria-idref`)
- group `onFocus`/`onBlur`/`onFocusChange` = focus-within via `onFocusIn`/`onFocusOut` (ignored when relatedTarget inside group); `radioGroupFocusOut` always wired
- `globalDOMProps(props)` / `globalDOMProps(option)` without OWNED (component's own events are focusin/focusout/change/focus, not in the global set)
- validation: native -> `required` on inputs; group always gets `aria-required` when required
- deprecated aliases `required`, `disabled`, `describedBy`, item `disabled`
- SelectionIndicator (RAC): radios inside `SharedElementTransition` (`../shared-element-transition/transition.tsx`); with a `children` render each radio's content is wrapped in `Provider SelectionIndicatorContext { isSelected: () => state.selectedValue() === value }`; story `/selection-indicator-groups`
- Overloads, not a generic union: a union prop type loses contextual typing of `children` / `items` arrows (TS7006 in test routes)
- live props (P5): `RadioGroupParts` runs `liveOptions(merged, [isDisabled, isReadOnly, isInvalid])` (state `disabled` / `readOnly` accessors; group `aria-*` / `data-disabled` / `data-readonly` through the bag as returned-arrow accessors — `groupDisabled` / `groupReadOnly` / `flagAttr`, never conditional bare arrows: "function is not serializable" on resume); `RadioField` / `Radio` keep their own `isDisabled` live (`ownRadioProps`), `data-readonly` follows the group through the spread; class / style / children from a live view (`renderPropsOf`); bodies untracked; `RadioGroup` dispatch and `Radio` → `RadioButton` are direct calls (component spread of a live props object re-created the region on resume, see `../checkbox/CLAUDE.md`). Controlled `value` (NUMBERFIELD-LIVE 2026-10-09): a two-way Signal, a plain value or a live `value={v()}` (accessor via `liveOptions(…, ["value"])`, also in the `items` preset); plain / accessor = `state.fixed` (never written: `setSelectedValue` / `radioChange` only call `onChange`, the radios re-sync to the prop in a microtask — React restores a controlled input; before, a plain string crashed the state: deprecated 2-arg `controllable`). Live `orientation` / `aria-describedby` / `aria-details` / `aria-errormessage` (LIVE-SWEEP round 2): in `GROUP_LIVE`; orientation goes into the bags as a returned arrow (`liveOrientation`), `data-orientation={read(orientation)}`, `aria-describedby` joins `read(extraDescribedBy)`; only `aria-orientation` / `data-orientation` change (arrow keys move in both axes, like RA). Read once: the Signal identity, `defaultValue`, `name`, `form`, `id`, `aria-label` / `aria-labelledby`, `validationBehavior`, the `items` preset's props (its own `orientation` included). Tests `tests/live-props.browser.test.tsx`, story `tests-components/live-props.test.ts`
- Live `isRequired` (LIVE-REST 2026-10-09): `GROUP_LIVE` includes it; state `required` accessor (`isRadioGroupRequired`); group `aria-required` via the bag (`flagAria(groupRequired(state))`), `data-required` bindings on group / RadioField / RadioButton, radio input `required` (native) live; the `items` preset (`RadioGroupItems`) still reads its props once

## Commands
- `npx vitest run --project cdk-components libs/cdk/tests-components/radio-group.test.ts libs/cdk/tests-components/dom-events-forms.test.ts`

## Gotchas
- error message = `FieldError` from `@rivetjs/cdk/form` (`form/field-error.tsx`), rendered by the group inside its own `Provider FieldErrorContext` (`errorMessage` -> children, `errorClass` -> class); renders nothing while valid (no `hidden` span). Known bug (docs lane D2b): it also renders nothing while invalid (server + resume) although `aria-describedby` names `<id>-error`; docs example `radio-group-validation` skips those steps (`// cdk bug`)
- `errorMessage` undefined → the FieldError slot child resolves to `undefined` → FieldError's default children (validation errors); before K1 it rendered nothing (test `tests/fields-ssr.test.ts`, docs `radio-group-validation`, `form-server-errors`)
- `radio-group.test.ts`: 1 known baseline failure (../CLAUDE.md Gotchas)
- `RadioItem` focus/key handlers go on the input, global DOM props on the label - keep the split (RAC `<Radio>` props)
- Item label `onMouseDown` = user handler then `preventDefault()` (RA useRadio labelProps, RAC merge order): label mousedown keeps focus in the group. Cold page: the first mousedown default lands before the chunk loads (loader holds only clicks) — `tests-components/dom-events-forms.test.ts` documents it

## See also
- [../CLAUDE.md](../CLAUDE.md)
- `apps/cdk-docs/content/components/radio-group.md`
- [../checkbox/CLAUDE.md](../checkbox/CLAUDE.md), [../form/CLAUDE.md](../form/CLAUDE.md), [../label/CLAUDE.md](../label/CLAUDE.md)

- ID-RESUME (2026-10-27): Generated group / input / label / description IDREF roots use the shared `resumedId()` keyed-signal helper. The resume record retains the server id when parts adopt independently. Existing explicit-id fallback and ARIA behaviour are unchanged.
