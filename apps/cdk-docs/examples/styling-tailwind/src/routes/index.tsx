import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { ListBox, ListBoxItem, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "Styling with Tailwind" };

const sizes = [
  { key: "s", label: "Small" },
  { key: "m", label: "Medium" },
  { key: "l", label: "Large", disabled: true as boolean | undefined },
  { key: "xl", label: "Extra large" },
];

// #region demo
export default function Toolbar() {
  const saves = signal(0);
  const size = signal<Selection>(new Set(["m"]));
  return (
    <section class="m-4 grid max-w-xs gap-3 text-sm">
      <div class="flex gap-2">
        <ToggleButton
          id="bold"
          class="rounded-md border border-slate-300 px-3 py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-teal-600 aria-pressed:border-teal-700 aria-pressed:bg-teal-700 aria-pressed:text-white data-pressed:scale-95"
        >
          Bold
        </ToggleButton>
        <Button
          id="save"
          class="rounded-md bg-slate-900 px-3 py-1.5 text-white focus-visible:outline-2 focus-visible:outline-teal-600 data-pressed:bg-slate-700 data-disabled:opacity-50"
          onPress={() => saves.update((n) => n + 1)}
        >
          Save
        </Button>
        <Button id="archive" isDisabled class="rounded-md bg-slate-900 px-3 py-1.5 text-white data-disabled:cursor-not-allowed data-disabled:opacity-40">
          Archive
        </Button>
      </div>
      <ListBox
        id="size"
        aria-label="Size"
        items={sizes}
        selectionMode="single"
        selectedKeys={size}
        class="grid gap-0.5 rounded-lg border border-slate-200 p-1 outline-none focused:ring-2 focused:ring-teal-600/30"
      >
        {(item: (typeof sizes)[number]) => (
          <ListBoxItem
            id={item.key}
            isDisabled={item.disabled}
            class="cursor-default rounded px-2 py-1 outline-none data-focused:bg-slate-100 aria-selected:bg-teal-100 aria-selected:font-semibold data-disabled:text-slate-400"
          >
            {item.label}
          </ListBoxItem>
        )}
      </ListBox>
      <p id="value" class="text-slate-600">
        Saved {saves()} time(s), size {[...(size() as Set<string>)].join(", ")}
      </p>
    </section>
  );
}
// #endregion
