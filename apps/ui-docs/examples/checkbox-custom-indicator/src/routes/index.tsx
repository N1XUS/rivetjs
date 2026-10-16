// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/custom-indicator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Heart, Minus, Plus } from "lucide";
import { Checkbox } from "@rivetjs/ui/checkbox";

export const head = { title: "Checkbox: Custom Indicator" };

// #region demo
// Rivet: upstream's inline svg icons → lucide via `@rivetjs/kit/icon` (icon rule: no hand-written SVG paths).
export function CustomIndicator() {
  return (
    <div class="flex gap-4">
      <Checkbox defaultSelected name="heart">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator>{({ isSelected }) => (isSelected() ? <Icon fill="currentColor" icon={Heart} /> : null)}</Checkbox.Indicator>
          </Checkbox.Control>
          Heart
        </Checkbox.Content>
      </Checkbox>
      <Checkbox defaultSelected name="plus">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator>{({ isSelected }) => (isSelected() ? <Icon icon={Plus} stroke-width={3} /> : null)}</Checkbox.Indicator>
          </Checkbox.Control>
          Plus
        </Checkbox.Content>
      </Checkbox>
      <Checkbox isIndeterminate name="indeterminate">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator>{({ isIndeterminate }) => (isIndeterminate() ? <Icon icon={Minus} stroke-width={3} /> : null)}</Checkbox.Indicator>
          </Checkbox.Control>
          Indeterminate
        </Checkbox.Content>
      </Checkbox>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIndicator />
    </div>
  );
}
