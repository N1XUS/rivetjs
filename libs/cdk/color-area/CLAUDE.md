# @rivetjs/cdk/color-area
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `ColorArea` + react-aria `useColorArea` / `useColorAreaGradient`: 2D (x/y channel) color picker, thumb drag (useMove) + keys, two hidden range inputs, gradient background as inline style.

## Entry points
- `@rivetjs/cdk/color-area` -> `index.tsx`: `ColorArea`, `ColorAreaContext` (rv-color-area), `ColorAreaStateContext` (rv-color-area-state), `ColorAreaProps`, `ColorAreaRenderProps`; re-exports `behaviour.tsx` (`export *`)
- `@rivetjs/cdk/color-area/behaviour` -> `behaviour.tsx`: `colorAreaProps(opts, state)` bags, free handlers `colorAreaPointerDown` / `colorAreaThumbPointerDown` / `colorAreaThumbKeyDown` / `colorAreaInputChange` / `colorAreaInputFocus` / focus-within, styles `colorAreaStyle` / `colorAreaThumbStyle` / `colorAreaInputStyle`, `createColorAreaInteraction()` (JSON move state)
- state: `@rivetjs/cdk/color` `createColorAreaState`; thumb: `../color-thumb` (`InternalColorThumbContext`)

- `contexts.ts` (BIG-UI 2026-10-27): `ColorAreaContext`, `ColorAreaStateContext` live in this leaf (re-exported by `index.tsx`), so `color-picker` and siblings read them without importing the component and its behaviour closure (color-picker-basic −28 % JS gz)
## Rules / invariants
- Default class `rv-ColorArea`; root `role="group"`, inputs `aria-roledescription="2D slider"`; style bound explicitly (OWNED `style`), never in a spread.
- Window listeners via `getOwnerWindow(containerRef())` (no bare `window` in .tsx).
- Resume: handlers / bindings capture only plain locals + state (signals, JSON move states, string colors); bags passed to `*Props` are explicit fields, never `...props` (a closure reading `props.x` captures the whole props object).
- Live props (P5): body untracked (`colorArea`); `liveOptions(ctx, ["isDisabled"], ["value"])`: a live `isDisabled` is stored as `state.disabled` (`isColorAreaDisabled(state)`, `../color/area-state.ts`); handlers stay attached and check `read(props.isDisabled)` (`AriaColorAreaOptions.isDisabled` = `MaybeAccessor`); inputs `disabled`, root / thumb `data-disabled`, `isDisabled()` follow. Flags go into the spread bag only (an explicit attribute after a spread overrides the bag's key). Tests `tests/live-controlled.browser.test.tsx` "live flags: color parts", `tests/live-flags-ssr.test.ts`, story `/live-props` `#lf-color-*`.

## Tests
- `tests/color-area.browser.test.tsx` (RAC ColorArea.test.js port), story `tests-components/color.test.ts` (`/color` #area: key + drag after resume).

## Gotchas
- Value signals on resumed pages must hold strings (Color instances are not serializable).

## See also
[../color/CLAUDE.md](../color/CLAUDE.md), [../color-thumb/CLAUDE.md](../color-thumb/CLAUDE.md), `apps/cdk-docs/content/components/color-area.md`
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element (default path unchanged); reactive attrs are accessors, handlers inline arrows; the state + thumb contexts wrap the children accessor; tests `tests/render-date-color.browser.test.tsx`
- Thumb `data-rk` = `COLOR_AREA_KEYS` (arrows, PageUp / PageDown, Home / End; with the handlers, so not on a static disabled area): a cold key is held instead of stepping the native range inputs (SLIDER-KEY; `tests/color-area.browser.test.tsx`).
