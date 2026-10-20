// resource() on a resumed page (../resource-resume.test.ts). `__load` is the page's API: the test defines it on the server
// and in the browser (where it counts calls).
import { signal } from "@rivetjs/reactivity";
import { Suspense, resource } from "@rivetjs/runtime/dom";
import type { ResourceInfo } from "@rivetjs/runtime/dom";

type Load = (key: unknown, info: ResourceInfo<string>) => Promise<string>;
const api = (): Load => (globalThis as unknown as { __load: Load }).__load;

/** Created inside the Suspense content (the server builds it again once its load resolved). */
function Card(props: { start: number }) {
  const n = signal(props.start);
  const card = resource(
    () => n(),
    (key, info) => api()("card" + key, info),
  );
  return (
    <article>
      <b id="card">{card() ?? "-"}</b>
      <button id="card-next" onClick={() => n.set(n() + 1)}>
        next card
      </button>
    </article>
  );
}

export function Page() {
  const id = signal(1);
  // Created outside the Suspense, read inside it.
  const user = resource(
    () => id(),
    (key, info) => api()(key, info),
  );
  const later = resource((_: true, info) => api()("later", info), { ssr: false });
  return (
    <main>
      <Suspense fallback={() => <p id="wait">wait</p>}>
        {() => (
          <section>
            <b id="user">{user()}</b>
            <i id="state">{user.state()}</i>
            <Card start={10} />
          </section>
        )}
      </Suspense>
      <p id="later">{later() ?? later.state()}</p>
      <button id="next" onClick={() => id.set(id() + 1)}>
        next
      </button>
      <button id="refetch" onClick={() => user.refetch()}>
        refetch
      </button>
      <button id="mutate" onClick={() => user.mutate("local")}>
        mutate
      </button>
    </main>
  );
}
