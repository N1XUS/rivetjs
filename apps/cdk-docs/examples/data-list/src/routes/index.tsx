import { signal } from "@rivetjs/reactivity";
import { createListData } from "@rivetjs/cdk/data";
import { ListBox, ListBoxItem, type Key } from "@rivetjs/cdk/listbox";

export const head = { title: "createListData" };

interface Animal {
  id: number;
  name: string;
}

// #region demo
export default function Animals() {
  const list = createListData<Animal>({
    initialItems: [
      { id: 1, name: "Aardvark" },
      { id: 2, name: "Kangaroo" },
      { id: 3, name: "Snake" },
      { id: 4, name: "Platypus" },
    ],
    initialSelectedKeys: [2],
    // getKey defaults to item.id ?? item.key.
    filter: (animal, text) => animal.name.toLowerCase().includes(text.toLowerCase()),
  });
  const next = signal(5);
  const selected = (): Key[] => {
    const keys = list.selectedKeys();
    return keys === "all" ? list.items().map((animal) => animal.id) : [...keys];
  };
  const button = "rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100";
  return (
    <section class="m-4 grid max-w-sm gap-2 text-sm">
      <input
        id="animals-filter"
        aria-label="Filter animals"
        placeholder="Filter…"
        class="rounded border border-slate-300 px-2 py-1"
        onInput={(e) => list.setFilterText((e.currentTarget as HTMLInputElement).value)}
      />
      <ListBox
        id="animals"
        aria-label="Animals"
        selectionMode="multiple"
        items={list.items}
        selectedKeys={list.selectedKeys}
        class="grid gap-0.5 rounded-lg border border-slate-200 p-1 outline-none"
      >
        {(animal: Animal) => (
          <ListBoxItem
            id={animal.id}
            textValue={animal.name}
            class="rounded px-2 py-1 outline-none aria-selected:bg-sky-100 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500"
          >
            {animal.name}
          </ListBoxItem>
        )}
      </ListBox>
      <div class="flex flex-wrap gap-2">
        <button
          id="animals-add"
          class={button}
          onClick={() => {
            const id = next();
            list.append({ id, name: `Animal ${id}` });
            next.set(id + 1);
          }}
        >
          Append
        </button>
        <button id="animals-top" class={button} onClick={() => list.moveBefore(list.items()[0].id, selected())}>
          Move to top
        </button>
        <button
          id="animals-shout"
          class={button}
          onClick={() => selected().forEach((key) => list.update(key, (prev) => ({ ...prev, name: prev.name.toUpperCase() })))}
        >
          Uppercase
        </button>
        <button id="animals-remove" class={button} onClick={() => list.removeSelectedItems()}>
          Remove selected
        </button>
      </div>
      <output id="animals-count">{list.items().length} items</output>
      <output id="animals-selection">
        Selected:{" "}
        {selected()
          .map((key) => list.getItem(key)?.name)
          .join(", ") || "none"}
      </output>
    </section>
  );
}
// #endregion
