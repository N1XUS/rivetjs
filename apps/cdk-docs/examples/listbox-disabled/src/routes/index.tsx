import { signal } from "@rivetjs/reactivity";
import { ListBox, type Key, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "ListBox disabled options" };

const seats = [
  { key: "a1", label: "A1" },
  { key: "a2", label: "A2", disabled: true },
  { key: "a3", label: "A3" },
  { key: "a4", label: "A4" },
  { key: "a5", label: "A5" },
];

const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].map(String).sort().join(", ") || "none");

// #region demo
export default function Seats() {
  const all = signal<Selection>(new Set<Key>());
  const selection = signal<Selection>(new Set<Key>());
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <div class="grid content-start gap-1">
        <span class="font-semibold">disabledBehavior="all"</span>
        <ListBox id="all" aria-label="Seats" items={seats} selectionMode="multiple" disabledKeys={["a4"]} selectedKeys={all} />
        <p id="all-value" class="text-slate-600">
          {show(all())}
        </p>
      </div>
      <div class="grid content-start gap-1">
        <span class="font-semibold">disabledBehavior="selection"</span>
        <ListBox
          id="selection"
          aria-label="Seats (focusable)"
          items={seats}
          selectionMode="multiple"
          disabledKeys={["a4"]}
          disabledBehavior="selection"
          selectedKeys={selection}
        />
        <p id="selection-value" class="text-slate-600">
          {show(selection())}
        </p>
      </div>
    </section>
  );
}
// #endregion
