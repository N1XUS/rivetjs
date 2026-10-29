---
title: Slider
description: "A slider allows a user to select one or more values within a range"
template: reference
status: experimental
related: [components/number-field, components/switch, components/progress-bar]
---

`Slider` picks one value, or a range with two thumbs, from a continuous or stepped scale: the [cdk Slider](site:cdk/components/slider/) (native range inputs, keyboard, pointer drag, form value) with the Rivet UI parts and classes.

Notes:

- `class`, not `className`.
- `value` takes a two-way signal (`value={volume}`) or a value.
- Render props carry the cdk `SliderState`: read it with `sliderValues(state)` / `getThumbValueLabel(state, i)` from `@rivetjs/cdk/slider`; `state.defaultValues` gives the thumb count (upstream `state.values`).
- With a `step`, the thumb follows the pointer during a drag and animates to the closest step on release (cdk `snap="release"`, `data-snapping`); `snap="drag"` keeps React Aria's step-by-step drag.
- `Slider.Fill` is the cdk `SliderFill`: right-to-left layouts work.
- Shorthand (Rivet addition): `label` without children renders Label / Output / Track / Fill / Thumb(s).

## Usage

```tsx
import { Slider } from "@rivetjs/ui/slider";
```

::example{id=slider-default}

## Anatomy

```tsx
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export default () => (
  <Slider>
    <Label />
    <Slider.Output />
    <Slider.Track>
      <Slider.Fill />
      <Slider.Steps />
      <Slider.Thumb />
    </Slider.Track>
    <Slider.Marks>
      <Slider.Mark value={0} />
      <Slider.Mark value={50} />
      <Slider.Mark value={100} />
    </Slider.Marks>
  </Slider>
);
```

`Slider.Steps` and `Slider.Marks` are optional. Compose them independently as needed. Additional exported part: `Slider.Root`.

## Examples

### Shorthand

Rivet addition: without children, `label` renders the Label, Output, Track, Fill and one Thumb per value (two for an array `value` / `defaultValue`, decided once at mount), the compound form's markup. Use the parts for marks, a custom output or thumb content. Explicit children win: next to children the shorthand props are ignored, with a development warning.

::example{id=slider-shorthand}

### Steps

Place `Slider.Steps` inside `Slider.Track` to display a dot at each increment defined by `minValue`, `maxValue`, and `step`. The `step` prop controls value increments even without visible dots.

Dots start at `minValue`. If `maxValue` is not on a step, no extra dot is added at that endpoint. Invalid ranges and ranges requiring more than 1,000 dots omit the indicators.

::example{id=slider-with-steps}

### Marks

Place `Slider.Marks` directly after `Slider.Track` as a sibling, and add `Slider.Mark` children with a required `value`. Each label is positioned at its value, so marks can be unevenly spaced and do not need to match the step increments.

Use children for custom labels. Without children, a mark displays its value using the slider's locale and `formatOptions`. Marks outside the slider's bounds, or with non-finite values, are not rendered. Marks are labels; they do not change the value or snapping behavior.

::example{id=slider-with-marks}

### Steps and Marks

Combine dots and labels independently. Fractional steps are supported; this example uses `step={0.1}` with labels at `0`, `0.5`, and `1`.

::example{id=slider-with-steps-and-marks}

### Range with Steps and Marks

For a single thumb, dots and marks from the minimum through the selected value receive `data-filled="true"`. For a range, only those between the first and last thumbs receive it, including the endpoints. In Rivet the filled state follows the thumbs while they move freely during a drag, the way the fill does.

::example{id=slider-range-with-steps-and-marks}

### Vertical Steps and Marks

Dots and labels follow `orientation="vertical"` automatically. Give vertical sliders a container with a defined height. Horizontal indicators also follow the locale's right-to-left direction.

::example{id=slider-vertical-with-steps-and-marks}

### Disabled

::example{id=slider-disabled}

