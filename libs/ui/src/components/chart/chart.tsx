// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no charts). Feature set inspired by HeroUI Pro's public chart docs
// (area / line / bar / pie-donut charts with tooltip, legend, grid and axes on HeroUI tokens; Pro wraps recharts with a
// children API). Independent implementation with a data-driven API (`data` + `index` + `series`, like a table's columns):
// - Server-rendered SVG (area / line, 0…100 viewBox stretched to the plot, `vector-effect: non-scaling-stroke`) or HTML
//   (bars, axes, labels: crisp at any width). Monotone cubic curves (Fritsch–Carlson, `chart-math.ts`).
// - Tooltips are CSS only: one focusable slot per index (`aria-label` = the row's values) shows the guide, dots and a
//   tooltip on `:hover` / `:focus-visible`. No state, no script: a chart costs no JS on a resumed page.
// - `data` / `series` / formatters are read once at mount (all geometry is plain strings computed before the markup); re-create
//   the chart to show other data (`<Show keyed when={period()}>`).
// - `tooltip` (every chart): a render function `(point: ChartPoint) => JSX` replacing the default tooltip rows (e.g. a
//   `@rivetjs/ui/chart-tooltip` card); still server-rendered, still shown by CSS.
// - Missing values (`null` / absent key, UI-PORT-C): area / line series break into separate runs (a gap) unless
//   `connectNulls`; a bar is left out; tooltips and slot names skip the series. Stacked series count a gap as 0.
// - `showDots` (area / line) draws a dot on every point; a series `dashed` draws its line dashed; a bar chart with
//   `orientation="horizontal"` lays the categories down the side and grows the bars along the inline axis (HeroUI Pro's
//   `layout="vertical"`).
// - The helpers below (`prepare`, `renderFrame`, `renderTooltip`, `colorOf`, …) are shared with `../pie-chart`,
//   `../radar-chart`, `../radial-chart` and `../composed-chart` (not part of the `@rivetjs/ui/chart` entry).
import { createId } from "@rivetjs/cdk/id";
import { cachedIntl } from "@rivetjs/cdk/i18n/intl-cache";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import { chartVariants } from "../../../styles/src/components/chart/index.ts";
import { areaPath, labelIndices, linearPath, monotonePath, niceTicks } from "./chart-math.ts";
import type { Point } from "./chart-math.ts";

const SLOTS = chartVariants();

// Gradient stops (`offset` is missing from the JSX SVG stop typings: spread plain attribute objects).
export const STOP_TOP = { offset: "0%", "stop-color": "currentColor", "stop-opacity": "0.32" } as Record<string, string>;
export const STOP_BOTTOM = { offset: "100%", "stop-color": "currentColor", "stop-opacity": "0.02" } as Record<string, string>;

/** One x value: the index key + a value per series (`null` / absent = no value: a gap in a line or area, no bar). */
type ChartDatum = Record<string, string | number | null | undefined>;

/** One hovered index (cartesian / radar) or segment (pie / radial), handed to a chart's `tooltip` render function. */
interface ChartPoint {
  /** Index of the datum / segment. */
  index: number;
  /** The formatted index value (x label) or the segment / ring name. */
  label: string;
  /** One entry per series (pie / radial: the segment). */
  items: { key: string; name: string; value: number; formatted: string; color: string }[];
}

interface ChartSeries {
  /** Key of the value in each datum. */
  key: string;
  /** Legend / tooltip label (default: the key). */
  label?: string;
  /** Any CSS colour (default: the palette `var(--chart-N)`). */
  color?: string;
  /** Dashed line (area / line outline; comparisons, targets). */
  dashed?: boolean;
}

