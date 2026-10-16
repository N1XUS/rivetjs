/** @jsxImportSource react */
// Island 2 (`client="visible"`, below the fold): an SVG bar chart; clicking a bar selects it.
import { useState } from "react";

export function Chart(props: { values: number[] }) {
  const [picked, setPicked] = useState(-1);
  return (
    <figure className="chart">
      <svg width={12 * 30} height={110} role="img" aria-label="chart">
        {props.values.map((value, i) => (
          <rect
            key={i}
            className="bar"
            data-i={i}
            x={i * 30}
            y={105 - value}
            width={24}
            height={value}
            fill={i === picked ? "#5b00f8" : "#0360fa"}
            onClick={() => setPicked(i)}
          />
        ))}
      </svg>
      <figcaption id="bar-label">{picked < 0 ? "none" : "bar " + (picked + 1) + ": " + props.values[picked]}</figcaption>
    </figure>
  );
}
