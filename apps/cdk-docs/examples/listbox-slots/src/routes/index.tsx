import { computed, signal } from "@rivetjs/reactivity";
import { ListBox, ListBoxItem, type Key, type Selection } from "@rivetjs/cdk/listbox";
import { Text } from "@rivetjs/cdk/text";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "ListBox render slots" };

const people = [
  { key: "ada", label: "Ada Lovelace", textValue: "Ada", role: "Mathematician" },
  { key: "alan", label: "Alan Turing", textValue: "Alan", role: "Computer scientist" },
  { key: "grace", label: "Grace Hopper", textValue: "Grace", role: "Rear admiral" },
];

const all = ["Apple", "Apricot", "Banana", "Blueberry"].map((label) => ({ key: label.toLowerCase(), label }));

// #region demo
export default function People() {
  const team = signal<Selection>(new Set<Key>(["alan"]));
  const query = signal("");
  // Items as an accessor (a computed): the list re-renders when the filter changes.
  const filtered = computed(() => all.filter((item) => item.label.toLowerCase().startsWith(query().toLowerCase())));
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <ListBox id="team" aria-label="Team" items={people} selectionMode="multiple" selectedKeys={team}>
        {(person: (typeof people)[number]) => (
          <ListBoxItem id={person.key} textValue={person.textValue} class="flex items-center gap-2">
            {({ isSelected }) => (
              <>
                <span class="w-4 text-teal-700" aria-hidden="true">
                  {isSelected() ? <Icon icon={Check} /> : ""}
                </span>
                <span class="grid">
                  <Text slot="label" class="font-medium">
                    {person.label}
                  </Text>
                  <Text slot="description" class="text-xs text-slate-500">
                    {person.role}
                  </Text>
                </span>
              </>
            )}
          </ListBoxItem>
        )}
      </ListBox>
      <div class="grid content-start gap-2">
        <input
          id="filter"
          class="rounded border border-slate-300 px-2 py-1"
          aria-label="Filter fruit"
          value={query()}
          onInput={(event) => query.set(event.currentTarget.value)}
        />
        <ListBox id="fruit" aria-label="Fruit" items={filtered} renderEmptyState={() => <em class="rv-ListBox-empty">No fruit matches</em>} />
      </div>
    </section>
  );
}
// #endregion
