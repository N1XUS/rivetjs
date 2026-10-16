---
title: ColorWheel
description: ColorWheel from @rivetjs/cdk picks a hue on a circular track by dragging a thumb, pressing the track or with the arrow keys.
template: guide
status: experimental
related: [components/color-area, components/color-slider, components/color-picker]
---

`ColorWheel` adjusts the hue of a color on a ring. `ColorWheelTrack` draws the conic gradient (ring sized by `outerRadius` / `innerRadius`); `ColorThumb` is placed on the ring and holds a hidden `<input type="range">`.

::example{id=color-wheel-basic}

## Anatomy

```html
<div class="rv-ColorWheel" style="position: relative">
  <div class="rv-ColorWheelTrack" style="width: 200px; height: 200px; background: conic-gradient(…); clip-path: …"></div>
  <div class="rv-ColorThumb"><input type="range" aria-valuetext="0°, red" /></div>
</div>
```

## Import

```ts
import { ColorWheel, ColorWheelTrack } from "@rivetjs/cdk/color-wheel";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `outerRadius`, `innerRadius` | `number` | required | Ring geometry (px). |
| `value` | `string \| Color \| Signal \| accessor` | none | |
| `defaultValue` | `string \| Color` | `"hsl(0, 100%, 50%)"` | |
| `isDisabled` | `boolean` | `false` | |
| `name`, `form` | `string` | | Hidden input. |
| `id` | `string` | | Lands on the input (as upstream). |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details`, `aria-errormessage` | `string` | | Default label: "Hue". |
| `class` | `string \| (rp) => string` | `rv-ColorWheel` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ColorWheel`; see [Render](#render). |
| `style`, `children`, `ref`, `slot`, global DOM props | | | |

`ColorWheelTrack`: `class` (`rv-ColorWheelTrack`), `style`, `ref`, `slot`, global DOM props; render props as the wheel.

### Events

| Event | Type | |
| --- | --- | --- |
| `onChange` | `(color: Color) => void` | every change |
| `onChangeEnd` | `(color: Color) => void` | drag / key end |

### Render props

`isDisabled()` `[data-disabled]`, `state` (`ColorWheelState`).

## Styling, events, disabled

::example{id=color-wheel-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ColorWheel` (`<div>`), `ColorWheelTrack` (`<div>`), `ColorThumb` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<ColorWheel render={(props) => <div {...(props as {})} />}>…</ColorWheel>
```

## Accessibility

| Key | |
| --- | --- |
| :kbd[ArrowRight] / :kbd[ArrowUp] | hue + 1° |
| :kbd[ArrowLeft] / :kbd[ArrowDown] | hue − 1° |
| :kbd[PageUp] / :kbd[PageDown] | next / previous 15° step |

## Resumability

- Server-rendered: gradients, thumb position, hidden inputs and labels are in the HTML; no component code runs until the first interaction.
- Keys and drags work on a resumed page (handlers are resumable free functions over plain signal state; drag state is JSON).
- Pass a two-way `Signal` for `value` and keep **strings** in it (`signal<string | Color>("#3366cc")`): a `Color` instance in a signal is not serializable. Callbacks (`onChange`, `onChangeEnd`) must be inline arrows or local consts.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ColorWheel`, `ColorWheelTrack`, contexts | RAC `ColorWheel`, `ColorWheelTrack` |
| `colorWheelProps` + handlers (`@rivetjs/cdk/color-wheel/behaviour`) | react-aria `useColorWheel` |
| `createColorWheelState` | react-stately `useColorWheelState` |