interface CartesianChartProps extends Omit<JSX.IntrinsicElements["figure"], "children" | "class"> {
  data: ChartDatum[];
  /** Key of the x value (category label) in each datum. */
  index: string;
  series: ChartSeries[];
  /** Plot height in px. @default 240 */
  height?: number;
  /** Formats y values (axis, tooltip). Default: `Intl.NumberFormat("en-US")`. */
  valueFormatter?: (value: number) => string;
  /** Formats the index value (x axis, tooltip title). */
  indexFormatter?: (value: string | number) => string;
  /** Lower bound of the y axis. @default 0 */
  minValue?: number;
  /** Upper bound of the y axis (default: from the data, rounded up to a nice tick). */
  maxValue?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showTooltip?: boolean;
  /** Custom tooltip content per index (e.g. a `ChartTooltip`). */
  tooltip?: (point: ChartPoint) => JSX.Element;
  /** Accessible name of the figure. */
  "aria-label"?: string;
  class?: string;
}

interface AreaChartProps extends CartesianChartProps {
  /** `monotone` (default) or `linear`. */
  curve?: "monotone" | "linear";
  /** Stack the series (areas on top of each other). */
  stacked?: boolean;
  /** A dot on every data point (not only on hover). */
  showDots?: boolean;
  /** Draw a line straight across missing values instead of leaving a gap. @default false */
  connectNulls?: boolean;
}

type LineChartProps = Omit<AreaChartProps, "stacked">;

interface BarChartProps extends CartesianChartProps {
  stacked?: boolean;
  /**
   * `vertical` (default): categories along the x axis, bars grow up. `horizontal`: categories down the side, bars grow
   * along the inline axis (HeroUI Pro / Recharts `layout="vertical"`).
   */
  orientation?: "vertical" | "horizontal";
  /** Width of the category labels of a horizontal bar chart (any CSS length). @default "6rem" */
  categoryWidth?: string;
}

export const colorOf = (s: ChartSeries, i: number) => s.color ?? `var(--chart-${(i % 6) + 1})`;
export const defaultFormat = (v: number) => cachedIntl(Intl.NumberFormat, "en-US").format(v);
export const pct = (n: number) => `${Math.round(n * 1000) / 1000}%`;

export interface Prepared {
  /** `values`: a missing value is 0 there, `has[i]` false. */
  rows: { label: string; values: number[]; sums: number[]; has?: boolean[] }[];
  ticks: number[];
  min: number;
  max: number;
  y: (v: number) => number;
  format: (v: number) => string;
  colors: string[];
  labels: string[];
}

export function prepare(props: CartesianChartProps, stacked: boolean): Prepared {
  const format = props.valueFormatter ?? defaultFormat;
  const indexFormat = props.indexFormatter ?? ((v: string | number) => String(v));
  const rows = props.data.map((d) => {
    const has = props.series.map((s) => d[s.key] != null && d[s.key] !== "");
    const values = props.series.map((s, i) => (has[i] ? Number(d[s.key]) : 0));
    let acc = 0;
    const sums = values.map((v) => (acc += v));
    return { label: indexFormat(d[props.index] ?? ""), values, sums, has };
  });
  // Missing values do not widen the range (stacked: the sums still count them as 0).
  const all = rows.flatMap((r) => (stacked ? r.sums : r.values.filter((_, i) => r.has[i])));
  const lo = Math.min(props.minValue ?? 0, ...all);
  const hi = props.maxValue ?? Math.max(...all, lo + 1);
  const ticks = niceTicks(lo, hi, 4);
  const min = ticks[0]!;
  const max = props.maxValue ?? ticks[ticks.length - 1]!;
  const y = (v: number) => 100 - ((v - min) / (max - min || 1)) * 100;
  return {
    rows,
    ticks: ticks.filter((t) => t <= max),
    min,
    max,
    y,
    format,
    colors: props.series.map(colorOf),
    labels: props.series.map((s) => s.label ?? s.key),
  };
}

/** Legend items (plain data). */
const legendOf = (p: Prepared) => p.labels.map((label, i) => ({ label, color: p.colors[i]! }));

