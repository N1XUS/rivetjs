// Function-literal destructuring defaults (`../resume-closures-browser.test.ts`): `const { step = () => 1 } = ctx` and a
// parameter default `({ step = () => 2 })` captured by a handler serialize as `_rFn` symbols (compiler `resume.rs`
// `default_site`, a9b34190). Before, the server held a bare function: "function is not serializable" for a handler capture,
// silently dropped inside region locals / provider values (cdk ColorThumb `isSnapping`: dead thumb handlers).
import { signal } from "@rivetjs/reactivity";

type Ctx = { step?: () => number };

function Declared(props: { ctx: Ctx }) {
  const { step = () => 1 } = props.ctx;
  const n = signal(0);
  return (
    <button class="declared" onClick={() => n.set(n() + step())}>
      {n()}
    </button>
  );
}
function Param({ step = () => 2 }: Ctx) {
  const n = signal(0);
  return (
    <button class="param" onClick={() => n.set(n() + step())}>
      {n()}
    </button>
  );
}

export function Page() {
  return (
    <section>
      <Declared ctx={{}} />
      <Param />
    </section>
  );
}
