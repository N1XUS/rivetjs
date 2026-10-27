# @rivetjs/cdk/color-slider
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `ColorSlider` + react-aria `useColorSlider`: one-channel slider over the slider ports (`../slider/behaviour.tsx` + `sliderView(state)`), parts from `../slider` (`SliderTrack`, `SliderOutput`) + `Label` + `ColorThumb`; gradient track background inline.

## Entry points
- `@rivetjs/cdk/color-slider` -> `index.tsx`: `ColorSlider`, `ColorSliderContext` (rv-color-slider), `ColorSliderStateContext`, `ColorSliderProps`, `ColorSliderRenderProps`; re-exports `behaviour.tsx`
- `@rivetjs/cdk/color-slider/behaviour` -> `behaviour.tsx`: `colorSliderProps`, `colorSliderAriaLabel`, `colorSliderThumbOptions`, styles `colorSliderTrackBackground` / `colorSliderTrackStyle` / `colorSliderThumbStyle` / `colorSliderInputStyle`, `colorSliderInputValueText`, handlers `colorSliderTrackPointerDown` / `colorSliderThumbPointerDown` / `colorSliderThumbKeyDown` / `colorSliderInputChange` / `colorSliderInputFocus` / `colorSliderInputBlur`, `createColorSliderInteraction()`
- state: `@rivetjs/cdk/color` `createColorSliderState`, `sliderView` (in `../color/slider-state.tsx`)

- `contexts.ts` (BIG-UI 2026-10-27): `ColorSliderContext`, `ColorSliderStateContext` live in this leaf (re-exported by `index.tsx`), so `color-picker` and siblings read them without importing the component and its behaviour closure (color-picker-basic −28 % JS gz)
## Rules / invariants
- Provides `SliderStateContext` = `sliderView(state)` (with color `format`, `step`, `pageSize`), `SliderTrackContext` (style accessor + pointer handler), `SliderOutputContext`, `LabelContext` (children = channel name), `InternalColorThumbContext`.
- `aria-labelledby` / `aria-label` on the track are unconditional arrows (conditional arrows are not resumable).
- Free drag + animated snap (Slider deviation, `snap="release"` default; `snap="drag"` = RA): `colorSliderThumbStyle` uses `getThumbPositionPercent(view, 0)`; `InternalColorThumbContext.isSnapping` = `isThumbSnapping(state.slider, 0)` (`ColorThumb` `data-snapping` / `isSnapping()`).
- Resume: handlers / bindings capture only plain locals + state (signals, JSON move states, string colors); bags passed to `*Props` are explicit fields, never `...props` (a closure reading `props.x` captures the whole props object).
- Live props (P5): body untracked (`colorSlider`); `liveOptions(ctx, ["isDisabled"], ["value"])`: a live `isDisabled` reaches `createSliderState` as an accessor (`state.slider.disabled`, `sliderView` spreads it: thumb input `disabled` / tabindex / `data-rk` live via `sliderThumbProps`); handlers stay attached and check `read(opts.isDisabled)` (`AriaColorSliderOptions.isDisabled` = `MaybeAccessor`); root `data-disabled` + `isDisabled()` render prop + `InternalColorThumbContext.isDisabled` follow; `channel` / `colorSpace` / `orientation` read once. Flags go into the spread bag only (an explicit attribute after a spread overrides the bag's key). Tests `tests/live-controlled.browser.test.tsx` "live flags: color parts", `tests/live-flags-ssr.test.ts`, story `/live-props` `#lf-color-*`. Gap (static too): ColorSlider + SliderTrack does not render resumably in `live-flags-ssr` (SliderTrack captures the transient `sliderView`), the story build resumes.

## Tests
- `tests/color-slider.browser.test.tsx` (RAC ColorSlider.test.js + additions: keys over a Signal, HSL formatting, track press + drag, gradient); `tests/color-slider-snap.browser.test.tsx` (free drag, release `data-snapping` + Motion1D settle, track press, `isSnapping`, keyboard stepped, `snap="drag"`); story `/color` #hue, #picker-track.

## Gotchas
- `../slider/CLAUDE.md` still names `../color/slider-state.ts` (now `.tsx`).

## See also
[../color/CLAUDE.md](../color/CLAUDE.md), [../slider/CLAUDE.md](../slider/CLAUDE.md), `apps/cdk-docs/content/components/color-slider.md`
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element (default path unchanged); reactive attrs are accessors, handlers inline arrows; the contexts wrap the children accessor; tests `tests/render-date-color.browser.test.tsx`
