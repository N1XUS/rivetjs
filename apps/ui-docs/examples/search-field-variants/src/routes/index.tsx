// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-col gap-4">
      <SearchField name="primary-search" variant="primary">
        <Label>Primary variant</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <SearchField name="secondary-search" variant="secondary">
        <Label>Secondary variant</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-[280px]" placeholder="Search..." />
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
      <Variants />
    </div>
  );
}
