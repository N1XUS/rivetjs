// Slot presence: a parent reads `props.header` / destructured `header` only to pick a class.
import { signal } from "@rivetjs/reactivity";

// Counts how often each slot's content is evaluated (server and browser).
const seen = (key: string) => {
  const counts = ((globalThis as any).__seen ??= {}) as Record<string, number>;
  counts[key] = (counts[key] ?? 0) + 1;
  return key;
};

// Props object; presence only in a static class expression.
function Card(props: any) {
  return (
    <div id={props.id} class={props.header ? "card has-header" : "card"}>
      <slot r:name="header" />
      <slot />
    </div>
  );
}

// Destructured; presence also picks a wrapper.
function Panel({ id, header, children }: any) {
  return (
    <section id={id} class={header ? "panel has-header" : "panel"}>
      {header ? (
        <header>
          <slot r:name="header" />
        </header>
      ) : null}
      {children}
    </section>
  );
}

// Reads presence, never renders the slot.
function Flag({ id, header }: any) {
  return <i id={id} class={header ? "y" : "n"} />;
}

// Presence and a signal in one class binding: the binding captures `props` (serialized on resume).
function Toggle(props: any) {
  const open = signal(false);
  return (
    <div
      id={props.id}
      class={
        (props.header ? "has-header" : "no-header") + (open() ? " open" : "")
      }
    >
      <button class="open" onClick={() => open.set(true)}>
        open
      </button>
      <slot r:name="header" />
    </div>
  );
}

// A prop that is sometimes undefined (per render, not reactive: props are values).
function Titled({ id, title }: any) {
  return (
    <Card id={id} header={title ? () => <h2>{seen("t")}</h2> : undefined}>
      body
    </Card>
  );
}

export function Page() {
  const on = signal(true);
  // A local slot function: serializable when a resumed binding captures it.
  const Head = () => <h2 class="dyn">{seen("dyn")}</h2>;
  // Presence that changes: re-create the component (props are snapshots), here with a ternary.
  return (
    <main>
      <Card id="a">
        <h2 r:slot="header">{seen("a")}</h2>
        body
      </Card>
      <Card id="b">body</Card>
      <Panel id="c">
        <h2 r:slot="header">{seen("c")}</h2>
        body
      </Panel>
      <Panel id="d">body</Panel>
      <Flag id="e">
        <b r:slot="header">{seen("never")}</b>
      </Flag>
      <Card id="f" header={() => <h2>{seen("f")}</h2>}>
        body
      </Card>
      {on() ? (
        <Card id="g">
          <h2 r:slot="header">{seen("g")}</h2>
          body
        </Card>
      ) : (
        <Card id="g">body</Card>
      )}
      {on() ? (
        <Panel id="h" header={Head}>
          body
        </Panel>
      ) : (
        <Panel id="h">body</Panel>
      )}
      <Toggle id="i">
        <h2 r:slot="header">{seen("i")}</h2>
      </Toggle>
      {on() ? <Toggle id="j" header={Head} /> : <Toggle id="j" />}
      <Titled id="k" title="T" />
      <Titled id="m" />
      <button id="flip" onClick={() => on.update((v) => !v)}>
        flip
      </button>
    </main>
  );
}
