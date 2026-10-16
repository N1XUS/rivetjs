# @rivetjs/cdk/header
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `Header`: section header (`<header>`), reading `HeaderContext`; collection leaf (`createLeafComponent(HeaderNode, …)`, `../collections/components.tsx`).

## Entry points
- `@rivetjs/cdk/header` -> `index.tsx`: `Header`, `HeaderContext` (`rv-header`), `HeaderProps`

## Layout
- `index.tsx` - component + context
- tests: `tests/slots.browser.test.tsx` (Header cases); story `tests-components/app/src/routes/slots.tsx` + `tests-components/slots.test.ts` (SSR + resume)
- docs: `apps/cdk-docs/content/foundations/slots.md`

## Upstream
- RAC `Header.tsx` (Apache-2.0); `render` prop via `renderElement` (renderProps `undefined`)

## Rules / invariants
- live props (P5): a live prop (own getter, e.g. `class={c()}` or dynamic children) takes `../utils/live-element.tsx` `liveElement` (class / style / children through bindings; other props forwarded); static props keep the compiled per-element path (0 cost); `render` stays read once
- props merged with the context via `contextProps(props, props.ref, Ctx)` (slots, `slot={null}` opt-out; own props win, handlers chain context-first)
- `children` may be an accessor (`() => title()`, also via context): rendered with `renderSlot` as reactive content (C7 date fields, dialog titles)
- inside a collection host: build mode registers a `HeaderNode`, live mode renders in place (B5 contract)
- default class `rv-Header`
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/slots.browser.test.tsx`
- `STORIES_DIST=dist-b1 npx vitest run --project cdk-components libs/cdk/tests-components/slots.test.ts`

## Gotchas
- relies on B5 `collections/components.tsx`; signature `(props, forwardedRef: unknown)`

## See also
- [../CLAUDE.md](../CLAUDE.md), [../slots/CLAUDE.md](../slots/CLAUDE.md)
