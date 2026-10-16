// HMR fixture (hot-v2.test.ts): a hot-wrapped component the test replaces, rendered by a parent that
// passes eager children (nodes the parent owns). Compiled through the register hook (DOM v2 by default).
import { hot } from "../../hot.ts";
import { signal } from "../../hot-reactivity.ts";
import type { CompiledElement } from "../../jsx-runtime.ts";

function CardA(props: { label: string; children?: CompiledElement }) {
  const count = signal(0);
  return (
    <p class="a" onClick={() => count.update((n) => n + 1)}>
      {props.label}:{count()}
      {props.children}
    </p>
  );
}
function CardB(props: { label: string; children?: CompiledElement }) {
  const count = signal(0);
  return (
    <section class="b" onClick={() => count.update((n) => n + 10)}>
      {props.label}={count()}
      {props.children}
    </section>
  );
}
export const Card = hot(CardA, "v2-fixture.tsx#Card");
/** A module update replacing Card's implementation. */
export const update = (): unknown => hot(CardB, "v2-fixture.tsx#Card");

export function App(props: { n: () => number }) {
  // Built here (an eager node the parent owns), not lazy JSX children (a slot re-runs on every render).
  const kid = <b>{props.n()}</b>;
  return (
    <div>
      <Card label="x">{kid}</Card>
    </div>
  );
}
