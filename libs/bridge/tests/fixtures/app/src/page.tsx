import { signal } from "@rivetjs/reactivity";
import { Counter } from "./Counter.fake.js";
import { Badge } from "./Hooks.fake.js";

// Two islands of one framework (load + visible), a live prop and a callback writing a Rivet signal.
export function Page() {
  const n = signal(1);
  return (
    <main>
      <Counter client="load" count={n()} onIncrement={(k: number) => n.set(n() + k)} />
      <p class="total">{n()}</p>
      <Badge client="visible" label="badge" />
    </main>
  );
}
