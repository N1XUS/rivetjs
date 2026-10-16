# @rivetjs/cdk/meter
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `Meter`: `<div role="meter">` — a quantity within a known range; same mechanics as `../progress-bar` (no indeterminate state).

## Entry points
- `@rivetjs/cdk/meter` -> `index.tsx`: `Meter`, `MeterProps`, `MeterRenderProps`, `MeterContext` (`rv-meter`), re-exports `meterProps`
- `@rivetjs/cdk/meter/behaviour` -> `behaviour.tsx` (explicit package.json entry): `meterProps(props, locale?)` → `{ meterProps, labelProps }`, `percentageOf`, `percentageOfProps`

## Layout
- `index.tsx` - component (RAC Meter.tsx); `behaviour.tsx` - RA `useMeter` over `../progress-bar/behaviour.tsx` (role `meter`)
- tests: `../tests/meter.browser.test.tsx` (port of RAC Meter.test.js), `../tests/progress-bar-behaviour.test.ts` (`meterProps`), story `/progress`
- docs: `apps/cdk-docs/content/components/meter.md`, examples `apps/cdk-docs/examples/meter-*`

## Upstream
- RAC `Meter.tsx`, react-aria `meter/useMeter.ts` (Apache-2.0); `useMeter` → `meterProps`

## Rules / invariants
- Same as progress-bar: `MaybeAccessor` value props, accessor aria attributes, render props `percentage()` / `valueText()`, `LabelContext` span label + `createSlot`, default class `rv-Meter`, `style` owned
- RAC renders `role="meter"` only (not `"meter progressbar"`)
- Live props (P5): body untracked; `liveOptions(merged, [value, minValue, maxValue, valueLabel, isIndeterminate, formatOptions])` turns live value props into accessors (the bag reads them in bindings); class / style / children via `renderPropsOf`

## Gotchas
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element (default path unchanged); reactive attrs are accessors, handlers inline arrows; the `LabelContext` provider wraps the children accessor; tests `tests/render-date-color.browser.test.tsx`

## See also
- [../progress-bar/CLAUDE.md](../progress-bar/CLAUDE.md), [../CLAUDE.md](../CLAUDE.md)
