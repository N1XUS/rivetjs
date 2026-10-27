---
title: Sheet
description: "A draggable edge sheet: drag to dismiss, snap points, nested sheets and non-modal mode on the cdk overlay layer."
template: reference
status: experimental
related: [components/drawer, components/modal, components/popover]
---

`Sheet` slides in from an edge of the screen and follows the pointer: drag it towards the edge to dismiss, or between snap points to resize it. It runs on the cdk overlay layer (the same focus trap, scroll lock and Escape handling as [Drawer](/components/drawer/) and [Modal](/components/modal/)). The gesture is [`@rivetjs/cdk/sheet-motion`](site:cdk/foundations/sheet-motion/) on the shared motion physics.

## Usage

```tsx
import { Sheet } from "@rivetjs/ui/sheet";
```

::example{id=sheet-basic}

## Anatomy

```tsx
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export default function Anatomy() {
  return (
    <Sheet>
      <Button>Open</Button>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.CloseTrigger />
            <Sheet.Header>
              <Sheet.Heading>Title</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body>Content</Sheet.Body>
            <Sheet.Footer>
              <Sheet.Close>Done</Sheet.Close>
            </Sheet.Footer>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}
```

The first pressable child of `Sheet` (or a `Sheet.Trigger`) opens it. `Sheet.Close` and any `slot="close"` button close it; `Sheet.CloseTrigger` is the corner close button.

Additional exported parts: `Sheet.Root`.

## Examples

### Backdrop Variants

::example{id=sheet-backdrop-variants}

### Controlled

Pass a two-way `Signal<boolean>` as `isOpen` (or `state` from `useOverlayState`). Drag, Escape and the backdrop write `false` back.

::example{id=sheet-controlled}

### Detached

::example{id=sheet-detached}

### Emoji Picker Sheet

::example{id=sheet-emoji-picker}

### Handle Only

With `isHandleOnly` a drag starts only on `Sheet.Handle`, so the body can hold sliders, maps or other draggable content.

::example{id=sheet-handle-only}

### Nested

`Sheet.NestedRoot` inside an open sheet opens a child sheet; the parent gets `data-sheet-nested-open` and steps back (CSS on `--sheet-nested-progress` while the child is dragged).

::example{id=sheet-nested}

### Non Dismissable

::example{id=sheet-non-dismissable}

### Placements

::example{id=sheet-placements}

### Professions Picker

::example{id=sheet-professions-picker}

### Scrollable Content

Dragging an open sheet past fully shown rubber-bands and springs back; the surface stays attached to its edge (its background extends past the edge, no gap). A detached sheet has no such extension.

A scrollable `Sheet.Body` scrolls with wheel and touch; mouse drags still start from the handle and header. Touch drags never start inside a scrollable body (the browser pans it).

::example{id=sheet-scrollable-content}

### Slack Message Actions

::example{id=sheet-slack-message-actions}

### Snap Points

`snapPoints` takes fractions of the viewport (`0.4`) or CSS lengths (`"320px"`). The sheet rests on the active point (`activeSnapPoint`: a value or a two-way signal, `defaultActiveSnapPoint`, `onActiveSnapPointChange`); a release settles on the nearest point after the fling projection, and pressing the handle cycles the points (`preventCycle` turns that off).

::example{id=sheet-snap-points}

### Snap Points Custom Fade

`fadeFromIndex` picks the snap point from which the backdrop fades in (default: the last point).

::example{id=sheet-snap-points-custom-fade}

### Snap Points Sequential

::example{id=sheet-snap-points-sequential}

### With Form

::example{id=sheet-with-form}

### Resumability

Server-rendered closed (or open with `defaultOpen`). Nothing runs at load for a closed sheet; the gesture attaches when the dialog mounts (a server-rendered open sheet attaches it at load).

## Styling Reference

The component’s parts emit these additional `data-slot` values: `sheet-root`, `sheet-trigger`, `sheet-close`, `sheet-content`, `sheet-dialog`, `sheet-header`, `sheet-body`, `sheet-footer`, `sheet-heading`, `sheet-close-trigger`.

### CSS Classes

### Base & Variant Classes

| Class                                                  | Applied                               |
| ------------------------------------------------------ | ------------------------------------- |
| `sheet__backdrop`                                      | `Sheet.Backdrop`                      |
| `sheet__backdrop--opaque` / `--blur` / `--transparent` | backdrop `variant` (default `opaque`) |

### Content & Placement Classes

| Class                                                     | Applied                        |
| --------------------------------------------------------- | ------------------------------ |
| `sheet__content`                                          | `Sheet.Content`                |
| `sheet__content--bottom` / `--top` / `--left` / `--right` | `placement` (default `bottom`) |
| `sheet__content--detached`                                | `isDetached`                   |

### Dialog & Layout Classes

| Class                                                    | Applied        |
| -------------------------------------------------------- | -------------- |
| `sheet__dialog`                                          | `Sheet.Dialog` |
| `sheet__dialog--bottom` / `--top` / `--left` / `--right` | `placement`    |
| `sheet__dialog--detached`                                | `isDetached`   |
| `sheet__header` / `sheet__body` / `sheet__footer`        | layout parts   |

### Element Classes

