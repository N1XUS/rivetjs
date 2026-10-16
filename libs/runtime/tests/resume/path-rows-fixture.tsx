// Path-addressed list rows (RESUME-ROWS-2, docs/resume.md "Path-addressed rows"): row-plan rows inside row regions ship
// without `data-r`; the browser finds their elements from each row's end marker by child index (state `w`). A list row,
// a table row (`<tbody>`: the parser keeps comments in place), and a row whose content slot holds JSX (ids stay).
import { signal } from "@rivetjs/reactivity";
import { Async, For } from "@rivetjs/runtime/server";

interface Item {
  id: number;
  label: string;
}
const seed = (): Item[] => [
  { id: 1, label: "a" },
  { id: 2, label: "b" },
  { id: 3, label: "c" },
];

export function Rows() {
  const items = signal(seed());
  const picked = signal(0);
  return (
    <section>
      <ul id="list">
        <For each={items} by={(row) => row.id}>
          {(row) => (
            <li class={picked() === row().id ? "on" : ""}>
              <a href={"/item/" + row().id}>{row().label}</a>
              <button class="pick" onClick={() => picked.set(row().id)}>
                pick
              </button>
            </li>
          )}
        </For>
      </ul>
      <table>
        <tbody>
          <For each={items} by={(row) => row.id}>
            {(row) => (
              <tr>
                <td class={picked() === -row().id ? "on" : ""}>{row().label}</td>
                <td>
                  <button class="neg" onClick={() => picked.set(-row().id)}>
                    x
                  </button>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <button id="add" onClick={() => items.set([...items(), { id: items().length + 1, label: "n" }])}>
        add
      </button>
      <output id="picked">{picked()}</output>
    </section>
  );
}

// A content slot holding JSX on some row (it may add elements): the whole list keeps its `data-r` ids.
export function Mixed() {
  const items = signal(seed());
  const picked = signal(0);
  return (
    <ul>
      <For each={items} by={(row) => row.id}>
        {(row) => (
          <li class={picked() === row().id ? "on" : ""}>
            {row().id === 2 ? <b>{row().label}</b> : row().label}
            <button onClick={() => picked.set(row().id)}>pick</button>
          </li>
        )}
      </For>
    </ul>
  );
}

// Path rows only in a streamed segment: the rows add-on ships before that segment (its patch carries `w`).
const load = (): Promise<string> => (globalThis as { __load?: () => Promise<string> }).__load?.() ?? Promise.resolve("x");
export function Streamed() {
  const items = signal(seed());
  const picked = signal(0);
  return (
    <main>
      <output id="picked">{picked()}</output>
      <Async load={load} fallback={() => <i>wait</i>}>
        {(v: string) => (
          <ul id="late" title={v}>
            <For each={items} by={(row) => row.id}>
              {(row) => (
                <li class={picked() === row().id ? "on" : ""}>
                  <button class="pick" onClick={() => picked.set(row().id)}>
                    {row().label}
                  </button>
                </li>
              )}
            </For>
          </ul>
        )}
      </Async>
    </main>
  );
}

// Rows outside row regions (a static list): each row root keeps its `data-r` as the anchor; its button has none.
export function Anchored() {
  const picked = signal(0);
  return (
    <main>
      <output id="picked">{picked()}</output>
      <ol id="static">
        <For each={() => seed()} by={(row) => row.id}>
          {(row) => (
            <li data-state={picked() === row().id ? "on" : "off"}>
              <span>{row().label}</span>
              <button class="pick" onClick={() => picked.set(row().id)}>
                pick
              </button>
            </li>
          )}
        </For>
      </ol>
    </main>
  );
}
