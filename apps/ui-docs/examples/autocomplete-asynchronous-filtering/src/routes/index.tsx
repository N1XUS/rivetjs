// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/asynchronous-filtering.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createAsyncList } from "@rivetjs/cdk/data";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "Autocomplete: Asynchronous Filtering" };

// #region demo
import { cn } from "tailwind-variants";

interface Character {
  name: string;
}

export function AsynchronousFiltering() {
  const list = createAsyncList<Character>({
    async load({ filterText, signal }) {
      const res = await fetch(`https://swapi.py4e.com/api/people/?search=${filterText}`, {
        signal,
      });

      const json = await res.json();

      return {
        items: json.results,
      };
    },
  });

  return (
    <Autocomplete allowsEmptyCollection class="w-[256px]" placeholder="Search..." selectionMode="single">
      <Label>Search a Star Wars characters</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter onInputChange={(value) => list.setFilterText(value)}>
          <SearchField autoFocus aria-label="Search characters" class="sticky top-0 z-10" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search characters..." />
              <Spinner
                size="sm"
                class={cn("absolute end-2 top-1/2 -translate-y-1/2", {
                  "pointer-events-none opacity-0": !list.isLoading(),
                })}
              />
              <SearchField.ClearButton class={cn({ "pointer-events-none opacity-0": list.isLoading() })} />
            </SearchField.Group>
          </SearchField>
          <ListBox class="max-h-[420px] overflow-y-auto" items={list.items} renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
            {(item: Character) => (
              <ListBox.Item id={item.name} textValue={item.name}>
                {item.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
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
      <AsynchronousFiltering />
    </div>
  );
}
