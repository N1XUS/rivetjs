import { signal } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import type { Incident } from "../model.ts";
export function IncidentRow(props: { incident: Incident }) {
  const draft = signal(props.incident.title),
    expanded = signal(false),
    notes = signal(props.incident.notes);
  return (
    <tr data-row={props.incident.id}>
      <td>{props.incident.id}</td>
      <td>
        <label>
          Local draft <input model:value={draft} />
        </label>
      </td>
      <td>{props.incident.severity}</td>
      <td>
        <button class="expand" onClick={() => expanded.update((v) => !v)}>
          Details
        </button>
        <Show when={expanded()}>
          <section>
            <button class="add-note" onClick={() => notes.update((old) => [...old, { id: `${props.incident.id}-${old.length + 1}`, text: "New note" }])}>
              Add note
            </button>
            <ul>
              <For each={notes()} by={(n) => n.id}>
                {(n) => <li data-note={n().id}>{n().text}</li>}
              </For>
            </ul>
          </section>
        </Show>
      </td>
    </tr>
  );
}
