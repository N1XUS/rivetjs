# @rivetjs/cdk/toolbar
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC Toolbar: arrow keys move focus across controls (also across `Group`s, separators, nested toolbars; no wrap), Tab leaves, re-entry restores last focused control.

## Entry points
- `@rivetjs/cdk/toolbar` -> `index.tsx`: `Toolbar`, `ToolbarContext`, types `ToolbarProps`, `ToolbarRenderProps`
- `@rivetjs/cdk/toolbar/behaviour` -> `behaviour.ts`: `toolbarProps(props, isInToolbar?)`, `toolbarKeys(orientation)`, `toolbarKeyDown(e, { orientation, direction? })`, `toolbarFocus(e)`, `toolbarBlur(e)`, type `AriaToolbarProps`

## Layout
- `index.tsx` - `<Toolbar>`; internal `InToolbarContext`: nested toolbar renders `role="group"` without `data-rk` from the server on
- `behaviour.ts` - RA useToolbar; last-focused control in a module `WeakMap` (browser only)
- importers: `toggle-button-group/*` (`toolbarProps`, `toolbarKeyDown(event, state)`)
- tests: `tests/toolbar.browser.test.tsx` (RAC Toolbar.test.tsx port, render case in `tests/render-collections.browser.test.tsx`), `tests-components/links.test.ts`, `tests-components/dom-events-forms.test.ts`
- docs: `apps/cdk-docs/content/components/toolbar.md`, `foundations/keyboard-navigation.md`, examples `toolbar-*`

## Rules / invariants
- root: `role` toolbar / group, `aria-orientation` + `data-orientation` (default horizontal), `aria-labelledby` only without `aria-label`; class `rv-Toolbar`
- `data-rk` = `toolbarKeys(orientation)` (outer toolbar only)
- RTL: `useLocale().direction` (passed in key props) or DOM `dir` flips Left / Right
- render prop `orientation` is an accessor; no `role` prop

## Gotchas
- Deviation: bubbling keydown / focusin / focusout (chosen when capture handlers did not resume; they do since the derived model) → a descendant stopping an arrow key keeps it
- `render` prop (RAC DOMRenderProps; `(attrs, renderProps)` → spread attrs; early return before the compiled element; `tests/render-collections.browser.test.tsx`) (renderProps `orientation`)

## See also
- [../CLAUDE.md](../CLAUDE.md) (Component conventions), [../group/CLAUDE.md](../group/CLAUDE.md)
