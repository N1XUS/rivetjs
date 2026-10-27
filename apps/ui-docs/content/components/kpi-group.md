---
title: KpiGroup
description: "Several KPI cards on one shared surface, side by side or stacked, with separators between them."
template: reference
status: experimental
related: [components/kpi, components/widget, components/number-value]
---

`KpiGroup` puts [Kpi](/components/kpi/) cards on one surface: the group draws the background and shadow, the cards inside drop their own and share the width. Horizontal groups wrap below about 12rem per card, so a row of four becomes two rows on a phone. Pure markup: no script.

## Usage

```tsx
import { KpiGroup } from "@rivetjs/ui/kpi-group";
```

::example{id=kpi-group-basic}

## Anatomy

```tsx
import { Kpi } from "@rivetjs/ui/kpi";
import { KpiGroup } from "@rivetjs/ui/kpi-group";

export default function Anatomy() {
  return (
    <KpiGroup>
      <Kpi>…</Kpi>
      <KpiGroup.Separator />
      <Kpi>…</Kpi>
    </KpiGroup>
  );
}
```

## Vertical

`orientation="vertical"` stacks the cards; separators turn horizontal.

::example{id=kpi-group-vertical}

## With From Suffix

Show the previous value next to the current one. [NumberValue](/components/number-value/) formats both the same way.

::example{id=kpi-group-from-suffix}

## Styling Reference

### CSS Classes

- `.kpi-group` - The shared surface. Modifiers `.kpi-group--horizontal` (equal-width cards that wrap) / `.kpi-group--vertical` (stacked).
- `.kpi-group__separator` - The 1px divider: vertical in a horizontal group, horizontal in a vertical one.
- `.kpi-group > .kpi` - Cards inside drop their own surface.

### Data Attributes

- `[data-slot]`: `kpi-group`, `kpi-group-separator`.
- `[data-orientation]`: `horizontal` / `vertical` on the root.

## API Reference

### KpiGroup

| Prop          | Type                         | Default        | Description              |
| ------------- | ---------------------------- | -------------- | ------------------------ |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Layout direction         |
| `class`       | `string`                     | -              | Additional CSS classes   |
| `children`    | `Content`                    | -              | Kpi cards and separators |

Also takes `div` props.

### KpiGroup.Separator

A decorative line (`aria-hidden`); takes `span` props and `class`.

## Accessibility

The root is a `div role="group"`: give it an `aria-label` when the page has several groups. Separators are hidden from assistive technology.

## Related Components

- [Kpi](/components/kpi/): The metric card.
- [Widget](/components/widget/): Dashboard container around groups and charts.
- [NumberValue](/components/number-value/): Locale-aware number formatting.
