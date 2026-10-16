// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/required.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { Button } from "@rivetjs/ui/button";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "Autocomplete: Required" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function Required() {
  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data: Record<string, string> = {};

    // Convert FormData to plain object
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    alert("Form submitted successfully!");
  };

  const states = [
    { id: "florida", name: "Florida" },
    { id: "delaware", name: "Delaware" },
    { id: "california", name: "California" },
    { id: "texas", name: "Texas" },
    { id: "new-york", name: "New York" },
    { id: "washington", name: "Washington" },
  ];

  const countries = [
    { id: "usa", name: "United States" },
    { id: "canada", name: "Canada" },
    { id: "mexico", name: "Mexico" },
    { id: "uk", name: "United Kingdom" },
    { id: "france", name: "France" },
    { id: "germany", name: "Germany" },
  ];

  return (
    <Form class="flex w-[256px] flex-col gap-4" onSubmit={onSubmit}>
      <Autocomplete isRequired class="w-full" name="state" placeholder="Select one" selectionMode="single">
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
              {states.map((state) => (
                <ListBox.Item id={state.id} textValue={state.name}>
                  {state.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
        <FieldError />
      </Autocomplete>
      <Autocomplete isRequired class="w-full" name="country" placeholder="Select a country" selectionMode="single">
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
              {countries.map((country) => (
                <ListBox.Item id={country.id} textValue={country.name}>
                  {country.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
        <FieldError />
      </Autocomplete>
      <Button type="submit">Submit</Button>
    </Form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Required />
    </div>
  );
}
