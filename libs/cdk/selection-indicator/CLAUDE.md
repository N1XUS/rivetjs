# @rivetjs/cdk/selection-indicator
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `SelectionIndicator`: a `SharedElement` named "SelectionIndicator", visible while the enclosing item is selected; moves (animated) between the items of one `SharedElementTransition` scope.

## Entry points
- `@rivetjs/cdk/selection-indicator` -> `index.tsx`: `SelectionIndicator`, `SelectionIndicatorProps`; re-exports `SelectionIndicatorContext`, `SelectionIndicatorContextValue`, type `SharedElementRenderProps`

## Layout
- `context.ts` - `SelectionIndicatorContext` (default `{ isSelected: false }`). Imported by tabs / radio-group / toggle-button: only this token lands in their chunks
- `index.tsx` - component; calls `SharedElement(...)` as a plain function (reads stay on the user's `<SelectionIndicator />` site, render-function children pass through)
- tests: `../tests/shared-element.browser.test.tsx` "SelectionIndicator", `../tests-components/selection-indicator.test.ts`

## Upstream
- RAC `SelectionIndicator.tsx` (2025, Apache-2.0); no upstream tests
- Rivet: context `isSelected` is an accessor (or boolean) so items never re-render; `useContextProps` → own `isSelected` / `class` / `style` win over the context's

## Rules / invariants
- Default class `rv-SelectionIndicator` (RAC `react-aria-SelectionIndicator`); `data-entering` / `data-exiting` = `"true"`
- Providers: Tabs tab content (`tab` slot), RadioGroup radio content (`children` render), ToggleButton children. Scopes: Tabs tablist, RadioGroup group; ToggleButton: ToggleButtonGroup (wraps its items in `SharedElementTransition`) or a user `<SharedElementTransition>`
- Zero cost: a page without `SelectionIndicator` ships only the context tokens + Provider wrappers of the items

## Commands
- see [../shared-element-transition/CLAUDE.md](../shared-element-transition/CLAUDE.md)

## Gotchas
- Not wired yet (upstream wires them): ListBox, GridList, Table, TagGroup, Menu, Tree

## See also
- [../shared-element-transition/CLAUDE.md](../shared-element-transition/CLAUDE.md), [../CLAUDE.md](../CLAUDE.md)
