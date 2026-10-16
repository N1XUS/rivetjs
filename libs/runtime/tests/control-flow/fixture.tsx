// Show / Switch / Match / Dynamic, compiled for both targets (control-flow.test.ts).
import { signal, onCleanup } from "@rivetjs/reactivity";
import { Show, Switch, Match, Dynamic } from "@rivetjs/runtime/dom";

export const stats = { created: 0, disposed: 0 };
export function A(props: { label?: string }) {
  stats.created++;
  onCleanup(() => stats.disposed++);
  const c = signal(0);
  return (
    <button class="a" onClick={() => c.set(c() + 1)}>
      {props.label ?? "a"}:{c()}
    </button>
  );
}
export function ShowPage({ n }: { n: () => number }) {
  return (
    <div id="show">
      <Show when={() => n() > 5} fallback={() => <i>no</i>}>
        {() => <A />}
      </Show>
    </div>
  );
}
export function TernaryPage({ n }: { n: () => number }) {
  return <div id="show">{n() > 5 ? <A /> : <i>no</i>}</div>;
}
export function SlotFallbackPage({ n }: { n: () => number }) {
  return (
    <div>
      <Show when={() => n() > 5}>
        <i r:slot="fallback">slot</i>
        {() => <b>yes</b>}
      </Show>
    </div>
  );
}
type User = { name: string };
export function KeyedPage({ user }: { user: () => User | null }) {
  return (
    <p>
      <Show keyed when={user}>
        {(u) => <A label={u().name} />}
      </Show>
    </p>
  );
}
export function LivePage({ user }: { user: () => User | null }) {
  return (
    <p>
      <Show when={user} fallback="none">
        {(u) => <b>{u().name}</b>}
      </Show>
    </p>
  );
}
export function EagerPage({ on }: { on: () => boolean }) {
  return (
    <p>
      <Show when={on} fallback={<i>off</i>}>
        <A label="eager" />
      </Show>
    </p>
  );
}
export function SwitchPage({ n }: { n: () => number }) {
  return (
    <section>
      <Switch fallback={<p>mid</p>}>
        <Match when={() => n() < 0}>{() => <A label="neg" />}</Match>
        <Match when={() => n() > 10}>{() => <A label="big" />}</Match>
      </Switch>
    </section>
  );
}
export function DynamicPage({ tag, title }: { tag: string; title: () => string }) {
  return (
    <div>
      <Dynamic component={A} label="dyn" />
      <Dynamic component={tag} class="t" title={title} data-x={1}>
        hello
      </Dynamic>
    </div>
  );
}
export function SwitchTag({ tag }: { tag: () => string }) {
  return (
    <div>
      <Show keyed when={tag}>
        {(t) => <Dynamic component={t()}>x</Dynamic>}
      </Show>
    </div>
  );
}
export function Unsafe({ tag }: { tag: string }) {
  return <Dynamic component={tag} />;
}
