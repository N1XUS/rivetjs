// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no charts). Feature set inspired by commercial UI kits' public Composed Chart
// docs (bar, line and area series on one set of axes: stacked bars with a line, area with a line, bar with an area, multi
// type; grid, axes, tooltip); independent implementation with the data-driven API of `@rivetjs/ui/chart` (`data` + `index`
// + `series`, each series with a `type`):
// - Shares the cartesian frame of `../chart/chart.tsx` (legend, y axis, grid, x axis): bars in HTML (one band per index),
//   lines / areas in one SVG over them at the band centres, then one focusable slot per index whose CSS `:hover` /
//   `:focus-visible` shows the guide, the line / area dots and the tooltip with every series. No state, no script.
// - `stacked` stacks the bar series; `dashed` draws a line series dashed (targets, comparisons).
// - `data` / `series` / formatters are read once at mount.
import { createId } from "@rivetjs/cdk/id";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import { chartVariants } from "../../../styles/src/components/chart/index.ts";
import { composedChartVariants } from "../../../styles/src/components/composed-chart/index.ts";
import { colorOf, defaultFormat, pct, renderFrame, renderTooltip, STOP_BOTTOM, STOP_TOP } from "../chart/chart.tsx";
import type { CartesianChartProps, ChartPoint, ChartSeries, Prepared } from "../chart/chart.tsx";
import { areaPath, linearPath, monotonePath, niceTicks } from "../chart/chart-math.ts";

const SLOTS = chartVariants();
const COMPOSED = composedChartVariants();

interface ComposedSeries extends ChartSeries {
  type: "bar" | "line" | "area";
}

interface ComposedChartProps extends Omit<CartesianChartProps, "series"> {
  series: ComposedSeries[];
  /** Stack the bar series. */
  stacked?: boolean;
  /** `monotone` (default) or `linear` for lines and areas. */
  curve?: "monotone" | "linear";
}

const ComposedChart = (props: ComposedChartProps): JSX.Element => {
  const format = props.valueFormatter ?? defaultFormat;
  const indexFormat = props.indexFormatter ?? ((v: string | number) => String(v));
  const series = props.series;
  const colors = series.map(colorOf);
  const isBar = series.map((s) => s.type === "bar");
  const stacked = props.stacked === true;
  const rows = props.data.map((d) => {
    const values = series.map((s) => Number(d[s.key] ?? 0));
    let acc = 0;
    const sums = values.map((v, i) => (isBar[i] ? (acc += v) : v));
    return { label: indexFormat(d[props.index] ?? ""), values, sums };
  });
  const all = rows.flatMap((r) => r.values.map((v, i) => (stacked && isBar[i] ? r.sums[i]! : v)));
  const lo = Math.min(props.minValue ?? 0, ...all);
  const hi = props.maxValue ?? Math.max(...all, lo + 1);
  const ticks = niceTicks(lo, hi, 4);
  const min = ticks[0]!;
  const max = props.maxValue ?? ticks[ticks.length - 1]!;
  const y = (v: number) => 100 - ((v - min) / (max - min || 1)) * 100;
  const p: Prepared = { rows, ticks: ticks.filter((t) => t <= max), min, max, y, format, colors, labels: series.map((s) => s.label ?? s.key) };
  const n = rows.length;
  const xOf = (i: number) => ((i + 0.5) / Math.max(1, n)) * 100;
  const base = y(Math.max(min, 0));
  const id = createId();
  const curve = props.curve === "linear" ? linearPath : monotonePath;
  const bars = rows.map((r) =>
    r.values
      .map((v, si) => ({ si, v }))
      .filter((b) => isBar[b.si])
      .map((b) => ({
        height: pct(stacked ? (b.v / (max - min || 1)) * 100 : base - y(b.v)),
        color: colors[b.si]!,
      })),
  );
  const paths = series
    .map((s, si) => ({ s, si }))
    .filter(({ s }) => s.type !== "bar")
    .map(({ s, si }) => {
      const points = rows.map((r, i) => ({ x: xOf(i), y: y(r.values[si]!) }));
      const line = curve(points);
      return {
        line,
        area: s.type === "area" ? areaPath(line, points, base) : "",
        color: colors[si]!,
        dashed: s.dashed === true,
        gradient: `${id}-g${si}`,
      };
    });
  const step = 100 / Math.max(1, n);
  const slots = rows.map((r, i) => {
    const point: ChartPoint = {
      index: i,
      label: r.label,
      items: series.map((s, si) => ({ key: s.key, name: p.labels[si]!, value: r.values[si]!, formatted: format(r.values[si]!), color: colors[si]! })),
    };
    return {
      left: pct(i * step),
      width: pct(step),
      side: xOf(i) > 60 ? "start" : "end",
      label: `${r.label}: ${r.values.map((v, si) => `${p.labels[si]} ${format(v)}`).join(", ")}`,
      dots: r.values.map((v, si) => (isBar[si] ? null : { top: pct(y(v)), color: colors[si]! })).filter((d) => d != null),
      tip: renderTooltip(
        r.label,
        r.values.map((v, si) => ({ label: p.labels[si]!, value: format(v), color: colors[si]! })),
        "50%",
        props.tooltip?.(point),
      ),
    };
  });
  const { stacked: _st, curve: _cu, ...frameProps } = props;
  return renderFrame(
    { ...(frameProps as CartesianChartProps), class: COMPOSED.base({ class: props.class }) },
    p,
    "composed",
    <>
      <div class={SLOTS.bars()} aria-hidden="true">
        {bars.map((group) => (
          <div class={SLOTS.barGroup()}>
            {stacked ? (
              <div class={SLOTS.barStack()}>
                {group.map((bar) => (
                  <span class={SLOTS.bar()} style={{ height: bar.height, "--chart-color": bar.color }} />
                ))}
              </div>
            ) : (
              group.map((bar) => <span class={SLOTS.bar()} style={{ height: bar.height, "--chart-color": bar.color }} />)
            )}
          </div>
        ))}
      </div>
      <svg class={SLOTS.svg()} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          {paths.map((path) =>
            path.area ? (
              <linearGradient id={path.gradient} x1="0" y1="0" x2="0" y2="1" style={{ color: path.color }}>
                <stop {...STOP_TOP} />
                <stop {...STOP_BOTTOM} />
              </linearGradient>
            ) : null,
          )}
        </defs>
        {paths.map((path) => (
          <g style={{ "--chart-color": path.color }}>
            {path.area ? <path class={SLOTS.area()} d={path.area} fill={`url(#${path.gradient})`} /> : null}
            <path class={SLOTS.line()} d={path.line} data-dashed={path.dashed ? "" : undefined} vector-effect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      {props.showTooltip === false ? null : (
        <div class={SLOTS.slots()}>
          {slots.map((slot) => (
            <div
              class={`${SLOTS.slot()} ${COMPOSED.slot()}`}
              data-slot="chart-slot"
              data-side={slot.side}
              role="group"
              tabIndex={0}
              aria-label={slot.label}
              style={{ left: slot.left, width: slot.width }}
            >
              <span class={SLOTS.guide()} style={{ "inset-inline-start": "50%" }} />
              {slot.dots.map((dot) => (
                <span class={SLOTS.dot()} style={{ top: dot.top, "inset-inline-start": "50%", "--chart-color": dot.color }} />
              ))}
              {slot.tip}
            </div>
          ))}
        </div>
      )}
    </>,
    xOf,
  );
};

export { ComposedChart };
export type { ComposedChartProps, ComposedSeries };
