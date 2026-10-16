---
title: Slider
description: Slider from @rivetjs/cdk picks a value or a range; thumbs are native range inputs with keys, pointer drag, track clicks, formatting and RTL.
template: guide
status: experimental
related: [components/number-field, components/label, foundations/i18n, foundations/interactions]
---

`Slider` lets the user pick a number, or a range with two or more thumbs, between a minimum and a maximum. Each `SliderThumb` wraps a visually hidden `<input type="range">`, so keyboard, screen readers and form submission all work natively. Pointer drags on a thumb and clicks or drags on the track are added on top. `SliderOutput` shows the formatted value.

::example{id=slider-basic}

## Anatomy

```html
<div role="group" class="rv-Slider" aria-labelledby="l1" data-orientation="horizontal">
  <label id="l1" for="s1-0" class="rv-Label">Volume</label>
  <output for="s1-0" aria-live="off" class="rv-SliderOutput">30</output>
  <div class="rv-SliderTrack" style="position:relative;touch-action:none">
    <div class="rv-SliderFill" style="position:absolute;inset-inline-start:0%;width:30%"></div>
    <div class="rv-SliderThumb" style="position:absolute;left:30%;transform:translate(-50%, -50%)">
      <div style="/* visually hidden */"><input id="s1-0" type="range" min="0" max="100" step="1" value="30" aria-labelledby="l1" /></div>
    </div>
  </div>
</div>
```

| Part | |
| --- | --- |
| `Slider` | `role="group"` root; owns the state and provides it to the parts |
| `Label` (`@rivetjs/cdk/label`) | optional; labels the group and every thumb input, and a click on it focuses the first thumb |
| `SliderOutput` | `<output>` with the formatted value (`$200 – $600` for a range) |
| `SliderTrack` | the track; a click or drag moves the closest thumb |
| `SliderFill` | Rivet extra: the filled part of the track (start to the value, or between the first and last thumbs) |
| `SliderThumb` | one per value (`index`); holds the hidden range input |

## Import

```ts
import { Slider, SliderOutput, SliderTrack, SliderFill, SliderThumb } from "@rivetjs/cdk/slider";
import { Label } from "@rivetjs/cdk/label";
```

## Props

