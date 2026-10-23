# @rivetjs/cdk/switch
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `Switch`, `SwitchField` + `SwitchButton`: visually hidden `<input type=checkbox role=switch>` in a `<label>`.

## Entry points
- `@rivetjs/cdk/switch` -> `index.tsx`: `Switch`, `SwitchField`, `SwitchButton`, `SwitchContext` (rv-switch), `SwitchFieldContext` (rv-switch-field), `ToggleStateContext` (rv-toggle-state), `*Props`, `*RenderProps`
- `@rivetjs/cdk/switch/behaviour` -> `behaviour.tsx` (explicit entry): `switchProps(props, state, inputRef?)` = `toggleProps` + `role="switch"` (RA useSwitch), `AriaSwitchProps`, `SwitchAria`

## Layout
- `index.tsx` components; internal context
- tests: `tests/switch.browser.test.tsx` (RAC Switch.test.js, 43); stories `tests-components/checkbox.test.ts` "switch:" (route `checkbox.tsx`), `widgets` "form fields" + `axe` (route `forms.tsx`)
- docs examples: `apps/cdk-docs/examples/switch-*/` (`Switch` with a drawn track; `SwitchField` + `SwitchButton` for validation / `isInvalid`)

## Rules / invariants
- label state: `rv-Switch` / `rv-SwitchButton`, `data-selected`, `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-readonly`, `data-invalid`, `data-required`; SwitchField root `rv-SwitchField`
- `isSelected` plain / Signal / accessor; render props accessors; behaviour shared with `../checkbox/behaviour.tsx`
- SwitchField provides `TextContext` slots + `FieldErrorContext`
- `SwitchButton` root bag: `mergeInto(globalDOMProps(…), labelProps, hover)` (merged into the fresh bag; input bag unset keys dropped by `toggleProps`, LIVE-FAST — see ../checkbox/CLAUDE.md)
- live props (P5): `Switch` / `SwitchField` run `liveOptions(merged, LIVE_KEYS, ["isSelected"])` (isDisabled / isReadOnly / isInvalid / aria keys → accessors; a forwarded two-way Signal stays two-way), `liveOmit` / `liveWithoutData` / `liveAssign` instead of spreads, render props via `renderPropsOf`. Read once (JSDoc "Read once at mount"): `name`, `value`, `form`, hover handlers, `slot` (`isRequired` is live: LIVE-REST). Test `tests/live-props.browser.test.tsx`
- Live `isRequired` (LIVE-REST 2026-10-09): `SwitchField` (`LIVE_KEYS`) → `data-required` bindings on the field and its `SwitchButton` (context `isRequired` may be an accessor); standalone `Switch` sets no `data-required` (as before)
- live props (P5), resume: `Switch` renders `SwitchButton` by a direct call (see `checkbox/` — component spread of a forwarding props object re-created the region on a resumed page); state / aria creation under `untrack`
- SwitchField server slot probe (CDK-PINS 2026-10-12): `probeSlots(values, () => rp.children())` before rendering (as CheckboxField): the input renders before its `Text slot="description"`, so the server input names the description id the client render links; inside another field's probe `SwitchField` returns `null`. Its children render twice on the server — unmeasured; follow-up: measure (ssr-bench / micro, CheckboxField has the same pattern) before changing (CDK-PINS review 2026-10-12 #5).

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/switch.browser.test.tsx`

## Gotchas
- examples / story tests must click the label (input visually hidden); `progress-bar-indeterminate` example clicked `#known` (coordinator fixing)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../checkbox/CLAUDE.md](../checkbox/CLAUDE.md), [../form/CLAUDE.md](../form/CLAUDE.md)
- `apps/cdk-docs/content/components/switch.md`
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element; reactive attrs are accessors, handlers inline arrows; tests `tests/render-forms.browser.test.tsx`; SwitchField `<div>`, SwitchButton / Switch `<label>` (hidden input inside `children`)
