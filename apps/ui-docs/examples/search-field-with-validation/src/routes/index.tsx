// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/with-validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: With Validation" };

// #region demo
export function WithValidation() {
  const value = signal("");
  const isInvalid = () => value().length > 0 && value().length < 3;

  return (
    <div class="flex flex-col gap-4">
      <SearchField isRequired isInvalid={isInvalid} name="search" value={value}>
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        {isInvalid() ? <FieldError>Search query must be at least 3 characters</FieldError> : <Description>Enter at least 3 characters to search</Description>}
      </SearchField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithValidation />
    </div>
  );
}
