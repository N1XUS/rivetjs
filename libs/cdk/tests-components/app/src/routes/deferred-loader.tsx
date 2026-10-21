import { load, type PageProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";

// Deferred loader (PPR-T01, `load(fn, { defer: true })`): the shell (counter, fallback, sync sibling) streams first, the
// list arrives as a streamed segment with its own handlers; a client navigation gets the resolved data (fuzz CSR side).
export const loader = load(
  async () => {
    await new Promise((done) => setTimeout(done, 30));
    return { title: "Planets", items: ["Mercury", "Venus", "Earth", "Mars"] };
  },
  { defer: true },
);

export default function DeferredData({ data }: PageProps<typeof loader>) {
  const count = signal(0);
  const picked = signal("none");
  return (
    <section>
      <h1>Deferred data</h1>
      <button id="dl-count" type="button" onClick={() => count.update((n) => n + 1)}>
        Count {count()}
      </button>
      <Async load={() => data} fallback={() => <p id="dl-wait">Loading…</p>}>
        {(value) => (
          <div id="dl-list">
            <h2>{value.title}</h2>
            <ul>
              {value.items.map((item) => (
                <li>
                  <button type="button" onClick={() => picked.set(item)}>
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Async>
      <p id="dl-picked">{picked()}</p>
      <p>Sync sibling</p>
    </section>
  );
}