| Class                                                      | Applied                                                |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `sheet__handle`                                            | `Sheet.Handle` (bar = `[data-slot=sheet-handle-bar]`)  |
| `sheet__heading`                                           | `Sheet.Heading`                                        |
| `sheet__trigger` / `sheet__close` / `sheet__close-trigger` | `Sheet.Trigger` / `Sheet.Close` / `Sheet.CloseTrigger` |

### Interactive States

| Attribute                                                            | Element                                | When                                 |
| -------------------------------------------------------------------- | -------------------------------------- | ------------------------------------ |
| `data-entering` / `data-exiting`                                     | content                                | enter / exit transition              |
| `data-sheet-dragging`                                                | backdrop, scaled wrapper, parent sheet | while dragging                       |
| `data-sheet-drawer`, `data-sheet-snap-points`, `data-sheet-detached` | dialog                                 | always / with snap points / detached |
| `data-sheet-nested-open`                                             | parent dialog                          | a nested sheet is open               |
| `data-sheet-scaled`                                                  | `[data-sheet-wrapper]`                 | `shouldScaleBackground` and open     |
| `data-sheet-modal="false"`                                           | content                                | `isModal={false}`                    |

### CSS Variables

| Variable                          | What                                                                      |
| --------------------------------- | ------------------------------------------------------------------------- |
| `--sheet-backdrop-opacity`        | backdrop colour strength (0–1), written while dragging and per snap point |
| `--initial-transform`             | first-render transform of a snap-point sheet                              |
| `--snap-point-height`             | height of the active snap point                                           |
| `--sheet-open-progress`           | 0–1 on `[data-sheet-wrapper]` (background scale)                          |
| `--sheet-nested-progress`         | 0–1 on the parent of a dragged nested sheet                               |
| `--sheet-radius` / `--sheet-ease` | corner radius / settle easing                                             |

### Keyframes

None: enter / exit are CSS transitions on `translate` and `opacity` (they compose with the inline drag `transform`); the drag settle runs on the cdk motion physics, and reduced motion jumps. The `blur` backdrop's `backdrop-filter` radius fades with it (0 → 12 px on enter, back to 0 on exit) and follows the drag with the backdrop colour (`--sheet-backdrop-opacity`); closing right after a drag still plays the exit fade.

## API Reference

See the [full module API](/api/rivetjs/ui/sheet/) for every named export and part prop type.

### Sheet

| Prop                                                                     | Type                                                        | Default     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- | ----------- |
| `isOpen` / `defaultOpen` / `onOpenChange`                                | `boolean \| Signal<boolean>` / `boolean` / `(open) => void` | — / `false` |
| `state`                                                                  | `useOverlayState()` value                                   | —           |
| `placement`                                                              | `"bottom" \| "top" \| "left" \| "right"`                    | `"bottom"`  |
| `isDismissable`                                                          | `boolean`                                                   | `true`      |
| `isDetached`                                                             | `boolean`                                                   | `false`     |
| `isModal`                                                                | `boolean`                                                   | `true`      |
| `isHandleOnly`                                                           | `boolean`                                                   | `false`     |
| `snapPoints`                                                             | `(number \| string)[]`                                      | —           |
| `activeSnapPoint` / `defaultActiveSnapPoint` / `onActiveSnapPointChange` | snap point (value, Signal, accessor)                        | first point |
| `fadeFromIndex`                                                          | `number`                                                    | last point  |
| `snapToSequentialPoint`                                                  | `boolean`                                                   | `false`     |
| `closeThreshold`                                                         | `number` (fraction of the size)                             | `0.25`      |
| `shouldScaleBackground`                                                  | `boolean`                                                   | `false`     |
| `shouldAutoFocus`                                                        | `boolean`                                                   | `false`     |
| `onDrag` / `onRelease` / `onAnimationEnd` / `onClose`                    | callbacks                                                   | —           |

### Sheet.Trigger

A cdk `Button` that opens the sheet (any first pressable child works too).

### Sheet.Close

A cdk `Button` in the dialog's `close` slot.

### Sheet.Backdrop

`variant`: `"opaque" | "blur" | "transparent"` (default `"opaque"`). Dismiss options come from the root.

### Sheet.Content

The overlay container (`data-placement`, `data-sheet-detached`).

### Sheet.Dialog

The `dialog` element; carries the gesture. `aria-label` when there is no heading.

### Sheet.Header

### Sheet.Heading

The dialog title (`slot="title"`, names the dialog).

### Sheet.Body

### Sheet.Footer

### Sheet.Handle

`preventCycle` (default `false`): pressing the handle cycles the snap points (past the last: closes when dismissable).

### Sheet.CloseTrigger

The ui `CloseButton` in the `close` slot (CloseButton props).

### Sheet.NestedRoot

A `Sheet` root that marks itself as nested in the surrounding sheet.

::api{symbol="@rivetjs/ui/sheet#SheetRootProps"}

## Accessibility

the dialog is a modal `dialog` (focus trapped, page inert and scroll locked) unless `isModal={false}`. Give it a `Sheet.Heading` or an `aria-label`. Drag is a pointer extra: Escape, the backdrop and close buttons always work, and `prefers-reduced-motion` turns the settle animation into a jump.

## Related Components

- [Drawer](/components/drawer/)
- [Modal](/components/modal/)
- [Popover](/components/popover/)
