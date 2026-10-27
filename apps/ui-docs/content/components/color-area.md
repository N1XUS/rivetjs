---
title: ColorArea
description: "A 2D color picker that selects two channels of a color from a gradient area."
template: reference
status: experimental
related: [components/color-picker, components/color-slider]
---

`ColorArea` is a 2D color picker: two channels of one color space on the x / y axes of a gradient area, a draggable `ColorArea.Thumb`, arrow keys on two hidden range inputs. The root is the [cdk ColorArea](site:cdk/components/color-area/) (React Aria `ColorArea`) and the thumb the cdk `ColorThumb`.

Notes:

- `class`, not `className`. `parseColor` and the `Color` / `ColorSpace` / `ColorChannel` types come from `@rivetjs/cdk/color` (the React Stately color port).
- A controlled `value` is a two-way signal of the color string (`signal("#0485F7")`; no `onChange` setter needed; the component writes back a lossless string such as `hsla(200, 100%, 50%, 1)`). `Color` objects in props (`defaultValue={parseColor("…")}`) reach the cdk part as strings so the page resumes; a `Color` held in a component local and read by resumable code must be its string form.
- `colorSpace`, `xChannel` and `yChannel` are read once: to switch them, re-create the area (`<Show keyed when={…}>`, Space and Channels demo).
- Render props are accessors (`({ color }) => color().toString("css")`, `({ isDragging }) => isDragging()`).

## Usage

```tsx
import { ColorArea } from "@rivetjs/ui/color-area";
```

::example{id=color-area-basic}

## Anatomy

```tsx
import { ColorArea } from "@rivetjs/ui/color-area";

export default () => (
  <ColorArea>
    <ColorArea.Thumb />
  </ColorArea>
);
```

Additional exported parts: `ColorArea.Root`.

## Examples

### With Dots

::example{id=color-area-with-dots}

### Color Space & Channels

Use `colorSpace` to set the color space (RGB, HSL, HSB) and `xChannel`/`yChannel` props to customize which color channels are displayed on each axis.

::example{id=color-area-space-and-channels}

### Disabled

::example{id=color-area-disabled}

### Controlled

::example{id=color-area-controlled}

### Render Function

::example{id=color-area-render-function}

## Customization

### Tailwind CSS

::example{id=color-area-custom-styles}

### Global CSS

To customize the ColorArea component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .color-area {
    @apply rounded-3xl;
  }

  .color-area__thumb {
    @apply size-5 border-4;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `color-area-thumb`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ColorArea component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/color-area.css)):

#### Base Classes

- `.color-area` - Base styles with gradient background and inner shadow
- `.color-area--show-dots` - Adds dot grid overlay for precision picking

#### Element Classes

- `.color-area__thumb` - Draggable thumb indicator

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Disabled**: `[data-disabled="true"]`
- **Focus**: `[data-focus-visible="true"]`
- **Dragging**: `[data-dragging="true"]` (thumb only)

## API Reference

See the [full module API](/api/rivetjs/ui/color-area/) for every named export and part prop type.

### ColorArea

Inherits from [cdk ColorArea](site:cdk/components/color-area/).

| Prop           | Type                                                                   | Default        | Description                                                      |
| -------------- | ---------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------- |
| `value`        | `string \| Color \| Signal<string \| Color>`                           | -              | The current color value (controlled; Rivet: a signal is two-way) |
| `defaultValue` | `string \| Color`                                                      | -              | The default color value (uncontrolled)                           |
| `onChange`     | `(color: Color) => void`                                               | -              | Handler called when the color changes while dragging             |
| `onChangeEnd`  | `(color: Color) => void`                                               | -              | Handler called when the user stops dragging                      |
| `xChannel`     | `ColorChannel`                                                         | `"saturation"` | Color channel for the horizontal axis                            |
| `yChannel`     | `ColorChannel`                                                         | `"brightness"` | Color channel for the vertical axis                              |
| `colorSpace`   | `ColorSpace`                                                           | -              | The color space for the channels                                 |
| `isDisabled`   | `boolean`                                                              | `false`        | Whether the color area is disabled                               |
| `showDots`     | `boolean`                                                              | `false`        | Whether to show the dot grid overlay                             |
| `class`        | `string`                                                               | -              | Additional CSS classes                                           |
| `render`       | `DOMRenderFunction<keyof JSX.IntrinsicElements, ColorAreaRenderProps>` | -              | Overrides the default DOM element with a custom render function. |

### ColorArea.Thumb

| Prop     | Type                                                                    | Default | Description                                                      |
| -------- | ----------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `class`  | `string`                                                                | -       | Additional CSS classes                                           |
| `style`  | `JSX.CSSProperties \| ((renderProps) => JSX.CSSProperties)`             | -       | Inline styles or render props function                           |
| `render` | `DOMRenderFunction<keyof JSX.IntrinsicElements, ColorThumbRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

::api{symbol="@rivetjs/ui/color-area#ColorArea"}

## Accessibility

the root is a `role="group"`; the x input is a slider with `aria-roledescription="2D slider"` (the y input is `aria-hidden`); arrow keys step the channels, Page Up / Down and Shift + arrows take larger steps.

## Related Components

- [ColorSwatch](/components/color-swatch/): Visual preview of a color value.
- [ColorSwatchPicker](/components/color-swatch-picker/): Color swatch selection from a list of colors.
- [ColorField](/components/color-field/): Input for entering color values with hex format.
- [ColorPicker](/components/color-picker/): Composable color picker with popover.
