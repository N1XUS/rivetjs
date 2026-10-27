# @rivetjs/cdk/color-wheel
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `ColorWheel` / `ColorWheelTrack` + react-aria `useColorWheel`: circular hue picker, thumb drag + track press (useMove), keys, hidden range input, conic-gradient track as inline style.

## Entry points
- `@rivetjs/cdk/color-wheel` -> `index.tsx`: `ColorWheel`, `ColorWheelTrack`, `ColorWheelContext` (rv-color-wheel), `ColorWheelStateContext`, `ColorWheelTrackContext`, props / render-prop types; re-exports `behaviour.tsx`
- `@rivetjs/cdk/color-wheel/behaviour` -> `behaviour.tsx`: `colorWheelProps`, handlers `colorWheelTrackPointerDown` / `colorWheelThumbPointerDown` / `colorWheelThumbKeyDown` / `colorWheelInputChange` / `colorWheelInputFocus`, styles `colorWheelTrackStyle` / `colorWheelThumbStyle` / `colorWheelInputStyle`, `createColorWheelInteraction()`
- state: `@rivetjs/cdk/color` `createColorWheelState`

## Rules / invariants
- Default classes `rv-ColorWheel` (default style `position: relative`), `rv-ColorWheelTrack`; RA puts `id` on the input, not the root.
- Window listeners via `getOwnerWindow(inputRef())`.
- Resume: handlers / bindings capture only plain locals + state (signals, JSON move states, string colors); bags passed to `*Props` are explicit fields, never `...props` (a closure reading `props.x` captures the whole props object).
- Live props (P5): class / style / children via `renderPropsOf(merged, …)` (ColorWheelTrack: class / style live view); body untracked (`colorWheel`); live `isDisabled` = `state.disabled` (`isColorWheelDisabled(state)`, `../color/wheel-state.ts`): handlers check `read(props.isDisabled)` (`ColorWheelAriaOptions.isDisabled` = `MaybeAccessor`), input `disabled`, wheel / track / thumb `data-disabled` follow. Flags go into the spread bag only (an explicit attribute after a spread overrides the bag's key). Tests `tests/live-controlled.browser.test.tsx` "live flags: color parts", `tests/live-flags-ssr.test.ts`, story `/live-props` `#lf-color-*`.

## Tests
- `tests/color-wheel.browser.test.tsx`: RAC ColorWheel.test.js + react-aria useColorWheel.test.tsx (custom `HookWheel` markup); Mouse/Touch duplicate variants skipped (Chromium pointer events only). Story `/color` #wheel.

## See also
[../color/CLAUDE.md](../color/CLAUDE.md), [../color-thumb/CLAUDE.md](../color-thumb/CLAUDE.md), `apps/cdk-docs/content/components/color-wheel.md`
- `render` (RAC DOMRenderProps): `if (render) return render(attrs, renderProps)` before the compiled element (default path unchanged); reactive attrs are accessors, handlers inline arrows; also on `ColorWheelTrack`; the contexts wrap the children accessor; tests `tests/render-date-color.browser.test.tsx`
- Thumb `data-rk` = `COLOR_WHEEL_KEYS` (arrows, PageUp / PageDown; with the handlers): a cold PageUp is held instead of stepping the native range input by its own page size (SLIDER-KEY; `tests/color-wheel.browser.test.tsx`).
