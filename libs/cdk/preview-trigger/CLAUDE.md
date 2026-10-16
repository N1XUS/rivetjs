# @rivetjs/cdk/preview-trigger
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `PreviewTrigger` + RA `usePreviewTrigger`: hover / keyboard-focus / long-press preview popover of a link (non-modal, safe area).

## Entry points
- `@rivetjs/cdk/preview-trigger` → `index.tsx`: `PreviewTrigger` (`delay` 600, `closeDelay` 200, `isDisabled`, `isOpen` / `defaultOpen` / `onOpenChange`), `PreviewTriggerProps`
- `@rivetjs/cdk/preview-trigger/behaviour` → `behaviour.tsx`: `previewTriggerProps(options, state)`, handlers `previewTriggerPointerEnter` / `Leave` / `Focus` / `Blur` / `KeyDown` / `TouchStart` / `FocusScopeRestore`, `previewTriggerKeepOpen`, `previewTriggerCheckClose`, `attachPreviewTrigger(state, options)` (safe area, focus after long press), `AriaPreviewTriggerOptions`

## Layout
- `PreviewTrigger`: Provider [OverlayTriggerStateContext (tooltip trigger state), PopoverContext {trigger "PreviewTrigger", triggerRef, ref, isNonModal, id, idRef, focus-within handlers}] → `FocusableProvider` (handlers + accessor `aria-haspopup` / `-expanded` / `-controls` / `-describedby`, forwarded by Button / Link) + `span[data-rv-overlay-anchor]` > `Show(open)` > effects (`attachPreviewTrigger`)
- State: `../state/tooltip.ts` (warmup / cooldown)

## Rules
- Closures in `.tsx`; per-state refs in a browser WeakMap; no bare `window` / `document` at render (ownerDocument)
- Aria accessors must not read the popover `ref()` (loads the PreviewTrigger chunk at load): ids travel through `idRef`

- Deviation (header): `previewTriggerFocus` returns early on `isDisabled` (upstream lets keyboard focus open a disabled trigger); hover / long press also check it; `isDisabled` may be an accessor (inherited from TooltipTriggerProps), read at event time

## Tests
- `tests-components/preview-trigger.test.ts` (route `/preview-trigger`: SSR / no chunk, hover delay + ARIA + data-trigger, safe area, keyboard, isDisabled); `tests/hover-trigger.test.ts` (safe area)
- Not ported: RAC PreviewTrigger.test.js (jsdom + fake timers; covered by the story suite); long-press description string

## See also
- [../popover/CLAUDE.md](../popover/CLAUDE.md), [../overlay/CLAUDE.md](../overlay/CLAUDE.md), [../tooltip/CLAUDE.md](../tooltip/CLAUDE.md)
