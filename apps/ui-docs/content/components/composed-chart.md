---
title: ComposedChart
description: "Bars, lines and areas on one set of axes, rendered on the server with stacked bars, dashed lines and script-free tooltips."
template: reference
status: experimental
related: [components/chart, components/chart-tooltip, components/kpi]
---

`ComposedChart` puts several kinds of series on one frame: each series has a `type` (`bar`, `line` or `area`). It shares the legend, axes and grid of the [cartesian charts](/components/chart/) and keeps one focusable slot per index whose tooltip lists every series when tooltips are enabled. Everything renders on the server; no script runs in the browser.

## Usage

```tsx
import { ComposedChart } from "@rivetjs/ui/composed-chart";
```

::example{id=composed-chart-basic}

## Anatomy

`ComposedChart` is a single data-driven component. Set each series `type` to `bar`, `line` or `area`; the component renders those series in one plot with shared axes, legend and tooltip slots.

## Examples

### Stacked Bar With Line

::example{id=composed-chart-stacked-bar-with-line}

### Area With Line

::example{id=composed-chart-area-with-line}

### Bar With Area

::example{id=composed-chart-bar-with-area}

### Multi Type

::example{id=composed-chart-multi-type}

## Styling Reference

The component’s parts emit these additional `data-slot` values: `chart-slot`.

### CSS Classes

- `.chart.chart--composed.composed-chart` - The figure; the frame, axes, grid and legend are the [Chart](/components/chart/) classes.
- `.chart__bars`, `.chart__bar-group`, `.chart__bar-stack`, `.chart__bar` - Bar series (drawing only).
- `.chart__svg`, `.chart__area`, `.chart__line` (`[data-dashed]`) - Line and area series.
- `.chart__slot.composed-chart__slot`, `.chart__guide`, `.chart__dot`, `.chart__tooltip` - Hover / focus slots.

### CSS Variables

| Variable                  | Default                                  | Description                                                |
| ------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `--chart-1` … `--chart-6` | accent, cyan, violet, amber, pink, green | Series palette (theme tokens, also usable outside a chart) |
| `--chart-height`          | `240px`                                  | Plot height (`height`)                                     |

## API Reference

See the [full module API](/api/rivetjs/ui/composed-chart/) for every named export and part prop type.

### ComposedChart

Every [AreaChart / LineChart / BarChart](/components/chart/) prop, plus:

| Prop      | Type                                 | Default      | Description                                                         |
| --------- | ------------------------------------ | ------------ | ------------------------------------------------------------------- |
| `series`  | `ComposedSeries[]`                   | -            | `{ key, type: "bar" \| "line" \| "area", label?, color?, dashed? }` |
| `stacked` | `boolean`                            | `false`      | Stack the bar series                                                |
| `curve`   | `"monotone"` \| `"linear"`           | `"monotone"` | Line and area shape                                                 |
| `tooltip` | `(point: ChartPoint) => JSX.Element` | -            | Custom tooltip content                                              |

## Accessibility

With tooltips enabled, each index has a focusable group whose accessible name contains the values. Bar and SVG geometry are decorative. Supply a meaningful `aria-label`; use a text summary or table when the chart carries essential information.

## Related Components

- [Chart](/components/chart/): Area, line, bar and donut charts.
- [ChartTooltip](/components/chart-tooltip/): The tooltip card.
- [Kpi](/components/kpi/): Metric cards with a sparkline.