/** Whether series `i` has a value in `row` (prepared rows of other charts carry no `has`). */
export const hasValue = (row: Prepared["rows"][number], i: number) => row.has?.[i] !== false;

/** The point handed to a `tooltip` render function (series without a value left out). */
function pointOf(p: Prepared, row: Prepared["rows"][number], index: number, keys: string[]): ChartPoint {
  return {
    index,
    label: row.label,
    items: row.values.flatMap((v, i) =>
      hasValue(row, i) ? [{ key: keys[i]!, name: p.labels[i]!, value: v, formatted: p.format(v), color: p.colors[i]! }] : [],
    ),
  };
}

function tooltipLabel(p: Prepared, row: Prepared["rows"][number]): string {
  const values = row.values.flatMap((v, i) => (hasValue(row, i) ? [`${p.labels[i]} ${p.format(v)}`] : []));
  return values.length ? `${row.label}: ${values.join(", ")}` : `${row.label}: no data`;
}

/** Default tooltip rows of a prepared row (series without a value left out). */
const rowsOf = (p: Prepared, row: Prepared["rows"][number]) =>
  row.values.flatMap((v, si) => (hasValue(row, si) ? [{ label: p.labels[si]!, value: p.format(v), color: p.colors[si]! }] : []));

/** Index runs of consecutive values of series `si` (one run over every value when `connect`). */
function runsOf(p: Prepared, si: number, connect: boolean): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  p.rows.forEach((r, i) => {
    if (hasValue(r, si)) run.push(i);
    else if (!connect && run.length) {
      runs.push(run);
      run = [];
    }
  });
  if (run.length) runs.push(run);
  return runs;
}

/* -------------------------------------------------------------------------------------------------
 * Area / Line
 * -----------------------------------------------------------------------------------------------*/
