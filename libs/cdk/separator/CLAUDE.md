# @rivetjs/cdk/separator
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `Separator` + RA `useSeparator`: `<hr>` (horizontal) or `<div role="separator" aria-orientation="vertical">`; reads `SeparatorContext`; collection leaf (`SeparatorNode`).

## Entry points
- `@rivetjs/cdk/separator` -> `index.tsx`: `Separator`, `SeparatorContext`, `SeparatorNode`, `SeparatorProps`, re-exports `separatorProps`, `AriaSeparatorProps`
- `@rivetjs/cdk/separator/behaviour` -> `behaviour.ts`: `separatorProps(props)` → `{ separatorProps }` (RA `useSeparator` result), type `SeparatorAria`

## Layout
- `index.tsx` - component + context; `behaviour.ts` - `separatorProps`
- tests: `tests/slots.browser.test.tsx` (Separator cases); story `tests-components/app/src/routes/slots.tsx` + `tests-components/slots.test.ts` (SSR + resume)
- docs: `apps/cdk-docs/content/components/separator.md`, example `separator-orientation`

## Upstream
- RAC `Separator.tsx`, react-aria `separator/useSeparator.ts` (Apache-2.0); `render` prop via `renderElement` (renderProps `undefined`)

## Rules / invariants
- props merged with the context via `contextProps(props, props.ref, Ctx)` (slots, `slot={null}` opt-out; own props win, handlers chain context-first)
- `elementType` default `hr` when horizontal, `div` when vertical; `hr`/`div` compiled branches, others `Dynamic`
- `separatorProps`: `role="separator"` unless `elementType === "hr"`; `aria-orientation` only when vertical; forwards id + aria labels
- `SeparatorNode.filter`: kept only after a non-separator item (RAC)
- default class `rv-Separator`; forwards `globalDOMProps` + `data-*`
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)
- Live props (P5): a live `class` goes into the merged attrs bag as `liveClass(merged, "rv-Separator")`; `elementType` / `orientation` read once

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/slots.browser.test.tsx`
- `STORIES_DIST=dist-b1 npx vitest run --project cdk-components libs/cdk/tests-components/slots.test.ts`

## Gotchas
- RAC "render function" case ported in `tests/render-core.browser.test.tsx`

## See also
- [../CLAUDE.md](../CLAUDE.md), [../slots/CLAUDE.md](../slots/CLAUDE.md)
