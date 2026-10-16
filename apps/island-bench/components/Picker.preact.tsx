/** @jsxImportSource preact */
// Island 3 (`client="idle"`): a date-like picker (one month grid of day buttons). Preact twin of Picker.react.tsx.
import type { VNode } from "preact";
import { useState } from "preact/hooks";

export function Picker(props: { year: number; month: number; days: number; firstWeekday: number }) {
  const [day, setDay] = useState(0);
  const cells: VNode[] = [];
  for (let i = 0; i < props.firstWeekday; i++) cells.push(<span key={"e" + i} class="empty" />);
  for (let d = 1; d <= props.days; d++)
    cells.push(
      <button key={d} class={d === day ? "day on" : "day"} data-d={d} onClick={() => setDay(d)}>
        {d}
      </button>,
    );
  return (
    <div class="picker">
      <div class="grid">{cells}</div>
      <output id="picked">{day ? props.year + "-" + props.month + "-" + day : "no date"}</output>
    </div>
  );
}
