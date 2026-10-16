import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { ListBox, type Key, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "ListBox events" };

const colours = [
  { key: "red", label: "Red" },
  { key: "green", label: "Green" },
  { key: "blue", label: "Blue" },
];

// #region demo
export default function Events() {
  const log = signal<{ id: number; text: string }[]>([]);
  // Local constants: the browser resumes them.
  const add = (text: string) => log.update((entries) => [...entries, { id: entries.length, text }]);
  const onSelectionChange = (keys: Selection) => add("selection: " + (keys === "all" ? "all" : [...keys].join(",") || "none"));
  const onAction = (key: Key) => add("action: " + String(key));
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <ListBox
        id="colours"
        aria-label="Colours"
        items={colours}
        selectionMode="single"
        selectionBehavior="replace"
        onSelectionChange={onSelectionChange}
        onAction={onAction}
      />
      <ol id="log" class="m-0 list-decimal pl-5 text-slate-600">
        <For each={log} by={(entry) => entry.id}>
          {(entry) => <li>{entry().text}</li>}
        </For>
      </ol>
    </section>
  );
}
// #endregion
