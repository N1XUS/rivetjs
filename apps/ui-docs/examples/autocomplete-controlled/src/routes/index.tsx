// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { EmptyState } from "@rivetjs/ui/empty-state";
import type { Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "Autocomplete: Controlled" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function Controlled() {
  const states = [
    { id: "california", name: "California" },
    { id: "texas", name: "Texas" },
    { id: "florida", name: "Florida" },
    { id: "new-york", name: "New York" },
    { id: "illinois", name: "Illinois" },
    { id: "pennsylvania", name: "Pennsylvania" },
  ];

  const state = signal<Key | null>("california");

  const selectedState = () => states.find((s) => s.id === state());

  return (
    <div class="space-y-2">
      <Autocomplete class="w-[256px]" placeholder="Select a state" selectionMode="single" value={state}>
        <Label>State (controlled)</Label>
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
              {states.map((state) => (
                <ListBox.Item id={state.id} textValue={state.name}>
                  {state.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>
      <p class="text-sm text-muted">Selected: {selectedState()?.name || "None"}</p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
