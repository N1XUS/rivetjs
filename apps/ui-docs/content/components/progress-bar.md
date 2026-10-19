---
title: ProgressBar
description: "A progress bar shows either determinate or indeterminate progress of an operation over time."
template: reference
status: experimental
related: []
---

`ProgressBar` shows how far a task has come, or that it runs (indeterminate). The root is the [cdk Progress Bar](site:cdk/components/progress-bar/) (`role="progressbar"`, `aria-valuenow`, `aria-valuetext`); the parts are styled elements.

Notes:

- `class`, not `className`.
- Value props also accept accessors (a cdk superset).
- Context `state` fields are accessors, not React snapshot values.
- SVG / style attributes keep their DOM names (`stroke-dasharray`, `width: 60%`); same output.

Accessibility: `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext` from the cdk. A [Label](label.md) child labels it (`aria-labelledby`).

## Usage

```tsx
import { ProgressBar } from "@rivetjs/ui/progress-bar";
import { Label } from "@rivetjs/ui/label";
```

::example{id=progress-bar-basic}

## Anatomy

```tsx
import { ProgressBar } from "@rivetjs/ui/progress-bar";
import { Label } from "@rivetjs/ui/label";

export default () => (
  <ProgressBar value={60}>
    <Label>Loading</Label>
    <ProgressBar.Output />
    <ProgressBar.Track>
      <ProgressBar.Fill />
    </ProgressBar.Track>
  </ProgressBar>
);
```

## Examples

### Sizes

::example{id=progress-bar-sizes}

### Colors

::example{id=progress-bar-colors}

### Without Label

When no visible label is needed, use `aria-label` for accessibility.

::example{id=progress-bar-without-label}

### Indeterminate

Use `isIndeterminate` when progress cannot be determined.

::example{id=progress-bar-indeterminate}

### Custom Value Scale

Use `minValue`, `maxValue`, and `formatOptions` to customize the value range and display format.

::example{id=progress-bar-custom-value}

## Customization

### Tailwind CSS

::example{id=progress-bar-custom-styles}

### Global CSS

To customize the ProgressBar component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .progress-bar {
    @apply w-full gap-2;
  }

  .progress-bar__track {
    @apply h-3 rounded-full;
  }

  .progress-bar__fill {
    @apply rounded-full;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ProgressBar component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/progress-bar.css)):

#### Base & Element Classes

- `.progress-bar` - Base container (grid layout)
- `.progress-bar__output` - Value text display
- `.progress-bar__track` - Track background
- `.progress-bar__fill` - Filled portion of the track

#### Size Classes

- `.progress-bar--sm` - Small size variant (thinner track)
- `.progress-bar--md` - Medium size variant (default)
- `.progress-bar--lg` - Large size variant (thicker track)

#### Color Classes

- `.progress-bar--default` - Default color variant
- `.progress-bar--accent` - Accent color variant
- `.progress-bar--success` - Success color variant
- `.progress-bar--warning` - Warning color variant
- `.progress-bar--danger` - Danger color variant

## API Reference

### ProgressBar

Inherits from [React Aria ProgressBar](https://react-spectrum.adobe.com/react-aria/ProgressBar.html).

| Prop              | Type                                                          | Default              | Description                         |
| ----------------- | ------------------------------------------------------------- | -------------------- | ----------------------------------- |
| `value`           | `number`                                                      | `0`                  | The current value                   |
| `minValue`        | `number`                                                      | `0`                  | The minimum value                   |
| `maxValue`        | `number`                                                      | `100`                | The maximum value                   |
| `isIndeterminate` | `boolean`                                                     | `false`              | Whether progress is indeterminate   |
| `size`            | `"sm" \| "md" \| "lg"`                                        | `"md"`               | Size of the progress track          |
| `color`           | `"default" \| "accent" \| "success" \| "warning" \| "danger"` | `"accent"`           | Color of the fill bar               |
| `formatOptions`   | `Intl.NumberFormatOptions`                                    | `{style: 'percent'}` | Number format for the value display |
| `valueLabel`      | `Content`                                                     | -                    | Custom value label content          |
| `children`        | `Content \| (values: ProgressBarRenderProps) => Content`      | -                    | Content or render prop              |

### Render Props

When using the render prop pattern, these values are provided:

| Prop              | Type      | Description                            |
| ----------------- | --------- | -------------------------------------- |
| `percentage`      | `number`  | The percentage of the progress (0-100) |
| `valueText`       | `string`  | The formatted value text               |
| `isIndeterminate` | `boolean` | Whether progress is indeterminate      |

::api{symbol="@rivetjs/ui/progress-bar#ProgressBarRootProps"}

## Related Components
