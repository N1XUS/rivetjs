import { signal } from "@rivetjs/reactivity";
import { ListBox, type Key, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "ListBox selection modes" };

const animals = [
  { key: "cat", label: "Cat" },
  { key: "dog", label: "Dog" },
  { key: "fox", label: "Fox" },
  { key: "owl", label: "Owl" },
];

// Sets keep insertion order: sort for a stable printout. "all" is the select-all value.
const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].map(String).sort().join(", ") || "none");

// #region demo
export default function Modes() {
  const single = signal<Selection>(new Set<Key>(["dog"]));
  const multiple = signal<Selection>(new Set<Key>());
  return (
    <section class="m-4 grid grid-cols-3 gap-4 text-sm">
      <div class="grid content-start gap-1">
        <span class="font-semibold">none</span>
        <ListBox id="none" aria-label="Animals (no selection)" items={animals} selectionMode="none" />
        <p class="text-slate-600">Focus only</p>
      </div>
      <div class="grid content-start gap-1">
        <span class="font-semibold">single</span>
        <ListBox id="single" aria-label="Animal" items={animals} selectionMode="single" selectedKeys={single} />
        <p id="single-value" class="text-slate-600">
          {show(single())}
        </p>
      </div>
      <div class="grid content-start gap-1">
        <span class="font-semibold">multiple</span>
        <ListBox id="multiple" aria-label="Animals" items={animals} selectionMode="multiple" selectedKeys={multiple} />
        <p id="multiple-value" class="text-slate-600">
          {show(multiple())}
        </p>
      </div>
    </section>
  );
}
// #endregion
