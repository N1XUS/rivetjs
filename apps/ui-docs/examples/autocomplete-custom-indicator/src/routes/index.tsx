// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/custom-indicator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronsUpDown } from "lucide";
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { EmptyState } from "@rivetjs/ui/empty-state";
import type { Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "Autocomplete: Custom Indicator" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function CustomIndicator() {
  const selectedKey = signal<Key | null>(null);

  const items = [
    { id: "florida", name: "Florida" },
    { id: "delaware", name: "Delaware" },
    { id: "california", name: "California" },
    { id: "texas", name: "Texas" },
    { id: "new-york", name: "New York" },
    { id: "washington", name: "Washington" },
  ];

  return (
    <Autocomplete class="w-[256px]" placeholder="Select one" selectionMode="single" value={selectedKey}>
      <Label>State</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator class="size-3">
          <Icon icon={ChevronsUpDown} size={16} />
        </Autocomplete.Indicator>
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
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIndicator />
    </div>
  );
}
