import { signal, createContext, useContext } from "@rivetjs/reactivity";
import { For, Provider } from "@rivetjs/runtime/server";

const ran = () => ((globalThis as any).__componentRuns = ((globalThis as any).__componentRuns ?? 0) + 1);
export const Tone = createContext<string>("parent", { id: "tone" });

function Panel({ title, footer, children }: any) {
  ran();
  const open = signal(false);
  return (
    <section id="panel">
      <h2 id="title">
        <slot r:name="title">Untitled</slot>
      </h2>
      <button id="toggle" onClick={() => open.update((v) => !v)}>
        toggle
      </button>
      {open() ? (
        <div id="body">
          <slot />
          <slot r:name="footer">no footer</slot>
        </div>
      ) : (
        <p id="closed">closed</p>
      )}
    </section>
  );
}

function Rows({ items, row }: any) {
  ran();
  return (
    <ul id="rows">
      <For each={items} by={(s: string) => s}>
        {(item: () => string, i: () => number) => (
          <slot r:name="row" r:args={[item, i]}>
            <li>{item()}</li>
          </slot>
        )}
      </For>
    </ul>
  );
}

function Toned(props: any) {
  ran();
  return (
    <Provider token={Tone} value="child">
      <div id="toned">
        <slot />
      </div>
    </Provider>
  );
}

function ToneOf() {
  return <i id="tone">{useContext(Tone)}</i>;
}

export function Page() {
  ran();
  const count = signal(1);
  const items = signal(["a", "b"]);
  return (
    <main>
      <Panel>
        <span r:slot="title">Hello</span>
        {() => (
          <p id="content">
            count <b id="n">{count()}</b>
          </p>
        )}
        <small r:slot="footer" id="foot">
          {count()} items
        </small>
      </Panel>
      <button id="inc" onClick={() => count.update((v) => v + 1)}>
        inc
      </button>
      <Rows items={items} row={(item: () => string, i: () => number) => <li class="row">{i()}:{item()}</li>} />
      <button id="add" onClick={() => items.update((list) => [...list, "c"])}>
        add
      </button>
    </main>
  );
}

export function Context() {
  return (
    <Toned>
      {() => <ToneOf />}
    </Toned>
  );
}
