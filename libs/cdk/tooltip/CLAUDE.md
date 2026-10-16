# @rivetjs/cdk/tooltip
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`TooltipTrigger` + `Tooltip` (RAC Tooltip.tsx): hover / focus tooltips with global warmup / cooldown, positioned in the div overlay layer.

## Entry points
- `@rivetjs/cdk/tooltip` → `index.tsx`: `TooltipTrigger`, `Tooltip`, `TooltipTriggerStateContext` (`rv-tooltip-trigger-state`), `TooltipContext` (`rv-tooltip`), re-exports `createTooltipTriggerState`, `openTooltip`, `closeTooltip`; types `TooltipProps`, `TooltipTriggerComponentProps`, `TooltipRenderProps` (`{placement(), isEntering(), isExiting(), state}`)
- `@rivetjs/cdk/tooltip/behaviour` → `behaviour.tsx`: `tooltipTriggerProps(props, state)`, `tooltipProps(props, state)`, handlers `tooltipTriggerPointerEnter` / `Leave` / `Focus` / `Blur`, `tooltipTriggerHoverStart` / `HoverEnd` / `PressStart`, `tooltipPointerEnter` / `Leave`, `attachTooltip(element, state, options)` (position, Escape, `aria-describedby`; `arrowOffset$` → OverlayArrow applies the offset)
- `@rivetjs/cdk/state/tooltip`: `createTooltipTriggerState` (`delay` 1500, `closeDelay` 500), `openTooltip`, `closeTooltip`, `_resetTooltips` (tests)

## Layout
- `TooltipTrigger`: renders no element — Provider [state, `{id, triggerRef}`] → `FocusableProvider` (trigger handlers on the child: Button / Link / Focusable / Pressable)
- `Tooltip`: `isHidden()` → children directly; state = own (`isOpen` / `defaultOpen` / no context) else context; `span[data-rv-overlay-anchor]` > `Show(open || exiting)` > `Portal(mount from PortalContext, resolved outside the presence)` > `div[role=tooltip].rv-Tooltip[data-placement][data-entering|exiting]`; children under `OverlayArrowContext {placement, ref, offset}`
- Standalone: `<Tooltip triggerRef={ref()} isOpen={signal}>`

## Rules / invariants
- `render` prop (RAC DOMRenderProps; `(attrs, renderProps)` → spread attrs; early return before the compiled element; `tests/render-collections.browser.test.tsx`) on the tooltip element (timing / JS positioning unchanged)
- Never focus moves; nothing rendered / no tooltip chunk at SSR while closed
- Opens on hover after `delay` (shared warmup), keyboard focus (focus-visible); closes on leave, blur, press, Escape, scroll; `trigger="focus"` = focus only
- Defaults: `placement` "top", `containerPadding` 12; positioning `zIndex` 100000 unless user `style.zIndex`
- Exit animation split: state (`createExitAnimationState`) on `Tooltip`, effect (`watchExitAnimation`) in `TooltipInner` — a closed tooltip records no client effect, so pages with closed tooltips do not boot the runtime at load (sidebar menu tooltips; `libs/cdk/tests-components/sidebar.test.ts` cold test)
- `OWNED = ["style", "onPointerEnter", "onPointerLeave"]`; `isEntering` / `isExiting` accept accessors
- `TooltipTrigger` `isDisabled`: boolean or accessor (read at event time; Rivet extension for Sidebar `MenuButton` tooltips shown only while collapsed)
- Live by default (LIVE-SWEEP round 2): `TooltipTrigger` runs `liveOptions(props, TRIGGER_LIVE = [isDisabled, delay, closeDelay, trigger, shouldCloseOnPress], ["isOpen"])` (gated by `hasLive`); the state keeps `delay` / `closeDelay` (creation values) + `state.live`, read at event time by `tooltipDelay` / `tooltipCloseDelay`; trigger options `read()` `trigger` / `shouldCloseOnPress` in the handlers; `Tooltip` `trigger` (standalone) via `liveAt` + `read` in the pointer handlers. Read once: `defaultOpen`, `placement` / offsets (positioning options at open), `id`

## Tests
- `tests/tooltip.test.ts` (useTooltipTriggerState / useTooltip / useTooltipTrigger), `tests/tooltip.browser.test.tsx` (RAC Tooltip.test.js port; skips: `UNSTABLE_portalContainer`, Button tabindex 0), `tests-components/tooltip.test.ts`, `dom-events-overlays.test.ts`

## Gotchas
- Rivet Button renders no `tabindex` (RA useFocusable sets 0) — button lane
- Trigger `<Button onFocus|onBlur>` chained with the FocusableContext handlers via `chain2` (`utils/data-attrs.tsx` `mergeFocusableContext`, resumable); a module-level curried chain is not serializable (old SSR crash)
- First open entering: `useAnimation` defers the end a microtask when the attribute is not committed yet (resumed binding order), see `../utils/CLAUDE.md`

## See also
- [../overlay-arrow/CLAUDE.md](../overlay-arrow/CLAUDE.md), [../overlay/CLAUDE.md](../overlay/CLAUDE.md), [../preview-trigger/CLAUDE.md](../preview-trigger/CLAUDE.md)
