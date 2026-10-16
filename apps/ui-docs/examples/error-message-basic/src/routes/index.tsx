// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/error-message/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { Selection } from "@rivetjs/cdk/tag-group";
import { computed, signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { ErrorMessage } from "@rivetjs/ui/error-message";
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "ErrorMessage: Usage" };

// #region demo
// Rivet: `selectedKeys` takes a signal (two-way; upstream: `useState` + `onSelectionChange`).
export function ErrorMessageBasic() {
  const selected = signal<Selection>(new Set());
  const isInvalid = computed(() => Array.from(selected()).length === 0);

  return (
    <TagGroup selectedKeys={selected} selectionMode="multiple">
      <Label>Required Categories</Label>
      <TagGroup.List>
        <Tag id="news">News</Tag>
        <Tag id="travel">Travel</Tag>
        <Tag id="gaming">Gaming</Tag>
        <Tag id="shopping">Shopping</Tag>
      </TagGroup.List>
      <Description>Select at least one category</Description>
      <ErrorMessage>{isInvalid() ? "Please select at least one category" : null}</ErrorMessage>
    </TagGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ErrorMessageBasic />
    </div>
  );
}
