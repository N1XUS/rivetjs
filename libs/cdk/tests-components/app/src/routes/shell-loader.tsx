import { load, type PageProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";

// Shell cache (route rule `shell` in `../../vite.config.ts`, PPR-T23): the shell (counter, fallback, sync sibling) is
// stored once; later document loads get it from the store and the hole (a deferred loader) renders live. The fuzz
// harness primes the store (`RIVET_FUZZ_SHELL`: `hit` default, `miss`, `off`), so resumed loads alternate by run.
export const loader = load(
  async () => {
    await new Promise((done) => setTimeout(done, 20));
    return { title: "Moons", items: ["Io", "Europa", "Ganymede"] };
  },
  { defer: true },
);

export default function ShellLoader({ data }: PageProps<typeof loader>) {
  const count = signal(0);
  const picked = signal("none");
  return (
    <section>
      <h1>Shell cache</h1>
      <button id="sl-count" type="button" onClick={() => count.update((n) => n + 1)}>
        Count {count()}
      </button>
      <Async load={() => data} fallback={() => <p id="sl-wait">Loading…</p>}>
        {(value) => (
          <div id="sl-list">
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
      <p id="sl-picked">{picked()}</p>
      <p>Sync sibling</p>
    </section>
  );
}
