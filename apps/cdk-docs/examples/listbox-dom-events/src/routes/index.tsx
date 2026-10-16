import { signal } from "@rivetjs/reactivity";
import { Header } from "@rivetjs/cdk/header";
import { ListBox, ListBoxItem, ListBoxSection, type Key, type Selection } from "@rivetjs/cdk/listbox";
import { For } from "@rivetjs/runtime/dom";

export const head = { title: "ListBox DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const picked = signal<Selection>(new Set<Key>());
  const log = signal<{ id: number; text: string }[]>([]);
  const add = (text: string) => log.update((entries) => [...entries, { id: entries.length, text }]);
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <ListBox
        id="words"
        aria-label="Words"
        selectionMode="single"
        selectedKeys={picked}
        lang="en"
        onPointerEnter={() => add("list pointerenter")}
        onClick={() => add("list click")}
        onContextMenu={(event) => {
          event.preventDefault();
          add("list contextmenu");
        }}
      >
        <ListBoxItem id="bonjour" lang="fr" onDblClick={() => add("bonjour dblclick")}>
          Bonjour
        </ListBoxItem>
        <ListBoxItem id="hallo" lang="de" onContextMenu={() => add("hallo contextmenu")}>
          Hallo
        </ListBoxItem>
        <ListBoxSection id="more" lang="it">
          <Header>More</Header>
          <ListBoxItem id="ciao" onPointerEnter={() => add("ciao pointerenter")}>
            Ciao
          </ListBoxItem>
        </ListBoxSection>
      </ListBox>
      <ol id="log" class="m-0 list-decimal pl-5 text-slate-600">
        <For each={log} by={(entry) => entry.id}>
          {(entry) => <li>{entry().text}</li>}
        </For>
      </ol>
    </section>
  );
}
// #endregion
