// CORE-GAPS (d): a module-level function passed as a prop resumes as a module-reference symbol: through a local alias
// (`const a = double`, dynamic props) and directly in static props (`<Step f={inc} />`, props by value).
import { signal } from "@rivetjs/reactivity";

function double(n: number) {
  return n * 2;
}
const triple = (n: number) => n * 3;
// Only passed directly (no alias registers it).
const inc = (n: number) => n + 1;

function Calc(props: { f: (n: number) => number; n: number }) {
  return <b>{String(props.f(props.n))}</b>;
}

function Step(props: { f: (n: number) => number }) {
  const k = signal(1);
  return (
    <button class="step" onClick={() => k.set(props.f(k()))}>
      {String(k())}
    </button>
  );
}

export function Page() {
  const n = signal(1);
  const a = double;
  const t = triple;
  return (
    <div>
      <p class="out">
        <Calc f={a} n={n()} />|<Calc f={t} n={n()} />
      </p>
      <Step f={inc} />
      <button class="go" onClick={() => n.set(n() + 1)}>
        +
      </button>
    </div>
  );
}
