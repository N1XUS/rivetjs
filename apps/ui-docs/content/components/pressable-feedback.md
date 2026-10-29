---
title: PressableFeedback
description: "A press layer that adds highlight, ripple, hold-to-confirm and progress feedback to any pressable element."
template: reference
status: experimental
related: [components/button, components/item-card]
---

`PressableFeedback` is a button (the cdk `Button`: pointer, touch, keyboard and screen reader presses) with optional feedback layers inside it. Each layer reacts to the root's press events; the visuals are CSS. Nothing loads before the first press. `.Highlight` and `.Ripple` also work on their own inside another pressable, such as a ui `Button` (see [Standalone Ripple](#standalone-ripple)).

## Usage

```tsx
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";
```

::example{id=pressable-feedback-basic}

## Anatomy

```tsx
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export default function Anatomy() {
  return (
    <PressableFeedback>
      <PressableFeedback.Highlight />
      <PressableFeedback.Ripple />
      <PressableFeedback.HoldConfirm>Confirmed</PressableFeedback.HoldConfirm>
      <PressableFeedback.ProgressFeedback>Done</PressableFeedback.ProgressFeedback>
      Label
    </PressableFeedback>
  );
}
```

Additional exported parts: `PressableFeedback.Root`.

## Examples

### Comparison

::example{id=pressable-feedback-comparison}

### Disabled

::example{id=pressable-feedback-disabled}

### Hold Confirm Callback

Hold with the pointer, or hold Space / Enter. `onComplete` fires when the hold reaches `duration`; releasing early snaps back over `releaseDuration`.

::example{id=pressable-feedback-hold-confirm}

### Hold Confirm Durations

`duration` sets the hold time until confirmed, `releaseDuration` the snap-back after an early release.

::example{id=pressable-feedback-hold-confirm-durations}

### Hold Confirm Sweep

`sweep` picks the edge the reveal moves toward: `right` (default), `left`, `down` or `up`.

::example{id=pressable-feedback-sweep}

### Pressable Cards

::example{id=pressable-feedback-cards}

### Progress Feedback Callback

A press starts the progress (no hold needed). `onComplete` fires after `duration`; with `autoReset` (default) the overlay resets after `resetDelay` and `onReset` fires.

::example{id=pressable-feedback-progress}

### Progress Feedback Durations

`duration` sets the progress time, `releaseDuration` the snap-back once it resets.

::example{id=pressable-feedback-progress-durations}

### Progress Feedback No Reset

`autoReset={false}` keeps the completed state.

::example{id=pressable-feedback-no-reset}

### Progress Feedback Sweep

::example{id=pressable-feedback-progress-sweep}

### Standalone Highlight

::example{id=pressable-feedback-standalone}

### Standalone Ripple

Outside a `PressableFeedback` root, `.Ripple` follows its parent element's own press: a pointer or touch press ripples from the press point, Space / Enter on the parent from the centre, and Space on a native checkbox or radio inside it from the centre too (selectable cards keep focus on their hidden input: [CheckboxButtonGroup](checkbox-button-group.md#with-ripple), [RadioButtonGroup](radio-button-group.md#with-ripple)); a parent that is `:disabled`, `aria-disabled="true"` or `data-disabled="true"` gets none. The parent needs a position (a ui `Button` has one) and its own corner radius (the ripple inherits it). On a resumed page the first press loads the ripple and still shows it. See also [Button, Adding Ripple Effect](button.md#adding-ripple-effect).

::example{id=pressable-feedback-standalone-ripple}

### With Highlight

::example{id=pressable-feedback-with-highlight}

### With Hold Confirm

Layers combine: Highlight and Ripple under a HoldConfirm overlay. `resetOnComplete={false}` keeps the overlay after a completed hold.

::example{id=pressable-feedback-with-hold-confirm}

### With Progress Feedback

::example{id=pressable-feedback-with-progress}

### With Ripple

::example{id=pressable-feedback-with-ripple}

## Styling Reference

### CSS Classes

- `.pressable-feedback` - The pressable root (relative, overflow hidden).
- `.pressable-feedback__highlight` - Opacity overlay on hover and press.
- `.pressable-feedback__ripple` - Ripple container; `.pressable-feedback__ripple-surface` draws the hover (`::before`) and press (`::after`) layers.
- `.pressable-feedback__hold-confirm` - Clip-path hold-to-reveal overlay.
- `.pressable-feedback__progress-feedback` - Clip-path press-to-progress overlay.

