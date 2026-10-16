// Unboxed horizontal bar chart (homepage numbers strip): label, bar, value per row. Plain elements, no canvas, no
// JS: bar length = `--p` (value / max), the Rivet bar in the brand gradient, peers neutral; bars grow from the start
// edge on a view timeline, staggered per row (home.css "Bars"), final length without scroll timelines / under
// reduced motion. Values are text (tabular mono).
import type { ChartPoint } from "@rivetjs/docs-kit/components/chart-model.ts";
import { formatValue } from "@rivetjs/docs-kit/components/chart-model.ts";

export interface BarListProps {
  points: readonly ChartPoint[];
  unit: string;
  digits: number;
  /** Accessible name of the list ("CPU per page, ms, lower is better"). */
  label: string;
}

export function BarList(props: BarListProps) {
  const max = Math.max(...props.points.map((p) => p.value));
  return (
    <ol class="bars" aria-label={props.label}>
      {props.points.map((p, index) => (
        <li class="bars-row" data-rivet={p.rivet ? "" : undefined} style={{ "--p": (p.value / max).toFixed(4), "--i": String(index) }}>
          <span class="bars-label">{p.label}</span>
          <span class="bars-track" aria-hidden="true">
            <span class="bars-bar" />
          </span>
          <span class="bars-value">
            {formatValue(p.value, props.digits)} {props.unit}
          </span>
        </li>
      ))}
    </ol>
  );
}
