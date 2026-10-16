// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <SearchField class="w-full max-w-64" name="docs" variant="secondary">
      <Label class="font-medium text-foreground">Search docs</Label>
      <SearchField.Group class="rounded-xl bg-default">
        <SearchField.SearchIcon class="text-muted" />
        <SearchField.Input class="placeholder:text-muted" placeholder="Components, guides..." />
        <SearchField.ClearButton class="text-muted" />
      </SearchField.Group>
    </SearchField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
