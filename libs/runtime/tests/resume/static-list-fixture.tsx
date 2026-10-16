// G-RES: a keyed For whose site reads no signal (a static list) with a handler + reactive attribute per
// row. The site is no region: rows render without row markers and share one `*` row template entry.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";

interface Item {
  id: number;
  label: string;
}

export function StaticList() {
  const selected = signal(-1);
  const items: Item[] = [
    { id: 1, label: "a" },
    { id: 2, label: "b" },
    { id: 3, label: "c" },
  ];
  return (
    <main>
      <ul id="list">
        <For each={() => items} by={(item: Item) => item.id}>
          {(item: () => Item) => (
            <li data-state={selected() === item().id ? "on" : "off"}>
              <button type="button" onClick={() => selected.set(item().id)}>
                {item().label}
              </button>
            </li>
          )}
        </For>
      </ul>
      <output id="out">{selected()}</output>
    </main>
  );
}

// Two lists in one static site with different row shapes: explicit per-row entries (no template), still no markers.
export function TwoLists() {
  const picked = signal("");
  const a = ["x", "y"],
    b = ["z"];
  return (
    <main>
      <p id="picked">{picked()}</p>
      {[
        <For each={() => a} by={(s: string) => s}>
          {(s: () => string) => (
            <button type="button" class="a" onClick={() => picked.set(s())}>
              {s()}
            </button>
          )}
        </For>,
        <For each={() => b} by={(s: string) => s}>
          {(s: () => string) => (
            <i class="b" title={picked()} onClick={() => picked.set(s() + "!")}>
              {s()}
            </i>
          )}
        </For>,
      ]}
    </main>
  );
}
