---
title: Compare
description: "Headless before / after comparison from @rivetjs/cdk: two stacked layers and a draggable divider (an ARIA slider) that reveals one over the other."
template: guide
status: experimental
related: [components/slider, components/carousel, foundations/motion]
---

`Compare` stacks two versions of the same thing, such as a photo before and after an edit or a design in two themes, and splits them with a divider. The handle is an ARIA slider: drag it, press the arrow keys when it is focused, or, with `dragAnywhere`, press anywhere on the frame. The after layer is clipped by an inline `clip-path`, so the parts need no CSS to work.

Rivet addition: React Aria Components and Angular CDK have no compare slider. The behaviour is composed from cdk primitives: `controllable` state, the text-selection lock and focus modality of the interactions layer, the locale direction, and the house motion ([Motion](../foundations/motion.md)) for animated settles. `@rivetjs/ui/compare` is the HeroUI-styled version.

::example{id=compare-basic}

## Anatomy

```html
<div class="rv-Compare" data-rv-compare data-orientation="horizontal"
     style="position:relative;overflow:hidden;--rv-compare-position:50%">
  <div class="rv-CompareBefore" data-rv-compare-before data-orientation="horizontal">…</div>
  <div class="rv-CompareAfter" data-rv-compare-after data-orientation="horizontal"
       style="position:absolute;inset:0;clip-path:inset(0 0 0 50%)">…</div>
  <div class="rv-CompareHandle" role="slider" tabindex="0" aria-label="Comparison position"
       aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-valuetext="50%"
       data-rv-compare-handle style="position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);touch-action:none">
    <span class="rv-CompareDivider" aria-hidden="true" data-rv-compare-divider></span>
  </div>
</div>
```

| Part | Element | Default class | Attributes |
| --- | --- | --- | --- |
| `Compare` | `div` | `rv-Compare` | `data-rv-compare`, `data-orientation`, `data-dragging`, `data-moving` (a settle is running), `data-disabled`; inline `position: relative`, `overflow: hidden`, `--rv-compare-position` (`touch-action: pan-y` / `pan-x` with `dragAnywhere`) |
| `CompareBefore` | `div` | `rv-CompareBefore` | `data-rv-compare-before`, `data-orientation`. In the flow: it sizes the frame. |
| `CompareAfter` | `div` | `rv-CompareAfter` | `data-rv-compare-after`, `data-orientation`; inline `position: absolute; inset: 0` + `clip-path: inset(…)` |
| `CompareHandle` | `div[role=slider]` | `rv-CompareHandle` | `aria-valuenow` / `-valuetext` / `-orientation` / `-disabled`, `data-rv-compare-handle`, `data-dragging`, `data-disabled`, `data-hovered`, `data-focus-visible`; inline position at the divider, `touch-action: none` |
| `CompareDivider` | `span[aria-hidden]` | `rv-CompareDivider` | `data-rv-compare-divider`, `data-orientation`. Optional decorative line inside the handle. |

The handle has no size of its own: give it a hit width (horizontal) or height (vertical) and draw the line and grip inside it.

## Import

```tsx
import { Compare, CompareAfter, CompareBefore, CompareDivider, CompareHandle } from "@rivetjs/cdk/compare";
```

The state and handlers (`createCompareState`, `compareKeyDown`, `comparePointerDown`, `compareSetValue`, `compareDispose`, …) are also exported from `@rivetjs/cdk/compare/behaviour`. `CompareContext` holds the state of the nearest `Compare`, and `useComparePosition()` returns an accessor of the rendered position.

## Props

### Compare

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `number \| Signal<number> \| (() => number)` | — | Before share in percent (0–100), from the start edge. Controlled: a Signal is two-way, an accessor is read live. A value changed from outside moves the divider at once. |
| `defaultValue` | `number` | `50` | Uncontrolled start value. |
| `onChange` | `(value: number) => void` | — | Every pointer move (continuous, 2 decimals) and every key. |
| `onChangeEnd` | `(value: number) => void` | — | Pointer release, and each key that moves the divider. |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Vertical: the divider runs across, the before layer is on top. Read once. |
| `isDisabled` | `boolean` | `false` | No pointer or keyboard input; the handle leaves the tab order (`aria-disabled`). Live prop. |
| `step` | `number` | `1` | Arrow key step. Keyed values snap to it. |
| `pageStep` | `number` | `10` | PageUp / PageDown / Shift+Arrow step. |
| `dragAnywhere` | `boolean` | `false` | A press on the frame jumps the divider there (animated) and keeps following the pointer. |
| `animation` | `boolean \| { duration?: number; friction?: number }` | `true` | Settle for keys and frame presses (embla units, defaults 20 / 0.68); `false` jumps. |
| `dir` | `"ltr" \| "rtl"` | the locale's | Horizontal start edge. |
| `state` | `CompareState` | — | A state from `createCompareState(options)`; the options above are then ignored. |
| `id`, `class`, `style`, DOM attributes and events | | `rv-Compare` | `style` is merged under the behaviour styles. |

### CompareHandle

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `aria-label` | `string` | `"Comparison position"` | Not set when `aria-labelledby` is given. Say what is compared. |
| `aria-labelledby` / `aria-describedby` | `string` | — | |
| `aria-valuetext` | `string \| ((value: number) => string)` | percent (`Intl.NumberFormat` of the locale) | |
| `onKeyDown` | `(event: KeyboardEvent) => void` | — | Runs after the handle's own key handling. |
| `children` | `Content` | — | The handle's look (divider line, grip). |
| `id`, `class`, `style`, DOM attributes and events | | `rv-CompareHandle` | |

