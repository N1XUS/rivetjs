# @rivetjs/cdk/toggle-button-group
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `ToggleButtonGroup`: `ToggleButton`s with `id`s in single (`role="radiogroup"`, radios with `aria-checked`) or multiple (`role="toolbar"`, `aria-pressed`) selection; arrow keys move focus (useToolbar).

## Entry points
- `@rivetjs/cdk/toggle-button-group` -> `index.tsx`: `ToggleButtonGroup`, `ToggleButtonGroupProps`, `ToggleButtonGroupRenderProps`, `ToggleButtonGroupContext` (`rv-toggle-button-group`), `ToggleGroupStateContext` (`rv-toggle-group-state`), type `ToggleGroupState`
- `@rivetjs/cdk/toggle-button-group/behaviour` -> `behaviour.tsx` (explicit package.json entry): `toggleButtonGroupProps(props, state)` (RA `useToggleButtonGroup` → `groupProps`), re-exports `item.tsx`: `toggleButtonGroupItemProps(props, state)` → `{ buttonProps, isSelected, isDisabled }`, `toggleButtonGroupItemPointerDown/KeyDown/Click(event, props, state)`, `toggleButtonGroupItemPressOptions`
- `@rivetjs/cdk/state/toggle-group` -> `../state/toggle-group.ts`: `createToggleGroupState(props, live?)`, `isGroupDisabled`, `toggleKey`, `setSelected`, `setSelectedKeys`, `selectedKeysOf`, `isKeySelected`

## Layout
- `index.tsx` - component (RAC ToggleButtonGroup.tsx); toolbar keys from `../toolbar/behaviour.ts`; children inside `SharedElementTransition` (`../shared-element-transition/transition.tsx`) for `SelectionIndicator`
- `context.ts` - the two contexts (separate so `../toggle-button/index.tsx` consumes the state context without pulling the group)
- `behaviour.tsx` - group props; `item.tsx` - item props + press handlers (no toolbar import; used by ToggleButton). `.tsx`: accessor closures (resumable closures rule)
- tests: `../tests/toggle-group-state.test.ts` (state, project `cdk`), `../tests/toggle-button-group.browser.test.tsx` (port of RAC ToggleButtonGroup.test.js, `cdk-browser`), `../tests-components/toggle-button-group.test.ts` route `/toggle-button-group` (SSR + resume)
- docs: `apps/cdk-docs/content/components/toggle-button-group.md`, examples `apps/cdk-docs/examples/toggle-button-group-*`

## Upstream
- RAC `ToggleButtonGroup.tsx`, react-aria `button/useToggleButtonGroup.ts`, react-stately `toggle/useToggleGroupState.ts` (Apache-2.0)
- Naming: `useToggleButtonGroup` → `toggleButtonGroupProps`, `useToggleButtonGroupItem` → `toggleButtonGroupItemProps`, `useToggleGroupState` → `createToggleGroupState`

## Rules / invariants
- `selectedKeys`: plain iterable = controlled (only `onSelectionChange` reports), `Signal<Iterable<Key>>` = two-way, omitted = `defaultSelectedKeys` (region state)
- Rivet extension (2026-10-08, no RAC counterpart; RAC Tabs / Select shape, used by `@rivetjs/ui/segment`): `selectedKey` (plain key / `null` = controlled, `Signal<Key | null>` = two-way, written with the first key of the new set or `null`) + `defaultSelectedKey` for single selection; `selectedKeys` / `defaultSelectedKeys` win when given; tests `../tests/toggle-group-state.test.ts` "selectedKey"
- `onSelectionChange` fires on every toggle (fresh Set ≠ current, upstream `useControlledState` semantics), also when `disallowEmptySelection` keeps the key
- Render props: `orientation()`, `isDisabled()` accessors + `state` object; `data-orientation`, `data-disabled="true"`, `aria-disabled="true"`, `aria-orientation`; default class `rv-ToggleButtonGroup`; `data-rk` = toolbar arrow keys
- ToggleButton in a group: `id` is the selection key (no DOM id); disabled = own `isDisabled` || group's (read at use)
- Live props: `isDisabled` / `orientation` read lazily from the own props (live getter), else the `ToggleButtonGroupContext` value (`slottedContext`; `contextProps` / RA mergeProps snapshot), through the component's registered getter object `live`: `createToggleGroupState(merged, live)` keeps `state.isDisabled` = value at creation (plain data: a getter on the state makes the resume encoder rebuild it from its recipe with a fresh selection signal the server bindings do not track — broke resumed selection) and `state.live`; readers use `isGroupDisabled(state)` (item press options, ToggleButton, `aria-disabled`); only the selection signal is `_regionState`. `toggleButtonGroupProps(props, state, live)` returns `aria-orientation` / `aria-disabled` accessors; `data-orientation` / `data-disabled` / `data-rk` bindings; toolbar keydown reads `live`. Tests: `../tests/toggle-button-group.browser.test.tsx` "live …" (client), `../tests/toggle-group-state.test.ts`, `libs/ui/tests-components/toggle-buttons.test.ts` (resumed, from the second change)
- Live props (P5): class / style / children via `renderPropsOf(merged, …)` (untracked)
- Live `disallowEmptySelection` (LIVE-SWEEP round 2): a getter on `live` (own prop, else context); `toggleKey` reads `isEmptySelectionDisallowed(state)` (untracked). Read once: `selectionMode` (roles + selection model), `id`, handlers, `defaultSelectedKeys` / `defaultSelectedKey`

## Gotchas
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element; reactive attrs are accessors, handlers inline arrows; tests `tests/render-forms.browser.test.tsx`; toolbar handlers bubble (see `../toolbar/behaviour.ts` header), not capture

## See also
- [../toggle-button/CLAUDE.md](../toggle-button/CLAUDE.md), [../toolbar/CLAUDE.md](../toolbar/CLAUDE.md), [../selection-indicator](../selection-indicator), [../state/CLAUDE.md](../state/CLAUDE.md)
