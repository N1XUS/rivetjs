import { signal } from "@rivetjs/reactivity";
import { setSearchParams, useSearchParams } from "@rivetjs/router/client";

// A search-only navigation keeps this page mounted; its search params follow.
export const live = true;

export default function Live() {
  const count = signal(0);
  const search = useSearchParams();
  return (
    <section id="live">
      <h1>CSR live</h1>
      <button type="button" id="live-count" onClick={() => count.update((value) => value + 1)}>
        Live {count()}
      </button>
      <input id="live-input" />
      <output id="live-search">{search().get("settings") ?? "none"}</output>
      <button type="button" id="live-set" onClick={() => setSearchParams({ settings: "open" })}>
        Open settings
      </button>
      <a id="live-link" href="/live?settings=link">
        Settings link
      </a>
    </section>
  );
}
