// Rivet native lane: the same page with the four components written in Rivet (signals; resumed on first input, no
// hydration). Same markup as ../../components/*.react.tsx.
import { signal } from "@rivetjs/reactivity";
import { MONTH, rows, series } from "../../data.ts";

function Counter(props: { start: number }) {
  const count = signal(props.start);
  return (
    <div class="counter">
      <button id="inc" onClick={() => count.set(count() + 1)}>
        +
      </button>
      <output id="count">{count()}</output>
    </div>
  );
}

function Chart(props: { values: number[] }) {
  const picked = signal(-1);
  return (
    <figure class="chart">
      <svg width={12 * 30} height={110} role="img" aria-label="chart">
        {props.values.map((value, i) => (
          <rect
            class="bar"
            data-i={i}
            x={i * 30}
            y={105 - value}
            width={24}
            height={value}
            fill={i === picked() ? "#5b00f8" : "#0360fa"}
            onClick={() => picked.set(i)}
          />
        ))}
      </svg>
      <figcaption id="bar-label">{picked() < 0 ? "none" : "bar " + (picked() + 1) + ": " + props.values[picked()]}</figcaption>
    </figure>
  );
}

function Picker(props: { year: number; month: number; days: number; firstWeekday: number }) {
  const day = signal(0);
  const empty = Array.from({ length: props.firstWeekday }, (_, i) => i);
  const days = Array.from({ length: props.days }, (_, i) => i + 1);
  return (
    <div class="picker">
      <div class="grid">
        {empty.map(() => (
          <span class="empty" />
        ))}
        {days.map((d) => (
          <button class={d === day() ? "day on" : "day"} data-d={d} onClick={() => day.set(d)}>
            {d}
          </button>
        ))}
      </div>
      <output id="picked">{day() ? props.year + "-" + props.month + "-" + day() : "no date"}</output>
    </div>
  );
}

function Badge(props: { label: string }) {
  return <span class="badge">{props.label}</span>;
}

export function Page() {
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
            <li>
              <span class="id">{row.id}</span>
              <span class="label">{row.label}</span>
              <span class="value">{row.value}</span>
            </li>
          ))}
        </ul>
        <Chart values={series} />
      </main>
    </div>
  );
}