function Cartesian(props: AreaChartProps & { kind: "area" | "line" }): JSX.Element {
  const stacked = props.kind === "area" && props.stacked === true;
  const p = prepare(props, stacked);
  const id = createId();
  const n = p.rows.length;
  const xOf = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const curve = props.curve === "linear" ? linearPath : monotonePath;
  const baseline = p.y(Math.max(p.min, 0));
  const connect = props.connectNulls === true;
  const paths = props.series.map((s, si) => {
    let line: string;
    let area = "";
    if (stacked) {
      // Stacked: a gap counts as 0, so the layers stay closed shapes.
      const points: Point[] = p.rows.map((r, i) => ({ x: xOf(i), y: p.y(r.sums[si]!) }));
      line = curve(points);
      if (props.kind === "area") {
        if (si > 0) {
          const below: Point[] = p.rows.map((r, i) => ({ x: xOf(i), y: p.y(r.sums[si - 1]!) })).reverse();
          area = `${line} ${curve(below).replace(/^M/, "L")} Z`;
        } else area = areaPath(line, points, baseline);
      }
    } else {
      // One path per run of values: a missing value leaves a gap (`connectNulls` joins the runs).
      const runs = runsOf(p, si, connect).map((run) => run.map((i) => ({ x: xOf(i), y: p.y(p.rows[i]!.values[si]!) })));
      const lines = runs.map((points) => curve(points));
      line = lines.join(" ");
      if (props.kind === "area") area = runs.map((points, k) => areaPath(lines[k]!, points, baseline)).join(" ");
    }
    return { line, area, color: p.colors[si]!, gradient: `${id}-g${si}`, dashed: s.dashed === true };
  });
  const points = props.showDots
    ? p.rows.flatMap((r, i) =>
        r.values.flatMap((v, si) =>
          hasValue(r, si) || stacked ? [{ left: pct(xOf(i)), top: pct(p.y(stacked ? r.sums[si]! : v)), color: p.colors[si]! }] : [],
        ),
      )
    : [];
  const step = n <= 1 ? 100 : 100 / (n - 1);
  const slots = p.rows.map((r, i) => {
    const x = xOf(i);
    const left = Math.max(0, x - step / 2);
    const right = Math.min(100, x + step / 2);
    return {
      left: pct(left),
      width: pct(right - left),
      // the guide / dots sit at the point: offset inside the clipped slot
      inner: pct(right - left === 0 ? 50 : ((x - left) / (right - left)) * 100),
      side: x > 60 ? "start" : "end",
      label: tooltipLabel(p, r),
      title: r.label,
      dots: r.values.flatMap((v, si) => (hasValue(r, si) ? [{ top: pct(p.y(stacked ? r.sums[si]! : v)), color: p.colors[si]! }] : [])),
      rows: rowsOf(p, r),
      custom: props.tooltip?.(
        pointOf(
          p,
          r,
          i,
          props.series.map((s) => s.key),
        ),
      ),
    };
  });
  return renderFrame(
    props,
    p,
    props.kind,
    <>
      <svg class={SLOTS.svg()} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {props.kind === "area" ? (
          <defs>
            {paths.map((path) => (
              <linearGradient id={path.gradient} x1="0" y1="0" x2="0" y2="1" style={{ color: path.color }}>
                <stop {...STOP_TOP} />
                <stop {...STOP_BOTTOM} />
              </linearGradient>
            ))}
          </defs>
        ) : null}
        {paths.map((path) => (
          <g style={{ "--chart-color": path.color }}>
            {props.kind === "area" ? <path class={SLOTS.area()} d={path.area} fill={`url(#${path.gradient})`} /> : null}
            <path class={SLOTS.line()} d={path.line} data-dashed={path.dashed ? "" : undefined} vector-effect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      {points.length ? (
        <div class={SLOTS.points()} aria-hidden="true">
          {points.map((point) => (
            <span class={SLOTS.point()} style={{ left: point.left, top: point.top, "--chart-color": point.color }} />
          ))}
        </div>
      ) : null}
      {props.showTooltip === false ? null : (
        <div class={SLOTS.slots()}>
          {slots.map((slot) => (
            <div
              class={SLOTS.slot()}
              data-slot="chart-slot"
              data-side={slot.side}
              role="group"
              tabIndex={0}
              aria-label={slot.label}
              style={{ left: slot.left, width: slot.width }}
            >
              <span class={SLOTS.guide()} style={{ "inset-inline-start": slot.inner }} />
              {slot.dots.map((dot) => (
                <span class={SLOTS.dot()} style={{ top: dot.top, "inset-inline-start": slot.inner, "--chart-color": dot.color }} />
              ))}
              {renderTooltip(slot.title, slot.rows, slot.inner, slot.custom)}
            </div>
          ))}
        </div>
      )}
    </>,
    (i) => xOf(i),
  );
}

// Positional-argument helpers are lower-case (`renderTooltip` / `renderFrame`): a capitalised function returning JSX
// compiles as a component boundary, and these are not components (called with positional arguments, not props) — as
// boundaries the resumed page re-rendered the frame on its first event (tooltips gone, focus lost).
export function renderTooltip(title: string, rows: { label: string; value: string; color: string }[], anchor?: string, custom?: JSX.Element): JSX.Element {
  if (custom != null)
    return (
      <div
        class={SLOTS.tooltip({ class: "chart__tooltip--custom" })}
        data-slot="chart-tooltip"
        aria-hidden="true"
        style={anchor ? { "--chart-anchor": anchor } : undefined}
      >
        {custom}
      </div>
    );
  return (
    <div class={SLOTS.tooltip()} data-slot="chart-tooltip" aria-hidden="true" style={anchor ? { "--chart-anchor": anchor } : undefined}>
      <div class={SLOTS.tooltipTitle()}>{title}</div>
      {rows.map((row) => (
        <div class={SLOTS.tooltipRow()}>
          <span class={SLOTS.swatch()} style={{ "--chart-color": row.color }} />
          <span>{row.label}</span>
          <span class={SLOTS.tooltipValue()}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Figure + legend + y axis + grid + plot content + x axis. */
export function renderFrame(props: CartesianChartProps, p: Prepared, kind: string, plot: JSX.Element, xOf: (i: number) => number): JSX.Element {
  const showY = props.showYAxis !== false && kind !== "sparkline";
  const showX = props.showXAxis !== false && kind !== "sparkline";
  const showGrid = props.showGrid !== false && kind !== "sparkline";
  const showLegend = kind !== "sparkline" && (props.showLegend ?? props.series.length > 1);
  const yTicks = p.ticks.map((t) => ({ top: pct(p.y(t)), label: p.format(t), baseline: t === 0 || t === p.min }));
  const shown = labelIndices(p.rows.length, 7);
  const major = labelIndices(p.rows.length, 4);
  const xLabels = shown.map((i) => ({ left: pct(xOf(i)), label: p.rows[i]!.label, minor: !major.includes(i) }));
  const legend = legendOf(p);
  const {
    data: _d,
    index: _i,
    series: _s,
    height,
    valueFormatter: _v,
    indexFormatter: _f,
    minValue: _mi,
    maxValue: _ma,
    showLegend: _l,
    showGrid: _g,
    showXAxis: _x,
    showYAxis: _y,
    showTooltip: _t,
    tooltip: _tt,
    class: cls,
    ...rest
  } = props as CartesianChartProps & Record<string, unknown>;
  const {
    kind: _k,
    curve: _c,
    stacked: _st,
    showDots: _sd,
    connectNulls: _cn,
    orientation: _o,
    categoryWidth: _cw,
    ...figureProps
  } = rest as Record<string, unknown>;
  return (
    <figure
      class={chartVariants({ kind: kind as never }).base({ class: cls as string | undefined })}
      data-slot="chart"
      data-hide-y-axis={showY ? undefined : ""}
      style={{ "--chart-height": `${height ?? (kind === "sparkline" ? 48 : 240)}px` }}
      {...(figureProps as object)}
    >
      {showLegend ? (
        <ul class={SLOTS.legend()} data-slot="chart-legend">
          {legend.map((item) => (
            <li class={SLOTS.legendItem()}>
              <span class={SLOTS.swatch()} style={{ "--chart-color": item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div class={SLOTS.frame()}>
        {showY ? (
          <div class={SLOTS.yAxis()} aria-hidden="true">
            {yTicks.map((t) => (
              <span class={SLOTS.yLabel()} style={{ top: t.top }}>
                {t.label}
              </span>
            ))}
          </div>
        ) : null}
        <div class={SLOTS.plot()} data-slot="chart-plot">
          {showGrid ? (
            <div class={SLOTS.grid()} aria-hidden="true">
              {yTicks.map((t) => (
                <span class={SLOTS.gridLine()} style={{ top: t.top }} data-baseline={t.baseline ? "" : undefined} />
              ))}
            </div>
          ) : null}
          {plot}
        </div>
        {showX ? (
          <div class={SLOTS.xAxis()} aria-hidden="true">
            {xLabels.map((l) => (
              <span class={SLOTS.xLabel()} style={{ left: l.left }} data-minor={l.minor ? "" : undefined}>
                {l.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </figure>
  );
}

/** Area chart: filled monotone areas (optionally stacked) with a CSS tooltip per index. */
const AreaChart = (props: AreaChartProps): JSX.Element => Cartesian({ ...props, kind: "area" });

/** Line chart: monotone lines with a CSS tooltip per index. */
const LineChart = (props: LineChartProps): JSX.Element => Cartesian({ ...props, kind: "line" });

/** Sparkline: a small area chart without axes, grid, legend or tooltip (KPI cards). */
const Sparkline = (props: Omit<AreaChartProps, "showLegend" | "showGrid" | "showXAxis" | "showYAxis">): JSX.Element => {
  const p = prepare(props, false);
  const n = p.rows.length;
  const xOf = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const id = createId();
  const paths = props.series.map((_, si) => {
    const points = p.rows.map((r, i) => ({ x: xOf(i), y: p.y(r.values[si]!) }));
    const line = monotonePath(points);
    return { line, area: areaPath(line, points, 100), color: p.colors[si]!, gradient: `${id}-g${si}` };
  });
  return renderFrame(
    { ...props, showTooltip: false },
    p,
    "sparkline",
    <svg class={SLOTS.svg()} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        {paths.map((path) => (
          <linearGradient id={path.gradient} x1="0" y1="0" x2="0" y2="1" style={{ color: path.color }}>
            <stop {...STOP_TOP} />
            <stop {...STOP_BOTTOM} />
          </linearGradient>
        ))}
      </defs>
      {paths.map((path) => (
        <g style={{ "--chart-color": path.color }}>
          <path class={SLOTS.area()} d={path.area} fill={`url(#${path.gradient})`} />
          <path class={SLOTS.line()} d={path.line} vector-effect="non-scaling-stroke" />
        </g>
      ))}
    </svg>,
    xOf,
  );
};

/* -------------------------------------------------------------------------------------------------
 * Bar
 * -----------------------------------------------------------------------------------------------*/
const BarChart = (props: BarChartProps): JSX.Element => {
  if (props.orientation === "horizontal") return horizontalBars(props);
  const stacked = props.stacked === true;
  const p = prepare(props, stacked);
  const n = p.rows.length;
  const xOf = (i: number) => ((i + 0.5) / Math.max(1, n)) * 100;
  const base = p.y(Math.max(p.min, 0));
  const groups = p.rows.map((r, i) => ({
    custom: props.tooltip?.(
      pointOf(
        p,
        r,
        i,
        props.series.map((s) => s.key),
      ),
    ),
    label: tooltipLabel(p, r),
    title: r.label,
    side: xOf(i) > 60 ? "start" : "end",
    // A missing value keeps its place in the group as an empty bar (the other bars do not shift).
    bars: r.values.map((v, si) => ({
      height: hasValue(r, si) ? pct(stacked ? (v / (p.max - p.min || 1)) * 100 : base - p.y(v)) : "0%",
      color: p.colors[si]!,
    })),
    rows: rowsOf(p, r),
  }));
  return renderFrame(
    props,
    p,
    "bar",
    <div class={SLOTS.bars()}>
      {groups.map((g) => (
        <div
          class={SLOTS.barGroup()}
          data-slot="chart-slot"
          data-side={g.side}
          role="group"
          tabIndex={props.showTooltip === false ? undefined : 0}
          aria-label={g.label}
        >
          {stacked ? (
            <div class={SLOTS.barStack()}>
              {g.bars.map((bar) => (
                <span class={SLOTS.bar()} style={{ height: bar.height, "--chart-color": bar.color }} />
              ))}
            </div>
          ) : (
            g.bars.map((bar) => <span class={SLOTS.bar()} style={{ height: bar.height, "--chart-color": bar.color }} />)
          )}
          {props.showTooltip === false ? null : renderTooltip(g.title, g.rows, undefined, g.custom)}
        </div>
      ))}
    </div>,
    xOf,
  );
};

/**
 * Horizontal bar chart: categories down the side (the y axis column holds their labels at the band centres), value ticks
 * along the bottom, bars grow from the inline start (mirrored in RTL). Same slots / tooltips as the vertical layout.
 */
function horizontalBars(props: BarChartProps): JSX.Element {
  const stacked = props.stacked === true;
  const p = prepare(props, stacked);
  const n = p.rows.length;
  const span = p.max - p.min || 1;
  /** Inline position (%) of a value. */
  const xv = (v: number) => ((v - p.min) / span) * 100;
  const base = xv(Math.max(p.min, 0));
  const yOf = (i: number) => ((i + 0.5) / Math.max(1, n)) * 100;
  const groups = p.rows.map((r, i) => {
    const ends = r.values.map((v, si) => (stacked ? xv(r.sums[si]!) : xv(v)));
    const end = Math.max(base, ...ends.filter((_, si) => hasValue(r, si)));
    return {
      custom: props.tooltip?.(
        pointOf(
          p,
          r,
          i,
          props.series.map((s) => s.key),
        ),
      ),
      label: tooltipLabel(p, r),
      title: r.label,
      anchor: pct(end),
      side: end > 60 ? "start" : "end",
      bars: r.values.map((v, si) => ({
        width: hasValue(r, si) ? pct(stacked ? (v / span) * 100 : Math.max(0, xv(v) - base)) : "0%",
        color: p.colors[si]!,
      })),
      rows: rowsOf(p, r),
    };
  });
  const showY = props.showYAxis !== false;
  const showX = props.showXAxis !== false;
  const showGrid = props.showGrid !== false;
  const showLegend = props.showLegend ?? props.series.length > 1;
  const ticks = p.ticks.map((t) => ({ at: pct(xv(t)), label: p.format(t), baseline: t === 0 || t === p.min }));
  const categories = p.rows.map((r, i) => ({ top: pct(yOf(i)), label: r.label }));
  const legend = legendOf(p);
  const {
    data: _d,
    index: _i,
    series: _s,
    height,
    valueFormatter: _v,
    indexFormatter: _f,
    minValue: _mi,
    maxValue: _ma,
    showLegend: _l,
    showGrid: _g,
    showXAxis: _x,
    showYAxis: _y,
    showTooltip,
    tooltip: _tt,
    stacked: _st,
    orientation: _o,
    categoryWidth,
    class: cls,
    ...figureProps
  } = props;
  return (
    <figure
      class={chartVariants({ kind: "bar", orientation: "horizontal" }).base({ class: cls })}
      data-slot="chart"
      data-orientation="horizontal"
      data-hide-y-axis={showY ? undefined : ""}
      style={{ "--chart-height": `${height ?? 240}px`, "--chart-y-axis-width": categoryWidth ?? "6rem" }}
      {...(figureProps as object)}
    >
      {showLegend ? (
        <ul class={SLOTS.legend()} data-slot="chart-legend">
          {legend.map((item) => (
            <li class={SLOTS.legendItem()}>
              <span class={SLOTS.swatch()} style={{ "--chart-color": item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div class={SLOTS.frame()}>
        {showY ? (
          <div class={SLOTS.yAxis()} aria-hidden="true">
            {categories.map((c) => (
              <span class={SLOTS.yLabel()} style={{ top: c.top }}>
                {c.label}
              </span>
            ))}
          </div>
        ) : null}
        <div class={SLOTS.plot()} data-slot="chart-plot">
          {showGrid ? (
            <div class={SLOTS.grid()} aria-hidden="true">
              {ticks.map((t) => (
                <span class={SLOTS.gridLine()} style={{ "inset-inline-start": t.at }} data-baseline={t.baseline ? "" : undefined} />
              ))}
            </div>
          ) : null}
          <div class={SLOTS.bars()}>
            {groups.map((g) => (
              <div
                class={SLOTS.barGroup()}
                data-slot="chart-slot"
                data-side={g.side}
                role="group"
                tabIndex={showTooltip === false ? undefined : 0}
                aria-label={g.label}
                style={base > 0 ? { "padding-inline-start": pct(base) } : undefined}
              >
                {stacked ? (
                  <div class={SLOTS.barStack()}>
                    {g.bars.map((bar) => (
                      <span class={SLOTS.bar()} style={{ width: bar.width, "--chart-color": bar.color }} />
                    ))}
                  </div>
                ) : (
                  g.bars.map((bar) => <span class={SLOTS.bar()} style={{ width: bar.width, "--chart-color": bar.color }} />)
                )}
                {showTooltip === false ? null : renderTooltip(g.title, g.rows, g.anchor, g.custom)}
              </div>
            ))}
          </div>
        </div>
        {showX ? (
          <div class={SLOTS.xAxis()} aria-hidden="true">
            {ticks.map((t) => (
              <span class={SLOTS.xLabel()} style={{ "inset-inline-start": t.at }}>
                {t.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </figure>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Donut
 * -----------------------------------------------------------------------------------------------*/
interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps extends Omit<JSX.IntrinsicElements["figure"], "children" | "class"> {
  data: DonutSegment[];
  /** Outer size in px. @default 160 */
  size?: number;
  /** Ring thickness in viewBox units (0…50). @default 12 */
  thickness?: number;
  valueFormatter?: (value: number) => string;
  /** Centre value (default: the formatted total), shown above `centerLabel`. */
  children?: JSX.Element;
  centerLabel?: string;
  showLegend?: boolean;
  "aria-label"?: string;
  class?: string;
}

const DonutChart = (props: DonutChartProps): JSX.Element => {
  const { data, size, thickness, valueFormatter, children, centerLabel, showLegend, class: cls, ...rest } = props;
  const format = valueFormatter ?? defaultFormat;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  const gap = data.length > 1 ? 1.2 : 0;
  let offset = 0;
  const segments = data.map((d, i) => {
    const len = total ? (d.value / total) * c : 0;
    const seg = {
      dash: `${Math.max(0, len - gap).toFixed(3)} ${(c - Math.max(0, len - gap)).toFixed(3)}`,
      offset: (-offset).toFixed(3),
      color: d.color ?? `var(--chart-${(i % 6) + 1})`,
      title: `${d.label}: ${format(d.value)} (${total ? Math.round((d.value / total) * 100) : 0}%)`,
      label: d.label,
      value: format(d.value),
      share: `${total ? Math.round((d.value / total) * 100) : 0}%`,
    };
    offset += len;
    return seg;
  });
  const stroke = thickness ?? 12;
  return (
    <figure
      class={chartVariants({ kind: "donut" }).base({ class: cls })}
      data-slot="chart"
      style={{ "--chart-donut-size": `${size ?? 160}px` }}
      aria-label={props["aria-label"] ?? segments.map((s) => s.title).join(", ")}
      {...rest}
    >
      <div class={SLOTS.donut()}>
        <svg class={SLOTS.donutSvg()} viewBox="0 0 100 100" aria-hidden="true">
          <circle class={SLOTS.donutTrack()} cx="50" cy="50" r={String(r)} stroke-width={String(stroke)} />
          {segments.map((s) => (
            <circle
              class={SLOTS.donutSegment()}
              cx="50"
              cy="50"
              r={String(r)}
              stroke-width={String(stroke)}
              stroke-dasharray={s.dash}
              stroke-dashoffset={s.offset}
              style={{ "--chart-color": s.color }}
            >
              <title>{s.title}</title>
            </circle>
          ))}
        </svg>
        <div class={SLOTS.donutCenter()}>
          <span class={SLOTS.donutValue()}>{children ?? format(total)}</span>
          {centerLabel ? <span>{centerLabel}</span> : null}
        </div>
      </div>
      {showLegend === false ? null : (
        <ul class={SLOTS.legend()} data-slot="chart-legend">
          {segments.map((s) => (
            <li class={SLOTS.legendItem()}>
              <span class={SLOTS.swatch()} style={{ "--chart-color": s.color }} />
              {s.label}
              <span class={SLOTS.legendValue()}>
                {s.value} · {s.share}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
};

export { AreaChart, LineChart, BarChart, DonutChart, Sparkline };
export type { AreaChartProps, LineChartProps, BarChartProps, DonutChartProps, DonutSegment, ChartDatum, ChartSeries, CartesianChartProps, ChartPoint };
