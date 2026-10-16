// Resume-compiled Show / Switch (control-flow.test.ts): server branches are adopted by the browser.
import { signal } from "@rivetjs/reactivity";
import { Show, Switch, Match } from "@rivetjs/runtime/server";

const ran = () => ((globalThis as any).__componentRuns = ((globalThis as any).__componentRuns ?? 0) + 1);
function Counter({ id }: { id: string }) {
  ran();
  const c = signal(0);
  return (
    <span id={id}>
      <button class="inc" onClick={() => c.set(c() + 1)}>
        +
      </button>
      <b class="count">{c()}</b>
      <input class="text" />
    </span>
  );
}
export function Page() {
  ran();
  const n = signal(6);
  const user = signal<{ name: string } | null>({ name: "ann" });
  const m = signal(1);
  return (
    <main>
      <button id="up" onClick={() => n.set(n() + 1)}>
        up
      </button>
      <button id="low" onClick={() => n.set(1)}>
        low
      </button>
      <button id="high" onClick={() => n.set(9)}>
        high
      </button>
      <output id="n">{n()}</output>
      <Show when={() => n() > 5} fallback={() => <i id="fallback">no</i>}>
        {() => <Counter id="shown" />}
      </Show>
      <button id="rename" onClick={() => user.set({ name: "zed" })}>
        rename
      </button>
      <p id="user">
        <Show when={() => user()}>{(u) => <b id="name">{u().name}</b>}</Show>
      </p>
      <button id="next" onClick={() => m.set(m() + 1)}>
        next
      </button>
      <Switch fallback={<p id="none">none</p>}>
        <Match when={() => m() < 3}>{() => <Counter id="small" />}</Match>
        <Match when={() => m() >= 3}>{() => <Counter id="large" />}</Match>
      </Switch>
    </main>
  );
}
