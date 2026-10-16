// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tag-group/selection-modes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import type { Selection } from "@rivetjs/cdk/tag-group";
import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "TagGroup: Selection Modes" };

// #region demo
export function TagGroupSelectionModes() {
  const singleSelected = signal<Selection>(new Set(["news"]));
  const multipleSelected = signal<Selection>(new Set(["news", "travel"]));

  return (
    <div class="flex flex-col gap-8">
      <TagGroup selectedKeys={singleSelected} selectionMode="single">
        <Label>Single Selection</Label>
        <TagGroup.List>
          <Tag>News</Tag>
          <Tag>Travel</Tag>
          <Tag>Gaming</Tag>
          <Tag>Shopping</Tag>
        </TagGroup.List>
        <Description>Choose one category</Description>
      </TagGroup>

      <TagGroup selectedKeys={multipleSelected} selectionMode="multiple">
        <Label>Multiple Selection</Label>
        <TagGroup.List>
          <Tag>News</Tag>
          <Tag>Travel</Tag>
          <Tag>Gaming</Tag>
          <Tag>Shopping</Tag>
        </TagGroup.List>
        <Description>Choose multiple categories</Description>
      </TagGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TagGroupSelectionModes />
    </div>
  );
}
