// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no charts). Feature set inspired by HeroUI Pro's public Radar Chart docs
// (multivariate comparison: polygon / circle grid, angle labels, optional radius axis, filled or outline shapes, dots,
// multiple series, tooltip); independent implementation with the data-driven API of `@rivetjs/ui/chart` (`data` + `index` +
// `series`):
// - Server-rendered SVG in a 0…100 viewBox (`../chart/polar-math.ts`): grid, one shape per series, axis labels in HTML.
// - Tooltips: one focusable wedge layer per category (`.chart__sector`, invisible hit path around the spoke) holding the
//   dots on that spoke and its tooltip; CSS `:hover` / `:focus-visible` shows them. No state, no script.
// - `data` / `series` / formatters are read once at mount.
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import { chartVariants } from "../../../styles/src/components/chart/index.ts";
import { radarChartVariants } from "../../../styles/src/components/radar-chart/index.ts";
import { colorOf, defaultFormat, pct, renderTooltip } from "../chart/chart.tsx";
import type { ChartDatum, ChartPoint, ChartSeries } from "../chart/chart.tsx";
import { niceTicks } from "../chart/chart-math.ts";
import { circlePath, polar, polygonPath, sectorPath } from "../chart/polar-math.ts";

const SLOTS = chartVariants();
const RADAR = radarChartVariants();

interface RadarSeries extends ChartSeries {
  /** Fill the shape. @default true */
  fill?: boolean;
  /** Draw the outline. @default true */
  stroke?: boolean;
  /** Dots at the vertices. @default false */
  dots?: boolean;
}

interface RadarChartProps extends Omit<JSX.IntrinsicElements["figure"], "children" | "class"> {
  data: ChartDatum[];
  /** Key of the category (spoke label) in each datum. */
  index: string;
  series: RadarSeries[];
  /** Size in px. @default 280 */
  size?: number;
  /** Upper bound of the radius (default: from the data, rounded up to a nice tick). */
  maxValue?: number;
  /** Grid shape. @default "polygon" */
  gridType?: "polygon" | "circle";
  showGrid?: boolean;
  /** Tick labels along the first spoke. @default false */
  showRadiusAxis?: boolean;
  /** Category labels around the chart. @default true */
  showAngleAxis?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  valueFormatter?: (value: number) => string;
  /** Custom tooltip content per category (a `ChartTooltip`). */
  tooltip?: (point: ChartPoint) => JSX.Element;
  "aria-label"?: string;
  class?: string;
}

const R = 38;

