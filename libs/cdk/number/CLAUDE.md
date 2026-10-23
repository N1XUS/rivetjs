# @rivetjs/cdk/number
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`@internationalized/number` port (locale-aware number formatting + parsing, partial-input validation, numbering-system detection) + react-stately `useNumberFieldState` as `createNumberFieldState` (state only, no component). Pure, server-safe.

## Entry points
- `@rivetjs/cdk/number` -> `index.tsx` (explicit package.json entry; resume-compiled so the state's validation accessor is an R2 symbol).:
  - `NumberFormatter` (Intl.NumberFormat wrapper: formatter cache, `signDisplay` polyfill, `formatRange` / `formatRangeToParts` fallbacks, `numberingSystem` option), type `NumberFormatOptions`
  - `NumberParser` (`parse`, `isValidPartialNumber(value, min?, max?)`, `getNumberingSystem(value)`; detects latn / arab / hanidec / deva / beng / fullwide input)
  - `createNumberFieldState(options)` + free functions (see below), types `NumberFieldState`, `NumberFieldStateOptions`, `NumberFieldProps`, `NumberFieldSync`
- `numberFormatSignDisplayPolyfill` exported from `NumberFormatter.ts` only (upstream: "exported for tests")

## Layout
- `NumberFormatter.ts`, `NumberParser.ts` - upstream `packages/@internationalized/number/src/*` 1:1 (v3.6.8)
- `number-field-state.tsx` - `packages/react-stately/src/numberfield/useNumberFieldState.ts` (`.tsx` without JSX: resume-compiled for the `validationValue` closure)
- `index.ts` - upstream `src/index.ts` + state exports
- tests (project `cdk`): `tests/number-parser.test.ts`, `tests/number-format-sign-display-polyfill.test.ts` (upstream suites verbatim, `@ts-nocheck`, Jest globals from `@rivetjs/testing/jest`), `tests/number-field-state.test.ts` (upstream suite, call syntax adapted, + Rivet cases)

## createNumberFieldState
- cdk `state/*` convention: plain signals + JSON, upstream members as free functions taking the state
- State fields: `value` (Signal, committed value; null = NaN), `input` (Signal, raw text), `prev` (Signal `NumberFieldSync` {value, locale, formatOptions}), `defaultNumberValue`, `controlled`, `fixed` (plain controlled value), `commitBehavior`, option passthroughs (`locale`, `formatOptions`, `minValue`, `maxValue`, `step`, `isDisabled`, `isReadOnly`: value or accessor), `onChange`, `validation` (`createFormValidationState`; use `state/form-validation` `realtimeValidation` / `displayValidation` / `commitValidation` / `resetValidation` / `updateValidation` on it)
- Reads: `inputValue(state)`, `numberValue(state)` (parsed input, NaN if unparsable), `committedValue(state)`, `formattedValue(state)` (Rivet: committed value formatted; the input text once in sync, the last committed value while typing — ui NumberStepper display), `minValue(state)`, `maxValue(state)`, `canIncrement(state)`, `canDecrement(state)`, `validate(state, text)` (partial input)
- Writes: `setInputValue(state, text)`, `setNumberValue(state, n)`, `commit(state, text?)`, `increment`, `decrement`, `incrementToMax`, `decrementToMin`
- Options: upstream names; `value` = two-way `Signal<number | null>` or plain number (fixed: writes only fire `onChange`), `defaultValue`, `onChange`; `locale` required; `commitBehavior` `'snap'` (default) / `'validate'`; FormValidationOptions (`validate`, `validationBehavior` default `'aria'`, `isInvalid`, `name`, `validationErrors`)
- Upstream render-time sync (reformat input when number value / locale / format options change, shallow format-options compare) = pure on read (out-of-sync input reads as formatted value) + written by every mutation first (`syncInputValue`)

## Rules / invariants
- Keep upstream files 1:1 (only `.ts` specifiers, strict types, prettier); Rivet adaptations only in `number-field-state.tsx` header bullets
- Reads never write signals (writes during computed evaluation throw)

## Commands
- `npx vitest run --project cdk libs/cdk/tests/number-parser.test.ts libs/cdk/tests/number-format-sign-display-polyfill.test.ts libs/cdk/tests/number-field-state.test.ts`

## Gotchas
- `number-parser.test.ts` imports `fast-check` (round-trip fuzz, 2000 runs) - needs `fast-check` devDependency
- Upstream 3.6.8 has no `style: 'unit'` polyfill any more (only `signDisplay`); unit parsing (incl. no-numeral plural units, e.g. ar `يومان`) is in `NumberParser`
- Formatter / parser caches are module-global, unbounded (upstream behaviour)
- `NumberParserImpl` mutates the passed options when `roundingIncrement` is set (upstream behaviour)
- Resume: accessor options / `onChange` must be inline arrows or local functions (serialized as symbols)
- Validation value = upstream `numberValue` (NaN when empty, controlled value snapped): uncontrolled = the value signal; controlled + `validate` = `validationValue(state)` accessor (R2 closure; a page whose client graph reaches the state only through `.ts` modules would miss its chunk — import `number/index.tsx` / `number-field-state.tsx`)
- Upstream `setNumberValue` + `setInputValue` in one React batch: render sync overrides the typed text; here `setInputValue` syncs first, so the typed text wins

## See also
- [../CLAUDE.md](../CLAUDE.md), [../state/CLAUDE.md](../state/CLAUDE.md) (`form-validation`), [../utils/CLAUDE.md](../utils/CLAUDE.md) (`clamp`, `snapValueToStep`)