### Range Slider Anatomy

```tsx
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export default () => (
  <Slider defaultValue={[25, 75]}>
    <Label />
    <Slider.Output />
    <Slider.Track>
      {({ state }) => (
        <>
          <Slider.Fill />
          {state.defaultValues.map((_, i) => (
            <Slider.Thumb index={i} />
          ))}
        </>
      )}
    </Slider.Track>
  </Slider>
);
```

### Vertical

::example{id=slider-vertical}

### Range

::example{id=slider-range}

### Controlled Value

Control the value with `value` and `onChange`. In Rivet, pass a signal to `value`: the slider writes it back.

::example{id=slider-controlled}

### Custom Value Formatting

Use `formatOptions` to format the displayed value. This example formats it as USD.

::example{id=slider-custom-value-formatting}

### Custom Output

Customize `Slider.Output` to control how the selected values are shown.

::example{id=slider-custom-output}

### Render Function

::example{id=slider-render-function}

## Customization

### Tailwind CSS

::example{id=slider-custom-styles}

### Global CSS

To customize the Slider component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .slider {
    @apply flex flex-col gap-2;
  }

  .slider__output {
    @apply text-muted-fg text-sm;
  }

  .slider__track {
    @apply relative h-2 w-full rounded-full bg-surface-secondary;
  }

  .slider__fill {
    @apply absolute h-full rounded-full bg-accent;
  }

  .slider__thumb {
    @apply size-4 rounded-full bg-accent border-2 border-background;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `slider-output`, `slider-steps`, `slider-step`, `slider-marks`, `slider-mark`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Slider component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/slider.css)):

#### Base Classes

- `.slider` - Base slider container
- `.slider__output` - Output element displaying current value(s)
- `.slider__track` - Track element containing fill, optional step dots, and thumbs
- `.slider__fill` - Fill element showing selected range
- `.slider__thumb` - Individual thumb element
- `.slider__steps` - Decorative step indicator container inside the track
- `.slider__step` - Individual step dot
- `.slider__marks` - Mark label container after the track
- `.slider__mark` - Individual value-positioned label

#### State Classes

- `.slider[data-disabled="true"]` - Disabled slider state
- `.slider[data-orientation="vertical"]` - Vertical orientation
- `.slider__thumb[data-dragging="true"]` - Thumb being dragged
- `.slider__thumb[data-focus-visible="true"]` - Thumb keyboard focused
- `.slider__thumb[data-disabled="true"]` - Disabled thumb state
- `.slider__track[data-fill-start="true"]` - Fill starts at beginning
- `.slider__track[data-fill-end="true"]` - Fill ends at end
- `.slider__step[data-filled="true"]` - Step dot within the selected interval
- `.slider__mark[data-filled="true"]` - Mark label within the selected interval

### Indicator Data Attributes

