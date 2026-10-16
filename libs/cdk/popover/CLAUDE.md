# @rivetjs/cdk/popover
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC Popover (`<DialogTrigger><Button/><Popover><Dialog/></Popover></DialogTrigger>`, standalone `triggerRef` + `isOpen`) on the div overlay layer; React Aria `usePopover` as `popoverProps()`; legacy `PopoverOverlay` shim.

## Entry points
- `@rivetjs/cdk/popover` → `index.tsx`: `Popover`, `PopoverContext`, `OverlayTriggerStateContext` (from `../overlay/contexts.ts`), legacy `PopoverOverlay`, types `PopoverProps`, `PopoverRenderProps` (`{trigger, placement(), isEntering(), isExiting()}`), `PopoverContextValue`, `Placement`, `PlacementAxis`; re-exports `./use-popover.ts`
- `@rivetjs/cdk/popover/use-popover` → `use-popover.ts`: `popoverProps(props, state)` → `PopoverAria` (`placement`, `triggerAnchorPoint`, `position`, `updatePosition`, `underlayProps`, `dispose`), `AriaPopoverProps` (`triggerRef`, `popoverRef`, `arrowRef`, `groupRef`, `isNonModal`, `isKeyboardDismissDisabled`, `shouldCloseOnInteractOutside`, `trigger`, focus-within handlers, position props)
- `behaviour.ts` / `popover-overlay.tsx`: LEGACY `PopoverOverlay`; last consumer `select/index.tsx` (items preset; the parts form `select-parts.tsx` uses `Popover`); delete with the preset

## Layout
- `Popover`: own-ref copy, `isHidden()` (collection build pass) → children directly (server slot probe `slotProbing` (`#server`) → null: popover content declares no owner slot); state = own (`isOpen` / `defaultOpen` given, or no context) else `OverlayTriggerStateContext`; `span[data-rv-overlay-anchor]` > `Show(isOpen || exiting)` > `PopoverInner`; exit state (`createExitAnimationState(state.isOpen)`) created here and passed as `exit`, `PopoverInner` calls `watchExitAnimation(element, exit)` (the exit effect lives inside the open overlay: a closed popover registers no idle `fx`, UI-COLD 2026-10-08)
- `PopoverInner`: `<Overlay shouldContainFocus={modal dialog}>` (ClearPressResponder inside), underlay `div[data-rv-underlay]` (modal, own binding), `div[ref=containerRef]` (PopoverGroupContext for submenus), `div.rv-Popover[data-rv-overlay][data-trigger][data-placement][data-entering|exiting]`, DismissButtons; children under `OverlayArrowContext {placement, ref, offset}` + `PopoverContext null` + `clearContexts` null
- Positioning: `popoverProps` in a client effect while open, once the Overlay's portal is in the overlay layer (`placed` signal set by the Overlay's `onPlaced`; CELLSELECT-DEV 2026-10-08: positioned while the host still sat in place, a flex gap moved the trigger 2px, the ResizeObserver re-positioned inside its own callback → "ResizeObserver loop completed with undelivered notifications"); the effect also tracks a function `triggerRef` (`ref()` signal): on a resumed page the trigger's ref can bind after a cold press opened the popover → re-positions when it arrives (RA: positions whenever trigger + overlay exist, any order; ui `Popover.Trigger` flake 2026-10-09; test "positions once a trigger ref set after opening arrives"); `arrowStyle: false` → OverlayArrow applies RA `arrowProps.style` from the `offset` signal (user arrow style wins); user `style.zIndex` → no positioning zIndex
- Tests: `tests/popover.browser.test.tsx` (RAC Popover.test.js port), `tests/overlay-position.test.ts` (usePopover scroll), `tests-components/overlays.test.ts`, `widgets.test.ts`, `dom-events-overlays.test.ts`, axe; route `tests-components/app/src/routes/popover.tsx`

## Upstream
- RAC Popover.tsx, React Aria usePopover / useOverlayPosition / Overlay / DismissButton — Apache-2.0
- Rivet: hook = imperative fn from a client effect; render props accessors; `isEntering` / `isExiting` accept accessors; PopoverContext `idRef` (signal): own `id` replaces the trigger's generated id (RA mergeIds); accessor `aria-label` / `aria-labelledby` from context read in the binding
- `render` prop (RAC DOMRenderProps; `(attrs, renderProps)` → spread attrs; early return before the compiled element; `tests/render-collections.browser.test.tsx`): replaces the popover `div`; underlay, `data-rv-overlay`, JS z-index/position stay
- Deviation: no `UNSTABLE_portalContainer` (PortalProvider only)

## Rules / invariants
- Div overlay layer, never native `popover`; modal popover contains focus; PreviewTrigger popover never focuses itself
- No nested `Dialog` → popover itself is role=dialog: role-detection client effect sets `tabindex=-1` (unless given) BEFORE `focusSafely` — on resumed pages the tabindex binding commits after the effect (D3-1)
- Defaults: `placement` "bottom", `offset` 8, `containerPadding` 12, `shouldFlip` true
- Read props up front before JSX (spread = one binding; closures must not capture `props`)

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/popover.browser.test.tsx`
- `npx vitest run --project cdk libs/cdk/tests/overlay-position.test.ts`
- `STORIES_DIST=dist-x npx vitest run --project cdk-components libs/cdk/tests-components/overlays.test.ts`

## Gotchas
- `overlay(groupElement ?? element, { keyTarget: element })`: Escape is handled on the popover itself, not the shared group (see `../overlay/CLAUDE.md`)
- `popover.browser` "should not leak PopoverContext to nested popovers" passes on the Select parts form (2026-10-08); its nested popover uses a callback ref (the Select's build pass renders Popover children inside a computed: `ref()` signal writes throw there)
- `overlays.test` standalone / isNonModal cases pass (tabindex before focus)
- `PortalProvider` ignored by Popover on resumed pages (region re-creation loses context; Tooltip resolves PortalContext outside the presence)
- Context ref (`PopoverContext.ref`, e.g. ComboBox `popoverRef`) is used as the element ref directly when it is a Rivet ref (signal or server ref `Symbol.for("rivet.ref")`), not via `contextProps` mergeRefValues: that copy is a clientEffect and on resumed pages runs only at idle, so a press during boot saw `popoverRef()` unset and the combobox's first blur closed the popover (RA mergeRefs set at commit)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../overlay/CLAUDE.md](../overlay/CLAUDE.md), [../overlay-arrow/CLAUDE.md](../overlay-arrow/CLAUDE.md), [../portal/CLAUDE.md](../portal/CLAUDE.md), [../dialog/CLAUDE.md](../dialog/CLAUDE.md)
- Docs: [popover](../../../apps/cdk-docs/content/components/popover.md)
