// Same page as the Rivet lanes: header + 1000-row list rendered on the server (React Server Components), the counter,
// picker and chart as client components, the badge as a server component (no JS).
import { MONTH, rows, series } from "../../../data.ts";
import { Badge } from "../../../components/Badge.react.tsx";
import { Chart, Counter, Picker } from "./islands.jsx";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div id="app">
      <header>
        <strong>Island bench</strong>
        <Counter start={0} />
        <Badge label="static" />
      </header>
      <main>
        <Picker year={MONTH.year} month={MONTH.month} days={MONTH.days} firstWeekday={MONTH.firstWeekday} />
        <ul id="rows">
          {rows.map((row) => (
            <li key={row.id}>
              <span className="id">{row.id}</span>
              <span className="label">{row.label}</span>
              <span className="value">{row.value}</span>
            </li>
          ))}
        </ul>
        <Chart values={series} />
      </main>
    </div>
  );
}
