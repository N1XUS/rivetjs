// Rivet + Preact islands lane: the Rivet page renders the header, the 1000-row list and the layout; the four Preact
// components (../../components/*.preact.tsx, shared with astro-preact) are islands with their own `client` policy.
import "@rivetjs/bridge-preact/types";
import { MONTH, rows, series } from "../../data.ts";
import { Badge } from "../../components/Badge.preact.tsx";
import { Chart } from "../../components/Chart.preact.tsx";
import { Counter } from "../../components/Counter.preact.tsx";
import { Picker } from "../../components/Picker.preact.tsx";

export function Page() {
  return (
    <div id="app">
      <header>
        <strong>Island bench</strong>
        <Counter client="load" start={0} />
        <Badge label="static" />
      </header>
      <main>
        <Picker client="idle" year={MONTH.year} month={MONTH.month} days={MONTH.days} firstWeekday={MONTH.firstWeekday} />
        <ul id="rows">
          {rows.map((row) => (
            <li>
              <span class="id">{row.id}</span>
              <span class="label">{row.label}</span>
              <span class="value">{row.value}</span>
            </li>
          ))}
        </ul>
        <Chart client="visible" values={series} />
      </main>
    </div>
  );
}
