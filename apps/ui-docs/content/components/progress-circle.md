---
title: ProgressCircle
description: "A circular progress indicator that shows determinate or indeterminate progress."
template: reference
status: experimental
related: []
---

`ProgressCircle` is the circular progress indicator: an SVG ring whose stroke follows the value. The root is the [cdk Progress Bar](site:cdk/components/progress-bar/) (`role="progressbar"`, `aria-valuenow`, `aria-valuetext`); the parts are styled elements.

Notes:

- `class`, not `className`.
- Value props also accept accessors (a cdk superset).
- Context `state` fields are accessors, not React snapshot values.
- SVG / style attributes keep their DOM names (`stroke-dasharray`, `width: 60%`); same output.

Accessibility: `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext` from the cdk. A [Label](label.md) child labels it (`aria-labelledby`).

## Usage

```tsx
import { ProgressCircle } from "@rivetjs/ui/progress-circle";
```

::example{id=progress-circle-basic}

## Anatomy

```tsx
import { ProgressCircle } from "@rivetjs/ui/progress-circle";

export default () => (
  <ProgressCircle aria-label="Loading" value={60}>
    <ProgressCircle.Track>
      <ProgressCircle.TrackCircle />
      <ProgressCircle.FillCircle />
    </ProgressCircle.Track>
  </ProgressCircle>
);
```

## Examples

### Sizes

::example{id=progress-circle-sizes}

### Colors

::example{id=progress-circle-colors}

### Indeterminate

Use `isIndeterminate` when progress cannot be determined.

::example{id=progress-circle-indeterminate}

### With Label

::example{id=progress-circle-with-label}

### Custom SVG Props

Since each part is a composable component, you can override SVG attributes like `strokeWidth`, `r`, `cx`, `cy`, and `viewBox` directly.

::example{id=progress-circle-custom-svg}

## Customization

### Tailwind CSS

::example{id=progress-circle-custom-styles}

### Global CSS

To customize the ProgressCircle component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .progress-circle {
    @apply inline-flex;
  }

  .progress-circle__track {
    @apply size-12;
  }

  .progress-circle__fill-circle {
    stroke: purple;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ProgressCircle component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/progress-circle.css)):

#### Base & Element Classes

- `.progress-circle` - Base container
- `.progress-circle__track` - SVG element
- `.progress-circle__track-circle` - Background circle
- `.progress-circle__fill-circle` - Progress arc

#### Size Classes

- `.progress-circle--sm` - Small size variant
- `.progress-circle--md` - Medium size variant (default)
- `.progress-circle--lg` - Large size variant

#### Color Classes

- `.progress-circle--default` - Default color variant
- `.progress-circle--accent` - Accent color variant
- `.progress-circle--success` - Success color variant
- `.progress-circle--warning` - Warning color variant
- `.progress-circle--danger` - Danger color variant

## API Reference

### ProgressCircle

Inherits from [React Aria ProgressBar](https://react-spectrum.adobe.com/react-aria/ProgressBar.html).

| Prop              | Type                                                          | Default              | Description                         |
| ----------------- | ------------------------------------------------------------- | -------------------- | ----------------------------------- |
| `value`           | `number`                                                      | `0`                  | The current value                   |
| `minValue`        | `number`                                                      | `0`                  | The minimum value                   |
| `maxValue`        | `number`                                                      | `100`                | The maximum value                   |
| `isIndeterminate` | `boolean`                                                     | `false`              | Whether progress is indeterminate   |
| `size`            | `"sm" \| "md" \| "lg"`                                        | `"md"`               | Size of the circle                  |
| `color`           | `"default" \| "accent" \| "success" \| "warning" \| "danger"` | `"accent"`           | Color of the progress arc           |
| `formatOptions`   | `Intl.NumberFormatOptions`                                    | `{style: 'percent'}` | Number format for the value display |
| `children`        | `Content \| (values: ProgressBarRenderProps) => Content`      | -                    | Content or render prop              |

### Render Props

When using the render prop pattern, these values are provided:

| Prop              | Type      | Description                            |
| ----------------- | --------- | -------------------------------------- |
| `percentage`      | `number`  | The percentage of the progress (0-100) |
| `valueText`       | `string`  | The formatted value text               |
| `isIndeterminate` | `boolean` | Whether progress is indeterminate      |

::api{symbol="@rivetjs/ui/progress-circle#ProgressCircleRootProps"}

## Related Components
