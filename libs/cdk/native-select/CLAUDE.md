# @rivetjs/cdk/native-select
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Rivet addition (no React Aria / Angular CDK counterpart; pro-forms lane 2026-10-08): a native `<select>` field part built like RAC `TextArea`. Used by `@rivetjs/ui/native-select` (feature set inspired by HeroUI Pro's public docs; independent implementation).

## Entry points
- `@rivetjs/cdk/native-select` -> `index.tsx` (package `"./*"` pattern): `NativeSelect`, `NativeSelectOption`, `NativeSelectOptGroup`, `NativeSelectContext`, `NativeSelectValueContext`, prop types, re-exports `InputRenderProps`

## Layout
- `index.tsx` - parts + contexts
- tests: `tests/native-select.browser.test.tsx` (standalone, TextField wiring + two-way Signal + onChange + optgroup, native required validation + FieldError, disabled + focus-visible), `tests/native-select-ssr.test.ts` (selected option, label `for`, `aria-describedby`, `name` / `required`)
- ui story: `libs/ui/tests-components/app/src/routes/pro-forms.tsx` `#ns` (resumed)

## Rules / invariants
- hideable: `if (slotProbing || isHiddenPart()) return null` before `contextProps` (`slotProbing`: a field's server slot probe, `#server`)
- props = own `NativeSelectContext` then the field's `TextAreaContext` bag (a cdk `TextField` provides id, `name`, `required`, `disabled`, `aria-invalid`, `aria-describedby`, `value` accessor, input / change / invalid / focus handlers); textarea-only keys (`placeholder`, `maxLength`, `minLength`, `readOnly`, `autoCapitalize`, `autoCorrect`, `spellCheck`, `inputMode`, `enterKeyHint`) are dropped
- state attrs as `../text-area`: `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-invalid`; default class `rv-NativeSelect`; `render` prop supported
- options: `NativeSelectOption` sets `selected` from `NativeSelectValueContext.value()` so SSR shows the value (HTML `<select>` has no `value` attribute); the client keeps the `value` property bound too
- TextField's value updates on `input` (as for text inputs): `userEvent.selectOptions` / real picks fire input + change; a bare `change` event does not update the field
- live props (P5): same as `input/` — `readOnce` + `liveOmit` + `liveAt` (`disabled`, `aria-invalid`, `value`) + class / style from `liveView`

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/native-select.browser.test.tsx`
- `npx vitest run --project cdk libs/cdk/tests/native-select-ssr.test.ts`

## Gotchas
- inside a cdk TextField no slot-id effect is recorded (UI-COLD 2026-10-08: server slot ids resolve during rendering, FieldError id only while invalid): the page does not boot at idle
- cdk-docs page `apps/cdk-docs/content/components/native-select.md` (example `native-select-field`)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../text-area/CLAUDE.md](../text-area/CLAUDE.md), [../text-field/CLAUDE.md](../text-field/CLAUDE.md)
