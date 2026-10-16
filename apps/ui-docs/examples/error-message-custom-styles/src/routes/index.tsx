// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/error-message/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { Selection } from "@rivetjs/cdk/tag-group";
import { computed, signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { ErrorMessage } from "@rivetjs/ui/error-message";
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "ErrorMessage: Tailwind CSS" };

// #region demo
// Rivet: `selectedKeys` takes a signal (two-way; upstream: `useState` + `onSelectionChange`).
export function CustomStyles() {
  const selected = signal<Selection>(new Set());
  const isInvalid = computed(() => Array.from(selected()).length === 0);

  return (
    <TagGroup class="w-full max-w-xs gap-1.5" selectedKeys={selected} selectionMode="multiple">
      <Label>Topics</Label>
      <TagGroup.List>
        <Tag id="api">API</Tag>
        <Tag id="design">Design</Tag>
        <Tag id="docs">Docs</Tag>
      </TagGroup.List>
      <Description>Pick at least one topic</Description>
      <ErrorMessage class="font-medium text-danger">{isInvalid() ? "Choose at least one topic" : null}</ErrorMessage>
    </TagGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
