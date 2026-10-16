// HMR + resume fixture (hot-region.test.ts): a hot-wrapped component that keeps `_regionState` and renders a
// keyed list, as a dev-server page's component (the Vite plugin wraps app exports in `hot`). Compiled through
// the register hook (DOM v2).
import { _regionState } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { hot } from "../../hot.ts";

function StackImpl(props: { items: () => number[]; log: string[] }) {
  const memory = _regionState(() => ({ from: "client" }));
  props.log.push(memory.from);
  return (
    <ul>
      {
        <For each={props.items()} by={(n) => n}>
          {(n) => <li>{n}</li>}
        </For>
      }
    </ul>
  );
}
export const Stack = hot(StackImpl, "region-fixture.tsx#Stack");
