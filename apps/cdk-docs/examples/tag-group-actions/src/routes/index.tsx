import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/cdk/label";
import { Tag, TagGroup, TagList } from "@rivetjs/cdk/tag-group";

export const head = { title: "TagGroup actions" };

const tag =
  "cursor-default rounded-full border border-slate-300 px-3 py-0.5 text-sm outline-none data-[hovered]:bg-slate-100 data-[pressed]:bg-slate-200 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";

// #region demo
export default function Genres() {
  const last = signal("none");
  return (
    <section class="m-4 grid max-w-md gap-2">
      <TagGroup id="genres" onAction={(key) => last.set(String(key))} class="grid gap-1.5">
        <Label class="text-sm font-semibold">Music genres</Label>
        <TagList class="flex flex-wrap gap-1.5 outline-none">
          <Tag id="rock" class={tag}>
            Rock
          </Tag>
          <Tag id="jazz" class={tag}>
            Jazz
          </Tag>
          <Tag id="pop" class={tag}>
            Pop
          </Tag>
          <Tag id="classical" class={tag} onAction={() => last.set("classical (tag onAction)")}>
            Classical
          </Tag>
          <Tag id="edm" class={tag}>
            EDM
          </Tag>
        </TagList>
      </TagGroup>
      <p id="genres-value" class="text-sm text-slate-600">
        Last action: {last()}
      </p>
    </section>
  );
}
// #endregion
