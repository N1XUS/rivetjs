// G24 resume: ref() objects captured by element id — handlers and effects get the element, refs are
// forwarded through props, one per For row, and an unattached ref attaches when its Show branch renders.
import { signal } from "@rivetjs/reactivity";
import { ref, clientEffect, For, Show } from "@rivetjs/runtime/dom";
import type { Ref } from "@rivetjs/runtime/dom";

function Canvas() {
  const canvas = ref<HTMLCanvasElement>();
  const clicks = signal(0);
  clientEffect(() => void (canvas()!.dataset.drawn = "yes"), { when: "load" });
  return (
    <section>
      <canvas id="canvas" ref={canvas} />
      <button id="paint" onClick={() => (canvas()!.dataset.clicks = String(clicks.set(clicks() + 1)))}>
        paint
      </button>
    </section>
  );
}

function Field(props: { id: string; inputRef?: Ref<HTMLInputElement> }) {
  return <input id={props.id} ref={props.inputRef} />;
}

function Form() {
  const name = ref<HTMLInputElement>();
  return (
    <section>
      <Field id="name" inputRef={name} />
      <Field id="other" />
      <button id="fill" onClick={() => (name()!.value = "filled")}>
        fill
      </button>
    </section>
  );
}

function Row(props: { name: string }) {
  const item = ref<HTMLLIElement>();
  return (
    <li id={"row-" + props.name} ref={item} onClick={() => (item()!.dataset.hit = props.name)}>
      {props.name}
    </li>
  );
}

const rows = ["a", "b", "c"];
function List() {
  return (
    <ul>
      <For each={() => rows} by={(name: string) => name}>
        {(name: () => string) => <Row name={name()} />}
      </For>
    </ul>
  );
}

function Toggle() {
  const open = signal(false);
  const panel = ref<HTMLDivElement>();
  const seen = signal("none");
  clientEffect(() => seen.set(panel()?.id ?? "none"), { when: "load" });
  return (
    <section>
      <button id="open" onClick={() => open.set(!open())}>
        open
      </button>
      {/* Thunk children: hidden content unmounts (eager region-symbol children would be parked, kept). */}
      <Show when={open}>{() => <div id="panel" ref={panel} />}</Show>
      <p id="seen">{seen()}</p>
    </section>
  );
}

function Closable() {
  const open = signal(true);
  const panel = ref<HTMLDivElement>();
  const seen = signal("none");
  clientEffect(() => seen.set(panel()?.id ?? "none"), { when: "load" });
  return (
    <section>
      <button id="close" onClick={() => open.set(!open())}>
        close
      </button>
      {/* Server-rendered branch: removing it resets the resumed ref like a client unmount. */}
      <Show when={open}>{() => <div id="spanel" ref={panel} />}</Show>
      <p id="sseen">{seen()}</p>
    </section>
  );
}

export function Page() {
  return (
    <main>
      <Canvas />
      <Form />
      <List />
      <Closable />
      <Toggle />
    </main>
  );
}
