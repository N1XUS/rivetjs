---
title: Interactions
description: "pressProps, longPressProps, hoverProps, moveProps, keyboardProps, scrollWheelProps and watchInteractOutside: resumable interaction handlers."
template: guide
status: experimental
related: [foundations/focus-interactions, foundations/dom-props, components/button]
---

The interaction helpers normalize input for custom widgets. Each returns a props object to spread on one element (`pressProps`, `hoverProps`, …) and, where it has state, a signal (`isPressed()`, `isHovered()`). They normalize mouse, pen, touch, keyboard and screen reader input into one set of events. The cdk components ([Button](../components/button.md), [Menu](../components/menu.md), [Select](../components/select.md), …) are built on them; use the hooks for your own pressable or draggable elements.

::example{id=press-events}

```tsx title="src/components/Tile.tsx"
import { signal } from "@rivetjs/reactivity";
import { pressProps } from "@rivetjs/cdk/interactions/press";

export function Tile() {
  const count = signal(0);
  const press = pressProps({ onPress: () => count.update((n) => n + 1) });
  return (
    <div role="button" tabIndex={0} {...press.pressProps} data-pressed={press.isPressed() || undefined}>
      Pressed {count()} times
    </div>
  );
}
```

## Import

| Function | Module | Spread |
| --- | --- | --- |
| `pressProps` | `@rivetjs/cdk/interactions/press` | `pressProps` |
| `longPressProps` | `@rivetjs/cdk/interactions/long-press` | `longPressProps` |
| `hoverProps` | `@rivetjs/cdk/interactions/hover` | `hoverProps` |
| `moveProps` | `@rivetjs/cdk/interactions/move` | `moveProps` |
| `keyboardProps` | `@rivetjs/cdk/interactions/keyboard` | `keyboardProps` |
| `scrollWheelProps` | `@rivetjs/cdk/interactions/scroll-wheel` | `scrollWheelProps` (or a `ref`) |
| `watchInteractOutside` | `@rivetjs/cdk/interactions/interact-outside` | nothing (document listeners) |
| `mergeProps`, `chain`, `chain2` | `@rivetjs/cdk/interactions/merge-props` | |
| `focusProps`, `focusWithinProps`, `createFocusVisible`, `useFocusRing` | see [Focus interactions](focus-interactions.md) | |

Each `xProps` returns React Aria's result object (`{ pressProps, isPressed }`): keep it in a const and spread its bag, `const press = pressProps(o)` then `{...press.pressProps}` (destructuring `pressProps` would shadow the function).

