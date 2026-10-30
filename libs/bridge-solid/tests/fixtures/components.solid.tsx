import { createResource, createSignal, createUniqueId, onCleanup, Show, Suspense, type JSX } from "solid-js";

export const activity = { created: 0, disposed: 0 };
export function Counter(props: { count?: number; label?: string; onIncrement?: (by: number) => void; children?: JSX.Element; title?: JSX.Element }) {
  activity.created++;
  onCleanup(() => activity.disposed++);
  const [local, setLocal] = createSignal(0);
  return (
    <article id={createUniqueId()}>
      <header>{props.title}</header>
      <span class="count">{props.count ?? "missing"}</span>
      <span class="label">{props.label ?? "gone"}</span>
      <button
        class="inc"
        onClick={() => {
          setLocal(local() + 1);
          props.onIncrement?.(1);
        }}
      >
        {local()}
      </button>
      <section>{props.children}</section>
    </article>
  );
}
export function Later(props: { value: string }) {
  const [value] = createResource(async () => {
    await Promise.resolve();
    return props.value;
  });
  return (
    <Suspense fallback={<i>wait</i>}>
      <b>{value()}</b>
    </Suspense>
  );
}
export function Boom(): never {
  throw new Error("solid boom");
}
export function LateBoom() {
  const [value] = createResource(async () => {
    throw new Error("solid async boom");
  });
  return (
    <Suspense fallback={<i>wait</i>}>
      <b>{value()}</b>
    </Suspense>
  );
}
export function CleanBoom(): never {
  onCleanup(() => activity.disposed++);
  throw new Error("solid mount boom");
}
export function Stopper() {
  return <button onClick={(event) => event.stopPropagation()}>stop</button>;
}

export function DynamicSlot(props: { show: boolean; children?: JSX.Element }) {
  return (
    <div>
      <Show when={props.show}>{props.children}</Show>
    </div>
  );
}
