// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no charts). Feature set inspired by HeroUI Pro's public
// chart docs (area / line / bar / donut, tooltip, legend, grid, axes); independent implementation on HeroUI tokens.
import "../../../out/chart.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chartVariants = tv({
  defaultVariants: {
    kind: "area",
  },
  slots: {
    anchor: "chart__anchor",
    area: "chart__area",
    bar: "chart__bar",
    barGroup: "chart__bar-group",
    barStack: "chart__bar-stack",
    bars: "chart__bars",
    base: "chart",
    donut: "chart__donut",
    donutCenter: "chart__donut-center",
    donutSegment: "chart__donut-segment",
    donutSvg: "chart__donut-svg",
    donutTrack: "chart__donut-track",
    donutValue: "chart__donut-value",
    dot: "chart__dot",
    frame: "chart__frame",
    grid: "chart__grid",
    gridLine: "chart__grid-line",
    guide: "chart__guide",
    legend: "chart__legend",
    legendItem: "chart__legend-item",
    legendValue: "chart__legend-value",
    line: "chart__line",
    plot: "chart__plot",
    point: "chart__point",
    points: "chart__points",
    polar: "chart__polar",
    polarCenter: "chart__polar-center",
    polarGrid: "chart__polar-grid",
    polarLabel: "chart__polar-label",
    polarSvg: "chart__polar-svg",
    sector: "chart__sector",
    sectorPath: "chart__sector-path",
    slot: "chart__slot",
    slots: "chart__slots",
    svg: "chart__svg",
    swatch: "chart__swatch",
    tooltip: "chart__tooltip",
    tooltipRow: "chart__tooltip-row",
    tooltipTitle: "chart__tooltip-title",
    tooltipValue: "chart__tooltip-value",
    xAxis: "chart__x-axis",
    xLabel: "chart__x-label",
    yAxis: "chart__y-axis",
    yLabel: "chart__y-label",
  },
  variants: {
    orientation: {
      horizontal: {base: "chart--horizontal"},
    },
    kind: {
      area: {base: "chart--area"},
      bar: {base: "chart--bar"},
      composed: {base: "chart--composed"},
      donut: {base: "chart--donut"},
      line: {base: "chart--line"},
      pie: {base: "chart--pie"},
      radar: {base: "chart--radar"},
      radial: {base: "chart--radial"},
      sparkline: {base: "chart--sparkline"},
    },
  },
});

export type ChartVariants = VariantProps<typeof chartVariants>;
