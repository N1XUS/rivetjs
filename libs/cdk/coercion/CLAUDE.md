# @rivetjs/cdk/coercion
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Angular CDK coercion port: coerce loosely typed option values (attribute strings, numbers, refs) into the type a widget needs. Pure, server-safe.

## Entry points
- `@rivetjs/cdk/coercion` -> `index.ts` (explicit package.json entry): `coerceBooleanProperty`, `coerceNumberProperty`, `_isNumberValue`, `coerceArray`, `coerceCssPixelValue`, `coerceStringArray`, `coerceElement`, `coerceAccessor`; types `BooleanInput`, `NumberInput`, `ElementInput`

## Layout
- `index.ts` - whole module (single file)
- used by: `../layout/index.ts` (`coerceArray`), `../observers/index.ts` (`coerceElement`, `coerceNumberProperty`), `../text-field/autosize.ts`
- tests: `tests/coercion.test.ts` (Angular `src/cdk/coercion/*.spec.ts` port)
- docs examples: `apps/cdk-docs/examples/coercion-values/`

## Upstream
- angular/components `src/cdk/coercion` (MIT, © Google LLC)
- Rivet mappings (doc comments): `ElementRef<T> | T` -> `ElementInput<T>` = element or ref accessor (`ref<T>()` / signal); `coerceObservable` -> `coerceAccessor` (functions pass through as accessors, values become constant accessors)

## Rules / invariants
- Pure functions, no DOM / import-time work - safe on server and in state factories
- `coerceBooleanProperty`: everything except `null`, `undefined`, `false`, `"false"` is true (so `""` attribute = true)
- `coerceNumberProperty(value, fallback?)`: `_isNumberValue` requires both `parseFloat` and `Number` to accept; fallback only when passed explicitly (default 0)
- `coerceCssPixelValue`: numbers get `px`, strings pass, nullish -> `""`
- `coerceStringArray`: non-arrays stringified + split on `separator` (default whitespace), trimmed, empties dropped
- `coerceElement` / `coerceAccessor`: any function is treated as an accessor and called

## Commands
- `npx vitest run --project cdk libs/cdk/tests/coercion.test.ts`

## Gotchas
- `drag-drop/dom/coerce.ts` has its own `coerceElement` with Angular's `{nativeElement}` shape (not this accessor shape); `a11y/focus-monitor.ts:349` has a private copy too - dedupe when drag-drop goes public
- `coerceElement` cannot hold a function-valued element input (functions are always called)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../layout/CLAUDE.md](../layout/CLAUDE.md), [../observers/CLAUDE.md](../observers/CLAUDE.md)
- `apps/cdk-docs/content/foundations/coercion.md`
