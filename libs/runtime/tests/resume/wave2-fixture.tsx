import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { globalDOMProps } from "@rivetjs/cdk/dom-props";

// Member-read captures: the spread binding captures `props.title` / `props.n` and the projected
// `globalDOMProps(props)` only — `props.secret` (and the children) never reach the state table.
function Row(props: { title: string; n: () => number; secret: string; children?: unknown }) {
  return (
    <p {...globalDOMProps(props)} id="row" title={props.title + props.n()} data-n={props.n()} style={{ "--n": props.n() }}>
      {props.children}
    </p>
  );
}
export function Members() {
  const n = signal(1);
  return (
    <main>
      <Row title="t" n={n} secret="ZZZSECRET" lang="fi">
        <b id="kid">k</b>
      </Row>
      <button id="inc" onClick={() => n.update((v) => v + 1)}>
        +
      </button>
    </main>
  );
}

// Conditional handlers: the absent branch records nothing (no `reset` in data-events / entries).
function Form(props: { onReset?: () => void; onSubmit?: () => void }) {
  const n = signal(0);
  return (
    <form
      id="f"
      onReset={props.onReset ? () => props.onReset!() : undefined}
      onSubmit={props.onSubmit && ((e: Event) => (e.preventDefault(), props.onSubmit!()))}
    >
      <output id="o">{n()}</output>
      <button id="n" type="button" onClick={() => n.update((v) => v + 1)}>
        n
      </button>
      <button id="s" type="submit">
        s
      </button>
    </form>
  );
}
export function Presence() {
  const log = signal("");
  return (
    <section>
      <Form onSubmit={() => log.update((v) => v + "submit,")} />
      <i id="log">{log()}</i>
    </section>
  );
}

// Explicit capture-phase handler + self-referencing const arrow.
export function CaptureRec() {
  const log = signal("");
  const n = signal(3);
  const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
  return (
    <main>
      <div id="outer" onClickCapture={() => log.update((v) => v + "cap,")}>
        <button id="inner" onClick={() => (log.update((v) => v + "bubble,"), n.update((v) => v + 1))}>
          x
        </button>
      </div>
      <i id="log">{log()}</i>
      <b id="fact">{fact(n())}</b>
    </main>
  );
}

// A `<For>` passed as a component's children is its own region: reordering the list adopts the
// rows (same elements) instead of re-creating the whole `List`.
function List(props: { children?: unknown }) {
  return <ul id="list">{props.children}</ul>;
}
export function Adopt() {
  const items = signal(["a", "b", "c"]);
  return (
    <main>
      <List>
        <For each={items} by={(item) => item}>
          {(item) => <li class="row">{item()}</li>}
        </For>
      </List>
      <button id="rev" onClick={() => items.set(items().slice().reverse())}>
        rev
      </button>
    </main>
  );
}
