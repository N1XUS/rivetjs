// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/custom-icons.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CircleX, Funnel } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: Custom Icons" };

// #region demo
// Rivet: upstream's inline svg icons → lucide via `@rivetjs/kit/icon` (icon rule: no hand-written SVG paths).
export function CustomIcons() {
  return (
    <div class="flex flex-col gap-4">
      <SearchField name="search-custom">
        <Label>Search (Custom Icons)</Label>
        <SearchField.Group>
          <SearchField.SearchIcon>
            <Icon icon={Funnel} size={16} />
          </SearchField.SearchIcon>
          <SearchField.Input class="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton>
            <Icon icon={CircleX} size={16} />
          </SearchField.ClearButton>
        </SearchField.Group>
        <Description>Custom icon children</Description>
      </SearchField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIcons />
    </div>
  );
}