### Slider

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `T \| Signal<T>` (`T` = `number \| number[]`) | none | A signal is two-way; a plain value is controlled (only `onChange` fires). |
| `defaultValue` | `T` | `minValue` | Uncontrolled start value. An array gives one thumb per entry. |
| `onChange` / `onChangeEnd` | `(value: T) => void` | none | `onChangeEnd` fires when a drag or key press ends. |
| `minValue` / `maxValue` | `number` | `0` / `100` | |
| `step` | `number` | `1` | Values snap to `minValue + n * step`. |
| `snap` | `"release" \| "drag"` | `"release"` | When a dragged thumb snaps to a step. `"release"` lets the thumb follow the pointer and animates it to the closest step on release. `"drag"` is the React Aria behaviour. See [Snapping](#snapping). |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | |
| `isDisabled` | `boolean` | `false` | |
| `formatOptions` | `Intl.NumberFormatOptions` | none | Formats the output and each thumb's `aria-valuetext` in the current locale. |
| `id`, `slot` | `string` | generated id | Thumb input ids are `<id>-<index>`. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | Needed when there is no `<Label>`. |
| `class` / `style` | value or `(rp) => value` | `rv-Slider` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `Slider`; see [Render](#render). |
| `children` | content or `(rp) => content` | none | |
| global DOM props | `GlobalDOMAttributes` | none | Forwarded to the root. |

### SliderThumb

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `index` | `number` | `0` | The value this thumb edits. |
| `isDisabled` | `boolean` | `false` | Disables this thumb only. |
| `name`, `form` | `string` | none | Submits the thumb's value with a form. |
| `inputRef` | `ref()` | none | The hidden `<input type="range">`. |
| `autoFocus`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details`, `aria-errormessage` | | | Label each thumb of a range (`aria-label="Minimum"`). |
| `onFocus`, `onBlur`, `onFocusChange`, `onKeyDown`, `onKeyUp`, `onHoverStart`, `onHoverEnd`, `onHoverChange` | handlers | none | |
| `class` / `style` / `children` | value or `(rp) => value` | `rv-SliderThumb` | The `style` render prop is merged over the positioning style. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `SliderThumb`; see [Render](#render). |

`SliderOutput`, `SliderTrack` and `SliderFill` take `class` / `style` / `children` (or render functions), `id` and global DOM props. Their default classes are `rv-SliderOutput`, `rv-SliderTrack` and `rv-SliderFill`. `SliderFill` also takes `offset`, the value the fill starts from for a single thumb (default `minValue`).

### Render props

| Part | Render props | Selectors |
| --- | --- | --- |
| `Slider`, `SliderOutput` | `orientation()`, `isDisabled()`, `state` | `[data-orientation]`, `[data-disabled]` |
| `SliderTrack` | same + `isHovered()` | `[data-hovered]` |
| `SliderThumb` | `isDragging()`, `isSnapping()`, `isHovered()`, `isFocused()`, `isFocusVisible()`, `isDisabled()`, `state` | `[data-dragging]`, `[data-snapping]`, `[data-hovered]`, `[data-focused]`, `[data-focus-visible]`, `[data-disabled]` |
| `SliderFill` | `orientation()`, `isDisabled()`, `isHovered()`, `state` | `[data-orientation]`, `[data-disabled]`, `[data-hovered]`, `[data-snapping]` |

## Ranges and formatting

Give `value` or `defaultValue` as an array and render one `SliderThumb` per entry. A thumb cannot pass its neighbours, and a track click moves the closest thumb. `formatOptions` accepts any `Intl.NumberFormat` option. The output then shows a formatted range, and each thumb announces its own value.

::example{id=slider-range}

## Snapping

With a `step`, the value always stays on a step. By default (`snap="release"`) the thumb and the fill still follow the pointer during a drag, on the thumb or on the track. On release the thumb animates to the closest step. The value, `aria-valuetext`, the output, the form value and `onChange` stay on steps the whole time, and `onChange` fires only when the stepped value changes. Keyboard and programmatic changes move straight from step to step.

`snap="drag"` makes the thumb jump from step to step during the drag, like React Aria.

::example{id=slider-snap}

- The release animation runs on [`@rivetjs/cdk/motion`](../foundations/motion.md) (embla's motion: the same feel as the carousel). It moves the thumb's `left` / `top` and the fill frame by frame. No CSS transition is set.
- Starting a new drag during the animation stops it.
- `[data-snapping]` is on the thumb and the fill while it runs (`isSnapping()` render prop on the thumb).
- With `prefers-reduced-motion: reduce` the thumb moves to the step without animating.
- The free position is client-only. The server renders the stepped positions.

This deviates from React Aria on purpose. Pass `snap="drag"` to get the upstream behaviour.

## State

`state` (render prop, or `SliderStateContext`) is the plain `SliderState` from `@rivetjs/cdk/slider/state`, with free functions such as `sliderValues(state)`, `getThumbPercent(state, i)` and `getFormattedValue(state)`. To position custom thumbs or fills, use `getThumbPositionPercent(state, i)`: it gives the free pointer position during a drag (`snap="release"`) and the stepped percent otherwise. `isThumbSnapping(state, i)` tells whether a thumb is animating to its step. A `children` function runs inside a binding, so read values there with `untrack(() => sliderValues(state))`; otherwise every change re-creates the thumbs.

## Styling

| Selector | When |
| --- | --- |
| `.rv-Slider`, `.rv-SliderOutput`, `.rv-SliderTrack`, `.rv-SliderFill`, `.rv-SliderThumb` | default classes |
| `[data-orientation="vertical"]` | vertical slider (root, output, track, fill) |
| `.rv-SliderThumb[data-dragging]` | thumb being dragged |
| `.rv-SliderThumb[data-snapping]`, `.rv-SliderFill[data-snapping]` | release animation to the closest step (`snap="release"`) |
| `.rv-SliderThumb[data-focus-visible]` | keyboard focus |

Behaviour styles are inline and do not depend on a class: the track is `position: relative; touch-action: none`, and the thumb is absolutely positioned (`left` / `top` percent, `translate(-50%, -50%)`). Give the track a size and set the thumb's other axis (`top: 50%` for horizontal sliders).

### Tailwind

The first two examples on this page use Tailwind utilities (`data-[dragging]:`, `data-[focus-visible]:`).

### Plain CSS

::example{id=slider-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Slider` (`<div>`), `SliderOutput` (`<output>`), `SliderTrack` (`<div>`), `SliderThumb` (`<div>`), `SliderFill` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<Slider render={(props) => <div {...(props as {})} />}>…</Slider>
```

## Accessibility

- Each thumb is a native `<input type="range">` (visually hidden) with `aria-valuetext`, `aria-orientation` and the label of the slider. Arrow keys step by `step`, Page Up / Page Down by a tenth of the range, and Home / End jump to the thumb's limits. RTL flips the horizontal keys.
- A click on the `Label` focuses the first thumb, matching native label behaviour.
- `SliderOutput` is `aria-live="off"`: screen readers read the value from the focused input instead.

## Resumability

- The server renders the values, the fill and the thumb positions. No script runs until the first interaction.
- The first pointerdown on a thumb or the track, or the first key press on a thumb, loads the handlers and the drag continues. Track and label clicks work on a resumed page.
- Pass a signal as `value` for two-way binding. A plain `value={v()}` is controlled: the thumbs follow it in place and the slider calls `onChange`.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Slider`, `SliderOutput`, `SliderTrack`, `SliderThumb`, `Slider*Context`, `SliderStateContext` | RAC `Slider` family |
| `SliderFill` | Rivet addition (RAC users draw the fill from render props) |
| `sliderProps`, `sliderThumbProps` + `sliderTrack*` / `sliderThumb*` handlers (`@rivetjs/cdk/slider/behaviour`) | react-aria `useSlider`, `useSliderThumb` |
| `createSliderState` (`@rivetjs/cdk/slider/state`) | react-stately `useSliderState` |

Deviations: `className` is `class`; render props are accessors; `value` takes a two-way signal; the state is plain data with free functions; stepped thumbs drag freely and animate to the step on release by default (`snap="release"`; `snap="drag"` is the RAC behaviour).

