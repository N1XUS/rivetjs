/** @jsxImportSource react */
// Island 3 (`client="idle"`): a date-like picker (one month grid of day buttons).
import { useState } from "react";

export function Picker(props: { year: number; month: number; days: number; firstWeekday: number }) {
  const [day, setDay] = useState(0);
  const cells = [];
  for (let i = 0; i < props.firstWeekday; i++) cells.push(<span key={"e" + i} className="empty" />);
  for (let d = 1; d <= props.days; d++)
    cells.push(
      <button key={d} className={d === day ? "day on" : "day"} data-d={d} onClick={() => setDay(d)}>
        {d}
      </button>,
    );
  return (
    <div className="picker">
      <div className="grid">{cells}</div>
      <output id="picked">{day ? props.year + "-" + props.month + "-" + day : "no date"}</output>
    </div>
  );
}
