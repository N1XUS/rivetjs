// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tag-group/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import type { Selection } from "@rivetjs/cdk/tag-group";
import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "TagGroup: Controlled" };

// #region demo
export function TagGroupControlled() {
  const selected = signal<Selection>(new Set(["news", "travel"]));

  return (
    <div class="flex flex-col gap-3">
      <TagGroup selectedKeys={selected} selectionMode="multiple">
        <Label>Categories (controlled)</Label>
        <TagGroup.List>
          <Tag id="news">News</Tag>
          <Tag id="travel">Travel</Tag>
          <Tag id="gaming">Gaming</Tag>
          <Tag id="shopping">Shopping</Tag>
        </TagGroup.List>
        <Description>Selected: {Array.from(selected()).length > 0 ? Array.from(selected()).join(", ") : "None"}</Description>
      </TagGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TagGroupControlled />
    </div>
  );
}
