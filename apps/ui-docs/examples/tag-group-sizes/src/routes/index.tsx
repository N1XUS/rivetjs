// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tag-group/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "TagGroup: Sizes" };

// #region demo
export function TagGroupSizes() {
  return (
    <div class="flex flex-col gap-6">
      <TagGroup selectionMode="single" size="sm">
        <Label>Small</Label>
        <TagGroup.List>
          <Tag>News</Tag>
          <Tag>Travel</Tag>
          <Tag>Gaming</Tag>
        </TagGroup.List>
      </TagGroup>
      <TagGroup selectionMode="single" size="md">
        <Label>Medium</Label>
        <TagGroup.List>
          <Tag>News</Tag>
          <Tag>Travel</Tag>
          <Tag>Gaming</Tag>
        </TagGroup.List>
      </TagGroup>
      <TagGroup selectionMode="single" size="lg">
        <Label>Large</Label>
        <TagGroup.List>
          <Tag>News</Tag>
          <Tag>Travel</Tag>
          <Tag>Gaming</Tag>
        </TagGroup.List>
      </TagGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TagGroupSizes />
    </div>
  );
}
