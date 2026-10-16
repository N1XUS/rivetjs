# @rivetjs/cdk/input
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `Input`: native `<input>` with hover / focus / focus-visible state (`data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-invalid`); fields provide `InputContext`.

## Entry points
- `@rivetjs/cdk/input` -> `index.tsx`: `Input`, `InputContext` (`rv-input`), `InputProps`, `InputRenderProps`

## Layout
- `index.tsx` - component + context
- tests: `tests/slots.browser.test.tsx` (Input cases); story `tests-components/app/src/routes/slots.tsx` + `tests-components/slots.test.ts` (SSR + resume)
- docs: `apps/cdk-docs/content/foundations/slots.md` (example `parts-tailwind`)

## Upstream
- RAC `Input.tsx` (Apache-2.0); deviation: not hideable; `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element; reactive attrs are accessors, handlers inline arrows; tests `tests/render-forms.browser.test.tsx`

## Rules / invariants
- hideable (RAC `createHideableComponent`): `if (slotProbing || isHiddenPart()) return null` BEFORE `contextProps` (`slotProbing`: a field's server slot probe, `#server`, the constant `false` in browsers) (`../collections/hidden.ts`): in the collection build pass the providers are absent (slot lookups would throw)
- props merged with the context via `contextProps(props, props.ref, Ctx)` (slots, `slot={null}` opt-out; own props win, handlers chain context-first)
- `disabled` / `aria-invalid` may be accessors (context from fields): read with `read()` inside bindings; `aria-invalid` `"false"` = valid
- render props accessors (`isHovered()`, `isFocused()`, `isFocusVisible()`, `isDisabled()`, `isInvalid()`); `class` / `style` functions via `renderProps`; default class `rv-Input`
- `hoverProps` gets `isDisabled`; handlers merged `mergeInto(rest, focusProps, hover.hoverProps)` (= `mergeProps`; the static path merges into the part's own `rest` copy, LIVE-FAST)
- `autoFocus` = React mount autoFocus: own `ref()` merged with the context ref (`mergeRefValues`) + once-only `clientEffect` → `focusSafely(el)` (native attribute acts at page load only; an input created later, e.g. in an opened popover — ui Autocomplete `SearchField autoFocus` — gets focus). Only when `autoFocus` is set; test `tests/slots.browser.test.tsx` "Input: autoFocus …"
- `autoFocus` = React mount autoFocus: own `ref()` merged with the context ref (`mergeRefValues`) + once-only `clientEffect` → `focusSafely(el)` (native attribute acts at page load only; an input created later, e.g. in an opened popover — ui Autocomplete `SearchField autoFocus` — gets focus). Only when `autoFocus` is set; test `tests/slots.browser.test.tsx` "Input: autoFocus …"
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)
- live props (P5): read-once keys (`readOnce`: hover handlers, `slot`, `render`, class / style values) untracked, the rest forwarded unread (`liveOmit`), `disabled` / `aria-invalid` via `liveAt`, class / style from `liveView` → an own `placeholder={p()}` updates in place
- Server slot probe (CDK-PINS 2026-10-12): during a field's `probeSlots` an `Input` with its own `id` merges it into the field's input id (`mergeIds(contextId, id)`) and renders nothing, so the field `Label` (rendered before the Input) writes `for` = that id like the client render (RA mergeIds). `@rivetjs/ui` Input and `InputGroup.Input` forward `{ id, slot }` to the cdk Input while probing (InputGroup: resume fuzz ui `/forms`). `TextArea` does the same (text-area/CLAUDE.md).

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/slots.browser.test.tsx`
- `STORIES_DIST=dist-b1 npx vitest run --project cdk-components libs/cdk/tests-components/slots.test.ts`

## Gotchas
- other accessor attributes are spread as-is (spread resolves them)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../slots/CLAUDE.md](../slots/CLAUDE.md)
