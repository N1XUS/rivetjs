// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tag-group/with-remove-button.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CircleX } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { EmptyState } from "@rivetjs/ui/empty-state";
import type { Key } from "@rivetjs/cdk/tag-group";
import { createListData } from "@rivetjs/cdk/data";
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "TagGroup: With Remove Button" };

// #region demo
export function TagGroupWithRemoveButton() {
  type TagItem = { id: string; name: string };

  const tags = createListData<TagItem>({
    initialItems: [
      { id: "news", name: "News" },
      { id: "travel", name: "Travel" },
      { id: "gaming", name: "Gaming" },
      { id: "shopping", name: "Shopping" },
    ],
  });

  const frameworks = createListData<TagItem>({
    initialItems: [
      { id: "react", name: "React" },
      { id: "vue", name: "Vue" },
      { id: "angular", name: "Angular" },
      { id: "svelte", name: "Svelte" },
    ],
  });

  const onRemoveTags = (keys: Set<Key>) => {
    tags.remove(...keys);
  };

  const onRemoveFrameworks = (keys: Set<Key>) => {
    frameworks.remove(...keys);
  };

  return (
    <div class="flex flex-col gap-8">
      <div class="w-sm">
        <TagGroup selectionMode="single" onRemove={onRemoveTags}>
          <Label>Default Remove Button</Label>
          <TagGroup.List items={tags.items} renderEmptyState={() => <EmptyState class="p-1">No categories found</EmptyState>}>
            {(tag: TagItem) => (
              <Tag id={tag.id} textValue={tag.name}>
                {tag.name}
              </Tag>
            )}
          </TagGroup.List>
          <Description>Click the X to remove tags</Description>
        </TagGroup>
      </div>

      <div class="w-md">
        <TagGroup selectionMode="single" onRemove={onRemoveFrameworks}>
          <Label>Custom Remove Button</Label>
          <TagGroup.List items={frameworks.items} renderEmptyState={() => <EmptyState class="p-1">No frameworks found</EmptyState>}>
            {(tag: TagItem) => (
              <Tag id={tag.id} textValue={tag.name}>
                {(renderProps: { allowsRemoving: boolean }) => (
                  <>
                    {tag.name}
                    {!!renderProps.allowsRemoving && (
                      <Tag.RemoveButton>
                        <Icon icon={CircleX} size={16} />
                      </Tag.RemoveButton>
                    )}
                  </>
                )}
              </Tag>
            )}
          </TagGroup.List>
          <Description>Custom remove button with icon</Description>
        </TagGroup>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TagGroupWithRemoveButton />
    </div>
  );
}
