// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox-group/with-custom-indicator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { X } from "lucide";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "CheckboxGroup: With Custom Indicator" };

// #region demo
export function WithCustomIndicator() {
  return (
    <CheckboxGroup name="features">
      <Label>Features</Label>
      <Description>Select the features you want</Description>
      <Checkbox value="notifications">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator>{({ isSelected }) => (isSelected() ? <Icon aria-hidden="true" icon={X} /> : null)}</Checkbox.Indicator>
          </Checkbox.Control>
          Email notifications
        </Checkbox.Content>
        <Description>Receive updates via email</Description>
      </Checkbox>
      <Checkbox value="newsletter">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator>{({ isSelected }) => (isSelected() ? <Icon aria-hidden="true" icon={X} /> : null)}</Checkbox.Indicator>
          </Checkbox.Control>
          Newsletter
        </Checkbox.Content>
        <Description>Get weekly newsletters</Description>
      </Checkbox>
    </CheckboxGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithCustomIndicator />
    </div>
  );
}
