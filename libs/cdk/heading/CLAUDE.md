# @rivetjs/cdk/heading
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `Heading`: `h1`…`h6` (`level`, default 3) reading `HeadingContext` (dialog / popover titles provide `slot="title"` props).

## Entry points
- `@rivetjs/cdk/heading` -> `index.tsx`: `Heading`, `HeadingContext` (`rv-heading`), `HeadingProps`

## Layout
- `index.tsx` - component + context
- tests: `tests/slots.browser.test.tsx` (Heading cases); story `tests-components/app/src/routes/slots.tsx` + `tests-components/slots.test.ts` (SSR + resume)
- docs: `apps/cdk-docs/content/components/heading.md`, example `heading-levels`

## Upstream
- RAC `Heading.tsx` (Apache-2.0); `render` prop via `renderElement` (renderProps `undefined`)

## Rules / invariants
- live props (P5): a live prop (own getter, e.g. `class={c()}` or dynamic children) takes `../utils/live-element.tsx` `liveElement` (class / style / children through bindings; other props forwarded); static props keep the compiled per-element path (0 cost); `render` stays read once
- props merged with the context via `contextProps(props, props.ref, Ctx)` (slots, `slot={null}` opt-out; own props win, handlers chain context-first)
- `children` may be an accessor (`() => title()`, also via context): rendered with `renderSlot` as reactive content (C7 date fields, dialog titles)
- one explicit JSX branch per level (compiled templates); `level` read once at component run
- default class `rv-Heading`
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/slots.browser.test.tsx`
- `STORIES_DIST=dist-b1 npx vitest run --project cdk-components libs/cdk/tests-components/slots.test.ts`

## Gotchas
- changing `level` after mount does not re-branch

## See also
- [../CLAUDE.md](../CLAUDE.md), [../slots/CLAUDE.md](../slots/CLAUDE.md)
