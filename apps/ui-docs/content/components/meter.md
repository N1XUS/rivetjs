---
title: Meter
description: "A meter represents a quantity within a known range, or a fractional value."
template: reference
status: experimental
related: [components/progress-bar, components/progress-circle]
---

`Meter` shows a known quantity inside a range (storage used, battery, a score). For task progress use a [ProgressBar](progress-bar.md). The root is the [cdk Meter](site:cdk/components/meter/) (`role="meter"`, `aria-valuenow`, `aria-valuetext`); the parts are styled elements.

Notes:

- `class`, not `className`.
- Value props also accept accessors (a cdk superset).
- Context `state` fields are accessors, not React snapshot values.
- SVG / style attributes keep their DOM names (`stroke-dasharray`, `width: 60%`); same output.

## Usage

```tsx
import { Meter } from "@rivetjs/ui/meter";
import { Label } from "@rivetjs/ui/label";
```

::example{id=meter-basic}

## Anatomy

```tsx
import { Meter } from "@rivetjs/ui/meter";
import { Label } from "@rivetjs/ui/label";

export default () => (
  <Meter value={60}>
    <Label>Storage</Label>
    <Meter.Output />
    <Meter.Track>
      <Meter.Fill />
    </Meter.Track>
  </Meter>
);
```

Additional exported parts: `Meter.Root`.

## Examples

### Sizes

::example{id=meter-sizes}

### Colors

::example{id=meter-colors}

### Without Label

When no visible label is needed, use `aria-label` for accessibility.

::example{id=meter-without-label}

### Custom Value Scale

Use `minValue`, `maxValue`, and `formatOptions` to customize the value range and display format.

::example{id=meter-custom-value}

## Customization

### Tailwind CSS

::example{id=meter-custom-styles}

### Global CSS

To customize the Meter component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .meter {
    @apply w-full gap-2;
  }

  .meter__track {
    @apply h-3 rounded-full;
  }

  .meter__fill {
    @apply rounded-full;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `meter-output`, `meter-track`, `meter-fill`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Meter component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/meter.css)):

#### Base & Element Classes

- `.meter` - Base container (grid layout)
- `.meter__output` - Value text display
- `.meter__track` - Track background
- `.meter__fill` - Filled portion of the track

#### Size Classes

- `.meter--sm` - Small size variant (thinner track)
- `.meter--md` - Medium size variant (default)
- `.meter--lg` - Large size variant (thicker track)

#### Color Classes

- `.meter--default` - Default color variant
- `.meter--accent` - Accent color variant
- `.meter--success` - Success color variant
- `.meter--warning` - Warning color variant
- `.meter--danger` - Danger color variant

## API Reference

See the [full module API](/api/rivetjs/ui/meter/) for every named export and part prop type.

### Meter

Inherits from [React Aria Meter](https://react-spectrum.adobe.com/react-aria/Meter.html).

| Prop            | Type                                                          | Default              | Description                         |
| --------------- | ------------------------------------------------------------- | -------------------- | ----------------------------------- |
| `value`         | `number`                                                      | `0`                  | The current value                   |
| `minValue`      | `number`                                                      | `0`                  | The minimum value                   |
| `maxValue`      | `number`                                                      | `100`                | The maximum value                   |
| `size`          | `"sm" \| "md" \| "lg"`                                        | `"md"`               | Size of the meter track             |
| `color`         | `"default" \| "accent" \| "success" \| "warning" \| "danger"` | `"accent"`           | Color of the fill bar               |
| `formatOptions` | `Intl.NumberFormatOptions`                                    | `{style: 'percent'}` | Number format for the value display |
| `valueLabel`    | `Content`                                                     | -                    | Custom value label content          |
| `children`      | `Content \| (values: MeterRenderProps) => Content`            | -                    | Content or render prop              |

### Render Props

When using the render prop pattern, these values are provided:

| Prop         | Type                        | Description                         |
| ------------ | --------------------------- | ----------------------------------- |
| `percentage` | `() => number`              | The percentage of the meter (0-100) |
| `valueText`  | `() => string \| undefined` | The formatted value text            |

::api{symbol="@rivetjs/ui/meter#MeterRootProps"}

## Accessibility

`role="meter"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext` from the cdk. A [Label](label.md) child labels it (`aria-labelledby`).

## Related Components

- [ProgressBar](/components/progress-bar/)
- [ProgressCircle](/components/progress-circle/)
