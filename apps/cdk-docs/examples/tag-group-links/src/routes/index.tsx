import { Label } from "@rivetjs/cdk/label";
import { Tag, TagGroup, TagList } from "@rivetjs/cdk/tag-group";

export const head = { title: "TagGroup links" };

const tag =
  "cursor-pointer rounded-full border border-slate-300 px-3 py-0.5 text-sm text-sky-800 underline-offset-2 outline-none data-[hovered]:underline data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";

// #region demo
export default function PhotoCategories() {
  return (
    <TagGroup id="photo-links" class="m-4 grid max-w-md gap-1.5">
      <Label class="text-sm font-semibold">Photo categories</Label>
      <TagList class="flex flex-wrap gap-1.5 outline-none">
        <Tag id="landscape" href="https://en.wikipedia.org/wiki/Landscape_photography" target="_blank" class={tag}>
          Landscape
        </Tag>
        <Tag id="portrait" href="https://en.wikipedia.org/wiki/Portrait_photography" target="_blank" class={tag}>
          Portrait
        </Tag>
        <Tag id="macro" href="https://en.wikipedia.org/wiki/Macro_photography" target="_blank" class={tag}>
          Macro
        </Tag>
        <Tag id="night" href="https://en.wikipedia.org/wiki/Night_photography" target="_blank" class={tag}>
          Night
        </Tag>
      </TagList>
    </TagGroup>
  );
}
// #endregion
