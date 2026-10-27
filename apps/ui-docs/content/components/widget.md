---
title: Widget
description: "A dashboard container: tinted shell with a header, legend and footer around a raised content area for charts, tables or KPIs."
template: reference
status: experimental
related: [components/chart, components/kpi-group, components/table]
---

`Widget` gives dashboard content one consistent frame: a `surface-secondary` shell, a header with title, description and an inline legend, a raised `surface` content area (its radius concentric with the shell's), and an optional footer. It works with any content: charts, tables, KPIs. Pure markup: no script.

## Usage

```tsx
import { Widget } from "@rivetjs/ui/widget";
```

::example{id=widget-basic}

## Anatomy

```tsx
import { Widget } from "@rivetjs/ui/widget";

export default function Anatomy() {
  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>…</Widget.Title>
        <Widget.Description>…</Widget.Description>
        <Widget.Legend>
          <Widget.LegendItem color="var(--chart-1)">…</Widget.LegendItem>
        </Widget.Legend>
      </Widget.Header>
      <Widget.Content>…</Widget.Content>
      <Widget.Footer>…</Widget.Footer>
    </Widget>
  );
}
```

## With Bar Chart

::example{id=widget-bar-chart}

## With Line Chart

::example{id=widget-line-chart}

## With Pie Chart

::example{id=widget-pie-chart}

## With KPIs

Combine Widget with [KpiGroup](/components/kpi-group/) for a metrics overview with inline sparklines. `class="p-0"` on the content lets the group fill it.

::example{id=widget-kpis}

## Usage Summary

No chart: rows with [ProgressCircle](/components/progress-circle/) indicators.

::example{id=widget-usage-summary}

## With Table

Use `variant="secondary"` on the [Table](/components/table/) to drop its own background, and `class="p-0"` on the content for edge-to-edge rows.

::example{id=widget-table}

## Dashboard Grid

::example{id=widget-dashboard-grid}

## Styling Reference

### CSS Classes

- `.widget` - The tinted shell.
- `.widget__header`, `.widget__title`, `.widget__description` - Header row (title left, legend or actions right).
- `.widget__content` - The raised content area (`p-0` for edge-to-edge content).
- `.widget__footer` - Bottom row.
- `.widget__legend`, `.widget__legend-item`, `.widget__legend-item-dot`, `.widget__legend-item-label` - Inline legend.

### CSS Variables

- `--widget-inset` - Shell padding around the content (default `--spacing(1.5)`).
- `--widget-radius` - Shell radius; the content's radius is `--widget-radius` minus `--widget-inset`.
- `--widget-legend-color` - Dot colour of one legend item (set by `color`).

### Data Attributes

- `[data-slot]`: `widget`, `widget-header`, `widget-title`, `widget-description`, `widget-content`, `widget-footer`, `widget-legend`, `widget-legend-item`, `widget-legend-item-dot`, `widget-legend-item-label`.

## API Reference

### Widget

| Prop     | Type                       | Default | Description                        |
| -------- | -------------------------- | ------- | ---------------------------------- |
| `render` | `DOMRenderFunction<"div">` | -       | Render another element as the root |
| `class`  | `string`                   | -       | Additional CSS classes             |

Also takes `div` props.

### Widget.LegendItem

| Prop       | Type      | Default | Description                      |
| ---------- | --------- | ------- | -------------------------------- |
| `color`    | `string`  | -       | CSS colour of the dot (required) |
| `children` | `Content` | -       | Label                            |

### Other parts

`Widget.Header`, `Widget.Content`, `Widget.Footer`, `Widget.Legend` take `div` props and `class`; `Widget.Title` and `Widget.Description` are `span`s.

## Related Components

- [Chart](/components/chart/): Area, line, bar and donut charts.
- [KpiGroup](/components/kpi-group/): KPI cards on one surface.
- [Table](/components/table/): Data tables.
