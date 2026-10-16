# @rivetjs/cdk/text
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `Text`: description / free text part reading `TextContext` (fields provide `{ slots: { description, errorMessage } }` with ids; SlotId ids supported).

## Entry points
- `@rivetjs/cdk/text` -> `index.tsx`: `Text`, `TextContext` (`rv-text`), `TextProps`; also re-exported by `@rivetjs/cdk/label`

## Layout
- `index.tsx` - component + context
- tests: `tests/slots.browser.test.tsx` (Text cases); story `tests-components/app/src/routes/slots.tsx` + `tests-components/slots.test.ts` (SSR + resume)
- docs: `apps/cdk-docs/content/foundations/slots.md`, examples `slots-*`

## Upstream
- RAC `Text.tsx` (Apache-2.0); `render` prop via `renderElement`; deviation: not a hideable collection component

## Rules / invariants
- live props (P5): a live prop (own getter, e.g. `class={c()}` or dynamic children) takes `../utils/live-element.tsx` `liveElement` (class / style / children through bindings; other props forwarded); static props keep the compiled per-element path (0 cost); `render` stays read once
- hideable (RAC `createHideableComponent`): a server field slot probe first (`if (slotProbing) return (probeSlot(props, TextContext), null)`; `slotProbing` from `#server`, the constant `false` in browsers): marks the description / errorMessage slot id it takes; then `if (isHiddenPart()) return null` BEFORE `contextProps` (`../collections/hidden.ts`): in the collection build pass the providers are absent (slot lookups would throw)
- props merged with the context via `contextProps(props, props.ref, Ctx)` (slots, `slot={null}` opt-out; own props win, handlers chain context-first)
- `children` may be an accessor (`() => title()`, also via context): rendered with `renderSlot` as reactive content (C7 date fields, dialog titles)
- `elementType` `span` (default) / `div` / `p` are compiled branches; others via `Dynamic` (no resumable handlers there)
- default class `rv-Text`
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/slots.browser.test.tsx`
- `STORIES_DIST=dist-b1 npx vitest run --project cdk-components libs/cdk/tests-components/slots.test.ts`

## Gotchas
- `Dynamic` branch: event handlers not resumable; `style` is passed only when set (server `Dynamic` rejects the `style` attribute name, even `undefined`; a set `style` still throws there: runtime gap)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../slots/CLAUDE.md](../slots/CLAUDE.md)
