# @rivetjs/cdk/color-swatch
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `ColorSwatch` + react-aria `useColorSwatch`: `role="img"` color preview with localized color name.

## Entry points
- `@rivetjs/cdk/color-swatch` -> `index.tsx`: `ColorSwatch`, `ColorSwatchContext` (rv-color-swatch), `ColorSwatchProps`, `ColorSwatchRenderProps`; re-exports `behaviour.ts` (`export *`: named re-exports trip "Duplicated export")
- `@rivetjs/cdk/color-swatch/behaviour` -> `behaviour.ts`: `colorSwatchProps`, `colorSwatchColor`

## Rules / invariants
- `color` may be an accessor (ColorPicker / ColorSwatchPickerItem pass one or a string through `ColorSwatchContext`).
- Default class `rv-ColorSwatch`; background (checkerboard + color) inline style; `children` render prop (Rivet: RAC renders children untyped).
- Live props (P5): body untracked; `liveOptions(merged, [color, colorName])` — live `color` / `colorName` re-run the aria / style bindings only; class / style / children from a live view. A live `Color` instance prop is captured with the props object (resumed pages: pass a string)

## Tests
- `tests/color-swatch.browser.test.tsx` (RAC ColorSwatch.test.js + ColorPicker.test.js).

## See also
[../color-picker/CLAUDE.md](../color-picker/CLAUDE.md), `apps/cdk-docs/content/components/color-swatch.md`
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element (default path unchanged); reactive attrs are accessors, handlers inline arrows; tests `tests/render-date-color.browser.test.tsx`
