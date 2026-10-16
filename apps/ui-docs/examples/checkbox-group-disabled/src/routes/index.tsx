// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox-group/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "CheckboxGroup: Disabled" };

// #region demo
export function Disabled() {
  return (
    <CheckboxGroup isDisabled name="disabled-features">
      <Label>Features</Label>
      <Description>Feature selection is temporarily disabled</Description>
      <Checkbox value="feature1">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Feature 1
        </Checkbox.Content>
        <Description>This feature is coming soon</Description>
      </Checkbox>
      <Checkbox value="feature2">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Feature 2
        </Checkbox.Content>
        <Description>This feature is coming soon</Description>
      </Checkbox>
    </CheckboxGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
