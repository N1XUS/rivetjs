# @rivetjs/cdk/color-thumb
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `ColorThumb`: draggable thumb inside ColorArea / ColorSlider / ColorWheel, fed by `InternalColorThumbContext` (thumb props, styles, hidden input props from the parent).

## Entry points
- `@rivetjs/cdk/color-thumb` -> `index.tsx`: `ColorThumb`, `InternalColorThumbContext`, `ColorThumbProps`, `ColorThumbRenderProps`

## Rules / invariants
- Default class `rv-ColorThumb`; style = parent thumb style + `backgroundColor` (display color), resolved per binding run; `data-hovered` / `data-dragging` / `data-snapping` (Rivet: ColorSlider release snap; context `isSnapping?`, default false; `isSnapping()` render prop) / `data-focused` / `data-focus-visible` / `data-disabled`.
- Throws outside a ColorArea / ColorSlider / ColorWheel.
- Live props (P5): class / style / children via `renderPropsOf(merged, …)` (untracked); `InternalColorThumbContext.isDisabled` may be an accessor (live parent `isDisabled`): `data-disabled` goes into the spread bag (`liveDisabledAttr`, never an explicit attribute after the spread), `isDisabled()` reads it

## Tests
- Through the area / slider / wheel browser suites and story `/color`.

## See also
[../color-area/CLAUDE.md](../color-area/CLAUDE.md), [../color-slider/CLAUDE.md](../color-slider/CLAUDE.md), [../color-wheel/CLAUDE.md](../color-wheel/CLAUDE.md)
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element (default path unchanged); reactive attrs are accessors, handlers inline arrows; the hidden input(s) are part of the children accessor; tests `tests/render-date-color.browser.test.tsx`
- Resume: optional context accessors are read in an inline arrow of the render-props object (`isSnapping: () => (snapping ? snapping() : false)`); a destructuring-default arrow (`{ isSnapping = () => false } = ctx`) is not resume-compiled and silently broke every resumed ColorArea / ColorSlider thumb (no page error, handlers dead).
