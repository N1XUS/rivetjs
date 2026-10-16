import { X } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { createListData } from "@rivetjs/cdk/data";
import { Label } from "@rivetjs/cdk/label";
import { Tag, TagGroup, TagList } from "@rivetjs/cdk/tag-group";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "TagGroup removal" };

interface Category {
  id: string;
  name: string;
}

const initial: Category[] = [
  { id: "news", name: "News" },
  { id: "travel", name: "Travel" },
  { id: "gaming", name: "Gaming" },
  { id: "shopping", name: "Shopping" },
];

// #region demo
export default function Removable() {
  const list = createListData<Category>({ initialItems: initial });
  return (
    <section class="m-4 grid max-w-sm gap-2">
      <TagGroup id="removable" selectionMode="multiple" onRemove={(keys) => list.remove(...keys)} class="grid gap-1.5">
        <Label class="text-sm font-semibold">Categories</Label>
        <TagList
          items={list.items}
          renderEmptyState={() => <span class="text-sm text-slate-500">No categories</span>}
          class="flex flex-wrap gap-1.5 outline-none"
        >
          {(item: Category) => (
            <Tag
              textValue={item.name}
              class="flex cursor-default items-center gap-1 rounded-full border border-slate-300 py-0.5 pl-3 pr-1 text-sm outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500 aria-selected:border-sky-700 aria-selected:bg-sky-700 aria-selected:text-white"
            >
              {item.name}
              <Button slot="remove" class="grid size-5 place-items-center rounded-full hover:bg-black/10">
                <Icon icon={X} size={12} />
              </Button>
            </Tag>
          )}
        </TagList>
      </TagGroup>
      <button
        id="removable-reset"
        type="button"
        class="justify-self-start rounded border border-slate-300 px-2 py-0.5 text-sm"
        onClick={() => list.append(...initial.filter((c) => !list.getItem(c.id)))}
      >
        Restore
      </button>
    </section>
  );
}
// #endregion
