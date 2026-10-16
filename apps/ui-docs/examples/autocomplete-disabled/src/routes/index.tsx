// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "Autocomplete: Disabled" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function Disabled() {
  const items = [
    { id: "florida", name: "Florida" },
    { id: "delaware", name: "Delaware" },
    { id: "california", name: "California" },
    { id: "texas", name: "Texas" },
    { id: "new-york", name: "New York" },
    { id: "washington", name: "Washington" },
  ];

  const countries = [
    { id: "argentina", name: "Argentina" },
    { id: "venezuela", name: "Venezuela" },
    { id: "japan", name: "Japan" },
    { id: "france", name: "France" },
    { id: "italy", name: "Italy" },
    { id: "spain", name: "Spain" },
  ];

  return (
    <div class="flex flex-col gap-4">
      <Autocomplete isDisabled class="w-[256px]" defaultValue="california" placeholder="Select one" selectionMode="single">
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
      <Autocomplete isDisabled class="w-[256px]" defaultValue={["argentina", "japan", "france"]} placeholder="Select countries" selectionMode="multiple">
        <Label>Countries to Visit</Label>
        <Autocomplete.Trigger>
          <Autocomplete.Value />
          <Autocomplete.ClearButton />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
            <SearchField autoFocus aria-label="Search countries" name="search" variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search countries..." />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
              {countries.map((country) => (
                <ListBox.Item id={country.id} textValue={country.name}>
                  {country.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