`CompareBefore`, `CompareAfter` and `CompareDivider` take `id`, `class`, `style`, DOM attributes and `children` (not the divider).

### Events

| Event | When |
| --- | --- |
| `onChange(value)` | A pointer move while dragging, a key, a frame press (`dragAnywhere`). |
| `onChangeEnd(value)` | Pointer release (once per drag), each key that changed the value. A key that does not move the divider (Home at 0) calls neither. |

## Vertical, plain CSS

::example{id=compare-vertical-css}

`orientation="vertical"`: the after layer is revealed from the top (`clip-path: inset(p% 0 0 0)`) and the keys follow the divider spatially. ArrowDown / ArrowRight / PageDown move it down (the value grows downward). The example styles the default `rv-*` classes with plain CSS.

## Controlled, drag anywhere

::example{id=compare-controlled}

- A two-way `Signal` is written by drags and keys, and the buttons write it from outside.
- `dragAnywhere` turns the whole frame into a drag surface. A press jumps the divider there through the motion, and moving the pointer retargets the settle so the drag stays continuous.
- `onChangeEnd` fires on release.

## Motion

- A drag is 1:1. A press on the handle grabs it where it was hit (the grab offset is kept, so the divider does not jump) and follows the pointer through window `pointermove` / `pointerup` / `pointercancel` listeners, which exist only while dragging. Text selection is locked while dragging.
- Keys and frame presses commit the value at once (`aria-valuenow`, `onChange`) and animate the rendered position with `Motion1D`. `data-moving` is set until the settle ends; `useComparePosition()` reads the animated value.
- `prefers-reduced-motion: reduce` and `animation={false}` jump.

## DOM events and attributes

- `Compare` owns `pointerdown` (surface drags with `dragAnywhere`); your `onPointerDown` runs after it.
- `CompareHandle` owns `pointerdown`, `pointerover` (hover state), `focusin` (focus-visible) and `keydown`; your handlers run after the handle's.
- Global DOM attributes (`id`, `data-*`, `aria-*`, events) land on the element of each part. `on*Capture` handlers work on resumed pages too, the first event included.

## Styling

| Selector | When |
| --- | --- |
| `.rv-Compare[data-orientation="vertical"]` | Vertical comparison |
| `[data-dragging]` (root, handle) | A drag is in progress |
| `.rv-Compare[data-moving]` | An animated settle is running |
| `[data-disabled]` (root, handle) | `isDisabled` |
| `.rv-CompareHandle[data-focus-visible]` | Keyboard focus |
| `.rv-CompareHandle[data-hovered]` | Pointer over the handle |
| `var(--rv-compare-position)` | Current position (`50%`), for your own CSS |

- Do not override the inline `clip-path` of the after layer or the inline position of the handle: that is the divider position.
- Size the frame (or let the before layer size it), give the handle a hit width or height, and draw the line with `CompareDivider` or your own element.
- Media inside the layers: `display: block; width: 100%; height: 100%; object-fit: cover`, `draggable={false}` on images (the browser's image drag would start first).

## Accessibility

- The handle is a `slider` with `aria-valuemin` 0, `aria-valuemax` 100, `aria-valuenow` (rounded) and `aria-valuetext` (percent), and `aria-orientation`. Name it with `aria-label` or `aria-labelledby`.
- The layers keep their content's semantics (an image's `alt`); the divider is `aria-hidden`.

| Key | Action |
| --- | --- |
| :kbd[ArrowRight] / :kbd[ArrowUp] | Increase by `step` (RTL: :kbd[ArrowLeft] / :kbd[ArrowUp]) |
| :kbd[ArrowLeft] / :kbd[ArrowDown] | Decrease by `step` (RTL: :kbd[ArrowRight] / :kbd[ArrowDown]) |
| :kbd[Shift] + arrow, :kbd[PageUp] / :kbd[PageDown] | ± `pageStep` |
| :kbd[Home] / :kbd[End] | 0 / 100 |

Vertical: :kbd[ArrowDown] / :kbd[ArrowRight] / :kbd[PageDown] increase (move the divider down), :kbd[ArrowUp] / :kbd[ArrowLeft] / :kbd[PageUp] decrease.

## Resumability

- The server renders the layers, the clip and the handle at the start value, so nothing shifts on load. A resumed page runs no compare code before the first pointer or key event. Its code is fetched at low priority when the browser is idle after the load (or on intent: pointer rest, focus, pointer down), so the first drag does not wait for the network; see [preloading](site:docs/guides/performance/preloading/).
- State is plain signals. The drag listeners and the motion live in a module map created by the first interaction. No unmount hook is registered (an effect would boot the page at load). A drag whose root left the document ends on its next move, and `compareDispose(state)` stops a running drag or settle by hand.

## Upstream

None: Rivet-authored. Positioning is absolute (the pointer position maps to the value), not React Aria's delta-based `useMove`, so a frame press can jump and a long drag never drifts. Not supported: a `render` prop on the parts, an animated follow of a value changed from outside (it jumps), and multi-pointer gestures.
