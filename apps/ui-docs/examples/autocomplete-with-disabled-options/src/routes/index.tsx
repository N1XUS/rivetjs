// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/with-disabled-options.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { EmptyState } from "@rivetjs/ui/empty-state";
import type { Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "Autocomplete: With Disabled Options" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function WithDisabledOptions() {
  const selectedKey = signal<Key | null>(null);

  return (
    <Autocomplete class="w-[256px]" disabledKeys={["cat", "kangaroo"]} placeholder="Select an animal" selectionMode="single" value={selectedKey}>
      <Label>Animal</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
          <SearchField autoFocus aria-label="Search animals" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search animals..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
            <ListBox.Item id="dog" textValue="Dog">
              Dog
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="cat" textValue="Cat">
              Cat
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="bird" textValue="Bird">
              Bird
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="kangaroo" textValue="Kangaroo">
              Kangaroo
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="elephant" textValue="Elephant">
              Elephant
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="tiger" textValue="Tiger">
              Tiger
              <ListBox.ItemIndicator />
            </ListBox.Item>
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
      <WithDisabledOptions />
    </div>
  );
}
