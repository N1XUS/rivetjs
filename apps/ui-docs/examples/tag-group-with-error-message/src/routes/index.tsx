// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tag-group/with-error-message.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { ErrorMessage } from "@rivetjs/ui/error-message";
import type { Selection } from "@rivetjs/cdk/tag-group";
import { computed, signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "TagGroup: With Error Message" };

// #region demo
export function TagGroupWithErrorMessage() {
  const selected = signal<Selection>(new Set());

  const isInvalid = computed(() => Array.from(selected()).length === 0);

  return (
    <TagGroup selectedKeys={selected} selectionMode="multiple">
      <Label>Amenities</Label>
      <TagGroup.List>
        <Tag id="laundry">Laundry</Tag>
        <Tag id="fitness">Fitness center</Tag>
        <Tag id="parking">Parking</Tag>
        <Tag id="pool">Swimming pool</Tag>
        <Tag id="breakfast">Breakfast</Tag>
      </TagGroup.List>
      <Description>{isInvalid() ? "Select at least one category" : "Selected: " + Array.from(selected()).join(", ")}</Description>
      <ErrorMessage>{isInvalid() ? "Please select at least one category" : null}</ErrorMessage>
    </TagGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TagGroupWithErrorMessage />
    </div>
  );
}
