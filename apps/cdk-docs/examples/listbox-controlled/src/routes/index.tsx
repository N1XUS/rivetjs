import { signal } from "@rivetjs/reactivity";
import { ListBox, type Key, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "ListBox controlled and uncontrolled" };

const sizes = [
  { key: "s", label: "Small" },
  { key: "m", label: "Medium" },
  { key: "l", label: "Large" },
  { key: "xl", label: "Extra large" },
];

const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].map(String).sort().join(", ") || "none");

// #region demo
export default function Sizes() {
  // Controlled: the signal is the selection. Write it from anywhere.
  const chosen = signal<Selection>(new Set<Key>(["m"]));
  // Uncontrolled: the ListBox keeps its own state; onSelectionChange reports it.
  const reported = signal("m, l");
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <div class="grid content-start gap-2">
        <span class="font-semibold">selectedKeys (signal)</span>
        <ListBox id="controlled" aria-label="Sizes" items={sizes} selectionMode="multiple" selectedKeys={chosen} />
        <p id="controlled-value" class="text-slate-600">
          {show(chosen())}
        </p>
        <div class="flex flex-wrap gap-1">
          <button id="pick-xl" type="button" class="rounded border border-slate-300 px-2" onClick={() => chosen.set(new Set<Key>(["xl"]))}>
            Only XL
          </button>
          <button id="pick-all" type="button" class="rounded border border-slate-300 px-2" onClick={() => chosen.set("all")}>
            All
          </button>
          <button id="pick-none" type="button" class="rounded border border-slate-300 px-2" onClick={() => chosen.set(new Set<Key>())}>
            None
          </button>
        </div>
      </div>
      <div class="grid content-start gap-2">
        <span class="font-semibold">defaultSelectedKeys</span>
        <ListBox
          id="uncontrolled"
          aria-label="Sizes (uncontrolled)"
          items={sizes}
          selectionMode="multiple"
          defaultSelectedKeys={["m", "l"]}
          disallowEmptySelection
          onSelectionChange={(keys) => reported.set(show(keys))}
        />
        <p id="uncontrolled-value" class="text-slate-600">
          onSelectionChange: {reported()}
        </p>
      </div>
    </section>
  );
}
// #endregion
