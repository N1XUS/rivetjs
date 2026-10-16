// Element refs (`ref<T>()`): object refs, forwarding, callback refs, refs in Show and For rows.
import { signal } from "@rivetjs/reactivity";
import { ref, clientEffect, Show, For } from "@rivetjs/runtime/dom";
import type { Ref } from "@rivetjs/runtime/dom";

export const log: string[] = [];

export function Canvas() {
  const canvas = ref<HTMLCanvasElement>();
  log.push("setup:" + String(canvas()));
  clientEffect(() => void log.push("effect:" + (canvas()?.tagName ?? "none")));
  return <canvas id="c" width={8} ref={canvas} />;
}

function Field(props: { label: string; inputRef?: Ref<HTMLInputElement> }) {
  return (
    <label>
      {props.label}
      <input ref={props.inputRef} />
    </label>
  );
}

export function Form() {
  const name = ref<HTMLInputElement>();
  let callback: HTMLButtonElement | undefined;
  return (
    <form>
      <Field label="Name" inputRef={name} />
      <Field label="Other" />
      <button type="button" ref={(el) => (callback = el)} onClick={() => name()!.focus()}>
        focus
      </button>
      <output>{String(!!callback)}</output>
    </form>
  );
}

export const open = signal(false);
export function Toggle() {
  const panel = ref<HTMLDivElement>();
  clientEffect(() => void log.push("panel:" + (panel()?.id ?? "none")));
  return (
    <section>
      <Show when={open}>{() => <div id="panel" ref={panel} />}</Show>
    </section>
  );
}

function Row(props: { name: string }) {
  const item = ref<HTMLLIElement>();
  return (
    <li ref={item} onClick={() => void (item()!.dataset.hit = props.name)}>
      {props.name}
    </li>
  );
}
export function List() {
  return (
    <ul>
      <For each={() => ["a", "b"]} by={(name) => name}>
        {(name) => <Row name={name()} />}
      </For>
    </ul>
  );
}

export const which = signal(true);
export function Swap() {
  const box = ref<HTMLDivElement>();
  clientEffect(() => void log.push("box:" + (box()?.id ?? "none")));
  return (
    <section>
      <Show when={which} fallback={() => <div id="b" ref={box} />}>
        {() => <div id="a" ref={box} />}
      </Show>
    </section>
  );
}
