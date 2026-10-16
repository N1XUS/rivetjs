import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { ArrowUpRight } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { bestCell, formatValue, sorted, type ProofGrid, type ProofMetric } from "./chart-model.ts";
import { reveal } from "./bench-proof.ts";

/**
 * Homepage benchmark section: a segmented control (radio inputs, no JS) switches between metrics; each
 * metric = headline that states the result, a plain subline, one thin bar per framework with the value at
 * its end, one provenance line. Bars grow once when the section scrolls into view (`reveal`, CSS
 * transition; none under reduced motion or without JS). Data: `ProofMetric` (`chart-model.ts`).
 */
export function BenchProof({ metrics, name = "bench-proof" }: { metrics: ProofMetric[]; name?: string }) {
  const root = ref<HTMLElement>();
  clientEffect(() => reveal(root()!), { when: "visible" });
  return (
    <div class="bench-tokens bench-proof" ref={root}>
      <fieldset class="bench-proof-tabs">
        <legend class="bench-sr">Benchmark</legend>
        {metrics.map((metric, i) => (
          <span class="bench-proof-tab">
            <input type="radio" class="bench-sr" name={name} id={`${name}-${metric.id}`} value={metric.id} checked={i === 0} />
            <label for={`${name}-${metric.id}`}>{metric.tab}</label>
          </span>
        ))}
      </fieldset>
      {metrics.map((metric) => {
        const points = sorted(metric.points, metric.better);
        const max = Math.max(...points.map(valueOf));
        return (
          <div class="bench-proof-panel" data-metric={metric.id} data-verdict={metric.verdict}>
            <p class="bench-proof-headline">{metric.headline}</p>
            <p class="bench-proof-sub">{metric.subline}</p>
            <ol class="bench-proof-rows" aria-label={`${metric.tab}, ${metric.unit}, ${metric.better} is better`}>
              {points.map((p, i) => (
                <li class={p.rivet ? "bench-proof-row is-rivet" : "bench-proof-row"} style={{ "--p": String(p.value / max), "--i": String(i) }}>
                  <span class="bench-proof-name">{p.label}</span>
                  <span class="bench-proof-track">
                    <span class="bench-proof-bar" aria-hidden="true" />
                    <span class="bench-proof-value">
                      {formatValue(p.value, metric.digits)}
                      <span class="bench-proof-unit"> {metric.unit}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p class="bench-proof-source">
              {metric.source.text} · {metric.better === "lower" ? "lower is better" : "higher is better"} ·{" "}
              <a href={metric.source.href} rel="noopener">
                Method
                <Icon icon={ArrowUpRight} size={13} />
              </a>
            </p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Comparison grid: frameworks as columns (Rivet's tinted), metrics as rows (unit in the row label), the
 * best measured cell per row emphasised, "—" where a lane did not run that work. One provenance line.
 */
export function BenchGrid({ grid }: { grid: ProofGrid }) {
  return (
    <div class="bench-tokens bench-grid">
      <div class="bench-grid-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">
                <span class="bench-sr">Metric</span>
              </th>
              {grid.columns.map((column) => (
                <th scope="col" class={column.rivet ? "is-rivet" : undefined}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => {
              const best = bestCell(row.cells, row.better);
              const note = grid.notes?.[row.label];
              return (
                <tr>
                  <th scope="row">
                    {row.label} <span class="bench-grid-unit">({row.unit})</span>
                    {note ? <span class="bench-grid-note">{note}</span> : null}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td class={cellClass(grid.columns[i]!.rivet === true, i === best)}>
                      {cell === null ? (
                        <span class="bench-grid-none" aria-label="not measured">
                          —
                        </span>
                      ) : (
                        formatValue(cell, row.digits)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p class="bench-proof-source">
        Medians, lower is better. Bold = fastest in the row. Sources:{" "}
        {grid.source.map((s, i) => (
          <span>
            {i > 0 ? ", " : ""}
            <a href={s.href} rel="noopener">
              {s.text}
            </a>
          </span>
        ))}
        .
      </p>
    </div>
  );
}

const valueOf = (p: { value: number }) => p.value;
const cellClass = (rivet: boolean, best: boolean) => [rivet ? "is-rivet" : "", best ? "is-best" : ""].filter(Boolean).join(" ") || undefined;
