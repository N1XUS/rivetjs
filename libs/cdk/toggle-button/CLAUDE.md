# @rivetjs/cdk/toggle-button
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`<button type="button" aria-pressed>` toggled by presses; state in `state/toggle.ts` (shared with Checkbox, Switch).

## Entry points
- `@rivetjs/cdk/toggle-button` -> `index.tsx`: `ToggleButton`, `ToggleButtonProps`, `ToggleButtonRenderProps`, `ToggleButtonContext` (RAC; resumable id `rv-toggle-button`)
- `@rivetjs/cdk/toggle-button/behaviour` -> `behaviour.ts`: `toggleButtonAttrs(state)`, `toggleButtonPress`, `toggleButtonPressOptions`, `toggleButtonPointerDown`, `toggleButtonKeyDown`, `toggleButtonClick`, `isToggleSelected`
- `@rivetjs/cdk/state/toggle` -> `state/toggle.ts`: `createToggleState`, `setSelected`, `toggle`, `ToggleState`, `ToggleStateOptions`

## Layout
- `index.tsx` - `<ToggleButton>` (RAC)
- `behaviour.ts` - RA `useToggleButton`: attrs + press wiring over `../button/press.ts` (adapter of `../interactions/press.tsx`)
- `../state/toggle.ts` - React Stately `useToggleState`
- tests: `tests/toggle-button.browser.test.tsx` (port of RAC ToggleButton.test.js: class, DOM props, render props, `render`, slot, hover, focus ring, press state, disabled, selected + Rivet: context without slots, two-way signal, `state` render prop, group render props / `render`, zero interaction attrs before interaction); `tests-components/button.test.ts` "toggle button:" (route `tests-components/app/src/routes/button.tsx`); `tests-components/widgets.test.ts` "buttons:" (route `buttons.tsx`); `tests-components/dom-events-forms.test.ts` "ToggleButton forwards global events…" (route `dom-events-forms.tsx`); `tests-components/axe.test.ts` (`/buttons`)
- docs examples: `apps/cdk-docs/examples/toggle-button-*/`

## Upstream
- RAC `ToggleButton.tsx`, react-aria `button/useToggleButton.ts`, react-stately `toggle/useToggleState.ts` (Apache-2.0)
- deviations in the `index.tsx` header (`Rivet:` list): accessor render props, states as signals only for function render props, `data-*` interaction attrs from handlers, live group `isDisabled`

## Rules / invariants
- `[props, ref] = contextProps(inProps, inProps.ref, ToggleButtonContext)` (RAC `useContextProps`: slots, `ref`)
- `OWNED = ["render", "onPointerDown", "onClick", "onPointerEnter", "onPointerLeave", "onPointerOver", "style"]`; user handler chained after the toggle press / hover handler; delegated hover / focus wiring as Button (`hoverStateOver`, `focusStateIn`; 0 listeners per instance)
- render props (RAC `ToggleButtonRenderProps`, accessors): `isHovered`, `isPressed`, `isFocused`, `isFocusVisible`, `isDisabled`, `isSelected`, `state` (in a group: a toggle state over the group selection, `onChange` → group `setSelected`); hover / press / focus signals only when `class` / `style` / `children` is a function (`isFn`)
- `render` (RAC DOMRenderProps): `if (props.render) return props.render(attrs, values)` before the compiled `<button>`; attrs = same attributes, accessors for selection, inline-arrow handlers, `tabindex` lowercase, `children` = `provide(SelectionIndicatorContext, …)`
- interaction attrs `data-hovered` / `data-focused` / `data-focus-visible` written by handlers (`../utils/data-attrs.tsx`; hover disabled while `isDisabled`), `data-pressed` by press.ts; `onFocus` / `onBlur` / `onFocusChange` / `onHover*` through the same handlers
- `excludeFromTabOrder` (RA `useFocusable`): `boolean | () => boolean` (Rivet: accessor, bound to `tabIndex` / render-path `tabindex`); `@rivetjs/ui` Segment passes one for a server-rendered roving tab stop (`-1` on unselected items of a group with a selection)
- `isSelected` = two-way `Signal<boolean>` (`controllable`), else `defaultSelected`; `onChange(isSelected)` only on actual change
- `toggle()` no-op when disabled; `setSelected()` no-op when read-only; `defaultSelected` kept for form reset
- `toggleButtonPressOptions`: toggle first, then caller `onPress` (RA chain order); build it inside handlers - functions created in .ts modules are not resumable (behaviour.ts:24)
- render: `class="rv-ToggleButton"` default, `aria-pressed="true|false"`, `data-selected="true"`, `data-disabled`, `data-pressed` (press.ts), native `disabled`
- no non-RAC aliases (`selected` / `disabled` / `label` removed 2026-10-08: use `isSelected` / `isDisabled` / `aria-label`)
- props read into locals before JSX (spread root)
- In a `ToggleButtonGroup` (`ToggleGroupStateContext`, `../toggle-button-group/context.ts`) with an `id`: `id` = selection key (not the DOM id), selection from `isKeySelected(groupState, id)`, single mode `role="radio"` + `aria-checked`, multiple `aria-pressed`; press via `../toggle-button-group/item.tsx`; disabled = own || group, an accessor read at use (`data-disabled` / `disabled` bindings, `isDisabled` render prop, hover switch, press handlers; all via `isGroupDisabled(groupState)`): a live group `isDisabled` updates the buttons in place. Standalone: `id` = DOM id (`String(id)`)
- children (`rp.children()`, function children = render props) rendered inside `provide(SelectionIndicatorContext, { isSelected })` (element child: a JSX `<Provider>` child would not re-run function children) (same accessor as aria-pressed / aria-checked; RAC); scope comes from ToggleButtonGroup or a user `<SharedElementTransition>`
- live props (P5): `isSelected` value form = controlled (`liveOptions(props, ["isDisabled"], ["isSelected"])` → accessor into `createToggleState`; `isSelected?: boolean | Signal<boolean>`), `isDisabled` / `excludeFromTabOrder` / aria keys through `liveView` + `liveAt` (read in bindings / at event time), class / style / children through `renderProps(…, liveView)`; body reads untracked. Test `tests/live-props.browser.test.tsx`

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/toggle-button.browser.test.tsx libs/cdk/tests/toggle-button-group.browser.test.tsx`
- `npx vitest run --project cdk-components libs/cdk/tests-components/button.test.ts libs/cdk/tests-components/dom-events-forms.test.ts`

## Gotchas
- `onPressUp` not in `ToggleButtonProps` (Button has it); no `onPointerUp` wiring

## See also
- [../CLAUDE.md](../CLAUDE.md)
- `apps/cdk-docs/content/components/toggle-button.md`
- [../button/CLAUDE.md](../button/CLAUDE.md), [../checkbox/CLAUDE.md](../checkbox/CLAUDE.md), [../switch/CLAUDE.md](../switch/CLAUDE.md)
