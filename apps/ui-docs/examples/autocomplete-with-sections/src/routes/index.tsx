// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/with-sections.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Header } from "@rivetjs/ui/header";
import type { Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "Autocomplete: With Sections" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function WithSections() {
  const selectedKey = signal<Key | null>(null);

  return (
    <Autocomplete class="w-[256px]" placeholder="Select a country" selectionMode="single" value={selectedKey}>
      <Label>Country</Label>
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
            <ListBox.Section>
              <Header>North America</Header>
              <ListBox.Item id="usa" textValue="United States">
                United States
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="canada" textValue="Canada">
                Canada
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="mexico" textValue="Mexico">
                Mexico
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox.Section>
            <Separator />
            <ListBox.Section>
              <Header>Europe</Header>
              <ListBox.Item id="uk" textValue="United Kingdom">
                United Kingdom
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="france" textValue="France">
                France
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="germany" textValue="Germany">
                Germany
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="spain" textValue="Spain">
                Spain
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="italy" textValue="Italy">
                Italy
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox.Section>
            <Separator />
            <ListBox.Section>
              <Header>Asia</Header>
              <ListBox.Item id="japan" textValue="Japan">
                Japan
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="china" textValue="China">
                China
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="india" textValue="India">
                India
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="south-korea" textValue="South Korea">
                South Korea
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox.Section>
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
      <WithSections />
    </div>
  );
}
