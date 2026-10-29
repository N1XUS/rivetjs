---
title: Chart
description: "Area, line, bar, donut and sparkline charts rendered on the server as SVG and HTML, with legends, axes and script-free tooltips."
template: reference
status: experimental
related: [components/kpi, components/data-grid, components/meter]
---

`@rivetjs/ui/chart` draws the charts a dashboard needs from plain data: `AreaChart`, `LineChart`, `BarChart` (grouped or stacked), `DonutChart` and `Sparkline`. Charts are computed and rendered on the server: no chart library, no canvas and no script in the browser. Tooltips, guides and dots appear on hover and keyboard focus with CSS alone, and cartesian charts expose labelled, focusable data slots while tooltips are enabled. DonutChart and Sparkline use a different, non-interactive structure.

The cartesian charts have their own pages with every demo: [AreaChart](/components/area-chart/), [LineChart](/components/line-chart/) and [BarChart](/components/bar-chart/). This page is the overview: the props, styling and accessibility they share, plus `DonutChart` and `Sparkline`.

## Usage

```tsx
import { AreaChart, BarChart, DonutChart, LineChart, Sparkline } from "@rivetjs/ui/chart";
```

Cartesian charts take `data` (one object per x value), `index` (the key of the x label) and `series` (`{ key, label?, color?, dashed? }`). Colours default to the `--chart-1` … `--chart-6` palette; the y axis gets rounded ticks from the data range.

## Anatomy

This subpath exports separate `AreaChart`, `LineChart`, `BarChart`, `DonutChart` and `Sparkline` components; there is no `Chart` root. Cartesian components take `data`, `index` and `series`; DonutChart takes labelled values, and Sparkline takes the same `data`, `index` and `series` shape as AreaChart. The chart builds its plot, axes, legend and tooltip slots from those props.

## Examples

### Area

[AreaChart](/components/area-chart/) has its own page: usage, custom tooltip, KPI with area chart, multi area, sparkline and stacked demos.

### Line

[LineChart](/components/line-chart/) has its own page: usage, dashed comparison, KPI with chart, colours, portfolio, sparkline, stats with chart, traffic source, custom tooltip, dots and missing values demos.

### Bar

[BarChart](/components/bar-chart/) has its own page: usage, comparison, custom tooltip, grouped, horizontal, horizontal stacked, KPI with bar chart and stacked demos.

### Donut

::example{id=chart-donut}

`DonutChart` takes `{ key, label, value, color? }` segments; the centre shows the total (or `children`) above `centerLabel`, and the legend lists values and shares. `size` sets the outer size in pixels, `thickness` the ring.

### Sparkline

