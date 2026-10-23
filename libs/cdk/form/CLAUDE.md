# @rivetjs/cdk/form
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Native `<form>` with RAC validation contexts (`validationBehavior`, server `validationErrors`) + the shared field validation / reset plumbing.

## Entry points
- `@rivetjs/cdk/form` -> `index.tsx`: `Form`, `FormProps`, `FormContext` (rv-form), `FormValidationContext` (rv-form-validation), `formValidationBehavior(own)`, `formValidationErrors()`, deprecated shims `useValidationBehavior` / `useValidationErrors`; re-exports `FieldError`, `FieldErrorContext`, `FieldErrorProps`, `FieldErrorRenderProps`; types `ValidationBehavior`, `ValidationErrors`, `ValidationResult`, `ValidationFunction`
- `form/field-error.tsx`: RAC `FieldError` (`<Text slot="errorMessage">`, default class `rv-FieldError`, `elementType`, accessor render props) + `FieldErrorContext` (rv-field-error; `ValidationResult` or accessor); renders nothing while valid; a plain-JSX (slot) child resolving to `undefined` = RAC `children == null` → default children (validation errors joined), a render-function child returning null → nothing
- `FieldError` in a field's server slot probe (`slotProbing`, `#server`): returns `null` at once — owners keep the error id while invalid (`slotIdRef(errorId, isInvalid())`), nothing to mark
- `@rivetjs/cdk/form/behaviour` -> `behaviour.ts`: `validityError`, `nativeValidity`, `syncValidity`, `validationInvalid` (focus + keyboard modality), `validationChange`, `commit`, `onFormReset` (skips cancelled resets), `applyPendingValidity`, `formSubmit`, type `ValidatableElement`
- `@rivetjs/cdk/state/form-validation` -> `state/form-validation.ts` (unchanged API)

## Layout
- `index.tsx` - `<Form>`: provides `{ validationBehavior }` + server errors; accessor `validationErrors` → a clientEffect re-applies fields' `data-rv-error` as custom validity after it changes (RA layout effect)
- `field-error.tsx`, `behaviour.ts`, `../state/form-validation.ts`
- tests: `tests/form.browser.test.tsx` (RAC Form.test.js, 8 + 1 skip), `tests/field-error.browser.test.tsx` (RAC FieldError.test.js, 6 + 2 skips), `tests/form-reset.browser.test.tsx` (RA useFormReset.test.tsx over `utils` useFormReset + `onFormReset`, 10 + 2 skips); stories text-field / checkbox / radio-group / select / dom-events-forms
- docs examples: `apps/cdk-docs/examples/form-*/`, `field-*` (parts API)

## Upstream
- RAC `Form.tsx`; react-aria `form/useFormValidation.ts`, `utils/useFormReset.ts`; react-stately `form/useFormValidationState.ts` (Apache-2.0)
- Rivet (index.tsx:4-5): plain JSX children are a lazy slot rendered inside the Form contexts (`renderSlot`); function children work too
- Rivet (behaviour.ts:3-5): no layout effect before interaction -> custom validity synced from field handlers (input/change/focus/invalid) and, for untouched fields, by `formSubmit` from the `data-rv-error` attribute
- Rivet (state header): "realtime" / "display" validation are read functions called by bindings, not per-render values

## Rules / invariants
- `validationBehavior` default `"native"` (constraint validation blocks submit); `"aria"` -> `noValidate` on the form; field resolution: own prop, else Form's, else `"native"`
- `validationErrors`: object, signal or accessor keyed by field `name`; shown until the field is edited; Provider value defaults to `{}`
- every field renders `data-rv-error={validityError(state)}`; `formSubmit` applies it as custom validity, cancels + `stopImmediatePropagation` if invalid; user `onSubmit` only runs when not `defaultPrevented`
- `onFormReset(owner, input, fn)`: one reset listener per form, attached lazily from the first handler that sees the input (once per state); a reset cancelled in the capture phase resets nothing
- `onReset` / `onInvalidCapture` are always bound (unconditional inline arrows: conditional closures are not resumable)
- `MaybeAccessor<T>` + `read()` is the shared "value or accessor" convention (also used by Button `isPending`)
- default class `rv-Form`; `globalDOMProps(props)` no OWNED; props read before JSX
- Live props (P5): a live `class` goes into the spread bag as `liveClass(merged, "rv-Form")` (no explicit `class` attribute on `<form>`)

## Commands
- `npx vitest run --project cdk-components libs/cdk/tests-components/dom-events-forms.test.ts libs/cdk/tests-components/text-field.test.ts libs/cdk/tests-components/checkbox.test.ts libs/cdk/tests-components/radio-group.test.ts`

## Gotchas
- fields never interacted with have no custom validity until submit (by design; `applyPendingValidity`)
- form `reset` listener (behaviour.ts:112) never removed; duplicates `useFormReset` (cdk-review M8 / addEventListener class (c))

## See also
- [../CLAUDE.md](../CLAUDE.md)
- `apps/cdk-docs/content/components/form.md`
- [../label/CLAUDE.md](../label/CLAUDE.md), [../text-field/CLAUDE.md](../text-field/CLAUDE.md), [../checkbox/CLAUDE.md](../checkbox/CLAUDE.md)
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element; reactive attrs are accessors, handlers inline arrows; tests `tests/render-forms.browser.test.tsx`; Form `render` provides contexts via `provide()`. FieldError forwards `render` to its `Text` (runs only while an error shows)
