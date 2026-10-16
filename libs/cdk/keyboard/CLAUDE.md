# @rivetjs/cdk/keyboard
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `Keyboard`: shortcut text `<kbd dir="ltr">` reading `KeyboardContext` (menu items provide slot `keyboard`).

## Entry points
- `@rivetjs/cdk/keyboard` -> `index.tsx`: `Keyboard`, `KeyboardContext` (`rv-keyboard`), `KeyboardProps`

## Layout
- `index.tsx` - component + context
- tests: `tests/slots.browser.test.tsx` (Keyboard cases); story `tests-components/app/src/routes/slots.tsx` + `tests-components/slots.test.ts` (SSR + resume)
- docs: `apps/cdk-docs/content/components/keyboard.md`, example `keyboard-shortcuts`

## Upstream
- RAC `Keyboard.tsx` (Apache-2.0); `render` prop via `renderElement` (renderProps `undefined`)

## Rules / invariants
- server field slot probe first (`if (slotProbing) return (probeSlot(props, KeyboardContext), null)`, `#server`): marks the menu item's shortcut slot id; hideable (RAC `createHideableComponent`): `if (isHiddenPart()) return null` BEFORE `contextProps` (`../collections/hidden.ts`): in the collection build pass the providers are absent (slot lookups would throw)
- props merged with the context via `contextProps(props, props.ref, Ctx)` (slots, `slot={null}` opt-out; own props win, handlers chain context-first)
- `children` may be an accessor (`() => title()`, also via context): rendered with `renderSlot` as reactive content (C7 date fields, dialog titles)
- `dir="ltr"` default (overridable); no default class (RAC has none)
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/slots.browser.test.tsx`
- `STORIES_DIST=dist-b1 npx vitest run --project cdk-components libs/cdk/tests-components/slots.test.ts`

## Gotchas
- none known

## See also
- [../CLAUDE.md](../CLAUDE.md), [../slots/CLAUDE.md](../slots/CLAUDE.md)
