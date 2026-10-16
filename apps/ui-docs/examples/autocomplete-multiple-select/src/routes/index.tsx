// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/multiple-select.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
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

export const head = { title: "Autocomplete: Multiple Select" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function MultipleSelect() {
  const selectedKeys = signal<readonly Key[]>([]);

  const items = [
    { id: "california", name: "California" },
    { id: "texas", name: "Texas" },
    { id: "florida", name: "Florida" },
    { id: "new-york", name: "New York" },
    { id: "illinois", name: "Illinois" },
    { id: "pennsylvania", name: "Pennsylvania" },
  ];

  const onRemoveTags = (keys: Set<Key>) => {
    selectedKeys.update((prev) => prev.filter((key) => !keys.has(key)));
  };

  return (
    <Autocomplete class="w-[256px]" placeholder="Select states" selectionMode="multiple" value={selectedKeys}>
      <Label>States</Label>
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
                    const item = items.find((s) => s.id === selectedItemKey);

                    if (!item) return null;

                    return <Tag id={item.id}>{item.name}</Tag>;
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
          <SearchField autoFocus aria-label="Search options" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
            {items.map((item) => (
              <ListBox.Item id={item.id} textValue={item.name}>
                {item.name}
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
      <MultipleSelect />
    </div>
  );
}
