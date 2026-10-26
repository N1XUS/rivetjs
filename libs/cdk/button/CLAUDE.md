# @rivetjs/cdk/button
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Native `<button>` with RA press events, pending state, form attrs; `press.ts` adapts the shared `usePress` handlers for explicit `onX` wiring (also used by toggle-button).

## Entry points
- `@rivetjs/cdk/button` -> `index.tsx`: `Button`, `ButtonContext`, types `ButtonProps`, `ButtonRenderProps`, `ButtonContextValue`, `PressEvent`, `PointerType`
- `@rivetjs/cdk/button/behaviour` -> `behaviour.ts`: `buttonProps(AriaButtonProps)`, `isPendingNow`, `pendingOptions`, `buttonKeyDown`, `buttonClick`, `buttonPointerDown`, `buttonPointerUp`, `buttonMouseDown`, `buttonDragStart`; types `PressEvent`, `PressEvents`, `PressOptions`, `PointerType`
- `press.ts`: not a subpath (import via behaviour types); per-element adapter over `../interactions/press.tsx`: `pressKeyDown/Click/PointerDown/MouseDown/PointerUp/PointerEnter/PointerLeave/DragStart(options, event)`, `cancelPress`, `isPressed`; re-exports `isVirtualClick`, `isVirtualPointerEvent` (`../platform`), types `PressEvent`, `PressEvents`, `PressProps`, `PointerType`; `PressOptions` = `PressProps`

