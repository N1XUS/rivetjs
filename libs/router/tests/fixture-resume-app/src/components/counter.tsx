import { signal } from "@rivetjs/reactivity";

export function Counter() {
  const count = signal(0);
  return (
    <button id="counter" onClick={() => count.set(count() + 1)}>
      Count {count()}
    </button>
  );
}
