# @rivetjs/cdk/overlay-arrow
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `OverlayArrow`: arrow element of a Popover / Tooltip, aligned with the trigger.

## Entry points
- `@rivetjs/cdk/overlay-arrow` → `index.tsx`: `OverlayArrow`, `OverlayArrowContext`, types `OverlayArrowProps`, `OverlayArrowRenderProps` (`placement()`), `OverlayArrowContextValue`

## Layout
- `div.rv-OverlayArrow[data-placement]`; style = `position:absolute`, placement side `100%`, translate −50%, RA `arrowProps.style` offset (context `offset` signal), then user `style` (wins); `aria-hidden` / `role=presentation` set by the positioning engine
- Context (`../overlay/contexts.ts`): `{placement, ref, offset}` from Popover / Tooltip

## Upstream / deviations
- RAC OverlayArrow.tsx — Apache-2.0; `render` prop (renderProps `placement`); `class` not `className`

## Tests
- `tests/popover.browser.test.tsx` "supports overriding styles", `tests/tooltip.browser.test.tsx` arrow cases, `tests-components/dom-events-overlays.test.ts`

## See also
- [../popover/CLAUDE.md](../popover/CLAUDE.md), [../tooltip/CLAUDE.md](../tooltip/CLAUDE.md)
