// Repeated sibling component instances (`xs.map((x) => <Badge … />)`): their text / attribute bindings are packed
// into "+" state entries (`PackedBindings`) — even row strides, uneven ones (`ids`), and a streamed segment.
import { signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/server";
import { For } from "@rivetjs/runtime/dom";

function Badge(props: { label: string; count: number }) {
  return (
    <span class="badge" title={props.label}>
      {props.count}|{props.count * 2}
    </span>
  );
}
function Chip(props: { n: number; i: number; bump?: (by: number) => void }) {
  return (
    <i class="chip">
      {props.n + props.i}
      {props.i === 1 && props.bump ? (
        <button class="x" onClick={() => props.bump!(100)}>
          x
        </button>
      ) : null}
    </i>
  );
}
const rows = [0, 1, 2, 3, 4];
const load = (): Promise<string> => (globalThis as { __load?: () => Promise<string> }).__load?.() ?? Promise.resolve("x");

function Lists(props: { n: () => number; bump: (by: number) => void }) {
  return (
    <>
      <div id="even">
        {rows.map((i) => (
          <Badge count={props.n() + i} label={"L" + i + ":" + props.n()} />
        ))}
      </div>
      <div id="uneven">
        {rows.map((i) => (
          <Chip n={props.n()} i={i} bump={props.bump} />
        ))}
      </div>
    </>
  );
}

export function Page() {
  const n = signal(1);
  return (
    <main>
      <Lists n={n} bump={(by) => n.set(n() + by)} />
      <button id="go" onClick={() => n.set(n() + 1)}>
        +
      </button>
    </main>
  );
}

export function Streamed() {
  const n = signal(1);
  return (
    <main>
      <button id="go" onClick={() => n.set(n() + 1)}>
        +
      </button>
      <section id="late">
        <Async load={load} fallback={() => <i>wait</i>}>
          {() => (
            <div id="chips">
              {rows.map((i) => (
                <Chip n={n()} i={i} />
              ))}
            </div>
          )}
        </Async>
      </section>
    </main>
  );
}

// Rows whose props recipes are other symbols (two call sites) are not packed together.
export function Mixed() {
  const n = signal(1);
  return <div>{rows.map((i) => (i === 1 ? <Chip n={n()} i={i} /> : <Chip n={n() + 0} i={i} />))}</div>;
}

// For rows whose items do not serialize (no row template; cdk HiddenSelect options over collection nodes): each row's
// binding sits in its row's region, packed as one run with row-relative regions (`g`).
const opaque = () => 1;
const keys = ["a", "b", "c", "d", "e"].map((key) => ({ key, opaque }));
export function Options() {
  const sel = signal("b");
  return (
    <main>
      <select id="opts">
        <For each={() => keys} by={(item) => item.key}>
          {(item) => {
            const { key } = item();
            return (
              <option value={key} selected={sel() === key || undefined}>
                {key}
              </option>
            );
          }}
        </For>
      </select>
      <button id="pick" onClick={() => sel.set("d")}>
        d
      </button>
    </main>
  );
}
