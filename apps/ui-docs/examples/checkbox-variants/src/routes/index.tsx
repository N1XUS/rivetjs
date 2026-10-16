// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Checkbox: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <p class="text-sm font-medium text-muted">Primary variant</p>
        <Checkbox id="primary" name="primary" variant="primary">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Primary checkbox
          </Checkbox.Content>
          <Description>Standard styling with default background</Description>
        </Checkbox>
      </div>
      <div class="flex flex-col gap-2">
        <p class="text-sm font-medium text-muted">Secondary variant</p>
        <Checkbox id="secondary" name="secondary" variant="secondary">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Secondary checkbox
          </Checkbox.Content>
          <Description>Lower emphasis variant for use in surfaces</Description>
        </Checkbox>
      </div>
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
