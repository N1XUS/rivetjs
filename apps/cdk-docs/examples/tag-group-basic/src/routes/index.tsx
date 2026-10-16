import { Label } from "@rivetjs/cdk/label";
import { Tag, TagGroup, TagList } from "@rivetjs/cdk/tag-group";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "TagGroup" };

const tag =
  "cursor-default rounded-full border border-slate-300 px-3 py-0.5 text-sm outline-none data-[hovered]:bg-slate-100 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500 aria-selected:border-sky-700 aria-selected:bg-sky-700 aria-selected:text-white";

// #region demo
export default function Categories() {
  return (
    <TagGroup id="categories" selectionMode="multiple" class="m-4 grid max-w-sm gap-1.5">
      <Label class="text-sm font-semibold">Categories</Label>
      <TagList class="flex flex-wrap gap-1.5 outline-none">
        <Tag id="news" class={tag}>
          News
        </Tag>
        <Tag id="travel" class={tag}>
          Travel
        </Tag>
        <Tag id="gaming" class={tag}>
          Gaming
        </Tag>
        <Tag id="shopping" class={tag}>
          Shopping
        </Tag>
      </TagList>
      <Text slot="description" class="text-xs text-slate-500">
        Pick the topics you follow.
      </Text>
    </TagGroup>
  );
}
// #endregion
