# @rivetjs/cdk/progress-bar
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `ProgressBar`: `<div role="progressbar">` with determinate / indeterminate progress, formatted `aria-valuetext`, render props for the fill.

## Entry points
- `@rivetjs/cdk/progress-bar` -> `index.tsx`: `ProgressBar`, `ProgressBarProps`, `ProgressBarRenderProps`, `ProgressBarContext` (`rv-progress-bar`, defined in `context.ts`: Button imports it from there without the ProgressBar + NumberFormatter graph), re-exports `progressBarProps`, `percentageOf`
- `@rivetjs/cdk/progress-bar/behaviour` -> `behaviour.tsx` (explicit package.json entry): `progressBarProps(props, locale?)` → `{ progressBarProps, labelProps }`, `percentageOf`, `percentageOfProps`, types

## Layout
- `index.tsx` - component (RAC ProgressBar.tsx)
- `behaviour.tsx` - RA `useProgressBar` (shared by `../meter/behaviour.tsx`); `.tsx` because the bag holds accessor closures
- tests: `../tests/progress-bar-behaviour.test.ts` (port of useProgressBar.test.js + additions, project `cdk`), `../tests/progress-bar.browser.test.tsx` (port of RAC ProgressBar.test.js, project `cdk-browser`), `../tests-components/toggle-button-group.test.ts` route `/progress` (SSR + resume)
- docs: `apps/cdk-docs/content/components/progress-bar.md`, examples `apps/cdk-docs/examples/progress-bar-*`

## Upstream
- RAC `ProgressBar.tsx`, react-aria `progress/useProgressBar.ts` (Apache-2.0)
- Naming: `useProgressBar` → `progressBarProps`

## Rules / invariants
- Props `value` / `minValue` / `maxValue` / `valueLabel` / `isIndeterminate` are `MaybeAccessor`s; the bag's `aria-valuenow` / `-valuemin` / `-valuemax` / `-valuetext` are accessors read in bindings (accessor rule) — the component never re-runs for a value change
- Render props are accessors: `percentage()` (undefined while indeterminate), `valueText()`, `isIndeterminate()`; `class` / `style` / `children` functions (slots `renderProps`)
- Label: `LabelContext` gets `{ id, ref, elementType: "span" }`; `aria-labelledby` = label id while the Label is attached (`createSlot`; server assumes attached when no `aria-label` / `aria-labelledby`)
- `formatOptions` default `{ style: "percent" }`; percent style formats the 0–1 fraction, other styles the raw value; locale = `useLocale()` at render
- `ProgressBarContext` merges props via `contextProps` (Button provides `{ id }` for its pending ProgressBar)
- default class `rv-ProgressBar`; global DOM props + `data-*` forwarded; `style` owned (render prop)
- Live props (P5): body untracked; `liveOptions(merged, [value, minValue, maxValue, valueLabel, isIndeterminate, formatOptions])` turns live value props into accessors (the bag reads them in bindings); class / style / children via `renderPropsOf`

## Gotchas
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element (default path unchanged); reactive attrs are accessors, handlers inline arrows; the `LabelContext` provider wraps the children accessor; tests `tests/render-date-color.browser.test.tsx`
- `formatOptions` live (`MaybeAccessor`, in `LIVE_KEYS`, read inside `aria-valuetext`); locale read once at render; the `NumberFormatter` is created inside the `aria-valuetext` accessor (cached Intl formatter) — a captured formatter instance breaks resume ("instance is not serializable")

## See also
- [../CLAUDE.md](../CLAUDE.md), [../meter/CLAUDE.md](../meter/CLAUDE.md), [../button/CLAUDE.md](../button/CLAUDE.md)
