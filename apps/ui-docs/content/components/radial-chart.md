---
title: RadialChart
description: "Radial bar charts for gauges, progress rings and concentric goals, rendered on the server as SVG with tracks, centre content and script-free tooltips."
template: reference
status: experimental
related: [components/chart, components/pie-chart, components/progress-circle]
---

`RadialChart` draws one ring per entry, from the outside in. A ring's sweep is its share of `maxValue` (100 by default), over a background track. Open sweeps make gauges; one full ring with centre content is a progress ring. It renders on the server with no script; each ring is focusable and shows its value on hover and focus with CSS.

## Usage

```tsx
import { RadialChart } from "@rivetjs/ui/radial-chart";
```

::example{id=radial-chart-basic}

## Gauge

::example{id=radial-chart-gauge}

## Gauge Grid

::example{id=radial-chart-gauge-grid}

## Progress Ring

::example{id=radial-chart-progress-ring}

## With Legend

::example{id=radial-chart-with-legend}

## Styling Reference

### CSS Classes

- `.chart.chart--radial.radial-chart` - The figure.
- `.chart__polar`, `.chart__polar-svg` - The square plot and its SVG layers.
- `.radial-chart__track` - Ring background (`showTrack`).
- `.chart__sector`, `.chart__sector-path`, `.chart__anchor` - One focusable layer per ring with its arc and tooltip.
- `.chart__polar-center`, `.chart__donut-value` - Centre content.
- `.chart__legend`, `.chart__legend-item`, `.chart__legend-value` - Legend (`showLegend`).

### CSS Variables

| Variable                  | Default                                  | Description                 |
| ------------------------- | ---------------------------------------- | --------------------------- |
| `--chart-1` … `--chart-6` | accent, cyan, violet, amber, pink, green | Ring palette                |
| `--chart-color`           | -                                        | Colour of one ring (inline) |
| `--chart-polar-size`      | `240px`                                  | Plot size (`size`)          |

## API Reference

### RadialChart

| Prop                          | Type                                 | Default        | Description                                       |
| ----------------------------- | ------------------------------------ | -------------- | ------------------------------------------------- |
| `data`                        | `RadialDatum[]`                      | -              | `{ key?, label, value, color? }`, one ring each   |
| `size`                        | `number`                             | `240`          | Size in px                                        |
| `barSize`                     | `number`                             | from the band  | Ring thickness in px                              |
| `innerRadius` / `outerRadius` | `number`                             | `0.3` / `0.8`  | Ring band as shares of the radius                 |
| `startAngle` / `endAngle`     | `number`                             | `90` / `-270`  | Sweep (degrees, counter-clockwise from 3 o'clock) |
| `maxValue`                    | `number`                             | `100`          | Value of a full sweep                             |
| `showTrack`                   | `boolean`                            | `true`         | Background track                                  |
| `showLegend`                  | `boolean`                            | `false`        | Legend with values                                |
| `showTooltip`                 | `boolean`                            | `true`         | Tooltips and focusable rings                      |
| `valueFormatter`              | `(value: number) => string`          | grouped number | Tooltip and legend values                         |
| `tooltip`                     | `(point: ChartPoint) => JSX.Element` | -              | Custom tooltip content                            |
| `children` / `centerLabel`    | `Content` / `string`                 | -              | Centre value and caption                          |

## Related Components

- [PieChart](/components/pie-chart/): Pie and donut charts.
- [ProgressCircle](/components/progress-circle/): A single circular progress indicator.
- [Chart](/components/chart/): Area, line, bar and donut charts.
