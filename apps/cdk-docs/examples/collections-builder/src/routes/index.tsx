import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { CollectionBuilder, Item, Section } from "@rivetjs/cdk/collections/builder";
import { ListCollection } from "@rivetjs/cdk/collections/list";
import { getChildNodes, getItemCount } from "@rivetjs/cdk/collections/nodes";
import type { Key } from "@rivetjs/cdk/collections/types";

export const head = { title: "Building collections" };

const fruit = [
  { id: "apple", name: "Apple" },
  { id: "kiwi", name: "Kiwi" },
];

// Static elements (keys from `key`, else "$.<index>") mixed with a section of dynamic items.
const build = () =>
  new ListCollection(
    new CollectionBuilder<object>().build({
      children: [
        Item({ key: "first", children: "First" }),
        Item({ children: "No key" }),
        Section({ key: "fruit", title: "Fruit", items: fruit, children: (item: { id: string; name: string }) => Item({ children: item.name }) }),
      ],
    }),
  );

const describe = (key: Key | null) => {
  if (key == null) return "-";
  const node = build().getItem(key)!;
  return `${node.type} "${node.textValue}" level ${node.level}, parent ${String(node.parentKey ?? "-")}`;
};

// #region demo
export default function Builder() {
  // Built while rendering (on the server) and again in each handler.
  const collection = build();
  const rows = [...collection.getKeys()].map((key) => ({ key, text: describe(key) }));
  const section = collection.getItem("fruit")!;
  const current = signal<Key | null>(collection.getFirstKey());
  return (
    <section class="m-4 grid gap-2 text-sm">
      <ul id="keys" class="m-0 list-none p-0 font-mono">
        <For each={() => rows} by={(row) => row.key}>
          {(row) => (
            <li>
              {String(row().key)}: {row().text}
            </li>
          )}
        </For>
      </ul>
      <p id="counts" class="text-slate-600">
        size {collection.size}, items {getItemCount(collection)}, section children {[...getChildNodes(section, collection)].map((node) => node.key).join(", ")}
      </p>
      <div class="flex items-center gap-2">
        <button id="prev" type="button" class="rounded border border-slate-300 px-2" onClick={() => current.set(build().getKeyBefore(current()!) ?? current())}>
          getKeyBefore
        </button>
        <button id="next" type="button" class="rounded border border-slate-300 px-2" onClick={() => current.set(build().getKeyAfter(current()!) ?? current())}>
          getKeyAfter
        </button>
        <output id="current" class="font-mono">
          {String(current())}
        </output>
      </div>
    </section>
  );
}
// #endregion
