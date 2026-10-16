# @rivetjs/cdk/color-picker
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `ColorPicker`: renders no element; one `createColorPickerState` shared by child ColorArea / ColorSlider / ColorWheel / ColorField / ColorSwatch / ColorSwatchPicker through their contexts.

## Entry points
- `@rivetjs/cdk/color-picker` -> `index.tsx`: `ColorPicker`, `ColorPickerContext` (rv-color-picker), `ColorPickerStateContext` (rv-color-picker-state), `ColorPickerProps`, `ColorPickerRenderProps`

## Rules / invariants
- Children contexts get `{ value: () => color, onChange: inline arrow → setColor }`; ColorSwatch gets `{ color }` accessor.
- `value` = plain value or two-way Signal (string | Color); on resumed pages hold strings.

## Tests
- `tests/color-swatch.browser.test.tsx` (ColorPicker "renders" + Signal sync), `tests/color-swatch-picker.browser.test.tsx` (sync), story `/color` (picker section).

## See also
[../color/CLAUDE.md](../color/CLAUDE.md), `apps/cdk-docs/content/components/color-picker.md`
