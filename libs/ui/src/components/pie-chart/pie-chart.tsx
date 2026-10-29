// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no charts). Feature set scoped from public docs of commercial UI kits
// (pie and donut with labels, legend, centre content, nested rings, breakdown, custom tooltip); independent implementation
// with the data-driven API of `@rivetjs/ui/chart` (`data` of `{ label, value, color? }`):
// - Server-rendered SVG sectors (`../chart/polar-math.ts`) in a 0…100 viewBox. Each sector is its own layer
//   (`.chart__sector`, focusable, `aria-label` = label, value, share) holding its path and its tooltip, so `:hover` on the
//   path / `:focus-visible` on the layer shows that tooltip with CSS only. No state, no script.
// - `innerRadius` (0…0.95 of the radius) turns the pie into a donut; `rings` stacks nested donuts (outer first);
//   `paddingAngle` separates sectors; `labels` writes outside labels (share / value / name) with leader lines.
// - `legend="breakdown"` lists value and share per segment; `children` / `centerLabel` fill a donut's centre.
// - `data` / formatters are read once at mount (like the other charts).
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import { chartVariants } from "../../../styles/src/components/chart/index.ts";
import { pieChartVariants } from "../../../styles/src/components/pie-chart/index.ts";
import { defaultFormat, pct, renderTooltip } from "../chart/chart.tsx";
import type { ChartPoint } from "../chart/chart.tsx";
import { polar, sectorPath, splitAngles } from "../chart/polar-math.ts";

const SLOTS = chartVariants();
const PIE = pieChartVariants();

interface PieSegment {
  /** Stable key (default: the label). */
  key?: string;
  label: string;
  value: number;
  /** Any CSS colour (default: the palette `var(--chart-N)`). */
  color?: string;
}

interface PieRing {
  data: PieSegment[];
  /** Ring name (tooltip header). */
  label?: string;
}

interface PieChartProps extends Omit<JSX.IntrinsicElements["figure"], "children" | "class"> {
  /** One ring of segments (or use `rings`). */
  data?: PieSegment[];
  /** Nested donut: rings from the outside in, sharing the radius between `innerRadius` and the edge. */
  rings?: PieRing[];
  /** Outer size in px. @default 200 */
  size?: number;
  /** Hole radius as a share of the radius (0 = pie). @default 0 */
  innerRadius?: number;
  /** Gap between sectors in degrees. @default 0 */
  paddingAngle?: number;
  /** Start angle in degrees (counter-clockwise from 3 o'clock). @default 90 */
  startAngle?: number;
  /** End angle in degrees. @default -270 */
  endAngle?: number;
  /** Outside labels. @default false */
  labels?: false | "percent" | "value" | "name";
  /** Legend style. @default "simple" */
  legend?: "simple" | "breakdown" | "none";
  valueFormatter?: (value: number) => string;
  /** Custom tooltip content per segment (a `ChartTooltip`). */
  tooltip?: (point: ChartPoint) => JSX.Element;
  showTooltip?: boolean;
  /** Centre content of a donut, above `centerLabel`. */
  children?: JSX.Element | string;
  centerLabel?: string;
  "aria-label"?: string;
  class?: string;
}

const colorAt = (s: PieSegment, i: number) => s.color ?? `var(--chart-${(i % 6) + 1})`;

