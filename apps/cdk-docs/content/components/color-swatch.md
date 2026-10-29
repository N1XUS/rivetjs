---
title: ColorSwatch
description: ColorSwatch from @rivetjs/cdk previews a color as role img with a localized color name, over a checkerboard for transparent colors.
template: guide
status: experimental
related: [components/color-swatch-picker, components/color-picker]
---

`ColorSwatch` shows a color. It renders `role="img"` with `aria-roledescription="color swatch"` and a localized description of the color (`"vibrant red"`, `"…, 50% transparent"`) as its label.

::example{id=color-swatch-basic}

## Anatomy

```html
<div role="img" class="rv-ColorSwatch" aria-roledescription="color swatch" aria-label="vibrant red" style="background: …"></div>
```

## Import

```ts
import { ColorSwatch } from "@rivetjs/cdk/color-swatch";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `color` | `string \| Color \| () => string \| Color` | from `ColorSwatchContext` | Accessor updates in place. |
| `colorName` | `string` | localized name | Replaces the generated name. |
| `aria-label` | `string` | | Appended: `"vibrant red, Background"`. |
| `aria-labelledby`, `aria-describedby`, `aria-details`, `id`, `slot` | `string` | | |
| `class` | `string \| (rp) => string` | `rv-ColorSwatch` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ColorSwatch`; see [Render](#render). |
| `style` | `object \| (rp) => object` | | Merged over the background (`defaultStyle`). |
| `children` | content or `({ color }) => content` | | |
| `ref`, global DOM props | | | |

Render props: `color()` (`Color`).

## Styling

`.rv-ColorSwatch`; size it, round it. The background (color over a checkerboard) is inline.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ColorSwatch` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<ColorSwatch render={(props) => <div {...(props as {})} />}>…</ColorSwatch>
```

## Accessibility

- `role="img"`, `aria-roledescription="color swatch"`, label = color name (+ `aria-label`).

## Resumability

Static markup; with a `color` accessor (or inside ColorPicker), only the label and background bindings update.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ColorSwatch`, `ColorSwatchContext` | RAC `ColorSwatch` |
| `colorSwatchProps` (`@rivetjs/cdk/color-swatch/behaviour`) | react-aria `useColorSwatch` |

