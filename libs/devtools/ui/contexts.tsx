// Contexts panel: every provider instance (context name, providing component, value, consumers), with
// jumps to the provider and each consumer. Provided signals edit in place; plain values are read-only.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { focusProvider, loadContexts, providers, valueOf } from "./store.ts";
import { Location, ValueTree } from "./parts.tsx";
import { CompLink } from "./components.tsx";

export function Contexts() {
  const query = signal("");
  const shown = () => {
    const text = query().toLowerCase();
    return providers().filter((p) => !text || [p.ctx.name, p.owner?.name ?? "", p.value.p].some((part) => part.toLowerCase().includes(text)));
  };
  return (
    <div class="pane contexts">
      <div class="toolbar">
        <input class="search" placeholder="Filter contexts" model:value={query} />
        <button type="button" onClick={() => void loadContexts()}>
          Refresh
        </button>
      </div>
      {() =>
        shown().length ? (
          <table class="providers">
            <thead>
              <tr>
                <th>Context</th>
                <th>Provider</th>
                <th>Value</th>
                <th>Consumers</th>
              </tr>
            </thead>
            <tbody>
              <For each={shown} by={(p) => p.provider}>
                {(p) => (
                  <tr class={focusProvider() === p().provider ? "provider focused" : "provider"} data-context={p().ctx.name}>
                    <td>
                      <span class="name ctx-name">{p().ctx.name}</span>
                      {p().ctx.location ? <Location at={p().ctx.location!} /> : null}
                    </td>
                    <td>{p().owner ? <CompLink comp={p().owner!} provider={p().provider} /> : <span class="muted">root</span>}</td>
                    <td>
                      {p().signal !== undefined ? (
                        <ValueTree value={valueOf(p().signal!, p().value)} target={{ kind: "signal", id: p().signal! }} id={"ctx:" + p().provider} />
                      ) : (
                        <span class="ro" title={p().readonly}>
                          <ValueTree value={() => p().value} id={"ctx:" + p().provider} />
                          <span class="badge readonly">read-only</span>
                        </span>
                      )}
                    </td>
                    <td class="consumers">
                      {p().consumers.length ? null : <span class="muted">none yet</span>}
                      <For each={() => p().consumers} by={(c) => c.id}>
                        {(c) => <CompLink comp={c()} />}
                      </For>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        ) : (
          <p class="muted">No context providers mounted.</p>
        )
      }
      <p class="muted hint-line">Provided signals are edited in place (consumers update). Plain values are snapshots read once at setup: provide a signal to edit them live.</p>
    </div>
  );
}
