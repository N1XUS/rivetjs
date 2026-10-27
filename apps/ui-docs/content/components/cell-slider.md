---
title: CellSlider
description: "A settings-row slider: the whole cell is the track, with the label on the left, the value on the right and an accent fill up to a thin thumb."
template: reference
status: experimental
related: [components/slider, components/number-stepper]
---

`CellSlider` fits sliders into settings lists and inspector panels. The cell itself is the track: press or drag anywhere on it, and the fill follows. The label and the formatted value sit on top of the fill. It is the [cdk Slider](site:cdk/components/slider/) (horizontal, one thumb), so bounds, `step`, `formatOptions`, `onChangeEnd`, `name` and the keyboard work as in Slider. Stepped sliders drag freely and snap to the nearest step with an animation on release (no animation with `prefers-reduced-motion`).

## Usage

```tsx
import { CellSlider } from "@rivetjs/ui/cell-slider";
```

::example{id=cell-slider-basic}

## Anatomy

```tsx
import { CellSlider } from "@rivetjs/ui/cell-slider";

export default function Volume() {
  return (
    <CellSlider defaultValue={60}>
      <CellSlider.Track>
        <CellSlider.Fill />
        <CellSlider.Thumb />
      </CellSlider.Track>
      <CellSlider.Label>Volume</CellSlider.Label>
      <CellSlider.Output />
    </CellSlider>
  );
}
```

`CellSlider.Track` stretches over the whole cell behind the label and the output, which ignore the pointer, so a press anywhere on the cell moves the value.

Additional exported parts: `CellSlider.Root`.

## Examples

### Shorthand

Without children, `label` renders the Track (Fill + Thumb), the Label and the Output, with the compound form's markup. Explicit children win: next to children `label` is ignored, with a development warning.

A bare `<CellSlider />` (no children, no `label`) renders the Track and the Output. The form is decided once, at render: adding or removing children later does not switch it.

::example{id=cell-slider-shorthand}

### Controlled

Pass a two-way `Signal<number>` as `value`. `onChangeEnd` reports the value once a drag (or key press) ends. A function child of `CellSlider.Output` renders the value text (here from the signal).

::example{id=cell-slider-controlled}

### Disabled

::example{id=cell-slider-disabled}

### Integer Step

::example{id=cell-slider-integer-step}

### Secondary Group

::example{id=cell-slider-secondary-group}

### Settings Group

::example{id=cell-slider-settings-group}

### Variants

::example{id=cell-slider-variants}

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.cell-slider` - The cell (rounded row, label and value on top). Variants `.cell-slider--default` (gray track) / `.cell-slider--secondary` (surface track, for gray containers).
- `.cell-slider__track` - The track stretched over the whole cell.
- `.cell-slider__fill` - Accent tint from the start to the thumb.
- `.cell-slider__thumb` - Hit area at the fill edge with a thin pill (`::after`); taller while dragging.
- `.cell-slider__label` - The label on the left.
- `.cell-slider__output` - The value on the right.

### CSS Variables

| Variable               | Default                     | Description |
| ---------------------- | --------------------------- | ----------- |
| `--cell-slider-height` | `calc(var(--spacing) * 11)` | Cell height |
| `--cell-slider-track`  | `--default`                 | Track color |
| `--cell-slider-fill`   | `--accent-soft`             | Fill color  |
| `--cell-slider-thumb`  | `--accent`                  | Thumb color |

### Data Attributes

- `[data-slot]`: `cell-slider`, `cell-slider-track`, `cell-slider-fill`, `cell-slider-thumb`, `cell-slider-label`, `cell-slider-output`.
- Root: `[data-disabled]`. Thumb: `[data-dragging]`, `[data-focus-visible]`, `[data-hovered]`, `[data-disabled]`.

## API Reference

See the [full module API](/api/rivetjs/ui/cell-slider/) for every named export and part prop type.

### CellSlider

| Prop            | Type                             | Default     | Description                                                                  |
| --------------- | -------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `variant`       | `"default"` \| `"secondary"`     | `"default"` | Track color                                                                  |
| `value`         | `number` \| `Signal<number>`     | -           | Value (controlled; a Signal is two-way)                                      |
| `defaultValue`  | `number`                         | `0`         | Initial value (uncontrolled)                                                 |
| `onChange`      | `(value: number) => void`        | -           | Called on every change                                                       |
| `onChangeEnd`   | `(value: number) => void`        | -           | Called when a drag or key press ends                                         |
| `minValue`      | `number`                         | `0`         | Lower bound                                                                  |
| `maxValue`      | `number`                         | `100`       | Upper bound                                                                  |
| `step`          | `number`                         | `1`         | Step; dragging snaps to it on release                                        |
| `formatOptions` | `Intl.NumberFormatOptions`       | -           | Value formatting                                                             |
| `isDisabled`    | `boolean`                        | `false`     | Disables the slider                                                          |
| `label`         | `Content`                        | -           | Shorthand (no children): the Label; Track, Fill, Thumb and Output render too |
| `class`         | `string` \| render-prop function | -           | Additional CSS classes                                                       |

### CellSlider.Output

`children` replace the value text; a function child gets the slider render props (`{ state }`).

### CellSlider.Track / .Fill / .Thumb / .Label

Take the cdk `SliderTrack` / `SliderFill` / `SliderThumb` / `Label` props.

::api{symbol="@rivetjs/ui/cell-slider#CellSliderRootProps"}

## Accessibility

the thumb holds a visually hidden `input type="range"` labelled by `CellSlider.Label`; arrow keys, Page Up / Down and Home / End change the value, and the cell shows a focus ring while the thumb has keyboard focus. Without a label, give the root an `aria-label`.

## Related Components

- [Slider](/components/slider/): A slider with a separate track and thumb.
- [NumberStepper](/components/number-stepper/): Step small counts with buttons.
