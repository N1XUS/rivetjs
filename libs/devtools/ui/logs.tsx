// Updates (highlight toggle, per-component DOM update counts), HMR and Errors panels.
import { For } from "@rivetjs/runtime/dom";
import { countOf, errors, flashing, highlightError, hmr, resetCounts, setFlashing, tree } from "./store.ts";
import { CompLink } from "./components.tsx";
import { Location } from "./parts.tsx";
import type { HmrEntry, TreeNode } from "../protocol.ts";

const time = (ts: number) => (ts / 1000).toFixed(2) + "s";
function flatten(nodes: readonly TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const node of nodes) {
    if (node.kind === "component") out.push(node);
    flatten(node.children, out);
  }
  return out;
}

export function Updates() {
  const rows = () =>
    flatten(tree())
      .map((node) => ({ id: node.id, name: node.name, n: countOf(node.id) ?? node.updates }))
      .filter((row) => row.n > 0)
      .sort((a, b) => b.n - a.n);
  return (
    <div class="pane">
      <div class="toolbar">
        <label class="check">
          <input
            type="checkbox"
            class="flash-toggle"
            checked={flashing()}
            onChange={(event: Event) => setFlashing((event.currentTarget as HTMLInputElement).checked)}
          />
          Highlight updates
        </label>
        <button type="button" onClick={resetCounts}>
          Reset counts
        </button>
      </div>
      {() =>
        rows().length ? (
          <table class="counts">
            <thead>
              <tr>
                <th>Component</th>
                <th>DOM updates</th>
              </tr>
            </thead>
            <tbody>
              <For each={rows} by={(row) => row.id}>
                {(row) => (
                  <tr data-name={row().name}>
                    <td>{"<" + row().name + ">"}</td>
                    <td class="n">{String(row().n)}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        ) : (
          <p class="muted">No DOM updates recorded since the panel opened.</p>
        )
      }
    </div>
  );
}

const describe = (entry: HmrEntry): string => {
  switch (entry.kind) {
    case "update":
      return "update " + (entry.files ?? []).join(", ");
    case "component":
      return (
        entry.id +
        " — " +
        entry.instances +
        (entry.instances === 1 ? " instance" : " instances") +
        ", state " +
        (entry.state === "kept" ? "kept" : "reset (" + entry.state + ")")
      );
    case "invalidate":
      return (
        "invalidated " + (entry.files ?? []).join(", ") + " (non-component exports changed; importers update)" + (entry.message ? ": " + entry.message : "")
      );
    case "reload":
      return "full reload" + (entry.files ? " " + entry.files.join(", ") : "");
    case "error":
      return "error " + (entry.message ?? "") + (entry.files ? " in " + entry.files.join(", ") : "");
  }
};

export function Hmr() {
  return (
    <div class="pane">
      {() =>
        hmr().length ? (
          <ol class="log">
            <For each={() => [...hmr()].reverse()} by={(entry) => entry.kind + entry.ts + (entry.id ?? "") + (entry.state ?? "")}>
              {(entry) => (
                <li class={"hmr " + entry().kind} data-kind={entry().kind} data-state={entry().state ?? ""}>
                  <span class="muted">{time(entry().ts)}</span> <span class="text">{describe(entry())}</span>
                </li>
              )}
            </For>
          </ol>
        ) : (
          <p class="muted">No hot updates yet. Edit a component to see it update in place.</p>
        )
      }
    </div>
  );
}

export function Errors() {
  return (
    <div class="pane">
      {() =>
        errors().length ? (
          <ol class="log">
            <For each={() => [...errors()].reverse()} by={(entry) => entry.id + ":" + (entry.file?.file ?? "")}>
              {(entry) => (
                <li
                  class={"error-entry " + entry().kind}
                  data-kind={entry().kind}
                  onMouseEnter={() => entry().element && highlightError(entry().id)}
                  onMouseLeave={() => entry().element && highlightError(null)}
                >
                  <div>
                    <span class="badge">{entry().kind}</span> {entry().rule ? <span class="badge rule">{entry().rule}</span> : null}{" "}
                    <span class="message">{entry().message}</span>
                    {entry().file ? <Location at={entry().file!} /> : null}
                  </div>
                  {entry().element || entry().comp ? (
                    <p class="element">
                      {entry().element ? <code class="element-tag">{entry().element}</code> : null}
                      {entry().comp ? <span class="muted"> in </span> : null}
                      {entry().comp ? <CompLink comp={entry().comp!} /> : null}
                    </p>
                  ) : null}
                  {entry().hint ? <p class="hint">{"Hint: " + entry().hint}</p> : null}
                  {entry().frames.length ? (
                    <ul class="frames">
                      <For each={() => entry().frames.slice(0, 8)} by={(frame) => frame.url + frame.line + ":" + frame.col}>
                        {(frame) => (
                          <li class="muted">{(frame().fn || "(anonymous)") + " " + frame().url.replace(/^https?:\/\/[^/]+/, "") + ":" + frame().line}</li>
                        )}
                      </For>
                    </ul>
                  ) : null}
                </li>
              )}
            </For>
          </ol>
        ) : (
          <p class="muted">No errors.</p>
        )
      }
    </div>
  );
}
