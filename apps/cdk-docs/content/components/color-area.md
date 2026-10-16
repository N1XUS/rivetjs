---
title: ColorArea
description: ColorArea from @rivetjs/cdk picks two channels of a color (e.g. saturation and brightness) by dragging a thumb or with the arrow keys.
template: guide
status: experimental
related: [components/color-slider, components/color-wheel, components/color-picker, components/color-field]
---

`ColorArea` lets users adjust two channels of a color on a 2D gradient. The thumb (`ColorThumb`) drags with the pointer; each axis is a hidden `<input type="range">`, so arrow keys, Page keys and Home / End work and screen readers announce a "2D slider".

::example{id=color-area-basic}

## Anatomy

```html
<div role="group" class="rv-ColorArea" style="background: …gradients…">
  <div class="rv-ColorThumb" style="left: …; top: …; background-color: …">
    <input type="range" aria-roledescription="2D slider" … />  <!-- x channel -->
    <input type="range" aria-roledescription="2D slider" … />  <!-- y channel -->
  </div>
</div>
```

| Part | |
| --- | --- |
| `ColorArea` | the gradient container (`role="group"`); press anywhere to move the thumb there |
| `ColorThumb` (`@rivetjs/cdk/color-thumb`) | the draggable thumb; holds the two visually hidden range inputs |

## Import

```ts
import { ColorArea } from "@rivetjs/cdk/color-area";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string \| Color \| Signal<string \| Color> \| () => string \| Color` | none | Controlled; a Signal is written back. |
| `defaultValue` | `string \| Color` | `"#ffffff"` (upstream default) | Uncontrolled. |
| `colorSpace` | `"rgb" \| "hsl" \| "hsb"` | the value's space | |
| `xChannel`, `yChannel` | `ColorChannel` | the space's 2nd / 3rd channel | e.g. `"saturation"`, `"brightness"`, `"red"`. |
| `isDisabled` | `boolean` | `false` | |
| `xName`, `yName`, `form` | `string` | none | Names of the hidden inputs for form submission. |
| `id`, `slot` | `string` | | |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | | |
| `class` | `string \| (rp) => string` | `rv-ColorArea` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ColorArea`; see [Render](#render). |
| `style` | `object \| (rp) => object` | | Merged over the gradient (`defaultStyle`). |
| `children` | content or `(rp) => content` | | Usually a `<ColorThumb>`. |
| `ref` | `ref()` / callback | | |
| global DOM props | `GlobalDOMAttributes` | | On the root `<div>`. |

### Events

| Event | Type | |
| --- | --- | --- |
| `onChange` | `(color: Color) => void` | on every change (drag, key) |
| `onChangeEnd` | `(color: Color) => void` | when a drag or key press ends |

### Render props

| Render prop | Type | Selector |
| --- | --- | --- |
| `isDisabled` | `() => boolean` | `[data-disabled]` |
| `state` | `ColorAreaState` (`@rivetjs/cdk/color`) | |

`ColorThumb` render props: `color()`, `isDragging()` `[data-dragging]`, `isHovered()` `[data-hovered]`, `isFocused()` `[data-focused]`, `isFocusVisible()` `[data-focus-visible]`, `isDisabled()` `[data-disabled]`.

## Channels, events and disabled

::example{id=color-area-events}

## DOM events and attributes

Global DOM events and attributes land on the root `<div>`; the component owns `onPointerDown` (yours runs after it).

::example{id=color-dom-events}

## Styling

| Selector | When |
| --- | --- |
| `.rv-ColorArea` | root (unless `class` is passed) |
| `.rv-ColorThumb` | thumb |
| `[data-disabled]` | disabled |
| `.rv-ColorThumb[data-dragging]`, `[data-focus-visible]`, `[data-hovered]` | thumb states |

The gradient, thumb position and the hidden inputs' visually-hidden styles are inline styles set by the component; give the area a size and the thumb a look. Tailwind: the first example. Plain CSS:

::example{id=color-area-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ColorArea` (`<div>`), `ColorThumb` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<ColorArea render={(props) => <div {...(props as {})} />}>…</ColorArea>
```

## Accessibility

- Two `<input type="range">` with `aria-roledescription="2D slider"`; `aria-valuetext` names both channel values and the color name.
- Only one input is in the tab order; keys switch the active axis (Left / Right → x, Up / Down → y).

| Key | |
| --- | --- |
| :kbd[ArrowLeft] / :kbd[ArrowRight] | x channel by one step |
| :kbd[ArrowUp] / :kbd[ArrowDown] | y channel by one step |
| :kbd[PageUp] / :kbd[PageDown] | y channel by a page step |
| :kbd[Shift] + arrows | x / y by a page step |
| :kbd[Home] / :kbd[End] | x channel by a page step |

## Resumability

- Server-rendered: gradients, thumb position, hidden inputs and labels are in the HTML; no component code runs until the first interaction.
- Keys and drags work on a resumed page (handlers are resumable free functions over plain signal state; drag state is JSON).
- Pass a two-way `Signal` for `value` and keep **strings** in it (`signal<string | Color>("#3366cc")`): a `Color` instance in a signal is not serializable. Callbacks (`onChange`, `onChangeEnd`) must be inline arrows or local consts.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ColorArea`, `ColorAreaContext`, `ColorAreaStateContext` | RAC `ColorArea`, contexts |
| `ColorThumb` | RAC `ColorThumb` |
| `colorAreaProps` + `colorArea*` handlers (`@rivetjs/cdk/color-area/behaviour`) | react-aria `useColorArea`, `useColorAreaGradient` |
| `createColorAreaState` (`@rivetjs/cdk/color`) | react-stately `useColorAreaState` |

Deviations: `className` → `class`; render props are accessors; hook results are attribute bags + free handler functions.

