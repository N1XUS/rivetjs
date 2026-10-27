---
title: CellColorPicker
description: "A settings-row color picker: label, hex value and swatch in one cell that opens a color picker popover."
template: reference
status: experimental
related: [components/color-picker, components/cell-select, components/cell-switch]
---

`CellColorPicker` is a [ColorPicker](/components/color-picker/) laid out as a settings cell: the whole row is the trigger, the hex value and a swatch sit at its end, and the popover holds any color controls (area, sliders, swatches).

## Usage

```tsx
import { CellColorPicker } from "@rivetjs/ui/cell-color-picker";
```

::example{id=cell-color-picker-basic}

## Anatomy

```tsx
import { CellColorPicker } from "@rivetjs/ui/cell-color-picker";

export default function Anatomy() {
  return (
    <CellColorPicker defaultValue="#3B82F6">
      <CellColorPicker.Trigger>
        <CellColorPicker.Label>Accent color</CellColorPicker.Label>
        <CellColorPicker.ValueDisplay />
        <CellColorPicker.Swatch />
      </CellColorPicker.Trigger>
      <CellColorPicker.Popover>{/* ColorArea, ColorSlider, ColorSwatchPicker */}</CellColorPicker.Popover>
    </CellColorPicker>
  );
}
```

## With Presets

::example{id=cell-color-picker-presets}

## Controlled

::example{id=cell-color-picker-controlled}

## Variants

::example{id=cell-color-picker-variants}

## Disabled

::example{id=cell-color-picker-disabled}

## Settings Group

::example{id=cell-color-picker-settings}

## Styling Reference

### CSS Classes

- `.cell-color-picker` - Root wrapper.
- `.cell-color-picker__trigger` - The cell row button, with `.cell-color-picker__trigger--default` or `--secondary`.
- `.cell-color-picker__label` - Leading label.
- `.cell-color-picker__value-display` - Hex value.
- `.cell-color-picker__swatch` - Color preview.
- `.cell-color-picker__popover` - Picker panel.

### Data Attributes

- `[data-hovered="true"]`, `[data-pressed="true"]`, `[data-focus-visible="true"]`, `[data-disabled="true"]` on the trigger.

## API Reference

### CellColorPicker

The ui `ColorPicker` (cdk ColorPicker + DialogTrigger).

| Prop           | Type                              | Default     | Description                                  |
| -------------- | --------------------------------- | ----------- | -------------------------------------------- |
| `variant`      | `"default" \| "secondary"`        | `"default"` | Cell style                                   |
| `value`        | `string \| Color \| Signal`       | -           | Controlled color (a signal is two-way)       |
| `defaultValue` | `string \| Color`                 | -           | Initial color                                |
| `onChange`     | `(color: Color) => void`          | -           | Color changed                                |
| `isDisabled`   | `boolean`                         | -           | Disable the trigger                          |

### CellColorPicker.Trigger

A cdk `Button` (the cell row).

### CellColorPicker.Label / ValueDisplay

`span`s; `ValueDisplay` shows the current color as uppercase hex.

### CellColorPicker.Swatch

A ui [ColorSwatch](/components/color-swatch/) (size `sm`) showing the picker color.

### CellColorPicker.Popover

The ui `ColorPicker.Popover` (`placement` `"bottom end"`).
