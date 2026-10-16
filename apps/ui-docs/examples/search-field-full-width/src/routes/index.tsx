// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/full-width.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: Full Width" };

// #region demo
export function FullWidth() {
  return (
    <div class="w-[400px] space-y-4">
      <SearchField fullWidth name="search">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FullWidth />
    </div>
  );
}
