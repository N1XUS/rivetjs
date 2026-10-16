---
title: ColorPicker
description: ColorPicker from @rivetjs/cdk keeps ColorArea, ColorSlider, ColorWheel, ColorField, ColorSwatch and ColorSwatchPicker in sync over one value.
template: guide
status: experimental
related: [components/color-area, components/color-slider, components/color-wheel, components/color-field, components/color-swatch, components/color-swatch-picker]
---

`ColorPicker` renders no element. It owns one color value and provides it to every color component inside it, so you can compose your own picker layout.

::example{id=color-picker-basic}

## Import

```ts
import { ColorPicker } from "@rivetjs/cdk/color-picker";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string \| Color \| Signal \| accessor` | | Keep strings in a Signal on resumed pages. |
| `defaultValue` | `string \| Color` | `"#000000"` | |
| `onChange` | `(color: Color) => void` | | |
| `children` | content or `({ color }) => content` | required | |
| `slot` | `string` | | |

Render props: `color()`. Contexts: `ColorPickerContext`, `ColorPickerStateContext`.

## How it works

Children read the value from their contexts (`ColorAreaContext`, `ColorSliderContext`, `ColorWheelContext`, `ColorFieldContext`, `ColorSwatchContext`, `ColorSwatchPickerContext`) and write through `onChange`; their own props still win.

## Resumability

One `createColorPickerState` (plain signal state) shared by all children; works on a resumed page.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ColorPicker`, `ColorPickerContext`, `ColorPickerStateContext` | RAC `ColorPicker` |
| `createColorPickerState` | react-stately `useColorPickerState` |
