import { computed, signal } from "@rivetjs/reactivity";
import { buildCollection } from "@rivetjs/cdk/collections/base";

export const head = { title: "BaseCollection and filtering" };

// Node specs, as React Aria components register them: sections hold items.
const specs = [
  {
    type: "section",
    id: "fruit",
    textValue: "Fruit",
    children: [
      { id: "apple", textValue: "Apple" },
      { id: "banana", textValue: "Banana" },
    ],
  },
  { type: "separator", id: "sep" },
  {
    type: "section",
    id: "veg",
    textValue: "Vegetables",
    children: [
      { id: "aubergine", textValue: "Aubergine" },
      { id: "leek", textValue: "Leek" },
    ],
  },
];

const keysOf = (query: string) => {
  const collection = buildCollection(specs);
  // filter keeps matching items, the sections that still have items, and drops a trailing separator.
  const filtered = query ? collection.filter((text) => text.toLowerCase().startsWith(query.toLowerCase())) : collection;
  // Iterate the top level, then each node's children.
  const tree = [...filtered].map((node) => {
    const children = [...filtered.getChildren(node.key)].map((child) => child.key);
    return children.length ? `${node.key}[${children.join(" ")}]` : String(node.key);
  });
  return `${tree.join(" ")} (size ${filtered.size})`;
};

// #region demo
export default function Filter() {
  const query = signal("");
  const keys = computed(() => keysOf(query()));
  return (
    <section class="m-4 grid max-w-sm gap-2 text-sm">
      <input
        id="query"
        aria-label="Filter"
        class="rounded border border-slate-300 px-2 py-1"
        value={query()}
        onInput={(event) => query.set(event.currentTarget.value)}
      />
      <output id="keys" class="font-mono text-slate-700">
        {keys()}
      </output>
    </section>
  );
}
// #endregion
