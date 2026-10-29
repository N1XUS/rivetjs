---
title: PieChart
description: "Pie and donut charts rendered on the server as SVG, with outside labels, nested rings, a breakdown legend and script-free tooltips."
template: reference
status: experimental
related: [components/chart, components/radial-chart, components/chart-tooltip]
---

`PieChart` draws proportional data as a pie or a donut. Like the other [charts](/components/chart/) it is computed and rendered on the server from plain data (`{ label, value, color? }`): no chart library and no script in the browser. With tooltips enabled, each sector is focusable and has a text label; its tooltip appears on hover and keyboard focus with CSS alone, and the other sectors dim.

## Usage

```tsx
import { PieChart } from "@rivetjs/ui/pie-chart";
```

::example{id=pie-chart-basic}

## Anatomy

`PieChart` is a single data-driven component. It creates sectors, optional inner rings, center content and the legend from its props; customize tooltip content with `tooltip`.

## Examples

### Custom Tooltip

`tooltip` renders your own content per sector, for example a [ChartTooltip](/components/chart-tooltip/).

::example{id=pie-chart-custom-tooltip}

### Donut

::example{id=pie-chart-donut}

### Donut With Content

::example{id=pie-chart-donut-with-content}

### Donut With Label

::example{id=pie-chart-donut-with-label}

### Nested Donut

::example{id=pie-chart-nested-donut}

### With Breakdown

::example{id=pie-chart-with-breakdown}

### Behaviour without JavaScript

Everything is static markup: the server computes the sector paths and labels, and the tooltips are CSS. `data` and the formatters are read once; to switch data, re-create the chart with `<Show keyed when={period()}>`.

## Styling Reference

The component’s parts emit these additional `data-slot` values: `chart-plot`.

### CSS Classes

- `.chart.chart--pie.pie-chart` - The figure.
- `.chart__polar` - The square plot (`size`); `.chart__polar-svg` - its SVG layers.
- `.chart__sector` - One focusable layer per sector with its `.chart__sector-path` and tooltip anchor `.chart__anchor`.
- `.chart__polar-label`, `.pie-chart__leader` - Outside labels and their leader lines (`labels`).
- `.chart__polar-center`, `.chart__donut-value` - Donut centre.
- `.chart__legend` (`[data-legend]` `simple` / `breakdown`), `.chart__legend-item`, `.chart__legend-value`, `.chart__swatch` - Legend.
- `.chart__tooltip` (`.chart__tooltip--custom` with `tooltip`) - Tooltip.

### CSS Variables

| Variable                  | Default                                  | Description                                                 |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `--chart-1` … `--chart-6` | accent, cyan, violet, amber, pink, green | Segment palette (theme tokens, also usable outside a chart) |
| `--chart-color`           | -                                        | Colour of one segment (inline)                              |
| `--chart-polar-size`      | `200px`                                  | Plot size (`size`)                                          |

### Data Attributes

- `[data-slot]`: `chart-slot` (one per sector, focusable), `chart-tooltip`, `chart-legend`.
- Tooltip anchor: `[data-side]` `start` / `end`.

## API Reference

See the [full module API](/api/rivetjs/ui/pie-chart/) for every named export and part prop type.

### PieChart

| Prop                      | Type                                            | Default        | Description                                       |
| ------------------------- | ----------------------------------------------- | -------------- | ------------------------------------------------- |
| `data`                    | `PieSegment[]`                                  | -              | `{ key?, label, value, color? }`                  |
| `rings`                   | `{ label?, data: PieSegment[] }[]`              | -              | Nested donut, outside first (instead of `data`)   |
| `size`                    | `number`                                        | `200`          | Size in px                                        |
| `innerRadius`             | `number`                                        | `0`            | Hole as a share of the radius (0 = pie)           |
| `paddingAngle`            | `number`                                        | `0`            | Gap between sectors (degrees)                     |
| `startAngle` / `endAngle` | `number`                                        | `90` / `-270`  | Sweep (degrees, counter-clockwise from 3 o'clock) |
| `labels`                  | `false` \| `"percent"` \| `"value"` \| `"name"` | `false`        | Outside labels                                    |
| `legend`                  | `"simple"` \| `"breakdown"` \| `"none"`         | `"simple"`     | Legend style                                      |
| `valueFormatter`          | `(value: number) => string`                     | grouped number | Tooltip, legend and centre values                 |
| `tooltip`                 | `(point: ChartPoint) => JSX.Element`            | -              | Custom tooltip content                            |
| `showTooltip`             | `boolean`                                       | `true`         | Tooltips and focusable sectors                    |
| `children`                | `Content`                                       | total          | Donut centre value                                |
| `centerLabel`             | `string`                                        | -              | Text under the centre value                       |
| `aria-label`              | `string`                                        | all segments   | Accessible name of the figure                     |

## Accessibility

With tooltips enabled, sectors are focusable groups with labels containing the category, value and share. With `showTooltip={false}`, sectors are removed from the tab order. Supply a meaningful `aria-label` and a textual summary or table when users need the underlying numbers.

## Related Components

- [Chart](/components/chart/): Area, line, bar and donut charts.
- [RadialChart](/components/radial-chart/): Gauges and progress rings.
- [ChartTooltip](/components/chart-tooltip/): The tooltip card.
