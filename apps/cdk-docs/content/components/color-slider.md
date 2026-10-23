---
title: ColorSlider
description: ColorSlider from @rivetjs/cdk adjusts one channel of a color (hue, alpha, lightness …) on a gradient track with a thumb, keys and a hidden range input.
template: guide
status: experimental
related: [components/color-area, components/color-wheel, components/color-picker, components/slider]
---

`ColorSlider` adjusts a single channel of a color. It is built on the [Slider](slider.md) parts: `SliderTrack` (the gradient), `SliderOutput` (the formatted channel value) and a `Label` (defaults to the channel name), with a `ColorThumb` inside the track.

::example{id=color-slider-basic}

## Anatomy

```html
<div class="rv-ColorSlider" data-orientation="horizontal">
  <label class="rv-Label">Hue</label>
  <output class="rv-SliderOutput">0°</output>
  <div class="rv-SliderTrack" style="background: linear-gradient(…)">
    <div class="rv-ColorThumb"><input type="range" aria-valuetext="0°, red" /></div>
  </div>
</div>
```

## Import

```ts
import { ColorSlider } from "@rivetjs/cdk/color-slider";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";
import { Label } from "@rivetjs/cdk/label";
import { SliderOutput, SliderTrack } from "@rivetjs/cdk/slider";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `channel` | `ColorChannel` | required | `"hue"`, `"saturation"`, `"lightness"`, `"brightness"`, `"red"`, `"green"`, `"blue"`, `"alpha"` |
| `value` | `string \| Color \| Signal \| accessor` | none | Controlled / two-way. |
| `defaultValue` | `string \| Color` | | One of `value` / `defaultValue` is required. |
| `colorSpace` | `"rgb" \| "hsl" \| "hsb"` | the value's space | Space the channel is read in. |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | |
| `isDisabled` | `boolean` | `false` | |
| `snap` | `"release" \| "drag"` | `"release"` | As [Slider](slider.md#snapping): the thumb follows the pointer and animates to the closest channel step on release; `"drag"` is the React Aria behaviour. The color stays stepped either way. |
| `name`, `form` | `string` | | Hidden input form submission. |
| `id`, `slot`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | | Without a `<Label>`, the channel name labels the slider. |
| `class` | `string \| (rp) => string` | `rv-ColorSlider` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ColorSlider`; see [Render](#render). |
| `style`, `children`, `ref`, global DOM props | | | |

### Events

| Event | Type | |
| --- | --- | --- |
| `onChange` | `(color: Color) => void` | every change |
| `onChangeEnd` | `(color: Color) => void` | drag / key end |

### Render props

| Render prop | Type | Selector |
| --- | --- | --- |
| `orientation` | `() => Orientation` | `[data-orientation]` |
| `isDisabled` | `() => boolean` | `[data-disabled]` |
| `state` | `ColorSliderState` | |

## Channels, orientation, disabled

::example{id=color-slider-channels}

## Styling

| Selector | When |
| --- | --- |
| `.rv-ColorSlider` | root |
| `.rv-SliderTrack` | track (gradient inline) |
| `.rv-SliderOutput`, `.rv-Label` | parts |
| `.rv-ColorThumb[data-dragging]`, `[data-focus-visible]` | thumb states |
| `.rv-ColorThumb[data-snapping]` | release animation to the closest step (`snap="release"`; `isSnapping()` render prop) |
| `[data-orientation="vertical"]` | vertical |

::example{id=color-slider-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ColorSlider` (`<div>`), `ColorThumb` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<ColorSlider render={(props) => <div {...(props as {})} />}>…</ColorSlider>
```

## Accessibility

- `<input type="range">` with `aria-valuetext` = formatted channel value (+ color name for hue).
- Label click focuses the thumb.

| Key | |
| --- | --- |
| :kbd[ArrowLeft] / :kbd[ArrowRight] / :kbd[ArrowUp] / :kbd[ArrowDown] | one step |
| :kbd[PageUp] / :kbd[PageDown] | page step (hue: 15°) |
| :kbd[Home] / :kbd[End] | min / max |

## Resumability

- Server-rendered: gradients, thumb position, hidden inputs and labels are in the HTML; no component code runs until the first interaction.
- Keys and drags work on a resumed page (handlers are resumable free functions over plain signal state; drag state is JSON).
- Pass a two-way `Signal` for `value` and keep **strings** in it (`signal<string | Color>("#3366cc")`): a `Color` instance in a signal is not written into the page, so the browser starts that signal again from its initial value.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ColorSlider`, `ColorSliderContext`, `ColorSliderStateContext` | RAC `ColorSlider` |
| `colorSliderProps` + `colorSlider*` handlers (`@rivetjs/cdk/color-slider/behaviour`) | react-aria `useColorSlider` |
| `createColorSliderState` | react-stately `useColorSliderState` |

Deviations: `className` → `class`; render props are accessors; the thumb drags freely and animates to the step on release (`snap`, as Slider).

