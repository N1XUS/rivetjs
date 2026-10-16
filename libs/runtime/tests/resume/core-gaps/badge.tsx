// CORE-GAPS (c): member reads of live props (`{props.count}`, `title={props.label}`, `props.count * 2`) update the
// server nodes in place on a resumed page (no re-creation of the child).
import { signal } from "@rivetjs/reactivity";

function Badge(props: { count: number; label: string }) {
  return (
    <span class="badge" title={props.label}>
      {props.count}|{props.count * 2}
    </span>
  );
}

export function Page() {
  const n = signal(1);
  return (
    <div>
      <Badge count={n()} label={"L" + n()} />
      <button class="go" onClick={() => n.set(n() + 1)}>
        +
      </button>
    </div>
  );
}
