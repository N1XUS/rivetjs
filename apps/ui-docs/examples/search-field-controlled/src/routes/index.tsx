// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: Controlled" };

// #region demo
export function Controlled() {
  const value = signal("");

  return (
    <div class="flex flex-col gap-4">
      <SearchField name="search" value={value}>
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Current value: {value() || "(empty)"}</Description>
      </SearchField>
      <div class="flex gap-2">
        <Button variant="tertiary" onPress={() => value.set("")}>
          Clear
        </Button>
        <Button variant="tertiary" onPress={() => value.set("example query")}>
          Set example
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
