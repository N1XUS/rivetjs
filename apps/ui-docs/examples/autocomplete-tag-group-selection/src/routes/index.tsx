// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/tag-group-selection.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { selectedKeys as keysOf, type Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "Autocomplete: Tag Group Selection" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function TagGroupSelection() {
  const tags = [
    { id: "react", name: "React" },
    { id: "typescript", name: "TypeScript" },
    { id: "javascript", name: "JavaScript" },
    { id: "nodejs", name: "Node.js" },
    { id: "python", name: "Python" },
    { id: "vue", name: "Vue" },
    { id: "angular", name: "Angular" },
    { id: "nextjs", name: "Next.js" },
  ];

  const selectedKeys = signal<readonly Key[]>([]);

  const onRemoveTags = (keys: Set<Key>) => {
    selectedKeys.update((prev) => prev.filter((key) => !keys.has(key)));
  };

  return (
    <Autocomplete class="w-[256px]" placeholder="Select tags" selectionMode="multiple" value={selectedKeys}>
      <Label>Tags</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value>
          {({ defaultChildren, isPlaceholder, state }) => {
            if (isPlaceholder() || keysOf(state).length === 0) {
              return defaultChildren;
            }

            const selectedItemsKeys = keysOf(state);

            return (
              <TagGroup size="sm" onRemove={onRemoveTags}>
                <TagGroup.List>
                  {selectedItemsKeys.map((selectedItemKey) => {
                    const tag = tags.find((t) => t.id === selectedItemKey);

                    if (!tag) return null;

                    return <Tag id={tag.id}>{tag.name}</Tag>;
                  })}
                </TagGroup.List>
              </TagGroup>
            );
          }}
        </Autocomplete.Value>
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
          <SearchField autoFocus aria-label="Search tags" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search tags..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>No tags found</EmptyState>}>
            {tags.map((tag) => (
              <ListBox.Item id={tag.id} textValue={tag.name}>
                {tag.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TagGroupSelection />
    </div>
  );
}
