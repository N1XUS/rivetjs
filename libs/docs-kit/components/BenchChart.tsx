import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { advantage, formatValue, LAYOUT, rowLayout, sorted, type BenchChartSpec, type ChartPoint } from "./chart-model.ts";
import { mountChart } from "./chart-canvas.ts";

const range = (p: ChartPoint, digits: number) =>
  p.min !== undefined && p.max !== undefined ? `${formatValue(p.min, digits)}–${formatValue(p.max, digits)}` : "not reported";

/** Server-side plot height (CSS px) at a wide and a narrow container, so the canvas never shifts layout. */
function plotHeights(chart: Exclude<BenchChartSpec, { kind: "stat" }>): { wide: number; narrow: number } {
  return { wide: rowLayout(chart, 720).height, narrow: rowLayout(chart, LAYOUT.narrow - 1).height };
}

/**
 * Benchmark chart (`::chart{id}` in content, or any page): figure with title, "lower / higher is
 * better" note, legend, a canvas the browser draws on when it scrolls into view, a visually hidden
 * data table (screen readers, no-JS fallback; the canvas reads its data back from it) and a caption
 * with machine, date, method and the report link. `stat` = a big-number card (HTML only, no canvas).
 * Spec shapes: `chart-model.ts`.
 * `compact` drops the caption's method line (homepage tiles); the table and source link stay.
 */
export function BenchChart({ chart, compact }: { chart: BenchChartSpec; compact?: boolean }) {
  const root = ref<HTMLElement>();
  clientEffect(() => mountChart(root()!), { when: "visible" });
  const digits = chart.digits ?? 1;
  const heights = chart.kind === "stat" ? undefined : plotHeights(chart);
  const titleId = `chart-${chart.id}-title`;
  const tableId = `chart-${chart.id}-table`;
  const better = chart.better === "lower" ? "Lower is better" : "Higher is better";
  const stat = chart.kind === "stat" ? statOf(chart) : undefined;
  return (
    <figure
      class={compact ? "bench-tokens bench-chart bench-compact" : "bench-tokens bench-chart"}
      id={`chart-${chart.id}`}
      ref={root}
      data-kind={chart.kind}
      data-unit={chart.unit}
      data-better={chart.better}
      data-digits={String(digits)}
      aria-labelledby={titleId}
    >
      <header class="bench-head">
        <p class="bench-title" id={titleId}>
          {chart.title}
        </p>
        <p class="bench-better">{better}</p>
      </header>
      {stat ? (
        <div class="bench-stat">
          <p class="bench-stat-value">
            <span class="bench-stat-accent">{formatValue(stat.ratio, 2)}×</span> {stat.lead}
          </p>
          <p class="bench-stat-claim">{stat.claim}</p>
          <dl class="bench-stat-list">
            {stat.points.map((p) => (
              <div class={p.rivet ? "bench-stat-row is-rivet" : "bench-stat-row"}>
                <dt>{p.label}</dt>
                <dd>
                  {formatValue(p.value, digits)}
                  <span class="bench-stat-unit">{chart.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div
          class="bench-plot"
          tabIndex={0}
          role="group"
          aria-label={`${chart.title}. Arrow keys read each value; the same data is in the table below.`}
          style={{ "--bench-h": heights!.wide + "px", "--bench-h-narrow": heights!.narrow + "px" }}
        >
          <canvas class="bench-canvas" aria-hidden="true" />
          <div class="bench-tip" aria-hidden="true" hidden />
          <p class="bench-sr bench-live" aria-live="polite" />
        </div>
      )}
      {chart.kind === "stat" ? null : (
        <ul class="bench-legend" aria-hidden="true">
          <li class="bench-key is-rivet">Rivet</li>
          <li class="bench-key">Other frameworks</li>
          {hasRanges(chart) ? <li class="bench-key is-range">min–max of repeats</li> : null}
        </ul>
      )}
      <div class="bench-sr">
        <table class="bench-table" id={tableId}>
          <caption>
            {chart.title} ({chart.unit}, {better.toLowerCase()})
          </caption>
          <thead>
            <tr>
              <th scope="col">{chart.kind === "range" ? "Scenario" : "Lane class"}</th>
              <th scope="col">Framework</th>
              <th scope="col">Median ({chart.unit})</th>
              <th scope="col">Min–max ({chart.unit})</th>
            </tr>
          </thead>
          <tbody>
            {chart.groups.map((group, g) =>
              (chart.kind === "bar" ? sorted(group.points, chart.better) : group.points).map((p) => (
                <tr
                  data-group={String(g)}
                  data-group-label={group.label}
                  data-label={p.label}
                  data-value={String(p.value)}
                  data-min={p.min === undefined ? undefined : String(p.min)}
                  data-max={p.max === undefined ? undefined : String(p.max)}
                  data-rivet={p.rivet ? "" : undefined}
                  data-note={p.note}
                >
                  <td>{group.label}</td>
                  <th scope="row">
                    {p.label}
                    {p.note ? ` (${p.note})` : ""}
                  </th>
                  <td>{formatValue(p.value, digits)}</td>
                  <td>{range(p, digits)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <figcaption class="bench-caption">
        <span>{chart.caption.machine}</span>
        <span>{chart.caption.date}</span>
        {compact ? null : <span class="bench-method">{chart.caption.method}</span>}
        <a href={chart.caption.source.href} rel="noopener">
          {chart.caption.source.label}
        </a>
      </figcaption>
    </figure>
  );
}

/** Headline numbers of a stat chart: Rivet lane, reference lane, ratio. */
function statOf(chart: Extract<BenchChartSpec, { kind: "stat" }>) {
  const points = chart.groups[0].points;
  const rivet = points.find(isRivet);
  const reference = points.find(isPeer);
  if (!rivet || !reference) throw new Error(`chart ${chart.id}: a stat chart needs one Rivet point and one reference point`);
  return { ratio: advantage(rivet.value, reference.value, chart.better), lead: chart.lead, claim: chart.claim, points };
}
const hasRanges = (chart: BenchChartSpec) => chart.groups.some(hasRange);
const hasRange = (group: BenchChartSpec["groups"][number]) => group.points.some(isRanged);
const isRanged = (p: ChartPoint) => p.min !== undefined && p.max !== undefined;
const isRivet = (p: ChartPoint) => p.rivet === true;
const isPeer = (p: ChartPoint) => !p.rivet;