const PieChart = (props: PieChartProps): JSX.Element => {
  const {
    data,
    rings: ringsProp,
    size,
    innerRadius,
    paddingAngle,
    startAngle,
    endAngle,
    labels,
    legend,
    valueFormatter,
    tooltip,
    showTooltip,
    children,
    centerLabel,
    class: cls,
    ...rest
  } = props;
  const format = valueFormatter ?? defaultFormat;
  const rings: PieRing[] = ringsProp ?? [{ data: data ?? [] }];
  const start = startAngle ?? 90;
  const end = endAngle ?? -270;
  const outerEdge = labels ? 38 : 48;
  const hole = Math.max(0, Math.min(0.95, innerRadius ?? 0)) * outerEdge;
  const band = (outerEdge - hole) / Math.max(1, rings.length);
  const ringGap = rings.length > 1 ? 1 : 0;
  let colorIndex = 0;
  const sectors = rings.flatMap((ring, ri) => {
    const outer = outerEdge - ri * band;
    const inner = Math.max(0, outer - band + (ri < rings.length - 1 ? ringGap : 0));
    const total = ring.data.reduce((s, d) => s + Math.max(0, d.value), 0);
    const angles = splitAngles(
      ring.data.map((d) => d.value),
      start,
      end,
      paddingAngle ?? 0,
    );
    return ring.data.map((d, i) => {
      const color = colorAt(d, colorIndex++);
      const { a0, a1, mid } = angles[i]!;
      const share = total ? Math.round((Math.max(0, d.value) / total) * 100) : 0;
      const at = polar(inner > 0 ? (outer + inner) / 2 : outer * 0.62, mid);
      const edge = polar(outer, mid);
      const out = polar(outer + 5, mid);
      const point: ChartPoint = {
        index: i,
        label: ring.label ?? d.label,
        items: [{ key: d.key ?? d.label, name: d.label, value: d.value, formatted: format(d.value), color }],
      };
      return {
        d: sectorPath(outer, inner, a0, a1),
        color,
        label: d.label,
        value: format(d.value),
        share: `${share}%`,
        aria: `${ring.label ? `${ring.label}, ` : ""}${d.label}: ${format(d.value)} (${share}%)`,
        anchor: { left: pct(at.x), top: pct(at.y), side: at.x > 60 ? "start" : "end" },
        line: `M${edge.x.toFixed(2)} ${edge.y.toFixed(2)} L${out.x.toFixed(2)} ${out.y.toFixed(2)}`,
        text: { left: pct(polar(outer + 8, mid).x), top: pct(polar(outer + 8, mid).y), align: Math.cos((mid * Math.PI) / 180) >= 0 ? "start" : "end" },
        labelText: labels === "value" ? format(d.value) : labels === "name" ? d.label : `${share}%`,
        tip: showTooltip === false ? null : renderTooltip(point.label, [{ label: d.label, value: format(d.value), color }], "0px", tooltip?.(point)),
        ring: ri,
      };
    });
  });
  const legendItems = rings[0]!.data.map((d, i) => sectors[i]!);
  const total = (rings[0]?.data ?? []).reduce((s, d) => s + Math.max(0, d.value), 0);
  return (
    <figure
      class={chartVariants({ kind: "pie" }).base({ class: PIE.base({ class: cls }) })}
      data-slot="chart"
      style={{ "--chart-polar-size": `${size ?? 200}px` }}
      aria-label={props["aria-label"] ?? sectors.map((s) => s.aria).join(", ")}
      {...rest}
    >
      <div class={SLOTS.polar()} data-slot="chart-plot">
        {labels ? (
          <svg class={SLOTS.polarSvg()} viewBox="0 0 100 100" aria-hidden="true">
            {sectors.map((s) => (s.ring === 0 ? <path class={PIE.leader()} d={s.line} vector-effect="non-scaling-stroke" /> : null))}
          </svg>
        ) : null}
        {sectors.map((s) => (
          <div class={SLOTS.sector()} data-slot="chart-slot" role="group" tabIndex={showTooltip === false ? undefined : 0} aria-label={s.aria}>
            <svg class={SLOTS.polarSvg()} viewBox="0 0 100 100" aria-hidden="true">
              <path class={SLOTS.sectorPath()} d={s.d} style={{ "--chart-color": s.color }} />
            </svg>
            {s.tip ? (
              <span class={SLOTS.anchor()} data-side={s.anchor.side} style={{ left: s.anchor.left, top: s.anchor.top }}>
                {s.tip}
              </span>
            ) : null}
          </div>
        ))}
        {labels
          ? sectors.map((s) =>
              s.ring === 0 ? (
                <span class={SLOTS.polarLabel()} data-align={s.text.align} style={{ left: s.text.left, top: s.text.top }} aria-hidden="true">
                  {s.labelText}
                </span>
              ) : null,
            )
          : null}
        {hole > 0 && (children != null || centerLabel) ? (
          <div class={SLOTS.polarCenter()}>
            <span class={SLOTS.donutValue()}>{children ?? format(total)}</span>
            {centerLabel ? <span>{centerLabel}</span> : null}
          </div>
        ) : null}
      </div>
      {legend === "none" ? null : (
        <ul class={SLOTS.legend()} data-slot="chart-legend" data-legend={legend ?? "simple"}>
          {legendItems.map((s) => (
            <li class={SLOTS.legendItem()}>
              <span class={SLOTS.swatch()} style={{ "--chart-color": s.color }} />
              {s.label}
              {legend === "breakdown" ? (
                <span class={SLOTS.legendValue()}>
                  {s.value} · {s.share}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
};

export { PieChart };
export type { PieChartProps, PieSegment, PieRing };