const RadarChart = (props: RadarChartProps): JSX.Element => {
  const {
    data,
    index,
    series,
    size,
    maxValue,
    gridType,
    showGrid,
    showRadiusAxis,
    showAngleAxis,
    showLegend,
    showTooltip,
    valueFormatter,
    tooltip,
    class: cls,
    ...rest
  } = props;
  const format = valueFormatter ?? defaultFormat;
  const n = Math.max(1, data.length);
  const all = data.flatMap((d) => series.map((s) => Number(d[s.key] ?? 0)));
  const ticks = niceTicks(0, maxValue ?? Math.max(1, ...all), 4);
  const max = maxValue ?? ticks[ticks.length - 1]!;
  const angleOf = (i: number) => 90 - (i * 360) / n;
  const at = (v: number, i: number) => polar((Math.max(0, v) / (max || 1)) * R, angleOf(i));
  const colors = series.map(colorOf);
  const levels = ticks.filter((t) => t > 0 && t <= max);
  const grid = levels.map((t) => (gridType === "circle" ? circlePath((t / max) * R) : polygonPath(data.map((_, i) => polar((t / max) * R, angleOf(i))))));
  const spokes = data.map((_, i) => {
    const p = polar(R, angleOf(i));
    return `M50 50 L${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  });
  const shapes = series.map((s, si) => ({
    d: polygonPath(data.map((d, i) => at(Number(d[s.key] ?? 0), i))),
    color: colors[si]!,
    fill: s.fill !== false,
    stroke: s.stroke !== false,
    dots: s.dots === true ? data.map((d, i) => at(Number(d[s.key] ?? 0), i)) : [],
  }));
  const step = 360 / n;
  const wedges = data.map((d, i) => {
    const a = angleOf(i);
    const label = String(d[index] ?? "");
    const rows = series.map((s, si) => ({ label: s.label ?? s.key, value: format(Number(d[s.key] ?? 0)), color: colors[si]! }));
    const tip = polar(R, a);
    const point: ChartPoint = {
      index: i,
      label,
      items: series.map((s, si) => ({
        key: s.key,
        name: s.label ?? s.key,
        value: Number(d[s.key] ?? 0),
        formatted: rows[si]!.value,
        color: colors[si]!,
      })),
    };
    return {
      d: sectorPath(R + 6, 0, a + step / 2, a - step / 2),
      aria: `${label}: ${rows.map((r) => `${r.label} ${r.value}`).join(", ")}`,
      dots: series.map((s, si) => {
        const p = at(Number(d[s.key] ?? 0), i);
        return { left: pct(p.x), top: pct(p.y), color: colors[si]! };
      }),
      anchor: { left: pct(tip.x), top: pct(tip.y), side: tip.x > 55 ? "start" : "end" },
      tip: renderTooltip(label, rows, "0px", tooltip?.(point)),
      label,
      text: (() => {
        const p = polar(R + 5, a);
        const c = Math.cos((a * Math.PI) / 180);
        return { left: pct(p.x), top: pct(p.y), align: Math.abs(c) < 0.2 ? "middle" : c > 0 ? "start" : "end" };
      })(),
    };
  });
  const radiusTicks = levels.map((t) => {
    const p = polar((t / max) * R, 90);
    return { left: pct(p.x), top: pct(p.y), label: format(t) };
  });
  const legend = (showLegend ?? series.length > 1) ? series.map((s, si) => ({ label: s.label ?? s.key, color: colors[si]! })) : [];
  return (
    <figure
      class={chartVariants({ kind: "radar" }).base({ class: RADAR.base({ class: cls }) })}
      data-slot="chart"
      style={{ "--chart-polar-size": `${size ?? 280}px` }}
      aria-label={props["aria-label"] ?? wedges.map((w) => w.aria).join("; ")}
      {...rest}
    >
      {legend.length ? (
        <ul class={SLOTS.legend()} data-slot="chart-legend">
          {legend.map((item) => (
            <li class={SLOTS.legendItem()}>
              <span class={SLOTS.swatch()} style={{ "--chart-color": item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div class={SLOTS.polar()} data-slot="chart-plot">
        <svg class={SLOTS.polarSvg()} viewBox="0 0 100 100" aria-hidden="true">
          {showGrid === false ? null : (
            <g class={SLOTS.polarGrid()}>
              {grid.map((d) => (
                <path d={d} vector-effect="non-scaling-stroke" />
              ))}
              {spokes.map((d) => (
                <path d={d} vector-effect="non-scaling-stroke" />
              ))}
            </g>
          )}
          {shapes.map((shape) => (
            <g style={{ "--chart-color": shape.color }}>
              <path
                class={RADAR.shape()}
                d={shape.d}
                data-fill={shape.fill ? "" : undefined}
                data-stroke={shape.stroke ? "" : undefined}
                vector-effect="non-scaling-stroke"
              />
              {shape.dots.map((p) => (
                <circle class={RADAR.vertex()} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="1.4" />
              ))}
            </g>
          ))}
        </svg>
        {showTooltip === false
          ? null
          : wedges.map((w) => (
              <div class={SLOTS.sector()} data-slot="chart-slot" role="group" tabIndex={0} aria-label={w.aria}>
                <svg class={SLOTS.polarSvg()} viewBox="0 0 100 100" aria-hidden="true">
                  <path class={RADAR.hit()} d={w.d} />
                </svg>
                {w.dots.map((dot) => (
                  <span class={SLOTS.dot()} style={{ left: dot.left, top: dot.top, "--chart-color": dot.color }} />
                ))}
                <span class={SLOTS.anchor()} data-side={w.anchor.side} style={{ left: w.anchor.left, top: w.anchor.top }}>
                  {w.tip}
                </span>
              </div>
            ))}
        {showAngleAxis === false
          ? null
          : wedges.map((w) => (
              <span class={SLOTS.polarLabel()} data-align={w.text.align} style={{ left: w.text.left, top: w.text.top }} aria-hidden="true">
                {w.label}
              </span>
            ))}
        {showRadiusAxis
          ? radiusTicks.map((t) => (
              <span class={RADAR.tick()} style={{ left: t.left, top: t.top }} aria-hidden="true">
                {t.label}
              </span>
            ))
          : null}
      </div>
    </figure>
  );
};

export { RadarChart };
export type { RadarChartProps, RadarSeries };
