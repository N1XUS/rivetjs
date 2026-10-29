// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no charts). Feature set scoped from public docs of commercial UI kits
// (concentric radial bars: gauges, gauge grids, progress rings, legend; `barSize`, `innerRadius`, `outerRadius`,
// `startAngle` 90, `endAngle` −270, background track); independent implementation with the data-driven API of
// `@rivetjs/ui/chart` (`data` of `{ label, value, color? }`, one ring per entry, outside first):
// - Server-rendered SVG arcs (`../chart/polar-math.ts`) in a 0…100 viewBox; each ring is a focusable layer
//   (`.chart__sector`) with its arc and tooltip, shown by CSS `:hover` / `:focus-visible`. No state, no script.
// - `maxValue` (default 100) is the full sweep; `children` / `centerLabel` fill the centre (progress ring, gauge value).
// - `data` / formatters are read once at mount.
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import { chartVariants } from "../../../styles/src/components/chart/index.ts";
import { radialChartVariants } from "../../../styles/src/components/radial-chart/index.ts";
import { defaultFormat, pct, renderTooltip } from "../chart/chart.tsx";
import type { ChartPoint } from "../chart/chart.tsx";
import { polar, sectorPath } from "../chart/polar-math.ts";

const SLOTS = chartVariants();
const RADIAL = radialChartVariants();

interface RadialDatum {
  key?: string;
  label: string;
  value: number;
  /** Any CSS colour (default: the palette `var(--chart-N)`). */
  color?: string;
}

interface RadialChartProps extends Omit<JSX.IntrinsicElements["figure"], "children" | "class"> {
  data: RadialDatum[];
  /** Size in px. @default 240 */
  size?: number;
  /** Ring thickness in px (default: the free band split between the rings). */
  barSize?: number;
  /** Inner radius as a share of the radius. @default 0.3 */
  innerRadius?: number;
  /** Outer radius as a share of the radius. @default 0.8 */
  outerRadius?: number;
  /** Start angle in degrees (counter-clockwise from 3 o'clock). @default 90 */
  startAngle?: number;
  /** End angle in degrees. @default -270 */
  endAngle?: number;
  /** Value of a full sweep. @default 100 */
  maxValue?: number;
  /** Background track behind each ring. @default true */
  showTrack?: boolean;
  /** @default false */
  showLegend?: boolean;
  showTooltip?: boolean;
  valueFormatter?: (value: number) => string;
  /** Custom tooltip content per ring (a `ChartTooltip`). */
  tooltip?: (point: ChartPoint) => JSX.Element;
  /** Centre content, above `centerLabel`. */
  children?: JSX.Element | string;
  centerLabel?: string;
  "aria-label"?: string;
  class?: string;
}

const RadialChart = (props: RadialChartProps): JSX.Element => {
  const {
    data,
    size,
    barSize,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    maxValue,
    showTrack,
    showLegend,
    showTooltip,
    valueFormatter,
    tooltip,
    children,
    centerLabel,
    class: cls,
    ...rest
  } = props;
  const format = valueFormatter ?? defaultFormat;
  const px = size ?? 240;
  const start = startAngle ?? 90;
  const end = endAngle ?? -270;
  const max = maxValue ?? 100;
  const outerR = (outerRadius ?? 0.8) * 50;
  const innerR = (innerRadius ?? 0.3) * 50;
  const n = Math.max(1, data.length);
  const slot = (outerR - innerR) / n;
  const thick = barSize == null ? slot * 0.78 : Math.min(slot, (barSize * 100) / px);
  const rings = data.map((d, i) => {
    const color = d.color ?? `var(--chart-${(i % 6) + 1})`;
    const mid = outerR - slot * i - slot / 2;
    const ro = mid + thick / 2;
    const ri = mid - thick / 2;
    const share = Math.max(0, Math.min(1, d.value / (max || 1)));
    const a1 = start + (end - start) * share;
    const tip = polar(mid, a1);
    const point: ChartPoint = {
      index: i,
      label: d.label,
      items: [{ key: d.key ?? d.label, name: d.label, value: d.value, formatted: format(d.value), color }],
    };
    return {
      color,
      label: d.label,
      value: format(d.value),
      track: sectorPath(ro, ri, start, end),
      bar: share > 0 ? sectorPath(ro, ri, start, a1) : "",
      aria: `${d.label}: ${format(d.value)}`,
      anchor: { left: pct(tip.x), top: pct(tip.y), side: tip.x > 55 ? "start" : "end" },
      tip: renderTooltip(d.label, [{ label: d.label, value: format(d.value), color }], "0px", tooltip?.(point)),
    };
  });
  return (
    <figure
      class={chartVariants({ kind: "radial" }).base({ class: RADIAL.base({ class: cls }) })}
      data-slot="chart"
      style={{ "--chart-polar-size": `${px}px` }}
      aria-label={props["aria-label"] ?? rings.map((r) => r.aria).join(", ")}
      {...rest}
    >
      <div class={SLOTS.polar()} data-slot="chart-plot">
        {showTrack === false ? null : (
          <svg class={SLOTS.polarSvg()} viewBox="0 0 100 100" aria-hidden="true">
            {rings.map((r) => (
              <path class={RADIAL.track()} d={r.track} />
            ))}
          </svg>
        )}
        {rings.map((r) => (
          <div class={SLOTS.sector()} data-slot="chart-slot" role="group" tabIndex={showTooltip === false ? undefined : 0} aria-label={r.aria}>
            <svg class={SLOTS.polarSvg()} viewBox="0 0 100 100" aria-hidden="true">
              {r.bar ? <path class={SLOTS.sectorPath()} d={r.bar} style={{ "--chart-color": r.color }} /> : null}
            </svg>
            {showTooltip === false ? null : (
              <span class={SLOTS.anchor()} data-side={r.anchor.side} style={{ left: r.anchor.left, top: r.anchor.top }}>
                {r.tip}
              </span>
            )}
          </div>
        ))}
        {children != null || centerLabel ? (
          <div class={SLOTS.polarCenter()}>
            {children != null ? <span class={SLOTS.donutValue()}>{children}</span> : null}
            {centerLabel ? <span>{centerLabel}</span> : null}
          </div>
        ) : null}
      </div>
      {showLegend ? (
        <ul class={SLOTS.legend()} data-slot="chart-legend">
          {rings.map((r) => (
            <li class={SLOTS.legendItem()}>
              <span class={SLOTS.swatch()} style={{ "--chart-color": r.color }} />
              {r.label}
              <span class={SLOTS.legendValue()}>{r.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
};

export { RadialChart };
export type { RadialChartProps, RadialDatum };
