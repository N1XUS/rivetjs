// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
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

export const head = { title: "Autocomplete: Variants" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function Variants() {
  const selectedKey1 = signal<Key | null>(null);
  const selectedKey2 = signal<Key | null>(null);
  const selectedKeys1 = signal<readonly Key[]>([]);
  const selectedKeys2 = signal<readonly Key[]>([]);

  const items = [
    { id: "option1", name: "Option 1" },
    { id: "option2", name: "Option 2" },
    { id: "option3", name: "Option 3" },
    { id: "option4", name: "Option 4" },
  ];

  const onRemoveTags1 = (keys: Set<Key>) => {
    selectedKeys1.update((prev) => prev.filter((key) => !keys.has(key)));
  };

  const onRemoveTags2 = (keys: Set<Key>) => {
    selectedKeys2.update((prev) => prev.filter((key) => !keys.has(key)));
  };

  return (
    <div class="flex flex-col gap-8">
      <div class="flex flex-col gap-4">
        <h3 class="text-lg font-semibold">Single Select Variants</h3>
        <div class="flex flex-col gap-4">
          <Autocomplete class="w-[256px]" placeholder="Select one" selectionMode="single" value={selectedKey1} variant="primary">
            <Label>Primary variant</Label>
            <Autocomplete.Trigger>
              <Autocomplete.Value />
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
          <Autocomplete class="w-[256px]" placeholder="Select one" selectionMode="single" value={selectedKey2} variant="secondary">
            <Label>Secondary variant</Label>
            <Autocomplete.Trigger>
              <Autocomplete.Value />
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
        </div>
      </div>
      <div class="flex flex-col gap-4">
        <h3 class="text-lg font-semibold">Multiple Select Variants</h3>
        <div class="flex flex-col gap-4">
          <Autocomplete class="w-[256px]" placeholder="Select multiple" selectionMode="multiple" value={selectedKeys1} variant="primary">
            <Label>Primary variant</Label>
            <Autocomplete.Trigger>
              <Autocomplete.Value>
                {({ defaultChildren, isPlaceholder, state }) => {
                  if (isPlaceholder() || keysOf(state).length === 0) {
                    return defaultChildren;
                  }

                  const selectedItemsKeys = keysOf(state);

                  return (
                    <TagGroup size="sm" onRemove={onRemoveTags1}>
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
          <Autocomplete class="w-[256px]" placeholder="Select multiple" selectionMode="multiple" value={selectedKeys2} variant="secondary">
            <Label>Secondary variant</Label>
            <Autocomplete.Trigger>
              <Autocomplete.Value>
                {({ defaultChildren, isPlaceholder, state }) => {
                  if (isPlaceholder() || keysOf(state).length === 0) {
                    return defaultChildren;
                  }

                  const selectedItemsKeys = keysOf(state);

                  return (
                    <TagGroup size="sm" variant="surface" onRemove={onRemoveTags2}>
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
        </div>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
