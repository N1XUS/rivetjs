---
title: Compare
description: "A before / after comparison: two stacked layers (images or any content) and a draggable divider that reveals one over the other."
template: reference
status: experimental
related: [components/slider, components/carousel, components/lightbox]
---

`Compare` puts two versions of the same thing on top of each other, such as a photo before and after an edit or a card in the light and the dark theme, and splits them with a divider. Drag the round handle to move the split, press the arrow keys when it is focused, or, with `dragAnywhere`, press anywhere on the frame.

Accessibility: the handle is an ARIA `slider` (`aria-valuenow` 0–100, `aria-valuetext` "50%", `aria-orientation`) named "Comparison position" by default: give it an `aria-label` that says what is compared. Images keep their own `alt` text. The thumb and the divider line are decorative (`aria-hidden`).

## Usage

```tsx
import { Compare } from "@rivetjs/ui/compare";
```

::example{id=compare-basic}

- `Compare.Before` is in the flow and sizes the frame; `Compare.After` is stacked over it and clipped to the end side of the divider (inline `clip-path`). Direct `img` / `picture` / `video` children cover their layer (`object-fit: cover`); give the root a size or an aspect ratio.
- The value is the share of the before layer in percent, from the start edge (left, right in RTL, top when vertical). `defaultValue` (50) sets where the divider starts.
- A press on the handle grabs it where it was hit and follows the pointer 1:1. Keys and frame presses settle through the house motion (`@rivetjs/cdk/motion`); `animation={false}` and reduced motion jump.
- `Compare.Label` puts a badge in a corner of its layer: `placement="start"` in the before layer, `"end"` in the after layer, so each is clipped with its own layer.
- Resumable: nothing runs before the first pointer or key event. The root preloads its chunks once it is visible, so the first drag is not a network round trip.

## Vertical

::example{id=compare-vertical}

`orientation="vertical"` turns the divider horizontal: the before layer is on top. ArrowDown / ArrowRight / PageDown move the divider down (the value grows downward), and the default thumb icon turns to `ChevronsUpDown`. The end label sits in the bottom start corner.

## Custom Handle

::example{id=compare-custom-handle}

- Children of `Compare.Handle` replace the default `Compare.Divider` + `Compare.Thumb`. Use the parts for the line and the round button, or draw your own.
- `Compare.Thumb` children replace the default lucide grip (`ChevronsLeftRight`).
- `--compare-divider-color` / `--compare-divider-width` restyle the line; `--compare-handle-size` sizes the round thumb.
- `dragAnywhere` jumps the divider to a press on the frame (animated), then the drag follows the pointer. The root then sets `touch-action: pan-y` (`pan-x` when vertical), so a touch drag across the frame moves the divider and a vertical swipe still scrolls the page.

## Controlled

::example{id=compare-controlled}

- `value` takes a number, an accessor or a two-way `Signal<number>`. With a Signal, drags and keys write it back.
- `onChange` runs on every pointer move and every key; `onChangeEnd` runs once per release and per key.
- A value set from outside moves the divider at once (no animation).
- `step` (1) sets the arrow-key step and `pageStep` (10) sets the PageUp / PageDown / Shift+Arrow step. Keyed values snap to `step`; drags are continuous (2 decimals).

## Content

::example{id=compare-content}

