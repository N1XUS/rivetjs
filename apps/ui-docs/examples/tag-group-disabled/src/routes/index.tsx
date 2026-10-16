// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tag-group/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "TagGroup: Disabled" };

// #region demo
export function TagGroupDisabled() {
  return (
    <div class="flex flex-col gap-4">
      <TagGroup selectionMode="single">
        <Label>Disabled Tags</Label>
        <TagGroup.List>
          <Tag isDisabled>News</Tag>
          <Tag>Travel</Tag>
          <Tag isDisabled>Gaming</Tag>
        </TagGroup.List>
        <Description>Some tags are disabled</Description>
      </TagGroup>

      <TagGroup disabledKeys={["travel"]} selectionMode="single">
        <Label>Disabled Keys</Label>
        <TagGroup.List>
          <Tag id="news">News</Tag>
          <Tag id="travel">Travel</Tag>
          <Tag id="gaming">Gaming</Tag>
        </TagGroup.List>
        <Description>Tags disabled via disabledKeys prop</Description>
      </TagGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TagGroupDisabled />
    </div>
  );
}
