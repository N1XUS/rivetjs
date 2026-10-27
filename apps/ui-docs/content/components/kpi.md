---
title: Kpi
description: "A metric card: title, icon, formatted value, trend, progress, an optional sparkline, actions and footer, in three surface variants."
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
      <Kpi.Actions>…</Kpi.Actions>
      <Kpi.Body>
        <Kpi.Value value={48210} formatOptions={{ style: "currency", currency: "USD" }} />
        <Kpi.Trend trend="up">9.6%</Kpi.Trend>
      </Kpi.Body>
      <Kpi.Progress value={64} />
      <Kpi.Description>vs. last period</Kpi.Description>
      <Kpi.Chart>…</Kpi.Chart>
      <Kpi.Separator />
      <Kpi.Footer>…</Kpi.Footer>
    </Kpi>
  );
}
```

`Kpi.Value` formats a number with `Intl.NumberFormat` (`formatOptions`, `locale`; one cached formatter per locale and options); pass an accessor to update it live, or children for a preformatted string. `Kpi.Trend` is a small [TrendChip](/components/trend-chip/). Put a [Sparkline](/components/chart/) in `Kpi.Chart`: it runs edge to edge across the card, and as the last part (no `Kpi.Footer`) it also reaches the bottom edge, clipped to the rounded corners.

Additional exported parts: `Kpi.Root`.

## Examples

### Variants

::example{id=kpi-variants}

`default` is a raised surface, `secondary` a flat tinted one, `transparent` drops the surface for KPIs inside an existing card.

### With Icon

::example{id=kpi-with-icon}

`Kpi.Icon` `status` (`success` / `warning` / `danger`) tints the icon background.

### With Actions

::example{id=kpi-with-actions}

`Kpi.Actions` is a corner slot: put your own [Button](/components/button/) or [Dropdown](/components/dropdown/) in it.

### With Progress

::example{id=kpi-with-progress}

### With Footer

::example{id=kpi-with-footer}

### With Chart Inline

::example{id=kpi-with-chart-inline}

`Kpi.Content` places the value and the trend side by side (like `Kpi.Body`, centred); lay it out next to a chart with your own classes.

### With Chart Bottom

::example{id=kpi-with-chart-bottom}

## Styling Reference

### CSS Classes

- `.kpi` - The card. Modifiers `.kpi--default` / `.kpi--secondary` / `.kpi--transparent`.
- `.kpi__header`, `.kpi__title`, `.kpi__icon` - Title row.
- `.kpi__body`, `.kpi__value` - The value row (value + trend).
- `.kpi__content` - Value and trend side by side.
- `.kpi__progress`, `.kpi__progress-bar` - The progress track and bar (`--kpi-progress`).
- `.kpi__actions` - The corner actions slot.
- `.kpi__separator` - An edge-to-edge divider.
- `.kpi__description`, `.kpi__chart`, `.kpi__footer` - Supporting rows. `.kpi__chart` bleeds through the card padding (to the bottom edge too when it is the last child).

### CSS Variables

- `--kpi-padding` - The card padding (default `--spacing(4)`, `0` for `transparent`); the chart and separator bleed follow it, so change the padding through this variable rather than a `p-*` class.
- `--kpi-progress` - The progress fill (set from `Kpi.Progress` `value`).

### Data Attributes

- `[data-slot]`: `kpi`, `kpi-header`, `kpi-title`, `kpi-icon`, `kpi-body`, `kpi-content`, `kpi-value`, `kpi-trend`, `kpi-progress`, `kpi-description`, `kpi-chart`, `kpi-actions`, `kpi-separator`, `kpi-footer`.
- `[data-status]` on `.kpi__icon` and `.kpi__progress`: `success` / `warning` / `danger`.

## API Reference

See the [full module API](/api/rivetjs/ui/kpi/) for every named export and part prop type.

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

### Kpi.Icon

| Prop     | Type                                     | Default | Description          |
| -------- | ---------------------------------------- | ------- | -------------------- |
| `status` | `"success"` \| `"warning"` \| `"danger"` | -       | Tints the background |

### Kpi.Progress

| Prop         | Type                                     | Default      | Description     |
| ------------ | ---------------------------------------- | ------------ | --------------- |
| `value`      | `number`                                 | -            | 0…100 (clamped) |
| `status`     | `"success"` \| `"warning"` \| `"danger"` | `"success"`  | Bar colour      |
| `aria-label` | `string`                                 | `"Progress"` | Accessible name |

A `div role="progressbar"` with `aria-valuenow`.

### Other parts

`Kpi.Header`, `Kpi.Body`, `Kpi.Content`, `Kpi.Description`, `Kpi.Chart`, `Kpi.Actions`, `Kpi.Footer` take `div` props and `class`; `Kpi.Title` is an `h3`; `Kpi.Separator` an `hr`.

## Accessibility

`Kpi.Title` renders a heading. `Kpi.Progress` has `role="progressbar"`, a 0–100 range and a default name of “Progress”; set `aria-label` to name the metric. Give action buttons accessible names and explain trend status in text.

## Related Components

- [TrendChip](/components/trend-chip/): The change indicator.
- [Chart](/components/chart/): Sparkline, area, line, bar and donut charts.
- [Card](/components/card/): General purpose surface.
