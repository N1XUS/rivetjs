import { Check, X } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { createListData } from "@rivetjs/cdk/data";
import { Label } from "@rivetjs/cdk/label";
import { Tag, TagGroup, TagList } from "@rivetjs/cdk/tag-group";
import { Text } from "@rivetjs/cdk/text";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "TagGroup with Tailwind" };

interface Filter {
  id: string;
  name: string;
}

const filters: Filter[] = [
  { id: "open", name: "Open" },
  { id: "bug", name: "Bug" },
  { id: "docs", name: "Docs" },
  { id: "help", name: "Help wanted" },
];

// #region demo
export default function Filters() {
  const list = createListData<Filter>({ initialItems: filters });
  return (
    <TagGroup
      id="filters"
      selectionMode="multiple"
      defaultSelectedKeys={["bug"]}
      onRemove={(keys) => list.remove(...keys)}
      class="m-4 flex max-w-md flex-col gap-1.5"
    >
      <Label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</Label>
      <TagList
        items={list.items}
        class={({ isFocusVisible }) => `flex flex-wrap gap-1.5 rounded-lg p-1 outline-none ${isFocusVisible() ? "ring-2 ring-violet-500" : ""}`}
        renderEmptyState={() => <span class="text-sm text-slate-400">No filters</span>}
      >
        {(item: Filter) => (
          <Tag
            textValue={item.name}
            class={({ isSelected, isFocusVisible }) =>
              `flex cursor-default items-center gap-1 rounded-md border px-2 py-0.5 text-sm outline-none transition-colors ${
                isSelected() ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              } ${isFocusVisible() ? "ring-2 ring-violet-400 ring-offset-1" : ""}`
            }
          >
            {({ isSelected }) => (
              <>
                {isSelected() ? <Icon icon={Check} size={12} class="selected-mark" /> : null}
                {item.name}
                <Button slot="remove" class="-mr-1 grid size-4 place-items-center rounded hover:bg-black/15">
                  <Icon icon={X} size={12} />
                </Button>
              </>
            )}
          </Tag>
        )}
      </TagList>
      <Text slot="description" class="text-xs text-slate-500">
        Press Delete to remove a filter.
      </Text>
    </TagGroup>
  );
}
// #endregion
