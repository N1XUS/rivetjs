# @rivetjs/cdk/color-swatch-picker
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `ColorSwatchPicker` / `ColorSwatchPickerItem` on the RAC ListBox port (`../listbox/index.tsx`, live collection, layout `grid` default).

## Entry points
- `@rivetjs/cdk/color-swatch-picker` -> `index.tsx`: `ColorSwatchPicker`, `ColorSwatchPickerItem`, `ColorSwatchPickerContext` (rv-color-swatch-picker), props / render-prop types
- `intl.ts` generated (RAC `colorSwatchPicker` string, default aria-label "Color swatches"); do not edit

## Rules / invariants
- Selection = color state: ListBox gets `selectedKey: () => getColor(state).toString("hexa")` + `selectedKeyControlled: true` (single-key backing, never written) and `onSelectionChange` → `setColor`.
- Item key = `toString("hexa")`; `ColorMapContext` (rv-color-swatch-picker-map) = plain record key → color string (keeps the item's color space); missing entry → `parseColor(key)`.
- Items provide `ColorSwatchContext` `{ color: string }`; item render props add `color` accessor; class / style wrappers are unconditional arrows.
- Default classes `rv-ColorSwatchPicker`, `rv-ColorSwatchPickerItem`.

## Tests
- `tests/color-swatch-picker.browser.test.tsx` (RAC ColorSwatchPicker.test.js 6 + 3 additions: Signal value, item color space + render props, ColorPicker sync); story `/color` #swatches.

## See also
[../listbox/CLAUDE.md](../listbox/CLAUDE.md), [../color-picker/CLAUDE.md](../color-picker/CLAUDE.md), `apps/cdk-docs/content/components/color-swatch-picker.md`
- `render` forwarded to ListBox / ListBoxItem.
