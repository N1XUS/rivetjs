---
title: AreaChart
description: "Filled area charts rendered on the server as SVG and HTML: one or more series, stacked areas, sparklines and script-free tooltips."
template: reference
status: experimental
related: [components/chart, components/chart-tooltip, components/kpi]
---

`AreaChart` draws one or more series as filled areas under a line. Like the other [charts](/components/chart/) it is computed and rendered on the server from plain data: no chart library, no canvas and no script in the browser. With tooltips enabled, every x value is a labelled, focusable slot whose tooltip, guide and dots appear on hover and keyboard focus with CSS alone.

:::note
Rivet addition. The section list covers the usual Area Chart patterns; the implementation and the demo content are Rivet's own.
:::

## Usage

```tsx
import { AreaChart } from "@rivetjs/ui/chart";
```

::example{id=area-chart-basic}

`data` holds one object per x value, `index` names the key of the x label and `series` lists the plotted keys (`{ key, label?, color?, dashed? }`). Colours default to the `--chart-1` … `--chart-6` palette; the y axis gets rounded ticks from the data range.

## Anatomy

`AreaChart` is a single data-driven component: it builds the legend, axes, grid, areas and tooltip slots from its props. Hide parts with `showLegend` / `showGrid` / `showXAxis` / `showYAxis` / `showTooltip`, and replace the tooltip content with `tooltip`. `Sparkline` (same module) is the axis-free, tooltip-free variant.

## Examples

### Custom Tooltip

`tooltip` receives the hovered `ChartPoint` (`{ index, label, items }`) and returns the tooltip content, here a [ChartTooltip](/components/chart-tooltip/) with line indicators and a total row. It is rendered on the server for every x value, like the default tooltip.

::example{id=area-chart-custom-tooltip}

### KPI With Area Chart

An area chart without axes or grid fills the chart part of a [Kpi](/components/kpi/) card edge to edge. Unlike `Sparkline`, it keeps the focusable slots and tooltips.

::example{id=area-chart-kpi}

### Multi Area

Several series overlap, each with its own gradient fill; the legend appears with two or more series. `curve` is `"monotone"` (default, never overshoots the data) or `"linear"`.

::example{id=area-chart-multi-area}

### Sparkline

`Sparkline` is an area chart without axes, grid, legend or tooltip, sized to its container: a trend next to a value.

::example{id=area-chart-sparkline}

### Stacked

`stacked` stacks the series: each area starts where the previous one ends, so the top edge shows the total. A missing value counts as 0 in a stack, so the layers stay closed.

::example{id=area-chart-stacked}

### Behaviour without JavaScript

Everything is static markup: the server computes the paths, and the tooltips are CSS. `data`, `series` and the formatters are read once; to switch data (a period picker), re-create the chart with `<Show keyed when={period()}>`.

## Styling Reference

Shared chart classes, variables and data attributes: [Chart styling](/components/chart/#styling-reference).

### CSS Classes

- `.chart.chart--area` - The figure (`.chart--sparkline` for `Sparkline`).
- `.chart__svg`, `.chart__area`, `.chart__line` (`[data-dashed]`), `.chart__dot`, `.chart__guide` - Area drawing, hover / focus dots and guide.
- `.chart__points`, `.chart__point` - The always visible dots of `showDots`.

## API Reference

See the [full module API](/api/rivetjs/ui/chart/) for every named export and part prop type.

### AreaChart

| Prop                                                                  | Type                                  | Default        | Description                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `data`                                                                | `ChartDatum[]`                        | -              | One object per x value                                                                       |
| `index`                                                               | `string`                              | -              | Key of the x label                                                                           |
| `series`                                                              | `ChartSeries[]`                       | -              | `{ key, label?, color?, dashed? }` per series                                                |
| `height`                                                              | `number`                              | `240`          | Plot height in px                                                                            |
| `valueFormatter`                                                      | `(value: number) => string`           | grouped number | Y axis and tooltip values                                                                    |
| `indexFormatter`                                                      | `(value: string \| number) => string` | -              | X labels                                                                                     |
| `minValue` / `maxValue`                                               | `number`                              | from data      | Y range                                                                                      |
| `stacked`                                                             | `boolean`                             | `false`        | Stack the series                                                                             |
| `curve`                                                               | `"monotone"` \| `"linear"`            | `"monotone"`   | Line shape                                                                                   |
| `showDots`                                                            | `boolean`                             | `false`        | A dot on every point                                                                         |
| `connectNulls`                                                        | `boolean`                             | `false`        | Draw across missing values instead of a gap                                                  |
| `showLegend` / `showGrid` / `showXAxis` / `showYAxis` / `showTooltip` | `boolean`                             | `true`         | Toggle parts (legend: shown with 2+ series)                                                  |
| `aria-label`                                                          | `string`                              | -              | Accessible name of the figure                                                                |
| `tooltip`                                                             | `(point: ChartPoint) => JSX.Element`  | -              | Custom tooltip per x value (server-rendered; see [ChartTooltip](/components/chart-tooltip/)) |

### Sparkline

Takes the `AreaChart` props except `showLegend`, `showGrid`, `showXAxis` and `showYAxis`; it never renders a tooltip. `height` defaults to `48`.

## Accessibility

With tooltips enabled, each x value is a focusable `role="group"` slot named by its values; the SVG geometry and the tooltip copies are hidden from assistive technology. Give the chart an `aria-label` and provide a textual summary or table for essential data. `Sparkline` has no slots: name it with `aria-label` and show the value it summarises as text.

## Related Components

- [Chart](/components/chart/): Overview of the chart module, donut charts, shared styling.
- [LineChart](/components/line-chart/): Lines, dashed comparisons and gaps.
- [BarChart](/components/bar-chart/): Grouped, stacked and horizontal bars.
- [ChartTooltip](/components/chart-tooltip/): Parts for a custom `tooltip`.
- [Kpi](/components/kpi/): Metric cards with a chart.
