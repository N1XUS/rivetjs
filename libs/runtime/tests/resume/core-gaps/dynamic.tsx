// CORE-GAPS (e): `Dynamic`'s `component` and forwarded props are live.
import { signal } from "@rivetjs/reactivity";
import { Dynamic } from "@rivetjs/runtime/server";

function Hello(props: { who: string }) {
  return <b class="hello">hello {props.who}</b>;
}
function Bye(props: { who: string }) {
  return <i class="bye">bye {props.who}</i>;
}

export function Page() {
  const n = signal(0);
  return (
    <div>
      <p class="fn">
        <Dynamic component={n() % 2 ? Bye : Hello} who={"w" + n()} />
      </p>
      <p class="tag">
        <Dynamic component={n() % 2 ? "em" : "strong"} title={"t" + n()}>
          {"c" + n()}
        </Dynamic>
      </p>
      <button class="go" onClick={() => n.set(n() + 1)}>
        +
      </button>
    </div>
  );
}
