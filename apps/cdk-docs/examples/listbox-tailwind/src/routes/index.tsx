import { signal } from "@rivetjs/reactivity";
import { Collection } from "@rivetjs/cdk/collections/components";
import { Header } from "@rivetjs/cdk/header";
import { ListBox, ListBoxItem, ListBoxSection, type Key, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "ListBox with Tailwind" };

const groups = [
  {
    key: "warm",
    title: "Warm",
    children: [
      { key: "red", label: "Red" },
      { key: "orange", label: "Orange", disabled: true as boolean | undefined },
    ],
  },
  {
    key: "cool",
    title: "Cool",
    children: [
      { key: "blue", label: "Blue" },
      { key: "teal", label: "Teal" },
    ],
  },
];

// #region demo
export default function Palette() {
  const picked = signal<Selection>(new Set<Key>(["blue"]));
  return (
    <section class="m-4 max-w-xs text-sm">
      <ListBox
        id="palette"
        aria-label="Palette"
        items={groups}
        selectionMode="multiple"
        selectedKeys={picked}
        class="grid gap-2 rounded-lg border border-slate-200 p-1 shadow-sm outline-none focused:ring-2"
      >
        {(group: (typeof groups)[number]) => (
          <ListBoxSection id={group.key} class="grid gap-0.5">
            <Header class="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</Header>
            <Collection items={group.children}>
              {(color: (typeof groups)[number]["children"][number]) => (
                <ListBoxItem
                  id={color.key}
                  textValue={color.label}
                  isDisabled={color.disabled}
                  class="flex cursor-default items-center justify-between rounded-md px-2 py-1.5 outline-none focused:bg-slate-100 aria-selected:bg-teal-700 aria-selected:text-white aria-disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  {({ isSelected }) => (
                    <>
                      <span>{color.label}</span>
                      <span class="text-xs" aria-hidden="true">
                        {isSelected() ? "selected" : ""}
                      </span>
                    </>
                  )}
                </ListBoxItem>
              )}
            </Collection>
          </ListBoxSection>
        )}
      </ListBox>
    </section>
  );
}
// #endregion
