import { signal } from "@rivetjs/reactivity";
import { resource, clientEffect } from "@rivetjs/runtime/dom";
export function Search() {
  const query = signal("initial");
  const search = resource<{ q: string }, string>(
    () => query(),
    async (q, info) => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: info.signal });
      if (!r.ok) throw Error(`Search ${r.status}`);
      return (await r.json()) as { q: string };
    },
    { ssr: false },
  );
  clientEffect(() => {
    search.state();
  });
  return (
    <section>
      <h2>Ajax / resource</h2>
      <button id="slow-search" onClick={() => query.set("slow")}>
        Slow request
      </button>
      <button id="fast-search" onClick={() => query.set("fast")}>
        Fast request
      </button>
      <button id="error-search" onClick={() => query.set("error")}>
        Fail request
      </button>
      <p>
        State: <output id="search-state">{search.state()}</output>
      </p>
      <p>
        Last result: <output id="search-result">{search.latest()?.q ?? "pending"}</output>
      </p>
    </section>
  );
}
