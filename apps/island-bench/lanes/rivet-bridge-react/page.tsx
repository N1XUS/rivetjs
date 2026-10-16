// Rivet + React islands lane: the Rivet page renders the header, the 1000-row list and the layout; the four React
// components (../../components, shared with every lane) are islands with their own `client` policy.
import "@rivetjs/bridge-react/types";
import { MONTH, rows, series } from "../../data.ts";
import { Badge } from "../../components/Badge.react.tsx";
import { Chart } from "../../components/Chart.react.tsx";
import { Counter } from "../../components/Counter.react.tsx";
import { Picker } from "../../components/Picker.react.tsx";

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
