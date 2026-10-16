// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: Validation" };

// #region demo
export function Validation() {
  return (
    <div class="flex flex-col gap-4">
      <SearchField isInvalid isRequired name="search" value="ab">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <FieldError>Search query must be at least 3 characters</FieldError>
      </SearchField>
      <SearchField isInvalid name="search-invalid">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-[280px]" placeholder="Search..." value="invalid@query" />
          <SearchField.ClearButton />
        </SearchField.Group>
        <FieldError>Invalid characters in search query</FieldError>
      </SearchField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Validation />
    </div>
  );
}
