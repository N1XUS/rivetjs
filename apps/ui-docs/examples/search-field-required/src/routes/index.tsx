// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/required.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: Required Field" };

// #region demo
export function Required() {
  return (
    <div class="flex flex-col gap-4">
      <SearchField isRequired name="search">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <SearchField isRequired name="search-query">
        <Label>Search query</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-[280px]" placeholder="Enter search query..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Minimum 3 characters required</Description>
      </SearchField>
    </div>
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