| Attribute              | Applies to                           | Description                                                                    |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| `data-slot`            | Steps, step dots, marks, mark labels | `slider-steps`, `slider-step`, `slider-marks`, and `slider-mark`, respectively |
| `data-value`           | Step dots and mark labels            | The numeric value represented by the indicator                                 |
| `data-filled="true"`   | Step dots and mark labels            | The value is within the selected interval, including endpoints                 |
| `data-disabled="true"` | Steps, step dots, marks, mark labels | Inherits the slider's disabled state                                           |
| `data-orientation`     | Steps and marks containers           | `horizontal` or `vertical`                                                     |
| `data-direction`       | Steps and marks containers           | `ltr` or `rtl`, derived from the locale                                        |

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` on thumb
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on thumb
- **Dragging**: `[data-dragging="true"]` on thumb
- **Snapping** (Rivet): `[data-snapping]` on thumb and fill while the thumb animates to its step after a drag
- **Disabled**: `:disabled` or `[data-disabled="true"]` on slider or thumb

## API Reference

See the [full module API](/api/rivetjs/ui/slider/) for every named export and part prop type.

### Slider

| Prop              | Type                                                                | Default        | Description                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`           | `number \| number[] \| Signal<number \| number[]>`                  | -              | The current value (controlled; a signal is two-way)                                                                                                             |
| `defaultValue`    | `number \| number[]`                                                | -              | The default value (uncontrolled)                                                                                                                                |
| `onChange`        | `(value: number \| number[]) => void`                               | -              | Handler called when the value changes                                                                                                                           |
| `onChangeEnd`     | `(value: number \| number[]) => void`                               | -              | Handler called when dragging ends                                                                                                                               |
| `minValue`        | `number`                                                            | `0`            | The slider's minimum value                                                                                                                                      |
| `maxValue`        | `number`                                                            | `100`          | The slider's maximum value                                                                                                                                      |
| `step`            | `number`                                                            | `1`            | Value increment and spacing between dots when `Slider.Steps` is present                                                                                         |
| `formatOptions`   | `Intl.NumberFormatOptions`                                          | -              | The display format of the value label                                                                                                                           |
| `orientation`     | `"horizontal" \| "vertical"`                                        | `"horizontal"` | The orientation of the slider                                                                                                                                   |
| `isDisabled`      | `boolean`                                                           | -              | Whether the slider is disabled                                                                                                                                  |
| `snap`            | `"release" \| "drag"`                                               | `"release"`    | Rivet: with a `step`, `"release"` lets the thumb follow the pointer and animates it to the closest step on release; `"drag"` steps during the drag (React Aria) |
| `aria-label`      | `string`                                                            | -              | Accessibility label for the slider                                                                                                                              |
| `aria-labelledby` | `string`                                                            | -              | ID of element that labels the slider                                                                                                                            |
| `class`           | `string`                                                            | -              | Additional CSS classes                                                                                                                                          |
| `children`        | `Content \| RenderFunction`                                         | -              | Slider content or render function                                                                                                                               |
| `label`           | `Content`                                                           | -              | Shorthand (no children): the Label; Output, Track, Fill and Thumb(s) render too.                                                                                |
| `render`          | `DOMRenderFunction<keyof JSX.IntrinsicElements, SliderRenderProps>` | -              | Overrides the default DOM element with a custom render function.                                                                                                |

### Slider.Output

| Prop       | Type                                                                      | Default | Description                                                      |
| ---------- | ------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `class`    | `string`                                                                  | -       | Additional CSS classes                                           |
| `children` | `Content \| RenderFunction`                                               | -       | Output content or render function                                |
| `render`   | `DOMRenderFunction<keyof JSX.IntrinsicElements, SliderOutputRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Slider.Track

| Prop       | Type                                                                     | Default | Description                                                      |
| ---------- | ------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| `class`    | `string`                                                                 | -       | Additional CSS classes                                           |
| `children` | `Content \| RenderFunction`                                              | -       | Track content or render function                                 |
| `render`   | `DOMRenderFunction<keyof JSX.IntrinsicElements, SliderTrackRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Slider.Fill

| Prop    | Type            | Default | Description            |
| ------- | --------------- | ------- | ---------------------- |
| `class` | `string`        | -       | Additional CSS classes |
| `style` | `CSSProperties` | -       | Inline styles          |

### Slider.Thumb

