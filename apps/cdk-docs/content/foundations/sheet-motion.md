---
title: Sheet motion
description: "@rivetjs/cdk/sheet-motion: the drag gesture of an edge sheet (dismiss, snap points, handle-only drags, backdrop fade) on the shared motion physics."
template: guide
status: experimental
related: [foundations/motion, components/sidebar, components/modal]
---

`@rivetjs/cdk/sheet-motion` makes an element attached to a screen edge follow the pointer. Drag it towards its edge to dismiss it, or release it between snap points to resize it. It runs on [`@rivetjs/cdk/motion`](./motion.md) (embla's physics), so a release settles the same way a carousel does. The ui [Sheet](site:ui/components/sheet/) uses it. Apps that do not import it pay nothing.

:::note
Rivet addition: no upstream module. The feature set (snap points, close threshold, sequential snapping, handle-only drags, backdrop fade from a snap index) is scoped from public docs of commercial UI kits; this is an independent implementation.
:::

::example{id=sheet-motion-basic}

## Import

```ts
import { sheetMotion, snapPointTransform, type SheetMotionController } from "@rivetjs/cdk/sheet-motion";
```

## How it moves

- **Offset.** The sheet's position is the number of pixels it is pushed towards its closed edge: 0 is fully shown, its own size is off-screen. It is written as an inline `transform: translateX/Y(…)`, so a CSS enter / exit on the separate `translate` property composes with it.
- **Snap points.** Numbers from 0 to 1 are fractions of the viewport along the axis; strings are CSS lengths (`"148px"`, `"20rem"`, `"50dvh"`, `"40%"`). Give them smallest first. `snapPointTransform(placement, point)` returns the same position as a CSS expression for the first render, before anything is measured.
- **Drag decision.** A drag starts after 6 px along the axis, and only when the move is more along the axis than across it. A cross-axis move is left to the browser (scroll, pan). A press inside a scroll container that can still scroll in that direction scrolls it instead. Text fields and `[data-sheet-no-drag]` never start a drag, and `handle` limits drags to one element.
- **Overdrag.** Past fully shown the sheet follows at a fifth of the pointer (rubber band) and springs back on release. Meanwhile a `[data-sheet-bleed]` child with the sheet's own background (`background: inherit`) fills the space between the sheet's attached edge and the screen edge, so the surface stays attached. `bleed: false` turns it off for a sheet that floats away from the edge. The bleed is absolutely positioned (a static sheet gets `position: relative` while it is shown), so an `overflow: hidden` sheet clips it.
- **Release.** The flick force projects the throw. Without snap points the sheet dismisses when the projection passes `closeThreshold` of its size; with snap points it dismisses below the lowest point and otherwise settles on the nearest one (`sequential`: the neighbour only). A dismiss animates off-screen and then calls `close()`.
- **Reduced motion.** With `prefers-reduced-motion: reduce` (or `reduceMotion()` returning true) every release and `snapTo` jumps.

## API

| Export                                                          | Signature                                                                    |                                                                                                        |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `sheetMotion`                                                   | `(sheet: HTMLElement, options: SheetMotionOptions) => SheetMotionController` | Attaches the gesture. Returns `snapTo(index, jump?)`, `dismiss()`, `offset()`, `index()`, `destroy()`. |
| `snapPointSize`                                                 | `(point, viewport, vertical, rootFontSize?) => number`                       | Visible size of a snap point in px.                                                                    |
| `snapPointTransform`                                            | `(placement, point) => string \| undefined`                                  | CSS transform for the first render at `point`.                                                         |
| `sheetBackdropOpacity`                                          | `(offset, size, offsets, fadeFrom) => number`                                | Backdrop strength (0–1) at an offset.                                                                  |
| `rubberBand`                                                    | `(raw, limits) => number`                                                    | Resistance past the drag limits (0.2 of the pointer).                                                  |
| `isVerticalSheet`                                               | `(placement) => boolean`                                                     | `top` / `bottom`.                                                                                      |
| `SHEET_AXIS_LOCK`, `SHEET_RUBBER_BAND`, `SHEET_CLOSE_THRESHOLD` | `6`, `0.2`, `0.25`                                                           | Constants.                                                                                             |

### Options

| Option                                                                                     | Default                                 |                                                                                                           |
| ------------------------------------------------------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `placement`                                                                                | `"bottom"`                              | `top`, `bottom`, `left` or `right`.                                                                       |
| `close`                                                                                    | required                                | Called once a dismiss has animated off-screen.                                                            |
| `dismissible`                                                                              | `true`                                  | Whether a drag may dismiss the sheet.                                                                     |
| `snapPoints`, `activeSnapIndex`                                                            | none, `0`                               | Snap points (smallest first) and the one to rest on (read once).                                          |
| `onSnap(index)`                                                                            |                                         | A release landed on another snap point.                                                                   |
| `closeThreshold`                                                                           | `0.25`                                  | Fraction of the remaining distance a throw must pass to dismiss.                                          |
| `sequential`                                                                               | `false`                                 | Never skip a snap point.                                                                                  |
| `handle`                                                                                   |                                         | Selector: only drags that start inside it move the sheet.                                                 |
| `backdrop`, `fadeFromIndex`                                                                | none, last index                        | Element whose `--sheet-backdrop-opacity` follows the drag; the snap index from which it is fully opaque.  |
| `onDrag(event, fraction)`, `onRelease(event, open)`, `onProgress(shown)`, `onSettle(open)` |                                         | Drag frame, release, every rendered frame (1 = fully shown), settled.                                     |
| `reduceMotion()`                                                                           |                                         | Turns the animations off on top of the media query.                                                       |
| `touchAction`                                                                              | `"none"` vertical, `"pan-y"` horizontal | Inline `touch-action` while attached (unchanged with `handle`).                                           |
| `bleed`                                                                                    | `true`                                  | Overdrag bleed: the sheet's background fills the gap at its attached edge while dragged past fully shown. |

## Keyboard and accessibility

`sheetMotion` installs a pointer gesture, not dialog semantics or keyboard dismissal. Compose it with [Modal](../components/modal.md) and [Dialog](../components/dialog.md) for focus containment and Escape handling, and keep a labelled close button available. If changing snap points is essential, provide buttons that call the controller's `snapTo(index)` as an alternative to dragging. The motion respects reduced-motion preferences.

## Notes

- Style the backdrop with the variable (`opacity: var(--sheet-backdrop-opacity, 1)` on a pseudo-element): the sheet usually sits inside the backdrop element.
- On touch, a press inside a scrollable part of the sheet always scrolls it (the browser pans the nearest scroll container and cancels the pointer). Drag from the handle or the header.
- While dragging, the sheet has `data-dragging="true"` and an inline `transition: none`.
