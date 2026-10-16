// Resume client hardening (resume-hardening-browser.test.ts): a keyed list region whose rows carry
// lazily activated class bindings (one element lookup each), a ternary region re-created on the first
// toggle, a handler reading currentTarget, and a second component whose chunk the test breaks.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";

function Extra() {
  const hits = signal(0);
  return (
    <button id="extra" onClick={() => hits.update((n) => n + 1)}>
      extra {hits()}
    </button>
  );
}

// `items`: server data in props (a local `Array.from` const would be re-created from its recipe in the
// browser, new item identities, so the keyed list would re-create every row instead of adopting it).
export function Page({ items }: { items: { id: number }[] }) {
  const picked = signal(-1);
  const limit = signal(100);
  const open = signal(false);
  const seen = signal("");
  return (
    <main>
      <button id="toggle" onClick={() => open.update((value) => !value)}>
        toggle
      </button>
      <div id="panel">{open() ? <p id="open">open</p> : <p id="closed">closed</p>}</div>
      <button
        id="probe"
        onClick={(event: MouseEvent) =>
          seen.set((event.currentTarget as Element).id + ":" + ("value" in Object.getOwnPropertyDescriptor(event, "currentTarget")!))
        }
      >
        probe
      </button>
      <output id="seen">{seen()}</output>
      <button id="fewer" onClick={() => limit.update((n) => n - 1)}>
        fewer
      </button>
      <ul id="rows">
        <For each={() => items.filter((item) => item.id < limit())} by={(item: { id: number }) => item.id}>
          {(item: () => { id: number }) => (
            <li class={picked() === item().id ? "row sel" : "row"} data-id={item().id}>
              <button class="pick" onClick={() => picked.set(item().id)}>
                pick
              </button>
            </li>
          )}
        </For>
      </ul>
      <Extra />
    </main>
  );
}
