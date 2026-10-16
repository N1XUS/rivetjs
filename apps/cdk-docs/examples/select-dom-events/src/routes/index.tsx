import { signal } from "@rivetjs/reactivity";
import { Select } from "@rivetjs/cdk/select";

export const head = { title: "Select DOM events" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  // Data items carry their option element's DOM events and attributes.
  const animals = [
    { key: "cat", label: "Cat", lang: "en", onPointerEnter: () => add("cat-enter") },
    { key: "dog", label: "Dog", onPointerEnter: () => add("dog-enter") },
  ];
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <Select
        id="de"
        label="Animal"
        items={animals}
        lang="en"
        onPointerEnter={() => add("root-enter")}
        onDblClick={() => add("root-dbl")}
        triggerProps={{ dir: "ltr", onPointerDown: () => add("trigger-down"), onClick: () => add("trigger-click") }}
        valueProps={{ lang: "en-GB", onContextMenu: () => add("value-menu") }}
        popoverProps={{ lang: "fi", onWheel: () => add("popover-wheel") }}
        listBoxProps={{ dir: "ltr", onPointerDown: () => add("list-down"), onPointerUp: () => add("list-up") }}
      />
      <output id="log" class="text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
