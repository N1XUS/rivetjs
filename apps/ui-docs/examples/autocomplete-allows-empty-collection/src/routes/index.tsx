// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/allows-empty-collection.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "Autocomplete: Allows Empty Collection" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function AllowsEmptyCollection() {
  return (
    <Autocomplete allowsEmptyCollection class="w-[256px]" placeholder="Select one" selectionMode="single">
      <Label>State</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
          <SearchField autoFocus aria-label="Search states" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search states..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>} />
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <AllowsEmptyCollection />
    </div>
  );
}
