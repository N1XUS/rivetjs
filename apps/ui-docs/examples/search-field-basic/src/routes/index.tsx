// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: Usage" };

// #region demo
export function Basic() {
  return (
    <SearchField name="search">
      <Label>Search</Label>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input class="w-[280px]" placeholder="Search..." />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
