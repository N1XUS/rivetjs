# @rivetjs/cdk/color-field
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `ColorField` + react-aria `useColorField` / `useColorChannelField`: hex text field (Enter / blur commit, arrows / wheel increment) or, with `channel`, a number field over one channel.

## Entry points
- `@rivetjs/cdk/color-field` -> `index.tsx`: `ColorField`, `ColorFieldContext` (rv-color-field), `ColorFieldStateContext` (rv-color-field-state), `ColorFieldProps`, `ColorFieldRenderProps`; re-exports `behaviour.tsx`
- `@rivetjs/cdk/color-field/behaviour` -> `behaviour.tsx`: `colorFieldProps`, `colorFieldSpinProps`, handlers `colorFieldInput` / `Change` / `Invalid` / `BeforeInput` / `CompositionStart` / `CompositionEnd` / `Scroll` / `KeyDown` / `KeyUp` / `Focus` / `Blur` / `Dispose`; `colorChannelFieldProps`, `colorChannelFieldNumberProps` (channel field = number-field handlers over `numberFieldView(state)`)
- state: `@rivetjs/cdk/color` `createColorFieldState`, `createColorChannelFieldState`

## Rules / invariants
- Parts provided: `InputContext`, `LabelContext`, `GroupContext` (`role="presentation"`), `TextContext` slots description / errorMessage (`createSlotId`), `FieldErrorContext`; channel field adds hidden `<input type=hidden name form value>`.
- Root `data-channel` / `data-disabled` / `data-invalid` / `data-readonly` / `data-required`; default class `rv-ColorField`.
- Channel field default `aria-label` = channel name while no `<Label>` renders (reactive).
- Resume: handlers / bindings capture only plain locals + state (signals, JSON move states, string colors); bags passed to `*Props` are explicit fields, never `...props` (a closure reading `props.x` captures the whole props object).
- Resume + `validate`: the state's validation value accessor lives in `color/field-state.tsx` (resumable symbol); `index.tsx` imports `createColorFieldState` from that file directly — the resume build walks `.tsx` imports only, not through the `.ts` barrel `@rivetjs/cdk/color` (else "Resume manifest has no chunk for …field-state.tsx#validationValue$0"; before, a `.ts` wrapper made the page unserializable). Test: tests-components `color` "color field: FieldError renders after resume".
- input `aria-describedby`: description `slotIdRef(id, false)` (server slot probe first: `probeSlots(values, children)`, `#server`, UIID 2026-10-12), error id while invalid; inside another field's probe `renderField` returns `null`
- Live props (P5): body untracked (`colorField`); `liveOptions` keys `isDisabled` / `isReadOnly` / `isInvalid` (+ `isRequired` on a hex field; a channel field's `isRequired` is read once, as NumberField's `numberFieldProps`) + controlled `value`: hex `colorFieldProps` makes input `disabled` / `readOnly` / `required` / `aria-*` accessors (returned arrows `liveFlag`), channel field reuses NumberField's live `numberFieldProps`; handlers `read()` the flags at event time; root `data-disabled` / `data-readonly` / `data-required` in the spread bag; `GroupContext.isDisabled` = the accessor; `channel` / `colorSpace` read once. Flags go into the spread bag only (an explicit attribute after a spread overrides the bag's key). Tests `tests/live-controlled.browser.test.tsx` "live flags: color parts", `tests/live-flags-ssr.test.ts`, story `/live-props` `#lf-color-*`. Gap (static too): a channel ColorField does not render resumably in `live-flags-ssr` (`ColorChannelField` capture #2), the story build resumes.

## Tests
- `tests/color-field.browser.test.tsx` (RAC ColorField.test.js + react-aria useColorField.test.js + additions; slot ids need `await tick()`); story `/color` #hex, #picker-field.

## See also
[../color/CLAUDE.md](../color/CLAUDE.md), [../number-field/CLAUDE.md](../number-field/CLAUDE.md), `apps/cdk-docs/content/components/color-field.md`
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element; reactive attrs are accessors, handlers inline arrows; tests `tests/render-forms.browser.test.tsx`; hidden form input stays a sibling of the rendered element
