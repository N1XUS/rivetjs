import { advantage, extent, formatTick, formatValue, niceAxis, sorted, type BenchChartSpec, type ChartPoint } from "./chart-model.ts";

const range = (p: ChartPoint, digits: number) =>
  p.min !== undefined && p.max !== undefined ? `${formatValue(p.min, digits)}–${formatValue(p.max, digits)}` : "not reported";

/** Share of the axis (0–1, clamped), as a short CSS number. */
const share = (value: number, max: number) => String(Math.round((Math.min(Math.max(value, 0), max) / (max > 0 ? max : 1)) * 1e5) / 1e5);

/**
 * Benchmark chart (`::chart{id}` in content, or any page): figure with title, "lower / higher is
 * better" note, legend, the plot, a visually hidden data table (screen readers, no-CSS fallback) and a
 * caption with machine, date, method and the report link. `stat` = a big-number card.
 * The plot is server HTML + CSS (STATIC-ZERO-3; it was a canvas drawn by a `visible` client effect, which booted the
 * resume runtime on `/about/benchmarks/` at load): one row per lane, bar / whisker / median dot / value placed by their
 * share of the axis (`--fw` etc., `bench-chart.css`), the axis of a narrow plot (< 520 px: labels above the bars,
 * 4 ticks) chosen by a container query, theme colours and fonts from CSS, a per-row tooltip on hover (CSS) and the
 * entrance growth on a per-row view timeline (no JS). Keyboard (arrows / Home / End / Escape on the focusable plot,
 * announced in the live region) loads with the docs page script on focus (`bench-keys.ts`).
 * Spec shapes: `chart-model.ts`.
 * `compact` drops the caption's method line (homepage tiles); the table and source link stay.
 */
export function BenchChart({ chart, compact }: { chart: BenchChartSpec; compact?: boolean }) {
  const digits = chart.digits ?? 1;
  const titleId = `chart-${chart.id}-title`;
  const tableId = `chart-${chart.id}-table`;
  const better = chart.better === "lower" ? "Lower is better" : "Higher is better";
  const stat = chart.kind === "stat" ? statOf(chart) : undefined;
  return (
    <figure
      class={compact ? "bench-tokens bench-chart bench-compact" : "bench-tokens bench-chart"}
      id={`chart-${chart.id}`}
      data-kind={chart.kind}
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
      ) : chart.kind === "stat" ? null : (
        <Plot chart={chart} digits={digits} />
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
            {chart.groups.map((group) =>
              (chart.kind === "bar" ? sorted(group.points, chart.better) : group.points).map((p) => (
                <tr>
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

/**
 * The bar / range plot as HTML: a wide axis (5 ticks) and a narrow one (4 ticks, < 520 px), each row carrying its marks'
 * shares of both (`--fw` / `--fn` median, `--lw` / `--ln` and `--hw` / `--hn` whisker ends); CSS picks the pair.
 */
function Plot({ chart, digits }: { chart: Exclude<BenchChartSpec, { kind: "stat" }>; digits: number }) {
  const max = extent(chart.groups);
  const wide = niceAxis(max, 5);
  const narrow = niceAxis(max, 4);
  const rows = chart.groups.flatMap((group, g) => (chart.kind === "bar" ? sorted(group.points, chart.better) : group.points).map((point) => ({ point, g })));
  const last = rows.length;
  let index = 0;
  const ticks = (axis: { max: number; ticks: number[] }, kind: string) => (
    <div class={"bench-axis " + kind} aria-hidden="true">
      {axis.ticks.map((tick) => (
        <span style={{ "--t": share(tick, axis.max) }}>{formatTick(tick)}</span>
      ))}
      <span class="bench-unit">{chart.unit}</span>
    </div>
  );
  return (
    <div
      class="bench-plot"
      tabIndex={0}
      role="group"
      aria-label={`${chart.title}. Arrow keys read each value; the same data is in the table below.`}
      style={{ "--kw": String(wide.ticks.length - 1), "--kn": String(narrow.ticks.length - 1) }}
    >
      <div class="bench-rows" aria-hidden="true">
        {chart.groups.map((group, g) => (
          <div class="bench-group">
            {group.label ? <p class="bench-heading">{group.label}</p> : null}
            {rows
              .filter((row) => row.g === g)
              .map(({ point: p }) => {
                const i = index++;
                const ranged = p.min !== undefined && p.max !== undefined;
                const median = `median ${formatValue(p.value, digits)} ${chart.unit}`;
                const span = ranged ? `min–max ${formatValue(p.min!, digits)}–${formatValue(p.max!, digits)} ${chart.unit}` : "";
                const say = [
                  p.label,
                  median,
                  ranged ? `range ${formatValue(p.min!, digits)} to ${formatValue(p.max!, digits)} ${chart.unit}` : "",
                  group.label,
                  p.note ?? "",
                ]
                  .filter(Boolean)
                  .join(", ");
                const anchor = (p.max ?? p.value) / (wide.max || 1);
                const style: Record<string, string> = { "--fw": share(p.value, wide.max), "--fn": share(p.value, narrow.max) };
                if (ranged) {
                  style["--lw"] = share(p.min!, wide.max);
                  style["--ln"] = share(p.min!, narrow.max);
                  style["--hw"] = share(p.max!, wide.max);
                  style["--hn"] = share(p.max!, narrow.max);
                }
                const tipClass = "bench-tip" + (anchor > 0.55 ? " is-left" : "") + (i >= 2 && i >= last - 2 ? " is-up" : "");
                return (
                  <div class={p.rivet ? "bench-row is-rivet" : "bench-row"} style={style} data-say={say}>
                    <span class="bench-label">{p.label}</span>
                    <span class="bench-track">
                      {chart.kind === "bar" ? <span class="bench-bar" /> : null}
                      {ranged ? <span class="bench-whisker" /> : null}
                      {chart.kind === "range" ? <span class="bench-dot" /> : null}
                      <span class="bench-value">{formatValue(p.value, digits)}</span>
                      <span class={tipClass}>
                        <strong>{p.label}</strong>
                        <span>{median}</span>
                        {span ? <span>{span}</span> : null}
                        {group.label ? <span class="bench-tip-note">{group.label}</span> : null}
                        {p.note ? <span class="bench-tip-note">{p.note}</span> : null}
                      </span>
                    </span>
                  </div>
                );
              })}
          </div>
        ))}
        {ticks(wide, "is-wide")}
        {ticks(narrow, "is-narrow")}
      </div>
      <p class="bench-sr bench-live" aria-live="polite" />
    </div>
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