## Layout
- `index.tsx` - `<Button>` (RAC Button): contextProps ButtonContext, PressResponderContext merge, FocusableContext merge (`mergeFocusableContext` + `readAttrs`; context from `../interactions/focus.tsx`, not `../focus/focusable.tsx`), user `onKeyDown` / `onKeyUp` via `createEventHandler` (no `../interactions/keyboard.tsx` / `../keys`: import diet BUTTONDIET 2026-10-26, button-basic −4.2 KB gz / −4 files), always provides `ProgressBarContext` `{ id: <id>-progress }`, hideable (`isHiddenPart`, `../collections/hidden.ts`)
- hideable: `if (slotProbing || isHiddenPart()) return null` first (`slotProbing`: a field's server slot probe, `#server`)
- `behaviour.ts` - RA `useButton` attr bag (`elementType` button/a/div/span/input) + pending-aware handler wrappers
- `press.ts` - thin layer: `pressOf(el, options)` builds a `Press` instance (state in a module `WeakMap` per element, transient, never serialized; `pressed.set` writes `data-pressed="true"`) and calls the shared handler functions
- importers of `press.ts`: `button/*`, `toggle-button/*`
- tests: `tests/button.browser.test.tsx` (RAC Button.test.js port + Rivet: ProgressBar, accessor labels, FocusableContext, disable-mid-press cancel, hideable), `tests/pilots-ssr.test.ts`, `tests-components/button.test.ts` (route `tests-components/app/src/routes/button.tsx`); `tests-components/widgets.test.ts` "buttons:" + "callbacks:" (routes `buttons.tsx`, `callbacks.tsx`); `tests-components/axe.test.ts` (`/buttons`); also used in routes `modal.tsx`, `popover.tsx`, `tooltip.tsx`
- docs examples: `apps/cdk-docs/examples/button-*/`

## Upstream
- RAC `Button.tsx`, react-aria `button/useButton.ts`, `interactions/usePress.ts`, `utils/isVirtualEvent.ts` (Apache-2.0)
- `render` prop: the attrs object (reactive attrs are accessors, read by the element spread) goes to `render(attrs, ButtonRenderProps)` or `<button>`; press-watcher roots (`watchDisabled`/`watchPending`) are detached (`runWithOwner(null)`): a handler of a spread runs under the spread effect owner and a root created there is disposed on its next run. Deviations (headers): while pending only press + owned handlers are disabled; resumability deviations of the press itself live in `interactions/press.tsx` (native `<button>`/`<input>`: keyboard press ends at the native `click`, `lastClick` guard, blur cancels)

## Rules / invariants
- `OWNED = ["render", "onPointerDown", "onPointerUp", "onMouseDown", "onClick", "onPointerEnter", "onPointerLeave", "onPointerOver", "style"]`; user handlers chained after the press / hover handler
- Delegated wiring (IMPL-INTERACT 2026-10-09): 0 listeners per mounted button. Hover = `onPointerOver` → user `onPointerOver` first (RA: hover starts on pointerenter, after it), then `hoverStateOver` (pointerleave bound while hovered), focus = `onFocusIn` → `focusStateIn` (blur bound while focused; `watchPending` drops on that blur), press enter / leave / dragstart bound by `pressPointerDown` for the press (`press.track`, `PRESS_TRACK_DRAG` from `pressOf`). User `onPointerEnter` / `onPointerLeave` bind natively only when given (conditional inline arrows, resumable)
- `onPointerUp` / `onMouseDown` attrs only rendered when `onPressUp` / `preventFocusOnPress` (or the user handler) set - keeps resume entries minimal
- render state: `class="rv-Button"` default, `data-disabled`, `data-pending="true"`, `data-pressed` (press.ts), `data-hovered` / `data-focused` / `data-focus-visible` (data-attrs handlers), `aria-disabled="true"` while pending, native `disabled`; render props are accessors
- `isPending` is `MaybeAccessor<boolean>` (`read` from `state/form-validation.ts`): pending -> presses ignored (`pendingOptions` sets isDisabled), focus kept, submit button renders `type="button"`, click `preventDefault`; a `<ProgressBar>` child takes id `<id>-progress` (ProgressBarContext) and joins `aria-labelledby` while pending; pending announced while focused (effect from focus handler)
- `excludeFromTabOrder` -> `tabIndex=-1`; no aliases
- accessor `isDisabled` turning true mid-press cancels the press (RA usePress isDisabled effect): watcher created at pointerdown / keydown, not at render
- no render-time reads of an accessor `isDisabled` (`ariaButtonProps` untracked; FocusableContext merge gets `liveAt(props, "isDisabled")` unread — accessor / live → gated at event time, boolean → RA `isDisabled ? {} : domProps`): a tracked read re-creates the whole Button on its first change on a resumed page (Calendar page buttons lost focus on the first Next press; a live `isDisabled` under a TooltipTrigger threw "Cannot run with a disposed owner" in the re-creation, ui InputGroup "With TextArea" — `tests-components/tooltip.test.ts` "live isDisabled on a trigger Button", `tests/button.browser.test.tsx` "accessor / live isDisabled gates the context props")
- `aria-label` / `aria-labelledby` / state aria props may be accessors (read in bindings)
- live props (P5): value forms (`aria-pressed={on()}`, `isDisabled={d()}`, `class={c()}`, `isPending`, `excludeFromTabOrder`, aria / form keys = `LIVE_KEYS`) update in place: with a live prop (`hasLive`) state / ARIA reads go through `liveView(props, LIVE_KEYS)` (`liveAt` accessors, `aria` = runtime `mergeProps(ariaButtonProps, view)`), class / style / children through `renderProps(…, liveView(props, RENDER_KEYS))`; body reads untracked. Live by default (LIVE-SWEEP 2026-10-11): `type` (`liveAt(aria, "type")`, `buttonType()` binding; a pending submit still renders `type="button"`) and `formEncType` / `formMethod` / `formTarget` (spread accessors only when live, static path unchanged). Read once (identity props, JSDoc "Read once at mount"): handlers, `slot`, `id`, `elementType`, `preventFocusOnPress`, the render-prop form (string vs function) of class / style / children. Tests: `tests/live-props.browser.test.tsx`, `tests-components/live-props.test.ts`
- read every prop into locals before JSX (spread root, index.tsx:86-87)
- `PressEvent.continuePropagation()`: RA default stops propagation

## Commands
- `npx vitest run --project cdk-components libs/cdk/tests-components/button.test.ts`
- `npx vitest run --project cdk-components libs/cdk/tests-components/widgets.test.ts libs/cdk/tests-components/axe.test.ts`

## Gotchas
- press state lives in a module WeakMap: lost on reload/resume boundary by design; do not read it on the server

## See also
- [../CLAUDE.md](../CLAUDE.md)
- `apps/cdk-docs/content/components/button.md`, `apps/cdk-docs/content/foundations/interactions.md`
- [../toggle-button/CLAUDE.md](../toggle-button/CLAUDE.md), [../link/CLAUDE.md](../link/CLAUDE.md)