### Data Attributes

- `[data-hovered="true"]`, `[data-pressed="true"]`, `[data-focus-visible="true"]`, `[data-disabled="true"]` on the root.
- `[data-pressed="true"]` / `[data-released="true"]` on the ripple.
- `[data-sweep="right|left|down|up"]` on hold confirm and progress feedback.
- `[data-holding="true"]` on hold confirm while held; `[data-progressing="true"]` on progress feedback while running; `[data-complete="true"]` on both once complete.

### CSS Variables

- `--pressable-feedback-highlight-color`, `--pressable-feedback-highlight-opacity` (0.08), `--pressable-feedback-highlight-pressed-opacity` (0.12).
- `--pressable-feedback-ripple-color`, `--pressable-feedback-ripple-hover-opacity` (0.08), `--pressable-feedback-ripple-pressed-opacity` (0.12).
- `--pressable-feedback-hold-confirm-duration` (2000ms), `--pressable-feedback-hold-confirm-release-duration` (200ms).
- `--pressable-feedback-progress-feedback-duration` (2000ms), `--pressable-feedback-progress-feedback-release-duration` (300ms).

## API Reference

See the [full module API](/api/rivetjs/ui/pressable-feedback/) for every named export and part prop type.

### PressableFeedback

The cdk `Button`: `isDisabled`, `onPress`, `onPressStart`, `onPressEnd`, `class` (string or a function of the render props), `render`, and native button attributes.

### PressableFeedback.Highlight

A `span` overlay; no props beyond `span` attributes and `class`.

### PressableFeedback.Ripple

| Prop                   | Type      | Default | Description                           |
| ---------------------- | --------- | ------- | ------------------------------------- |
| `duration`             | `number`  | `150`   | Grow animation (ms)                   |
| `hoverOpacity`         | `number`  | `0.08`  | Hover layer opacity                   |
| `pressedOpacity`       | `number`  | `0.12`  | Ripple opacity                        |
| `minimumPressDuration` | `number`  | `225`   | Minimum time the ripple stays pressed |
| `isDisabled`           | `boolean` | -       | No ripple                             |

### PressableFeedback.HoldConfirm

| Prop              | Type                                  | Default   | Description                         |
| ----------------- | ------------------------------------- | --------- | ----------------------------------- |
| `duration`        | `number`                              | `2000`    | Hold time (ms) until confirmed      |
| `releaseDuration` | `number`                              | `200`     | Snap-back time on release (ms)      |
| `sweep`           | `"right" \| "left" \| "down" \| "up"` | `"right"` | Edge the reveal moves toward        |
| `resetOnComplete` | `boolean`                             | `true`    | Reset when the completed press ends |
| `isDisabled`      | `boolean`                             | -         | No hold confirm                     |
| `onComplete`      | `() => void`                          | -         | The hold reached `duration`         |
| `children`        | `Content`                             | -         | Overlay content                     |

### PressableFeedback.ProgressFeedback

| Prop              | Type                                  | Default   | Description                        |
| ----------------- | ------------------------------------- | --------- | ---------------------------------- |
| `duration`        | `number`                              | `2000`    | Progress time (ms) until confirmed |
| `releaseDuration` | `number`                              | `300`     | Snap-back time on reset (ms)       |
| `sweep`           | `"right" \| "left" \| "down" \| "up"` | `"right"` | Edge the reveal moves toward       |
| `autoReset`       | `boolean`                             | `true`    | Reset after completing             |
| `resetDelay`      | `number`                              | `1500`    | Delay before the reset (ms)        |
| `isDisabled`      | `boolean`                             | -         | No progress                        |
| `onComplete`      | `() => void`                          | -         | The progress reached `duration`    |
| `onReset`         | `() => void`                          | -         | The overlay went back to idle      |
| `children`        | `Content`                             | -         | Overlay content                    |

## Accessibility

The root inherits the [Button](/components/button/) keyboard and disabled behavior. Feedback layers are hidden from assistive technology. Keep the action in the button’s accessible name; do not rely on ripple, hold or progress visuals to communicate a result.

## Related Components

- [Button](/components/button/)
- [ItemCard](/components/item-card/)
