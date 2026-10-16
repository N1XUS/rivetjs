---
title: Kpi
description: "A metric card: title, formatted value, trend, description and an optional sparkline, in three surface variants."
template: reference
status: experimental
related: [components/trend-chip, components/chart, components/card]
---

`Kpi` is the card at the top of a dashboard: one number, how it changed, and a small chart of its recent history. Parts are compound (`Kpi.Header`, `Kpi.Value`, `Kpi.Trend`, `Kpi.Chart`, …) so the layout stays yours; everything is server-rendered markup.

## Usage

```tsx
import { Kpi } from "@rivetjs/ui/kpi";
```

::example{id=kpi-basic}

## Anatomy

```tsx
import { Kpi } from "@rivetjs/ui/kpi";

export default function Anatomy() {
  return (
    <Kpi>
      <Kpi.Header>
        <Kpi.Title>Net revenue</Kpi.Title>
        <Kpi.Icon>…</Kpi.Icon>
      </Kpi.Header>
      <Kpi.Body>
        <Kpi.Value value={48210} formatOptions={{ style: "currency", currency: "USD" }} />
        <Kpi.Trend trend="up">9.6%</Kpi.Trend>
      </Kpi.Body>
      <Kpi.Description>vs. last period</Kpi.Description>
      <Kpi.Chart>…</Kpi.Chart>
      <Kpi.Footer>…</Kpi.Footer>
    </Kpi>
  );
}
```

`Kpi.Value` formats a number with `Intl.NumberFormat` (`formatOptions`, `locale`; one cached formatter per locale and options); pass an accessor to update it live, or children for a preformatted string. `Kpi.Trend` is a small [TrendChip](/components/trend-chip/). Put a [Sparkline](/components/chart/) in `Kpi.Chart`: it runs edge to edge across the card, and as the last part (no `Kpi.Footer`) it also reaches the bottom edge, clipped to the rounded corners.

## Variants

::example{id=kpi-variants}

`default` is a raised surface, `secondary` a flat tinted one, `transparent` drops the surface for KPIs inside an existing card.

## Styling Reference

### CSS Classes

- `.kpi` - The card. Modifiers `.kpi--default` / `.kpi--secondary` / `.kpi--transparent`.
- `.kpi__header`, `.kpi__title`, `.kpi__icon` - Title row.
- `.kpi__body`, `.kpi__value` - The value row (value + trend).
- `.kpi__description`, `.kpi__chart`, `.kpi__footer` - Supporting rows. `.kpi__chart` bleeds through the card padding (to the bottom edge too when it is the last child).

### CSS Variables

- `--kpi-padding` - The card padding (default `--spacing(4)`, `0` for `transparent`); the chart bleed follows it, so change the padding through this variable rather than a `p-*` class.

### Data Attributes

- `[data-slot]`: `kpi`, `kpi-header`, `kpi-title`, `kpi-icon`, `kpi-body`, `kpi-value`, `kpi-trend`, `kpi-description`, `kpi-chart`, `kpi-footer`.

## API Reference

### Kpi

| Prop      | Type                                            | Default     | Description            |
| --------- | ----------------------------------------------- | ----------- | ---------------------- |
| `variant` | `"default"` \| `"secondary"` \| `"transparent"` | `"default"` | Surface                |
| `class`   | `string`                                        | -           | Additional CSS classes |

### Kpi.Value

| Prop            | Type                       | Default | Description                           |
| --------------- | -------------------------- | ------- | ------------------------------------- |
| `value`         | `number` \| `() => number` | -       | The number (an accessor updates live) |
| `formatOptions` | `Intl.NumberFormatOptions` | -       | Number format                         |
| `locale`        | `string`                   | -       | Format locale                         |
| `children`      | `Content`                  | -       | Preformatted value instead of `value` |

### Kpi.Trend

The [TrendChip](/components/trend-chip/) props, size `sm`.

### Other parts

`Kpi.Header`, `Kpi.Icon`, `Kpi.Body`, `Kpi.Description`, `Kpi.Chart`, `Kpi.Footer` take `div` props and `class`; `Kpi.Title` is an `h3`.

## Related Components

- [TrendChip](/components/trend-chip/): The change indicator.
- [Chart](/components/chart/): Sparkline, area, line, bar and donut charts.
- [Card](/components/card/): General purpose surface.
