import { createStore, read, write, produce } from "@rivetjs/reactivity/store";
import { signal, computed, batch } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import { load, actions, redirect, type PageProps, type RequestEvent } from "@rivetjs/router";
import { incidents } from "../model.ts";
import { IncidentRow } from "../components/IncidentRow.tsx";
import { Search } from "../components/Search.tsx";
import { Transports } from "../components/Transports.tsx";
import { backend } from "../server/backend.server.ts";
export const loader = load(({ url }: RequestEvent) => ({ incidents: incidents(Math.max(1, Math.min(5000, Number(url.searchParams.get("count") ?? "120")))) }));
export const forms = actions({
  add: async ({ request }: RequestEvent) => {
    const title = String((await request.formData()).get("title") ?? "");
    backend.titles.push(title);
    return redirect("/", 303);
  },
});
export const head = { title: "Operations integration fixture" };
export default function Dashboard({ data }: PageProps<typeof loader>) {
  const counter = signal(0),
    double = computed(() => counter() * 2),
    rows = signal(data.incidents),
    filter = signal(""),
    connected = signal(false);
  const visible = computed(() => rows().filter((r) => r.title.toLowerCase().includes(filter().toLowerCase())));
  const severity = signal("normal"),
    text = signal("initial text");
  const draftStore = createStore({ items: [{ n: 1 }, { n: 2 }] });
  return (
    <main>
      <h1>Incident operations</h1>
      <p>Production SSR, resumability, nested keyed state, Ajax, SSE and WebSocket.</p>
      <nav>
        <a href="/desk">Service desk</a> <a href="/store">Store</a> <a href="/dispatch">Dispatch</a> <a href="/rich">Rich data</a>{" "}
        <a href="/stream">SSR stream</a>
      </nav>
      <section>
        <h2>Cold events / batch</h2>
        <button id="increment" onClick={() => batch(() => counter.update((n) => n + 1))}>
          Increment
        </button>
        <output id="counter">{counter()}</output>
        <output id="double">{double()}</output>
      </section>
      <section>
        <h2>Fully typed produce regression</h2>
        <button
          id="produce-truncate"
          onClick={() =>
            write(
              draftStore,
              produce((d) => {
                void d.items[1].n;
                d.items.length = 0;
              }),
            )
          }
        >
          Read then truncate draft
        </button>
        <output id="produce-length">{read(draftStore, "items").length}</output>
        <output id="produce-second">{read(draftStore, "items.1.n") ?? "absent"}</output>
      </section>
      <Search />
      <section>
        <h2>Transport lifecycle</h2>
        <button id="connect" onClick={() => connected.update((v) => !v)}>
          Toggle transports
        </button>
        <Show when={connected()}>
          <Transports />
        </Show>
      </section>
      <section>
        <h2>Controlled models</h2>
        <label>
          Text <textarea id="editor-text" model:value={text} />
        </label>
        <label>
          Severity{" "}
          <select id="severity" model:value={severity}>
            <option value="normal">Normal</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <pre id="editor-output">
          {severity()}:{text()}
        </pre>
      </section>
      <section>
        <h2>Progressive server action</h2>
        <form method="post" action="?/add">
          <label>
            Title <input name="title" required />
          </label>
          <button>Save on server</button>
        </form>
      </section>
      <section>
        <h2>Nested keyed state</h2>
        <label>
          Filter <input id="filter" model:value={filter} />
        </label>
        <button id="reverse" onClick={() => rows.update((r) => [...r].reverse())}>
          Reverse rows
        </button>
        <Show when={visible().length === 0}>
          <p id="empty">No incidents</p>
        </Show>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Draft</th>
              <th>Severity</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="incidents">
            <For each={visible()} by={(r) => r.id}>
              {(r) => <IncidentRow incident={r()} />}
            </For>
          </tbody>
        </table>
      </section>
    </main>
  );
}
