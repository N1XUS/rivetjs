/** @jsxImportSource preact */
// Island 1 (`client="load"`): a counter with local state. Preact twin of Counter.react.tsx.
import { useState } from "preact/hooks";

export function Counter(props: { start: number }) {
  const [count, setCount] = useState(props.start);
  return (
    <div class="counter">
      <button id="inc" onClick={() => setCount(count + 1)}>
        +
      </button>
      <output id="count">{count}</output>
    </div>
  );
}
