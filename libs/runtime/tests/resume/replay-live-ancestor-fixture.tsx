// A held cold click's replay carries only the native default (resume-replay-live-ancestor-browser.test.ts, lane
// REG): cdk Checkbox shape with the label's spread already activated (its own listener prevents the default, RA
// useToggle) and the input's press handler (stops the click) still delegated in a chunk that loads late.
import { signal } from "@rivetjs/reactivity";

function Box() {
  return (
    <input
      id="box"
      type="checkbox"
      aria-label="box"
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        (globalThis as { __boxClicks?: number }).__boxClicks = ((globalThis as { __boxClicks?: number }).__boxClicks ?? 0) + 1;
      }}
    />
  );
}

export function Page() {
  const armed = signal(0);
  const label = {
    id: "label",
    "data-armed": () => armed(),
    onClick: (event: MouseEvent) => event.preventDefault(),
  };
  return (
    <main>
      <button id="arm" onClick={() => armed.set(1)}>
        arm
      </button>
      <label {...label}>
        <Box />
      </label>
    </main>
  );
}
