---
title: Chart
description: "Area, line, bar, donut and sparkline charts rendered on the server as SVG and HTML, with legends, axes and script-free tooltips."
template: reference
status: experimental
related: [components/kpi, components/data-grid, components/meter]
---

`@rivetjs/ui/chart` draws the charts a dashboard needs from plain data: `AreaChart`, `LineChart`, `BarChart` (grouped or stacked), `DonutChart` and `Sparkline`. Charts are computed and rendered on the server: no chart library, no canvas and no script in the browser. Tooltips, guides and dots appear on hover and keyboard focus with CSS alone, and every data point is a focusable slot with a text label, so the numbers are reachable without a mouse.

## Usage

```tsx
import { AreaChart, BarChart, DonutChart, LineChart, Sparkline } from "@rivetjs/ui/chart";
```

Cartesian charts take `data` (one object per x value), `index` (the key of the x label) and `series` (`{ key, label?, color? }`). Colours default to the `--chart-1` … `--chart-6` palette; the y axis gets rounded ticks from the data range.

## Area

::example{id=chart-area}

`curve` is `"monotone"` (default, never overshoots the data) or `"linear"`; `stacked` stacks the series.

## Line

::example{id=chart-line}

`valueFormatter` formats the y axis and the tooltip values; `indexFormatter` the x labels. `minValue` / `maxValue` fix the y range.

## Bar

::example{id=chart-bar}

## Donut

::example{id=chart-donut}

`DonutChart` takes `{ key, label, value, color? }` segments; the centre shows the total (or `children`) above `centerLabel`, and the legend lists values and shares. `size` sets the outer size in pixels, `thickness` the ring.

## Sparkline

A `Sparkline` is an area chart without axes, grid, legend or tooltip, sized to its container; see [Kpi](/components/kpi/) for one in a metric card.

## Behaviour without JavaScript

Everything is static markup: the server computes the paths and bars, and the tooltips are CSS. `data`, `series` and the formatters are read once; to switch data (a period picker), re-create the chart with `<Show keyed when={period()}>`.

## Styling Reference

### CSS Classes

- `.chart` - The figure. Modifiers `.chart--area` / `--line` / `--bar` / `--donut` / `--sparkline`.
- `.chart__legend`, `.chart__legend-item`, `.chart__legend-value`, `.chart__swatch` - The legend.
- `.chart__frame`, `.chart__y-axis`, `.chart__y-label`, `.chart__plot`, `.chart__grid`, `.chart__grid-line`, `.chart__x-axis`, `.chart__x-label` - Axes and grid; minor x labels hide below a 420px container.
- `.chart__svg`, `.chart__area`, `.chart__line`, `.chart__dot`, `.chart__guide` - Area and line drawing.
- `.chart__bars`, `.chart__bar-group`, `.chart__bar-stack`, `.chart__bar` - Bars.
- `.chart__slots`, `.chart__slot`, `.chart__tooltip`, `.chart__tooltip-title`, `.chart__tooltip-row`, `.chart__tooltip-value` - Hover / focus slots and tooltips.
- `.chart__donut`, `.chart__donut-svg`, `.chart__donut-track`, `.chart__donut-segment`, `.chart__donut-center`, `.chart__donut-value` - Donut.

### CSS Variables

| Variable                  | Default                                  | Description                             |
| ------------------------- | ---------------------------------------- | --------------------------------------- |
| `--chart-1` … `--chart-6` | accent, cyan, violet, amber, pink, green | Series palette                          |
| `--chart-color`           | -                                        | Colour of one series / segment (inline) |
| `--chart-height`          | `240px`                                  | Plot height (`height` prop)             |
| `--chart-y-axis-width`    | `3rem`                                   | Width of the y axis labels              |
| `--chart-donut-size`      | `160px`                                  | Donut size (`size` prop)                |

### Data Attributes

- `[data-slot]`: `chart-slot` (one per x value, focusable), `chart-tooltip`.
- Slot: `[data-side]` `start` / `end` (which side the tooltip opens).

## API Reference

### AreaChart / LineChart / BarChart

| Prop                                                                  | Type                                  | Default        | Description                                 |
| --------------------------------------------------------------------- | ------------------------------------- | -------------- | ------------------------------------------- |
| `data`                                                                | `ChartDatum[]`                        | -              | One object per x value                      |
| `index`                                                               | `string`                              | -              | Key of the x label                          |
| `series`                                                              | `ChartSeries[]`                       | -              | `{ key, label?, color? }` per series        |
| `height`                                                              | `number`                              | `240`          | Plot height in px                           |
| `valueFormatter`                                                      | `(value: number) => string`           | grouped number | Y axis and tooltip values                   |
| `indexFormatter`                                                      | `(value: string \| number) => string` | -              | X labels                                    |
| `minValue` / `maxValue`                                               | `number`                              | from data      | Y range                                     |
| `stacked`                                                             | `boolean`                             | `false`        | Stack series (area, bar)                    |
| `curve`                                                               | `"monotone"` \| `"linear"`            | `"monotone"`   | Line shape (area, line)                     |
| `showLegend` / `showGrid` / `showXAxis` / `showYAxis` / `showTooltip` | `boolean`                             | `true`         | Toggle parts (legend: shown with 2+ series) |
| `aria-label`                                                          | `string`                              | -              | Accessible name of the figure               |

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

## Related Components

- [Kpi](/components/kpi/): Metric cards with a sparkline.
- [DataGrid](/components/data-grid/): The table under the charts.
- [Meter](/components/meter/): A single value in a range.
