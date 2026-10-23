# @rivetjs/cdk/text-area
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `TextArea`: native `<textarea>` with the same state attributes as `Input`; fields provide `TextAreaContext`.

## Entry points
- `@rivetjs/cdk/text-area` -> `index.tsx`: `TextArea`, `TextAreaContext`, `TextAreaProps`, re-exports `InputRenderProps`

## Layout
- `index.tsx` - component + context
- tests: `tests/slots.browser.test.tsx` (TextArea cases); story `tests-components/app/src/routes/slots.tsx` + `tests-components/slots.test.ts` (SSR + resume)
- docs: `apps/cdk-docs/content/foundations/slots.md`

## Upstream
- RAC `TextArea.tsx` (Apache-2.0); `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element; reactive attrs are accessors, handlers inline arrows; tests `tests/render-forms.browser.test.tsx`

## Rules / invariants
- hideable (RAC `createHideableComponent`): `if (slotProbing || isHiddenPart()) return null` BEFORE `contextProps` (`slotProbing`: a field's server slot probe, `#server`, the constant `false` in browsers) (`../collections/hidden.ts`): in the collection build pass the providers are absent (slot lookups would throw)
- Server slot probe (CDK-PINS 2026-10-12, as `Input`): an own `id` merges into the field's input id (`mergeIds(contextId, id)`) during the probe, so the field `Label` writes `for` = that id; ui `TextArea` forwards `{ id, slot }` while probing. Test `tests/label-links-ssr.test.ts`.
- props merged with the context via `contextProps(props, props.ref, Ctx)` (slots, `slot={null}` opt-out; own props win, handlers chain context-first)
- as `../input`: accessor `disabled` / `aria-invalid` via `read()`; default class `rv-TextArea`
- hover NOT disabled by `disabled` (RAC passes no `isDisabled` to hover props)
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)
- live props (P5): same as `input/` — `readOnce` + `liveOmit` + `liveAt` (`disabled`, `aria-invalid`) + class / style from `liveView`

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/slots.browser.test.tsx`
- `STORIES_DIST=dist-b1 npx vitest run --project cdk-components libs/cdk/tests-components/slots.test.ts`

## Gotchas
- known bug (docs lane D2b): inside TextField the context bag's `value` accessor is spread as a `value` attribute on the server, so `<textarea>` content is empty before resume (defaultValue / signal value invisible); docs example `text-area-controlled` skips its content step (`// cdk bug`)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../slots/CLAUDE.md](../slots/CLAUDE.md)
