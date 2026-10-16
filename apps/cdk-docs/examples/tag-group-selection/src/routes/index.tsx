import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/cdk/label";
import { Tag, TagGroup, TagList, type Key, type Selection } from "@rivetjs/cdk/tag-group";

export const head = { title: "TagGroup selection" };

const tag =
  "cursor-default rounded-full border border-slate-300 px-3 py-0.5 text-sm outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500 aria-selected:border-sky-700 aria-selected:bg-sky-700 aria-selected:text-white aria-disabled:opacity-40";

// #region demo
export default function Amenities() {
  const selected = signal<Selection>(new Set<Key>(["fitness"]));
  return (
    <section class="m-4 grid max-w-md gap-2">
      <TagGroup id="amenities" selectionMode="multiple" selectedKeys={selected} disabledKeys={["parking"]} class="grid gap-1.5">
        <Label class="text-sm font-semibold">Amenities</Label>
        <TagList class="flex flex-wrap gap-1.5 outline-none">
          <Tag id="laundry" class={tag}>
            Laundry
          </Tag>
          <Tag id="fitness" class={tag}>
            Fitness center
          </Tag>
          <Tag id="parking" class={tag}>
            Parking
          </Tag>
          <Tag id="pool" class={tag}>
            Swimming pool
          </Tag>
          <Tag id="breakfast" isDisabled class={tag}>
            Breakfast
          </Tag>
        </TagList>
      </TagGroup>
      <p id="amenities-value" class="text-sm text-slate-600">
        Current selection: {selected() === "all" ? "all" : [...(selected() as Set<Key>)].join(", ")}
      </p>
      <button
        id="amenities-clear"
        type="button"
        class="justify-self-start rounded border border-slate-300 px-2 py-0.5 text-sm"
        onClick={() => selected.set(new Set())}
      >
        Clear
      </button>
    </section>
  );
}
// #endregion