| Prop         | Type                                                                     | Default | Description                                                      |
| ------------ | ------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| `index`      | `number`                                                                 | `0`     | Index of the thumb within the slider                             |
| `isDisabled` | `boolean`                                                                | -       | Whether this thumb is disabled                                   |
| `name`       | `string`                                                                 | -       | The name of the input element, used when submitting an HTML form |
| `class`      | `string`                                                                 | -       | Additional CSS classes                                           |
| `children`   | `Content \| RenderFunction`                                              | -       | Thumb content or render function                                 |
| `render`     | `DOMRenderFunction<keyof JSX.IntrinsicElements, SliderThumbRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Slider.Steps

Renders decorative dots inside `Slider.Track` using the root slider's bounds and step. It generates its own children and accepts standard DOM props and a ref. Rivet: the range and step are read once at mount.

| Prop     | Type                                                        | Default | Description                                                     |
| -------- | ----------------------------------------------------------- | ------- | --------------------------------------------------------------- |
| `class`  | `string`                                                    | -       | Additional CSS classes for the container                        |
| `style`  | `CSSProperties`                                             | -       | Inline styles for the container                                 |
| `render` | `DOMRenderFunction<keyof JSX.IntrinsicElements, undefined>` | -       | Overrides the default DOM element with a custom render function |

### Slider.Marks

Contains `Slider.Mark` children. Place it directly inside `Slider`, after `Slider.Track`. Accepts standard DOM props and a ref.

| Prop       | Type                                                        | Default | Description                                                     |
| ---------- | ----------------------------------------------------------- | ------- | --------------------------------------------------------------- |
| `children` | `Content`                                                   | -       | Mark labels                                                     |
| `class`    | `string`                                                    | -       | Additional CSS classes for the container                        |
| `style`    | `CSSProperties`                                             | -       | Inline styles for the container                                 |
| `render`   | `DOMRenderFunction<keyof JSX.IntrinsicElements, undefined>` | -       | Overrides the default DOM element with a custom render function |

### Slider.Mark

A label positioned at a value within `Slider.Marks`. Accepts standard DOM props and a ref.

| Prop       | Type                                                        | Default         | Description                                                                               |
| ---------- | ----------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `value`    | `number`                                                    | Required        | Value at which to position the label; non-finite or out-of-bounds values are not rendered |
| `children` | `Content`                                                   | Formatted value | Custom label content; otherwise uses the slider's locale and `formatOptions`              |
| `class`    | `string`                                                    | -               | Additional CSS classes                                                                    |
| `style`    | `CSSProperties`                                             | -               | Additional inline styles; value positioning is managed automatically                      |
| `render`   | `DOMRenderFunction<keyof JSX.IntrinsicElements, undefined>` | -               | Overrides the default DOM element with a custom render function                           |

### Render Props

When using render functions with Slider.Output or Slider.Track, these values are provided:

| Prop          | Type                | Description                                                                                                                                                                                    |
| ------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`       | `SliderState`       | The cdk state of the slider. Read it with `sliderValues(state)` (values by thumb index), `getThumbValueLabel(state, index)` and `state.defaultValues` (thumb count) from `@rivetjs/cdk/slider` |
| `orientation` | `() => Orientation` | The orientation of the slider                                                                                                                                                                  |
| `isDisabled`  | `() => boolean`     | Whether the slider is disabled                                                                                                                                                                 |

::api{symbol="@rivetjs/ui/slider#SliderRootProps"}

## Accessibility

The Slider component implements the ARIA slider pattern and provides:

- Full keyboard navigation support (Arrow keys, Home, End, Page Up/Down)
- Screen reader announcements for value changes
- Proper focus management
- Support for disabled states
- HTML form integration via hidden input elements
- Internationalization support with locale-aware value formatting
- Right-to-left (RTL) language support
- Step dots are decorative, hidden from assistive technology, and add no tab stops
- Mark labels remain readable text and do not replace the slider's accessible label or value announcements

For more information, see the [React Aria Slider documentation](https://react-spectrum.adobe.com/react-aria/Slider.html).

Each thumb is a visually hidden native `<input type="range">` labelled by the slider's `Label` (Tab focuses; arrows step, Page Up / Down page, Home / End jump; React Aria). `Slider.Output` is an `<output>` tied to the inputs.

## Related Components

- [Label](/components/label/): Accessible label for form controls.
- [Form](/components/form/): Form validation and submission handling.
- [Description](/components/description/): Helper text for form fields.
