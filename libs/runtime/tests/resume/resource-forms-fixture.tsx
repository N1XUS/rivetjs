// resource() forms the compiler recipe-wraps without an inline arrow (lane RESOURCE-COMPILER, ../resource-resume.test.ts):
// a module fetcher alone, an inline source + module fetcher, a signal source + local const fetcher + `initialValue` from
// props, an aliased import with `ssr: false` read only in a handler, resources inside `For` rows and a `Show` branch.
// `__load` is the page's API (defined on the server and in the browser, where it counts calls).
import { signal } from "@rivetjs/reactivity";
import { For, Show, Suspense, resource, resource as res } from "@rivetjs/runtime/dom";
import type { ResourceInfo } from "@rivetjs/runtime/dom";

type Load = (key: unknown, info: ResourceInfo<string>) => Promise<string>;
const api = (): Load => (globalThis as unknown as { __load: Load }).__load;
async function loadAll(_: true, info: ResourceInfo<string>): Promise<string> {
  return api()("all", info);
}
const loadUser = (key: number, info: ResourceInfo<string>): Promise<string> => api()("user" + key, info);
const loadLater = (_: true, info: ResourceInfo<string>): Promise<string> => api()("later", info);
function loadRow(key: string, info: ResourceInfo<string>): Promise<string> {
  return api()("row-" + key, info);
}

function Local(props: { init: string }) {
  const n = signal(1);
  const fetch = (key: number, info: ResourceInfo<string>) => api()("local" + key, info);
  const local = resource(n, fetch, { initialValue: props.init });
  return (
    <p>
      <b id="local">{local()}</b>
      <button id="local-next" onClick={() => n.set(n() + 1)}>
        next local
      </button>
    </p>
  );
}

export function Page() {
  const id = signal(1);
  const rows = signal([{ k: "a" }, { k: "b" }]);
  const on = signal(true);
  const msg = signal("-");
  const all = resource(loadAll);
  const user = resource(() => id(), loadUser);
  const later = res(loadLater, { ssr: false });
  return (
    <main>
      <Suspense fallback={() => <p id="wait">wait</p>}>
        {() => (
          <section>
            <b id="all">{all()}</b>
            <b id="user">{user()}</b>
            <Local init="initial" />
            <ul>
              <For each={rows()} by={(r) => r.k}>
                {(row) => {
                  const item = resource(() => row().k, loadRow);
                  return (
                    <li id={"row-" + row().k} onClick={() => item.refetch()}>
                      {item()}
                    </li>
                  );
                }}
              </For>
            </ul>
            <Show when={on()}>
              {() => {
                const shown = resource(loadAll);
                return (
                  <i id="shown" onClick={() => shown.mutate("mutated")}>
                    {shown()}
                  </i>
                );
              }}
            </Show>
          </section>
        )}
      </Suspense>
      <button id="all-refetch" onClick={() => all.refetch()}>
        all
      </button>
      <button id="next" onClick={() => id.set(id() + 1)}>
        next
      </button>
      <button id="later" onClick={() => msg.set(String(later() ?? later.state()))}>
        later
      </button>
      <output id="msg">{msg()}</output>
    </main>
  );
}
