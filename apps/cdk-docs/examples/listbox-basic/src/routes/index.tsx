import { signal } from "@rivetjs/reactivity";
import { ListBox, type Key, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "ListBox" };

const fruits = [
  { key: "apple", label: "Apple" },
  { key: "banana", label: "Banana" },
  { key: "cherry", label: "Cherry", disabled: true },
  { key: "date", label: "Date" },
  { key: "elderberry", label: "Elderberry" },
];

// #region demo
export default function Fruit() {
  const favourite = signal<Selection>(new Set<Key>(["banana"]));
  return (
    <section class="m-4 grid max-w-xs gap-1 text-sm">
      <span id="favourite-label" class="font-semibold">
        Favourite fruit
      </span>
      <ListBox id="favourite" aria-labelledby="favourite-label" items={fruits} selectionMode="single" selectedKeys={favourite} />
      <p id="favourite-value" class="text-slate-600">
        Favourite: {[...(favourite() as Set<Key>)].join(", ") || "none"}
      </p>
    </section>
  );
}
// #endregion
