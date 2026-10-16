// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/indeterminate.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Checkbox: Indeterminate" };

// #region demo
export function Indeterminate() {
  const isIndeterminate = signal(true);
  const isSelected = signal(false);

  return (
    <Checkbox
      id="select-all"
      isIndeterminate={isIndeterminate()}
      isSelected={isSelected()}
      onChange={(selected: boolean) => {
        isSelected.set(selected);
        isIndeterminate.set(false);
      }}
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        Select all
      </Checkbox.Content>
      <Description>Shows indeterminate state (dash icon)</Description>
    </Checkbox>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Indeterminate />
    </div>
  );
}
