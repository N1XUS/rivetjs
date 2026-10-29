---
title: LineChart
description: "Line charts rendered on the server as SVG and HTML: several series, dots, dashed comparisons, gaps, sparklines and script-free tooltips."
template: reference
status: experimental
related: [components/chart, components/area-chart, components/chart-tooltip]
---

`LineChart` draws one or more series as lines over an x axis: trends, comparisons with a previous period or a target, and series with missing values. Like the other [charts](/components/chart/) it is computed and rendered on the server from plain data: no chart library, no canvas and no script in the browser. With tooltips enabled, every x value is a labelled, focusable slot whose tooltip, guide and dots appear on hover and keyboard focus with CSS alone.

:::note
Rivet addition. The section list covers the usual Line Chart patterns (plus Missing Values); the implementation and the demo content are Rivet's own.
:::

## Usage

```tsx
import { LineChart } from "@rivetjs/ui/chart";
```

::example{id=line-chart-basic}

`data` holds one object per x value, `index` names the key of the x label and `series` lists the plotted keys (`{ key, label?, color?, dashed? }`). `valueFormatter` formats the y axis and the tooltip values; `indexFormatter` the x labels. `minValue` / `maxValue` fix the y range, and `curve` is `"monotone"` (default, never overshoots the data) or `"linear"`.

## Anatomy

`LineChart` is a single data-driven component: it builds the legend, axes, grid, lines and tooltip slots from its props. Hide parts with `showLegend` / `showGrid` / `showXAxis` / `showYAxis` / `showTooltip`, and replace the tooltip content with `tooltip`.

## Examples

### Dashed Comparison

A series with `dashed: true` draws its line dashed (a previous period, a target).

::example{id=line-chart-dashed-comparison}

### KPI With Chart

A line chart without axes or grid fills the chart part of a [Kpi](/components/kpi/) card edge to edge; its points keep the focusable slots and tooltips.

::example{id=line-chart-kpi}

### Multi Line Chart Colors

Each series takes any CSS colour as `color`, or a palette token such as `var(--chart-3)`. The legend, dots and tooltip follow it.

::example{id=line-chart-multi-colors}

### Portfolio

A [Card](/components/card/) composition: the total as a [NumberValue](/components/number-value/) with a [TrendChip](/components/trend-chip/), the value against a dashed benchmark (`minValue` keeps the y range tight), and an allocation bar below.

::example{id=line-chart-portfolio}

### Sparkline

With every part off but the line (`showLegend`, `showGrid`, `showXAxis`, `showYAxis` and `showTooltip` set to `false`), a line chart is a sparkline that fills its box. For a filled one, use `Sparkline` ([AreaChart: Sparkline](/components/area-chart/#sparkline)).

::example{id=line-chart-sparkline}

### Stats With Chart

Stats with their trends above a chart of the same period, in one card.

::example{id=line-chart-stats-with-chart}

### Traffic Source

Four series with the built-in legend off (`showLegend={false}`) and a list of totals and shares in its place.

::example{id=line-chart-traffic-source}

### With Custom Tooltip

`tooltip` receives the hovered `ChartPoint` (`{ index, label, items }`) and returns the tooltip content, here a [ChartTooltip](/components/chart-tooltip/) with a status row derived from the values. It is rendered on the server for every x value, like the default tooltip.

::example{id=line-chart-custom-tooltip}

### With Dots

`showDots` draws a dot on every data point; without it, dots appear on the hovered or focused x value only.

::example{id=line-chart-with-dots}

### Missing Values

A `null` value (or a missing key) is no value: the line breaks into separate runs, the hovered x value lists only the series that have a value, and a slot with no values is named "no data". `connectNulls` draws straight across the gaps instead.

::example{id=line-chart-gaps}

### Behaviour without JavaScript

Everything is static markup: the server computes the paths, and the tooltips are CSS. `data`, `series` and the formatters are read once; to switch data (a period picker), re-create the chart with `<Show keyed when={period()}>`.

## Styling Reference

Shared chart classes, variables and data attributes: [Chart styling](/components/chart/#styling-reference).

### CSS Classes

- `.chart.chart--line` - The figure.
- `.chart__svg`, `.chart__line` (`[data-dashed]`), `.chart__dot`, `.chart__guide` - Line drawing, hover / focus dots and guide.
- `.chart__points`, `.chart__point` - The always visible dots of `showDots`.

## API Reference

See the [full module API](/api/rivetjs/ui/chart/) for every named export and part prop type.

### LineChart

| Prop                                                                  | Type                                  | Default        | Description                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `data`                                                                | `ChartDatum[]`                        | -              | One object per x value                                                                       |
| `index`                                                               | `string`                              | -              | Key of the x label                                                                           |
| `series`                                                              | `ChartSeries[]`                       | -              | `{ key, label?, color?, dashed? }` per series                                                |
| `height`                                                              | `number`                              | `240`          | Plot height in px                                                                            |
| `valueFormatter`                                                      | `(value: number) => string`           | grouped number | Y axis and tooltip values                                                                    |
| `indexFormatter`                                                      | `(value: string \| number) => string` | -              | X labels                                                                                     |
| `minValue` / `maxValue`                                               | `number`                              | from data      | Y range                                                                                      |
| `curve`                                                               | `"monotone"` \| `"linear"`            | `"monotone"`   | Line shape                                                                                   |
| `showDots`                                                            | `boolean`                             | `false`        | A dot on every point                                                                         |
| `connectNulls`                                                        | `boolean`                             | `false`        | Draw across missing values instead of a gap                                                  |
| `showLegend` / `showGrid` / `showXAxis` / `showYAxis` / `showTooltip` | `boolean`                             | `true`         | Toggle parts (legend: shown with 2+ series)                                                  |
| `aria-label`                                                          | `string`                              | -              | Accessible name of the figure                                                                |
| `tooltip`                                                             | `(point: ChartPoint) => JSX.Element`  | -              | Custom tooltip per x value (server-rendered; see [ChartTooltip](/components/chart-tooltip/)) |

## Accessibility

With tooltips enabled, each x value is a focusable `role="group"` slot named by its values; the SVG geometry and the tooltip copies are hidden from assistive technology. Give the chart an `aria-label` and provide a textual summary or table for essential data. With `showTooltip={false}` (a sparkline) there are no slots: show the summarised value as text.

## Related Components

- [Chart](/components/chart/): Overview of the chart module, donut charts, shared styling.
- [AreaChart](/components/area-chart/): Filled areas, stacked areas and sparklines.
- [BarChart](/components/bar-chart/): Grouped, stacked and horizontal bars.
- [ComposedChart](/components/composed-chart/): Lines with bars and areas on one set of axes.
- [ChartTooltip](/components/chart-tooltip/): Parts for a custom `tooltip`.
