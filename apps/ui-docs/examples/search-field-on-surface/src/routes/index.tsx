// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/on-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "SearchField: In Surface" };

// #region demo
export function OnSurface() {
  return (
    <Surface class="flex w-full max-w-sm flex-col gap-4 rounded-3xl p-6">
      <SearchField name="search" variant="secondary">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-full" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Enter keywords to search</Description>
      </SearchField>
      <SearchField name="search-2" variant="secondary">
        <Label>Advanced search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-full" placeholder="Advanced search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Use filters to refine your search</Description>
      </SearchField>
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OnSurface />
    </div>
  );
}
