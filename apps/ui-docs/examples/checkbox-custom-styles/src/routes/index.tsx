// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";

export const head = { title: "Checkbox: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Checkbox id="custom">
      <Checkbox.Content>
        <Checkbox.Control class="bg-success-soft before:bg-success">
          <Checkbox.Indicator class="**:data-[slot=checkbox-default-indicator--checkmark]:text-success-foreground" />
        </Checkbox.Control>
        Custom styled checkbox
      </Checkbox.Content>
    </Checkbox>
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
