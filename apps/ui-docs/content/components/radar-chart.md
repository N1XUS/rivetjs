---
title: RadarChart
description: "Radar charts for multivariate comparisons, rendered on the server as SVG with polygon or circle grids, dots, several series and script-free tooltips."
template: reference
status: experimental
related: [components/chart, components/pie-chart, components/chart-tooltip]
---

`RadarChart` compares several values per series on spokes around a centre. It takes the same `data` + `index` + `series` as the [cartesian charts](/components/chart/): one spoke per datum, one shape per series. It renders on the server with no script; hovering or focusing a spoke shows the values of that category with CSS alone.

## Usage

```tsx
import { RadarChart } from "@rivetjs/ui/radar-chart";
```

::example{id=radar-chart-basic}

## Anatomy

`RadarChart` is a single data-driven component. `data`, `index` and `series` determine spokes and series shapes; grid, labels, legend and tooltip slots are rendered by the component.

## Examples

### Comparison

::example{id=radar-chart-comparison}

### Dots Only

::example{id=radar-chart-dots-only}

### Multi Series

::example{id=radar-chart-multi-series}

### With Radius Axis

::example{id=radar-chart-with-radius-axis}

## Styling Reference

The component’s parts emit these additional `data-slot` values: `chart-plot`.

### CSS Classes

- `.chart.chart--radar.radar-chart` - The figure.
- `.chart__polar`, `.chart__polar-svg` - The square plot and its SVG.
- `.chart__polar-grid` - Grid rings and spokes (`gridType`).
- `.radar-chart__shape` (`[data-fill]`, `[data-stroke]`), `.radar-chart__vertex` - Series shapes and dots.
- `.chart__sector`, `.radar-chart__hit`, `.chart__dot`, `.chart__anchor` - One focusable wedge per category with its dots and tooltip.
- `.chart__polar-label` - Category labels; `.radar-chart__tick` - Radius ticks.

### CSS Variables

| Variable                  | Default                                  | Description                   |
| ------------------------- | ---------------------------------------- | ----------------------------- |
| `--chart-1` … `--chart-6` | accent, cyan, violet, amber, pink, green | Series palette                |
| `--chart-color`           | -                                        | Colour of one series (inline) |
| `--chart-polar-size`      | `280px`                                  | Plot size (`size`)            |

### Data Attributes

- `[data-slot]`: `chart-slot` (one per category, focusable), `chart-tooltip`, `chart-legend`.

## API Reference

See the [full module API](/api/rivetjs/ui/radar-chart/) for every named export and part prop type.

### RadarChart

| Prop                                         | Type                                 | Default        | Description                                      |
| -------------------------------------------- | ------------------------------------ | -------------- | ------------------------------------------------ |
| `data`                                       | `ChartDatum[]`                       | -              | One object per category                          |
| `index`                                      | `string`                             | -              | Key of the category label                        |
| `series`                                     | `RadarSeries[]`                      | -              | `{ key, label?, color?, fill?, stroke?, dots? }` |
| `size`                                       | `number`                             | `280`          | Size in px                                       |
| `maxValue`                                   | `number`                             | from data      | Value at the edge                                |
| `gridType`                                   | `"polygon"` \| `"circle"`            | `"polygon"`    | Grid shape                                       |
| `showGrid` / `showAngleAxis` / `showTooltip` | `boolean`                            | `true`         | Toggle parts                                     |
| `showRadiusAxis`                             | `boolean`                            | `false`        | Tick values along the first spoke                |
| `showLegend`                                 | `boolean`                            | 2+ series      | Legend                                           |
| `valueFormatter`                             | `(value: number) => string`          | grouped number | Tooltip and tick values                          |
| `tooltip`                                    | `(point: ChartPoint) => JSX.Element` | -              | Custom tooltip content                           |
| `aria-label`                                 | `string`                             | all values     | Accessible name of the figure                    |

## Accessibility

When tooltips are enabled, category slots are focusable groups labelled with their values. The SVG geometry is hidden from assistive technology. Supply a meaningful `aria-label` and a text summary or table for comparisons that matter.

## Related Components

- [Chart](/components/chart/): Area, line, bar and donut charts.
- [PieChart](/components/pie-chart/): Pie and donut charts.
- [ChartTooltip](/components/chart-tooltip/): The tooltip card.
