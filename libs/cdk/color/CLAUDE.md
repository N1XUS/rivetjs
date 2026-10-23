# @rivetjs/cdk/color
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

React Stately color model + color states (`@react-stately/color`), state only. Consumers (RAC components + react-aria hooks): `../color-area`, `../color-slider`, `../color-wheel`, `../color-field`, `../color-swatch`, `../color-swatch-picker`, `../color-picker`, `../color-thumb`.

## Entry point
`@rivetjs/cdk/color` → `index.ts` (package.json `exports["./color"]`). Exports:
- model (`color.ts`): `parseColor`, `getColorChannels`, `normalizeColor`, `normalizeHue`, `toColor` (= `useColor`), types `Color`, `ColorChannel`, `ColorFormat`, `ColorSpace`, `ColorAxes`, `ColorChannelRange`; Rivet: `stringifyColor` (lossless string in the color's own space), `colorKey` (value identity)
- `createColorAreaState` + `getChannels`, `getChannelSteps`, `getXValue`/`getYValue`, `setXValue`/`setYValue`, `setColorFromPoint`, `incrementX`/`Y`, `decrementX`/`Y`
- `createColorSliderState` + `sliderView` (transient `SliderState` for `@rivetjs/cdk/slider/state` functions), `getThumbValueLabel`, `getFormattedValue`
- `createColorWheelState` + `getHue`, `setHue`, `setHueFromPoint`
- `createColorFieldState` + `inputValue`, `setInputValue`, `commit`, `incrementToMax`, `decrementToMin`, `validate`
- `createColorChannelFieldState` + `numberFieldView` (transient `NumberFieldState` for `@rivetjs/cdk/number` functions)
- `createColorPickerState` + `getColor`, `setColor`
- dispatch on `state.kind` (members shared by several upstream states): `getValue`, `getDefaultValue`, `setValue`, `getDisplayColor`, `isDragging`, `setDragging`, `getThumbPosition`, `increment`, `decrement`, `colorValue`, `defaultColorValue`, `setColorValue`

## Layout
- `color.ts` Color.ts + types.ts + useColor.ts · `intl.ts` generated from react-stately `intl/color/*.json` (34 locales; do not edit) · `value.ts` Rivet controlled-color cell (useControlledState over signals)
- `area-state.ts`, `slider-state.tsx`, `wheel-state.ts`, `field-state.tsx`, `channel-field-state.tsx` (`.tsx`: the `sliderView` / `numberFieldView` / field `validationValue` closures are resume-compiled), `picker-state.ts` — one upstream hook each; kind-specific free functions carry prefixed names (`colorAreaValue`, `setColorWheelDragging`, …), `index.ts` re-exports and dispatches

## Upstream
react-spectrum `packages/react-stately/src/color/*` (`@react-stately/color` re-exports them), `intl/color/*.json`; tests `packages/react-stately/test/color/{Color.test.tsx,useColor.test.js,useColorFieldState.test.js}`.

## Rules / invariants
- State = plain signals + JSON + free functions (cdk `state/` convention). No Color instances, closures or getters stored.
- Live `isDisabled` (live props P5): `createColorAreaState` / `createColorWheelState` store a given accessor as `state.disabled` (creation value in `isDisabled`); read `isColorAreaDisabled` / `isColorWheelDisabled` (module exports, not in the barrel). ColorSlider: the accessor passes to `createSliderState` (`state.slider.disabled`).
- Colors live in signals as strings: uncontrolled → `stringifyColor` (lossless, own space: `rgba(…)`, `hsla(…)`, `hsba(…)` with unrounded channels, decimal never exponent); controlled `value` = two-way `Signal<string | Color>` (written back as a Color if it held a Color, else the lossless string) or a fixed plain value (only `onChange` fires).
- Equality = `colorKey` (same space + channel values); upstream compares Color objects by identity (useControlledState `Object.is`, `newValue === colorValue`).
- Strings: `getStringsForLocale(colorMessages, locale)` + `formatString` (templates are plain `{name}`); `NumberFormatter` from `../number/NumberFormatter.ts` (direct file: no number-field code in the color model).
- Composite states (`sliderView`, `numberFieldView`) build transient views per call (they hold closures): never store them.
- `ColorSliderProps.snap` (Rivet Slider deviation, default `"release"`) passes through to `createSliderState`; `sliderView` spreads `state.slider`, so free-drag positions / snap flags / the snap-motion key (`refs`) are the stored ones.

## Tests
`tests/color-model.test.ts` (Color + useColor upstream suites, Rivet additions), `tests/color-field-state.test.ts` (useColorFieldState upstream suite + signal), `tests/color-states.test.ts` (area / slider / wheel / channel field / picker; upstream has no direct tests for these hooks).
`npx vitest run --project cdk libs/cdk/tests/color-model.test.ts libs/cdk/tests/color-field-state.test.ts libs/cdk/tests/color-states.test.ts`

## Same names, different modules
- `getThumbValueLabel(state)` / `getFormattedValue(state)` here: color slider, no index / value arg, channel value via `Color.formatChannelValue(channel, locale)` (upstream ColorSliderState overrides).
- `getThumbValueLabel(state, index)` / `getFormattedValue(state, value?)` in `../slider/state.ts`: generic slider, `NumberFormatter(locale, formatOptions)`; on a color slider call them with `sliderView(state)` only for raw numbers. Importing both: alias one (`import { getFormattedValue as sliderFormattedValue } from "@rivetjs/cdk/slider/state"`).
- Same for `increment` / `decrement` / `inputValue` / `setInputValue` / `commit` / `validate` / `incrementToMax` / `decrementToMin` (color field here vs number field in `../number`).

## Gotchas / deviations
- `value` inputs (`ColorInput`) = plain value, two-way Signal or read-only accessor (ColorPicker passes `() => color`). On resumed pages signals must hold strings: a Color instance in a signal / context is not serializable.
- Color round-trip property test ported verbatim (root devDependencies fast-check, color-space ^1.16.0, delta-e ^0.0.8; strict-TS annotations only); extra deterministic 2000-sample test asserts rgb ±1 per channel (stricter than delta-e < 1.5).
- `LocalizedStringDictionary.getGlobalDictionaryForPackage` (build-time string extraction) not ported.
- `abstract class Color` → `BaseColor`; constructor parameter properties → explicit fields (`erasableSyntaxOnly`).
- Area `xChannelStep` / `yChannelStep` / `*PageStep` → `getChannelSteps(state)` (they follow the value's color space).
- Color field `validate` prop receives the parsed `Color | null` through a wrapper arrow stored in `state.validation` (only when given).
- Channel field: upstream passes no isDisabled / isReadOnly to the number field state; same here.
