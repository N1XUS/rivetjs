# @rivetjs/cdk/group
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC Group: `role="group"` container with hover / focus-within / focus-visible state for styling grouped controls (NumberField, ColorField, DatePicker, ComboBox provide props via `GroupContext`).

## Entry points
- `@rivetjs/cdk/group` -> `index.tsx`: `Group`, `GroupContext`, types `GroupProps`, `GroupRenderProps`
- no `behaviour.ts`

## Layout
- `index.tsx` - `<Group>`: contextProps, renderProps (accessors `isHovered`, `isFocusWithin`, `isFocusVisible`, `isDisabled`, `isInvalid`), `../utils/data-attrs.tsx` handlers (`within: true` → `data-focus-within`)
- tests: `tests/group.browser.test.tsx` (RAC Group.test.js port, render-function case skipped), `tests-components/links.test.ts`, `tests-components/dom-events-forms.test.ts`
- docs: `apps/cdk-docs/content/components/group.md`, examples `group-*`

## Rules / invariants
- `role` default `group`; default class `rv-Group`
- `isDisabled` / `isInvalid` / `isReadOnly` / `aria-disabled` / `aria-invalid` may be accessors; `isDisabled ?? aria-disabled`, `isInvalid ?? aria-invalid` (RAC)
- `data-hovered` / `data-focus-within` / `data-focus-visible` written by handlers (zero cost before interaction); signals only when a render-prop function asks
- Hover on the compiled element: delegated `onPointerOver` (`hoverStateOver`), no native pointerenter / pointerleave per Group; the user's `onPointerEnter` / `onPointerLeave` bind only when given (HOTPATH 2026-10-09). The `render` path keeps `hoverStateEnter` / `Leave`
- `OWNED = ["onPointerEnter", "onPointerLeave", "style"]`; own `onFocusIn` / `onFocusOut` chain user ones after; `onFocus` / `onBlur` / `onKeyDown` / `onKeyUp` pass through
- Live props (P5): body untracked; `liveOptions(ctxProps, [isDisabled, isInvalid, isReadOnly, aria-disabled, aria-invalid])`; class / style / children from a live view

## Gotchas
- Deviation: no "end hover when isDisabled turns true" effect (ends at next pointerleave); `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element; reactive attrs are accessors, handlers inline arrows; tests `tests/render-forms.browser.test.tsx`

## See also
- [../CLAUDE.md](../CLAUDE.md) (Component conventions), [../toolbar/CLAUDE.md](../toolbar/CLAUDE.md)
