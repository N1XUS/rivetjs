---
title: ChartTooltip
description: "A tooltip card for chart data points: a header and one row per series with a dot or line indicator, a label and a value."
template: reference
status: experimental
related: [components/chart, components/pie-chart, components/composed-chart]
---

`ChartTooltip` is the card the charts show for a data point. It is plain markup: use it as is, or return it from a chart's `tooltip` render function to replace the default rows. The charts still render every tooltip on the server and show it with CSS on hover and keyboard focus, so a custom tooltip costs no script either.

## Usage

```tsx
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";
```

::example{id=chart-tooltip-basic}

## Anatomy

```tsx
import { ChartTooltip } from "@rivetjs/ui/chart-tooltip";

export default function Anatomy() {
  return (
    <ChartTooltip>
      <ChartTooltip.Header />
      <ChartTooltip.Item>
        <ChartTooltip.Indicator />
        <ChartTooltip.Label />
        <ChartTooltip.Value />
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}
```

## Auto Content

Every chart (`AreaChart`, `LineChart`, `BarChart`, `PieChart`, `RadarChart`, `RadialChart`, `ComposedChart`) takes `tooltip`, a function of the hovered `ChartPoint` (`{ index, label, items: { key, name, value, formatted, color }[] }`). `ChartTooltip.Content` lays out a point's label and items.

::example{id=chart-tooltip-auto-content}

## Chart Colors

::example{id=chart-tooltip-chart-colors}

## Custom Formatters

::example{id=chart-tooltip-custom-formatters}

## Inactive

::example{id=chart-tooltip-inactive}

## Line Indicator

::example{id=chart-tooltip-line-indicator}

## No Header

::example{id=chart-tooltip-no-header}

## Styling Reference

### CSS Classes

- `.chart-tooltip` - The card (surface, border, overlay shadow).
- `.chart-tooltip__header` - Title row (muted, medium weight).
- `.chart-tooltip__item` - One series row.
- `.chart-tooltip__indicator` - The colour marker; `.chart-tooltip__indicator--dot` (8px circle) / `--line` (12 × 4px pill).
- `.chart-tooltip__label` - Series name (muted, fills the row).
- `.chart-tooltip__value` - Series value (semibold, tabular numbers).

### CSS Variables

| Variable        | Default    | Description                |
| --------------- | ---------- | -------------------------- |
| `--chart-color` | `--accent` | Indicator colour (`color`) |

### Data Attributes

- `[data-indicator]` on the card: `dot` / `line`.

## API Reference

### ChartTooltip

| Prop        | Type                | Default | Description                          |
| ----------- | ------------------- | ------- | ------------------------------------ |
| `active`    | `boolean`           | `true`  | `false` renders nothing              |
| `indicator` | `"dot"` \| `"line"` | `"dot"` | Shape of every indicator in the card |
| `children`  | `Content`           | -       | Header and items                     |

Also supports all native div attributes.

### ChartTooltip.Content

| Prop             | Type                                   | Default | Description                     |
| ---------------- | -------------------------------------- | ------- | ------------------------------- |
| `label`          | `string \| number`                     | -       | Header text (the point's label) |
| `payload`        | `{ name, value, color? }[]`            | -       | One row per series              |
| `hideHeader`     | `boolean`                              | `false` | No header row                   |
| `indicator`      | `"dot"` \| `"line"`                    | `"dot"` | Indicator shape                 |
| `labelFormatter` | `(label: string \| number) => Content` | -       | Formats the header              |
| `valueFormatter` | `(value: number \| string) => Content` | -       | Formats every value             |

### ChartTooltip.Header / Item / Label / Value

Plain `div` / `span` parts; all native attributes.

### ChartTooltip.Indicator

| Prop        | Type                | Default       | Description       |
| ----------- | ------------------- | ------------- | ----------------- |
| `color`     | `string`            | `--accent`    | Any CSS colour    |
| `indicator` | `"dot"` \| `"line"` | from the root | Shape of this one |

## Related Components

- [Chart](/components/chart/): Area, line, bar and donut charts.
- [PieChart](/components/pie-chart/): Pie and donut charts.
- [ComposedChart](/components/composed-chart/): Bars, lines and areas together.
