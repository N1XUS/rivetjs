// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/location-search.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { Description } from "@rivetjs/ui/description";
import { EmptyState } from "@rivetjs/ui/empty-state";
import type { Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "Autocomplete: Location Search" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

interface City {
  name: string;
  country: string;
}

export function LocationSearch() {
  const allCities: City[] = [
    { country: "USA", name: "New York" },
    { country: "USA", name: "Los Angeles" },
    { country: "USA", name: "Chicago" },
    { country: "UK", name: "London" },
    { country: "France", name: "Paris" },
    { country: "Japan", name: "Tokyo" },
    { country: "Australia", name: "Sydney" },
    { country: "Canada", name: "Toronto" },
    { country: "Germany", name: "Berlin" },
    { country: "Spain", name: "Madrid" },
  ];

  const selectedKey = signal<Key | null>(null);
  const isLoading = signal(false);

  // Simulate async filtering
  const customFilter = (text: string, inputValue: string) => {
    if (!inputValue) return true;
    isLoading.set(true);
    setTimeout(() => isLoading.set(false), 300);

    return contains(text, inputValue);
  };

  return (
    <Autocomplete class="w-[256px]" placeholder="Search for a city" selectionMode="single" value={selectedKey}>
      <Label>City</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={customFilter}>
          <SearchField autoFocus aria-label="Search cities" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search cities..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>{isLoading() ? "Searching..." : "No cities found"}</EmptyState>}>
            {allCities.map((city) => (
              <ListBox.Item id={city.name} textValue={city.name}>
                <div class="flex flex-col">
                  <Label>{city.name}</Label>
                  <Description>{city.country}</Description>
                </div>
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
      <LocationSearch />
    </div>
  );
}