A `Sparkline` is an area chart without axes, grid, legend or tooltip, sized to its container; see [AreaChart: Sparkline](/components/area-chart/#sparkline) and [Kpi](/components/kpi/) for one in a metric card.

### Behaviour without JavaScript

Everything is static markup: the server computes the paths and bars, and the tooltips are CSS. `data`, `series` and the formatters are read once; to switch data (a period picker), re-create the chart with `<Show keyed when={period()}>`.

## Styling Reference

The component’s parts emit these additional `data-slot` values: `chart-legend`, `chart-plot`.

### CSS Classes

- `.chart` - The figure. Modifiers `.chart--area` / `--line` / `--bar` / `--donut` / `--sparkline`; `.chart--horizontal` on a horizontal bar chart.
- `.chart__legend`, `.chart__legend-item`, `.chart__legend-value`, `.chart__swatch` - The legend.
- `.chart__frame`, `.chart__y-axis`, `.chart__y-label`, `.chart__plot`, `.chart__grid`, `.chart__grid-line`, `.chart__x-axis`, `.chart__x-label` - Axes and grid; minor x labels hide below a 420px container.
- `.chart__svg`, `.chart__area`, `.chart__line` (`[data-dashed]`), `.chart__dot`, `.chart__guide` - Area and line drawing.
- `.chart__points`, `.chart__point` - The always visible dots of `showDots`.
- `.chart__bars`, `.chart__bar-group`, `.chart__bar-stack`, `.chart__bar` - Bars.
- `.chart__slots`, `.chart__slot`, `.chart__tooltip`, `.chart__tooltip-title`, `.chart__tooltip-row`, `.chart__tooltip-value` - Hover / focus slots and tooltips.
- `.chart__donut`, `.chart__donut-svg`, `.chart__donut-track`, `.chart__donut-segment`, `.chart__donut-center`, `.chart__donut-value` - Donut.

### CSS Variables

| Variable                  | Default                                  | Description                                                   |
| ------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| `--chart-1` … `--chart-6` | accent, cyan, violet, amber, pink, green | Series palette (theme tokens, also usable outside a chart)    |
| `--chart-color`           | -                                        | Colour of one series / segment (inline)                       |
| `--chart-height`          | `240px`                                  | Plot height (`height` prop)                                   |
| `--chart-y-axis-width`    | `3rem`                                   | Width of the y axis labels (horizontal bars: `categoryWidth`) |
| `--chart-donut-size`      | `160px`                                  | Donut size (`size` prop)                                      |

### Data Attributes

- `[data-slot]`: `chart-slot` (one per x value, focusable `role="group"` named by its values), `chart-tooltip`.
- Slot: `[data-side]` `start` / `end` (which side the tooltip opens).
- Figure: `[data-orientation="horizontal"]` on a horizontal bar chart.

## API Reference

See the [full module API](/api/rivetjs/ui/chart/) for every named export and part prop type.

### AreaChart / LineChart / BarChart

Shared props of the cartesian charts; each chart page lists the ones that apply to it.

| Prop                                                                  | Type                                  | Default        | Description                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `data`                                                                | `ChartDatum[]`                        | -              | One object per x value                                                                       |
| `index`                                                               | `string`                              | -              | Key of the x label                                                                           |
| `series`                                                              | `ChartSeries[]`                       | -              | `{ key, label?, color?, dashed? }` per series                                                |
| `height`                                                              | `number`                              | `240`          | Plot height in px                                                                            |
| `valueFormatter`                                                      | `(value: number) => string`           | grouped number | Y axis and tooltip values                                                                    |
| `indexFormatter`                                                      | `(value: string \| number) => string` | -              | X labels                                                                                     |
| `minValue` / `maxValue`                                               | `number`                              | from data      | Y range                                                                                      |
| `stacked`                                                             | `boolean`                             | `false`        | Stack series (area, bar)                                                                     |
| `curve`                                                               | `"monotone"` \| `"linear"`            | `"monotone"`   | Line shape (area, line)                                                                      |
| `showDots`                                                            | `boolean`                             | `false`        | A dot on every point (area, line)                                                            |
| `connectNulls`                                                        | `boolean`                             | `false`        | Draw across missing values instead of a gap (area, line)                                     |
| `orientation`                                                         | `"vertical"` \| `"horizontal"`        | `"vertical"`   | Bar direction (bar; `"horizontal"` = bars grow sideways)                                     |
| `categoryWidth`                                                       | `string`                              | `"6rem"`       | Category label column of a horizontal bar chart                                              |
| `showLegend` / `showGrid` / `showXAxis` / `showYAxis` / `showTooltip` | `boolean`                             | `true`         | Toggle parts (legend: shown with 2+ series)                                                  |
| `aria-label`                                                          | `string`                              | -              | Accessible name of the figure                                                                |
| `tooltip`                                                             | `(point: ChartPoint) => JSX.Element`  | -              | Custom tooltip per x value (server-rendered; see [ChartTooltip](/components/chart-tooltip/)) |

### DonutChart

| Prop             | Type                        | Default | Description                     |
| ---------------- | --------------------------- | ------- | ------------------------------- |
| `data`           | `DonutSegment[]`            | -       | `{ key, label, value, color? }` |
| `size`           | `number`                    | `160`   | Outer size in px                |
| `thickness`      | `number`                    | `12`    | Ring thickness (viewBox units)  |
| `centerLabel`    | `string`                    | -       | Text under the centre value     |
| `children`       | `Content`                   | total   | Centre value                    |
| `valueFormatter` | `(value: number) => string` | -       | Legend and centre values        |
| `showLegend`     | `boolean`                   | `true`  | Show the legend                 |

## Accessibility

Cartesian charts expose labelled, focusable data slots when tooltips are enabled; tooltips appear on hover and focus. The SVG geometry and tooltip copies are hidden from assistive technology. Give charts an `aria-label` and provide a textual summary or table for essential data. DonutChart and Sparkline do not provide the same per-point keyboard slots.

## Related Components

- [AreaChart](/components/area-chart/): Area charts and sparklines.
- [BarChart](/components/bar-chart/): Grouped, stacked and horizontal bars.
- [LineChart](/components/line-chart/): Lines, dashed comparisons and gaps.
- [Kpi](/components/kpi/): Metric cards with a sparkline.
- [ChartTooltip](/components/chart-tooltip/): Parts for a custom `tooltip`.
- [PieChart](/components/pie-chart/), [RadarChart](/components/radar-chart/), [RadialChart](/components/radial-chart/), [ComposedChart](/components/composed-chart/): More chart types.
- [DataGrid](/components/data-grid/): The table under the charts.
- [Meter](/components/meter/): A single value in a range.
