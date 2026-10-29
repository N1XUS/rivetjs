---
title: BarChart
description: "Bar charts rendered on the server as HTML: grouped, stacked, horizontal and comparison bars with legends, axes and script-free tooltips."
template: reference
status: experimental
related: [components/chart, components/area-chart, components/chart-tooltip]
---

`BarChart` compares values across categories as vertical or horizontal bars, grouped side by side or stacked. Like the other [charts](/components/chart/) it is computed and rendered on the server from plain data: no chart library, no canvas and no script in the browser. With tooltips enabled, every category is a labelled, focusable slot whose tooltip appears on hover and keyboard focus with CSS alone.

:::note
Rivet addition. The section list follows HeroUI Pro's public Bar Chart docs; the implementation and the demo content are Rivet's own.
:::

## Usage

```tsx
import { BarChart } from "@rivetjs/ui/chart";
```

::example{id=bar-chart-basic}

`data` holds one object per category, `index` names the key of the category label and `series` lists the plotted keys (`{ key, label?, color? }`). Colours default to the `--chart-1` … `--chart-6` palette; the value axis gets rounded ticks from the data range and starts at 0 for positive data.

## Anatomy

`BarChart` is a single data-driven component: it builds the legend, axes, grid, bars and tooltip slots from its props. Hide parts with `showLegend` / `showGrid` / `showXAxis` / `showYAxis` / `showTooltip`, and replace the tooltip content with `tooltip`.

## Examples

### Comparison

Two periods side by side: give the previous one a muted `color` so the current period stands out. The legend and the tooltip follow the series colours.

::example{id=bar-chart-comparison}

### Custom Tooltip

`tooltip` receives the hovered `ChartPoint` (`{ index, label, items }`) and returns the tooltip content, here a [ChartTooltip](/components/chart-tooltip/) with a derived row (the share of a plan). It is rendered on the server for every category, like the default tooltip.

::example{id=bar-chart-custom-tooltip}

### Grouped

Without `stacked`, the series of one category sit side by side; the whole group is one focusable slot. A missing value keeps an empty place in its group.

::example{id=bar-chart-grouped}

### Horizontal

`orientation="horizontal"` puts the categories down the side (labels in a `categoryWidth` column, default `6rem`) and grows the bars along the inline axis, so they start at the right in right-to-left pages. The value ticks run along the bottom.

::example{id=bar-chart-horizontal}

### Horizontal Stacked

::example{id=bar-chart-horizontal-stacked}

### KPI With Bar Chart

A compact bar chart without the value axis or grid in the chart part of a [Kpi](/components/kpi/) card; the day labels and tooltips stay.

::example{id=bar-chart-kpi}

### Stacked

`stacked` stacks the series in one bar per category; a missing value counts as 0.

::example{id=bar-chart-stacked}

### Behaviour without JavaScript

Everything is static markup: the server computes the bars, and the tooltips are CSS. `data`, `series` and the formatters are read once; to switch data (a period picker), re-create the chart with `<Show keyed when={period()}>`.

## Styling Reference

Shared chart classes, variables and data attributes: [Chart styling](/components/chart/#styling-reference).

### CSS Classes

- `.chart.chart--bar` - The figure; `.chart--horizontal` (and `[data-orientation="horizontal"]`) on a horizontal bar chart.
- `.chart__bars`, `.chart__bar-group`, `.chart__bar-stack`, `.chart__bar` - Bars: one group (side by side) or stack per category.

### CSS Variables

| Variable               | Default | Description                                                  |
| ---------------------- | ------- | ------------------------------------------------------------ |
| `--chart-y-axis-width` | `3rem`  | Width of the value labels (horizontal bars: `categoryWidth`) |

## API Reference

See the [full module API](/api/rivetjs/ui/chart/) for every named export and part prop type.

### BarChart

| Prop                                                                  | Type                                  | Default        | Description                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `data`                                                                | `ChartDatum[]`                        | -              | One object per x value                                                                       |
| `index`                                                               | `string`                              | -              | Key of the x label                                                                           |
| `series`                                                              | `ChartSeries[]`                       | -              | `{ key, label?, color?, dashed? }` per series                                                |
| `height`                                                              | `number`                              | `240`          | Plot height in px                                                                            |
| `valueFormatter`                                                      | `(value: number) => string`           | grouped number | Y axis and tooltip values                                                                    |
| `indexFormatter`                                                      | `(value: string \| number) => string` | -              | X labels                                                                                     |
| `minValue` / `maxValue`                                               | `number`                              | from data      | Y range                                                                                      |
| `stacked`                                                             | `boolean`                             | `false`        | Stack the series in one bar                                                                  |
| `orientation`                                                         | `"vertical"` \| `"horizontal"`        | `"vertical"`   | `"horizontal"` = categories down the side, bars grow sideways                                |
| `categoryWidth`                                                       | `string`                              | `"6rem"`       | Category label column of a horizontal bar chart                                              |
| `showLegend` / `showGrid` / `showXAxis` / `showYAxis` / `showTooltip` | `boolean`                             | `true`         | Toggle parts (legend: shown with 2+ series)                                                  |
| `aria-label`                                                          | `string`                              | -              | Accessible name of the figure                                                                |
| `tooltip`                                                             | `(point: ChartPoint) => JSX.Element`  | -              | Custom tooltip per x value (server-rendered; see [ChartTooltip](/components/chart-tooltip/)) |

## Accessibility

With tooltips enabled, each category is a focusable `role="group"` slot named by its values; the bars and the tooltip copies are hidden from assistive technology. Give the chart an `aria-label` and provide a textual summary or table for essential data.

## Related Components

- [Chart](/components/chart/): Overview of the chart module, donut charts, shared styling.
- [LineChart](/components/line-chart/): Lines, dashed comparisons and gaps.
- [AreaChart](/components/area-chart/): Area charts and sparklines.
- [ComposedChart](/components/composed-chart/): Bars with lines and areas on one set of axes.
- [ChartTooltip](/components/chart-tooltip/): Parts for a custom `tooltip`.
- [Kpi](/components/kpi/): Metric cards with a chart.
