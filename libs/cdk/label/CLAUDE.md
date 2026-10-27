# @rivetjs/cdk/label
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `Label` (reads `LabelContext`) + legacy `FieldError` + label/field id wiring (`fieldProps`) shared by every form field component; `Text` lives in `../text/` (re-exported).

## Entry points
- `@rivetjs/cdk/label` -> `index.tsx`: `Label`, `LabelContext`, `FieldError` (+ `LabelProps`, `FieldErrorProps`); re-exports `Text`, `TextContext`, `TextProps` (`../text`), `labelProps`, `fieldProps`, `labelsProps`, `describedBy`, deprecated shims `labelAria` / `fieldAria` / `labelsAttrs`, types `FieldIds`, `FieldAriaProps`, `LabelAria`, `LabelAriaProps`
- `@rivetjs/cdk/label/behaviour` -> `behaviour.ts`: same id helpers

## Layout
- `index.tsx` - `<Label>` (`label` / `span` branches, other `elementType` via `Dynamic`; `contextProps(props, props.ref, LabelContext)`; accessor `children` reactive), `<FieldError>` (legacy, see Gotchas)
- `behaviour.ts` - RA `useLabel` / `useField` / `useLabels`: `labelProps`, `fieldProps`, `labelsProps`, `describedBy`; `/** @deprecated migration shim */` `labelAria` / `fieldAria` / `labelsAttrs` (remove when no importer)
- importers: checkbox, radio-group, text-field, date-field, date-picker, select (`fieldAria` shim, legacy `FieldError`)
- `Label`: `if (slotProbing || isHiddenPart()) return null` first (`slotProbing`: a field's server slot probe, `#server`, the constant `false` in browsers; the label consumes no slot id)
- tests: `tests/slots.browser.test.tsx` (Label + LabelContext)
- tests: `tests-components/dom-events-forms.test.ts` "Label / Text / FieldError / Form / Group" (route `tests-components/app/src/routes/dom-events-forms.tsx`); indirectly via `checkbox.test.ts`, `radio-group.test.ts`, `text-field.test.ts`
- docs examples: `apps/cdk-docs/examples/field-*/`

## Upstream
- RAC `Label.tsx`, `Text.tsx`, `FieldError.tsx`; react-aria `label/useLabel.ts`, `label/useField.ts`, `utils/useLabels.ts` (Apache-2.0)
- Rivet: Label reads `LabelContext` (fields provide id / `for` / `elementType`); `render` prop via `renderElement`; not hideable
- Rivet (behaviour.ts:3-5): generated ids retained across resume (`resumedId`); description / error ids in `aria-describedby` only while that part renders (RA `useSlotId`)
- Rivet (FieldError): node kept with `hidden` while no error (RAC renders nothing) so id relation + bindings stay

## Rules / invariants
- `describedBy(ids, invalid)` reads a live `aria-describedby` accessor (`ids.extraDescribedBy`) inside the caller's binding (LIVE-SWEEP; a function was joined as text before)
- live props (P5): a live prop (own getter, e.g. `class={c()}` or dynamic children) takes `../utils/live-element.tsx` `liveElement` (class / style / children through bindings; other props forwarded); static props keep the compiled per-element path (0 cost); `render` stays read once
- hideable (RAC `createHideableComponent`): `if (isHiddenPart()) return null` BEFORE `contextProps` (`../collections/hidden.ts`): in the collection build pass the providers are absent (slot lookups would throw)
- explicit `id` -> derived part ids `<id>-label`, `<id>-description`, `<id>-error` (byte-stable HTML); else `resumedId()`
- `errorMessageId` always reserved (errors can appear later); `descriptionId` only when description given
- `labelAria`: label `for` only when `labelElementType` is `label`; group fields (checkbox/radio group) pass `"span"`
- `labelsAttrs`: aria-label + aria-labelledby both -> labelledby includes the element's own id
- `describedBy(ids, invalid)`: description, error (while invalid), extra ids - read inside a binding
- default classes: `rv-Label` (no `data-slot`, RAC), `rv-FieldError` (`data-slot="errorMessage"`); `Text` → `rv-Text` (`../text`)
- `FIELD_ERROR_OWNED = ["hidden"]` (FieldError controls `hidden`); Label/Text: `globalDOMProps(props)` no OWNED
- `FieldError.errorMessage`: content, function of validation, or default `validationErrors.join(" ")`; `hasError` overrides visibility (default `validation().isInvalid`)
- props read before JSX (spread elements)
- Server: `Label` marks its context ref rendered (`markSlotRendered`, slots) before rendering, so an owner whose `createSlot` started `false` (an `aria-label` given) and renders after it names the label (TagList `aria-labelledby`, CDK-PINS 2026-10-12).

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/slots.browser.test.tsx`
- `npx vitest run --project cdk-components libs/cdk/tests-components/dom-events-forms.test.ts`

## Gotchas
- `labelProps` dev-only `console.warn` when no label / aria-label / aria-labelledby (behaviour.ts:49-50); guarded by `DEV` (`#dev`)
- two FieldErrors: legacy one here (`errorMessage` / `validation` / `hasError` props, used by checkbox / radio-group / date-field / date-picker / select) vs RAC `FieldError` + `FieldErrorContext` in `../form/field-error.tsx` (render-prop API); re-export the form one here once those importers migrate
- FieldError renders three branches on `errorMessage` type at component run; switching type later does not re-branch

## See also
- [../CLAUDE.md](../CLAUDE.md)
- `apps/cdk-docs/content/components/field.md`
- [../form/CLAUDE.md](../form/CLAUDE.md), [../text-field/CLAUDE.md](../text-field/CLAUDE.md)

- ID-RESUME (2026-10-27): Generated label, input, description and error ids use the shared `resumedId()` keyed-signal helper. The resume record retains the server id when parts adopt independently. Existing explicit-id fallback and ARIA behaviour are unchanged.