`@rivetjs/cdk/interactions` (no subpath) holds `controllable()`; prop merging is `mergeProps` (`@rivetjs/cdk/utils`), see [Props and values](props-and-values.md#merging-props).

## Rules for every hook

- **Call the hook in the component body**, spread its props on exactly one element. Callback options can be any function: inline, local or imported.
- **Options are read at event time.** `isDisabled` (and `pressProps`'s `isPressed`) may be a signal or accessor: `pressProps({ isDisabled: disabled })`.
- **State is a signal.** Write it to a data attribute for styling: `data-pressed={isPressed() || undefined}`.
- **Nothing runs at load.** The handlers attach when the component first runs in the browser (its first event); global listeners (pointerup on the document, the touch tracker of `hoverProps`) install inside the first handler call. Exceptions: `watchInteractOutside` and `scrollWheelProps(props, ref)` register client listeners at load.
- **Combine hooks with `mergeProps`** when two of them handle the same event (your own `onPointerDown` next to `pressProps`, `class` values to join). A plain double spread would keep only the last handler.
- **Delegated events.** The press and hover bags hold bubbling handlers (`pointerdown`, `pointerover`, …): the runtime handles them with one document listener per event type (shadow roots included), so a mounted hooked element adds no listener of its own. Events React Aria only needs mid-interaction bind on the element for that interaction and unbind after: `pointerenter` / `pointerleave` / `dragstart` during a pointer press, `pointerleave` while hovered. With callbacks, `hoverProps` (`pointerenter` / `pointerleave`) and `focusProps` (`focus` / `blur`) bind native listeners instead, so handlers merged around them run in `mergeProps` order, as in React Aria.

## pressProps

Press interactions across mouse, pen, touch, keyboard (:kbd[Enter], :kbd[Space]) and virtual clicks (screen readers, `element.click()`). A press that leaves the element ends (`onPressEnd`) without `onPress`, and starts again when the pointer comes back. Text selection is disabled while pressing; `touch-action: pan-x pan-y pinch-zoom` is set on the first pointerdown (no double-tap zoom delay).

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `onPress` | `(e: PressEvent) => void` | none | Released over the target. |
| `onPressStart` | `(e: PressEvent) => void` | none | Press began (pointer down, key down). |
| `onPressEnd` | `(e: PressEvent) => void` | none | Press ended, over the target or after the pointer left it. |
| `onPressUp` | `(e: PressEvent) => void` | none | Released over the target, wherever the press started. |
| `onPressChange` | `(isPressed: boolean) => void` | none | |
| `onClick` | `(e: MouseEvent) => void` | none | Compatibility alias; also called for keyboard presses with a synthetic `MouseEvent`. Prefer `onPress`. |
| `isDisabled` | `MaybeAccessor<boolean>` | `false` | No press events; clicks are `preventDefault`ed. |
| `isPressed` | `MaybeAccessor<boolean>` | none | Controlled press state (e.g. while the menu it opened is open). `isPressed()` returns `true` when this or the internal state is. |
| `preventFocusOnPress` | `boolean` | `false` | Do not move focus on press. |
| `shouldCancelOnPointerExit` | `boolean` | `false` | Leaving the target cancels the press instead of pausing it. |
| `allowTextSelectionOnPress` | `boolean` | `false` | Keep text selectable. |
| any other key | | | Merged into `pressProps` (attributes and handlers, chained). |

Returns `{ pressProps, isPressed }`. `pressProps` carries `data-rv-pressable` and handlers for `keydown`, `click`, `pointerdown`, `pointerup` and `mousedown`. During a pointer press it also listens on the element for `pointerenter` / `pointerleave` (press leaves and re-enters the target) and `dragstart` (a native drag cancels the press); these are removed when the press ends.

**`PressEvent`**: `type` (`"pressstart" | "pressend" | "pressup" | "press"`), `pointerType` (`"mouse" | "pen" | "touch" | "keyboard" | "virtual"`), `target`, `shiftKey`, `ctrlKey`, `metaKey`, `altKey`, `x` and `y` (relative to the target), `key` (keyboard presses), `continuePropagation()`.

Order for one press: `pressstart` → `pressup` → `pressend` → `press` (see the hero example).

### Options

::example{id=press-options}

### Propagation

Press events stop at the innermost pressable element. Call `e.continuePropagation()` in a handler to let the native event bubble on.

::example{id=press-propagation}

`PressResponderContext` lets a parent pass press props to the `pressProps` of a child (React Aria `PressResponder`). `cancelPress(press)` releases a running press, for a disabled signal that turns `true` mid-press.

## longPressProps

Long press with mouse or touch, built on `pressProps`. After `threshold` ms over the target it fires `onLongPress`, dispatches `pointercancel` so other press handlers let go, prevents the click (and the touch context menu) that follows, and focuses the target.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `onLongPressStart` | `(e: LongPressEvent) => void` | none | Every mouse / touch press start. |
| `onLongPressEnd` | `(e: LongPressEvent) => void` | none | Every press end, long or not. |
| `onLongPress` | `(e: LongPressEvent) => void` | none | The threshold was reached. |
| `threshold` | `number` | `500` | Milliseconds. |
| `pointerType` | `"mouse" \| "touch"` | both | Only this pointer type. |
| `accessibilityDescription` | `string` | none | Text of the description element (needs `onLongPress`). |
| `isDisabled` | `MaybeAccessor<boolean>` | `false` | |

Returns `{ longPressProps, descriptionId }`. With a description, `longPressProps` has `aria-describedby={descriptionId}`: render `<span id={descriptionId} hidden>…</span>` yourself (React Aria creates the node at run time, which a resumed page cannot). `LongPressEvent` is a `PressEvent` with `type` `"longpressstart" | "longpressend" | "longpress"` and no `continuePropagation`. Keyboard presses are not long presses.

::example{id=long-press}

## hoverProps

Hover for mouse and pen. Touch never hovers, and the emulated mouse events iOS fires after a touch are ignored for 500 ms. If the hovered element is removed, the next `pointerover` elsewhere ends the hover. Moving into a child keeps it.

| Option | Type | Notes |
| --- | --- | --- |
| `onHoverStart`, `onHoverEnd` | `(e: HoverEvent) => void` | `HoverEvent`: `type` (`"hoverstart" \| "hoverend"`), `pointerType` (`"mouse" \| "pen"`), `target`. |
| `onHoverChange` | `(isHovering: boolean) => void` | |
| `isDisabled` | `MaybeAccessor<boolean>` | No new hover starts. |

Returns `{ hoverProps, isHovered }`. With a callback (`onHoverStart`, `onHoverEnd`, `onHoverChange`) the bag is `onPointerEnter` / `onPointerLeave`, so handlers merged around it run in `mergeProps` order. Without one it is `onPointerOver` (delegated: a pointer entering the element from outside starts the hover, as `pointerenter` would; a `pointerleave` listener on the element ends it and is removed then). A second argument, the props object you merge with the bag, switches to `onPointerEnter` / `onPointerLeave` when it has those handlers. `endHover(hover)` and `setupGlobalTouchEvents()` are exported for components that disable hover mid-hover or install the touch tracker early.

::example{id=hover-events}

## moveProps

Drag-like movement with mouse, pen and touch (pointer events, page coordinates: correct on Safari and high-DPR Android) and the arrow keys. `onMoveStart` fires only with the first non-zero delta, so a click is no move. Text selection is off while moving.

| Option | Type | Notes |
| --- | --- | --- |
| `onMoveStart` | `(e: MoveStartEvent) => void` | `pointerType` and modifier keys. |
| `onMove` | `(e: MoveMoveEvent) => void` | `deltaX`, `deltaY` since the last event (keyboard: ±1). |
| `onMoveEnd` | `(e: MoveEndEvent) => void` | Only after a move started. |

Returns `{ moveProps }` (`onPointerDown`, `onKeyDown`). Give the element `touch-action: none` so touch drags do not scroll, and a `tabIndex` for the keys.

::example{id=move-keyboard}

## keyboardProps

`onKeyDown` / `onKeyUp` handlers whose events stop propagating unless the handler calls `e.continuePropagation()`, plus declarative shortcuts.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `onKeyDown`, `onKeyUp` | `(e: RivetKeyboardEvent) => void` | none | The native event plus `continuePropagation()` and `isPropagationStopped()`. |
| `shortcuts` | `Record<string, action>` | none | `"Shift+Enter"`, `"Mod+s"` (Meta on Mac, Control elsewhere), `"Escape"`. Modifiers: `Shift`, `Alt`, `Control`, `Meta`, `Mod`. |
| `allowRepeats` | `boolean` | `false` | Shortcuts also on repeating keys. |
| `allowComposing` | `boolean` | `false` | Shortcuts also during IME composition. |
| `isDisabled` | `MaybeAccessor<boolean>` | `false` | |

A shortcut action that returns nothing (or `true`) handled the key: `preventDefault()` and stop. `false` leaves the key alone. An object `{ shouldPreventDefault, shouldContinuePropagation }` sets both. Unmatched keys propagate.

Known issue: with `shortcuts` set, `onKeyDown` / `onKeyUp` get the plain native event, without `continuePropagation()`; calling it throws. Keep those handlers on a second `keyboardProps` merged with `mergeProps`, or do not call it there.

::example{id=keyboard-events}

::example{id=keyboard-shortcuts}

## scrollWheelProps

Wheel deltas as `onScroll({ deltaX, deltaY })`; the page does not scroll. :kbd[Ctrl] + wheel (zoom) is left to the browser.

| Call | Listener |
| --- | --- |
| `scrollWheelProps(props, ref)` | Non-passive `wheel` listener on `ref`'s element, from a client effect: `preventDefault` works from the first turn. |
| `scrollWheelProps(props)` | Returns `scrollWheelProps.onWheel`. Resumed delegated `wheel` listeners are passive, so the page may scroll on the first turn. |

Options: `onScroll`, `isDisabled`.

::example{id=scroll-wheel}

## watchInteractOutside

Calls `onInteractOutside` when the user presses outside `ref`'s element: pointerdown and click both outside, primary button only, in the capture phase (a `stopPropagation` inside the page does not hide it). Targets removed from the document and top-layer elements (`[data-rv-top-layer]`, such as toasts) do not count.

| Option | Type | Notes |
| --- | --- | --- |
| `ref` | `Ref<Element>` or accessor | Required. |
| `onInteractOutside` | `(e: PointerEvent) => void` | On the click. |
| `onInteractOutsideStart` | `(e: PointerEvent) => void` | On pointerdown. Only called when `onInteractOutside` is set. |
| `isDisabled` | `MaybeAccessor<boolean>` | |

The listeners are client events on `document`: a page using the hook boots the runtime at load and loads the handler on the first pointerdown. `isValidOutsideEvent(event, element)` is the check on its own.

::example{id=interact-outside}

## mergeProps and chain

`mergeProps(...bags)` merges prop objects: later keys win, `on*` handlers chain (earlier first), `class` / `className` and `aria-describedby` / `aria-labelledby` join with a space. Spread the merged object on a native element; its chained handlers attach with that element. `chain(...fns)` calls each function in order.

::example{id=merge-props}

## Styling

The hooks render no classes; write their signals to data attributes and style those.

| State | Attribute you write | Tailwind | CSS |
| --- | --- | --- | --- |
| `isPressed()` | `data-pressed` | `data-[pressed]:scale-95` | `[data-pressed]` |
| `isHovered()` | `data-hovered` | `data-[hovered]:bg-teal-50` | `[data-hovered]` |
| `isFocusVisible()` (useFocusRing) | `data-focus-visible` | `data-[focus-visible]:ring-2` | `[data-focus-visible]` |
| `isFocused()` (useFocusRing) | `data-focused` | `focused:` (from `@rivetjs/cdk/tailwind.css`) | `[data-focused]` |
| always | `data-rv-pressable` (pressProps) | | `[data-rv-pressable]` |

::example{id=interactions-tailwind}

::example{id=interactions-css}

## Accessibility

- Give a pressable non-button element `role="button"` and `tabIndex={0}`; `pressProps` handles :kbd[Enter] and :kbd[Space] (links: :kbd[Enter] only; text inputs ignore both).
- Screen reader activation arrives as a virtual click: `pointerType: "virtual"`.
- `moveProps` needs a keyboard path: the arrow keys work when the element is focusable.
- `longPressProps` needs a description and a second way to reach the action for keyboard users.

## Resumability

- Handlers resume on the first event; per-hook state is a JSON object in the page state. Nothing is wired before the first interaction, except `watchInteractOutside` and `scrollWheelProps(props, ref)` (client listeners at load).
- `pressProps` adds its document `pointerup` / `keyup` listeners (and the element's `pointerenter` / `pointerleave` / `dragstart`) inside the handler, per press.
- With `keyboardProps`, events stop at the element by default; resumed ancestors with their own handler still get the event when a handler calls `continuePropagation()`.
- Known issue: on an element that spreads hook handlers and also has an explicit handler of another event (`{...keyboardProps} onInput={…}`), the first cold keydown on a resumed page can be lost. Until it is fixed, avoid the mix: the shortcuts example reads the input's value from the key event instead of an `onInput` signal.

## Upstream

| Hook | Ported from | Deviations |
| --- | --- | --- |
| `pressProps` | `@react-aria/interactions` `usePress` | No mouse / touch fallback (upstream's is for JSDOM); `touch-action` set through the CSSOM instead of an injected `<style>`. |
| `longPressProps` | `useLongPress` | The description element is yours to render (`descriptionId`). |
| `hoverProps` | `useHover` | Global touch tracker installs on the first handler call. |
| `moveProps` | `useMove` | No mouse / touch fallback. |
| `keyboardProps` | `useKeyboard` + `createKeyboardShortcutHandler` | |
| `scrollWheelProps` | `useScrollWheel` | Returns `onWheel` without a `ref`. |
| `watchInteractOutside` | `useInteractOutside` | Client events on `document`. |
| `mergeProps`, `chain` | `@react-aria/utils` | |

`Pressable`, `PressResponder`, `ClearPressResponder` (`@rivetjs/cdk/interactions/pressable`) and `focusableProps` / `Focusable` (`@rivetjs/cdk/focusable`, React Aria `useFocusable`): see [Slots](slots.md#pressable-pressresponder-and-focusable). `keyboardProps` shortcuts spell the modifier `Control` (`Ctrl` is not an alias).
