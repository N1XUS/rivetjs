// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Checkbox: Disabled" };

// #region demo
export function Disabled() {
  return (
    <Checkbox isDisabled id="feature">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        Premium Feature
      </Checkbox.Content>
      <Description>This feature is coming soon</Description>
    </Checkbox>
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