Layers hold any content: here the same card renders with `data-theme="light"` in one layer and `data-theme="dark"` in the other. Keep both layers the same size, since the after layer covers the frame (`position: absolute; inset: 0`).

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.compare` - The frame (`overflow: hidden`, rounded, `bg-default`).
- `.compare__before` / `.compare__after` - The layers. Direct media children cover them.
- `.compare__handle` - The hit strip along the divider (44 px), the slider element. The cursor is `ew-resize` (`ns-resize` when vertical).
- `.compare__divider` - The line.
- `.compare__thumb` - The round surface button with the grip icon. It scales down while dragging and shows the focus ring when the handle has keyboard focus.
- `.compare__label` - A corner badge.

### CSS Variables

| Variable                  | Default                     | Description                                 |
| ------------------------- | --------------------------- | ------------------------------------------- |
| `--compare-divider-color` | `var(--white)`              | Divider line colour                         |
| `--compare-divider-width` | `2px`                       | Divider line thickness                      |
| `--compare-handle-size`   | `2.5rem`                    | Thumb diameter                              |
| `--compare-hit-size`      | `2.75rem`                   | Width of the hit strip around the line      |
| `--rv-compare-position`   | written by the cdk (`50%`)  | Current position, readable in your own CSS |

### Data Attributes

- `[data-slot]`: `compare`, `compare-before`, `compare-after`, `compare-handle`, `compare-divider`, `compare-thumb`, `compare-label`.
- Root: `[data-orientation]`, `[data-dragging]`, `[data-moving]` (a settle is running), `[data-disabled]`.
- Handle: `[data-dragging]`, `[data-disabled]`, `[data-hovered]`, `[data-focus-visible]`. Label: `[data-placement]`, `[data-orientation]`.

## API Reference

### Compare

| Prop           | Type                                                          | Default        | Description                                                            |
| -------------- | ------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------- |
| `value`        | `number` \| `() => number` \| `Signal<number>`                | -              | Before share in percent (controlled; a Signal is two-way)              |
| `defaultValue` | `number`                                                      | `50`           | Initial value (uncontrolled)                                           |
| `onChange`     | `(value: number) => void`                                     | -              | Every pointer move and key                                             |
| `onChangeEnd`  | `(value: number) => void`                                     | -              | Pointer release, each key                                              |
| `orientation`  | `"horizontal"` \| `"vertical"`                                | `"horizontal"` | Divider direction                                                      |
| `isDisabled`   | `boolean`                                                     | `false`        | No pointer or keyboard interaction (live prop)                         |
| `step`         | `number`                                                      | `1`            | Arrow key step                                                         |
| `pageStep`     | `number`                                                      | `10`           | PageUp / PageDown / Shift+Arrow step                                   |
| `dragAnywhere` | `boolean`                                                     | `false`        | A press on the frame jumps the divider there and drags                 |
| `animation`    | `boolean` \| `{ duration?: number; friction?: number }`       | `true`         | Settle for keys and frame presses (house motion); `false` jumps        |
| `dir`          | `"ltr"` \| `"rtl"`                                            | locale         | Writing direction (horizontal start edge)                              |
| `state`        | `CompareState`                                                | -              | A state from `createCompareState` (the options above are then ignored) |
| `class`        | `string`                                                      | -              | Additional CSS classes                                                 |

### Compare.Handle

| Prop               | Type                                       | Default                 | Description                                |
| ------------------ | ------------------------------------------ | ----------------------- | ------------------------------------------ |
| `aria-label`       | `string`                                   | `"Comparison position"` | Accessible name                            |
| `aria-labelledby`  | `string`                                   | -                       | Labelled by another element                |
| `aria-valuetext`   | `string` \| `(value: number) => string`    | percent of the locale   | Announced value                            |
| `children`         | `Content`                                  | Divider + Thumb         | Custom handle look                         |
| `class`            | `string`                                   | -                       | Additional CSS classes                     |

`Compare.Before` / `Compare.After` / `Compare.Divider` take `class`, `style` and DOM attributes. `Compare.Thumb` takes `class` and `children` (replaces the icon). `Compare.Label` takes `placement` (`"start"` \| `"end"`, default `"start"`), `class` and `children`.

### Keyboard

| Key                                   | Action                                         |
| ------------------------------------- | ---------------------------------------------- |
| :kbd[ArrowRight] / :kbd[ArrowUp]      | +`step` (RTL: :kbd[ArrowLeft] / :kbd[ArrowUp]) |
| :kbd[ArrowLeft] / :kbd[ArrowDown]     | −`step`                                        |
| :kbd[Shift] + arrow                   | ±`pageStep`                                    |
| :kbd[PageUp] / :kbd[PageDown]         | ±`pageStep`                                    |
| :kbd[Home] / :kbd[End]                | 0 / 100                                        |

Vertical: :kbd[ArrowDown] / :kbd[ArrowRight] / :kbd[PageDown] move the divider down (increase).

## Related Components

- [Slider](/components/slider/): Pick a value on a track.
- [Carousel](/components/carousel/): Swipe through slides.
- [Lightbox](/components/lightbox/): Full-screen image viewer.
