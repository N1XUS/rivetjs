/** @jsxImportSource react */
// Island 1 (`client="load"`): a counter with local state.
import { useState } from "react";

export function Counter(props: { start: number }) {
  const [count, setCount] = useState(props.start);
  return (
    <div className="counter">
      <button id="inc" onClick={() => setCount(count + 1)}>
        +
      </button>
      <output id="count">{count}</output>
    </div>
  );
}
