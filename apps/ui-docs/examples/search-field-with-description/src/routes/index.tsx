// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/with-description.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: With Description" };

// #region demo
export function WithDescription() {
  return (
    <div class="flex flex-col gap-4">
      <SearchField name="search">
        <Label>Search products</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-[280px]" placeholder="Search products..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Enter keywords to search for products</Description>
      </SearchField>
      <SearchField name="search-users">
        <Label>Search users</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-[280px]" placeholder="Search users..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Search by name, email, or username</Description>
      </SearchField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithDescription />
    </div>
  );
}
