// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/default-selected.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";

export const head = { title: "Checkbox: Default Selected" };

// #region demo
export function DefaultSelected() {
  return (
    <Checkbox defaultSelected id="default-notifications">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        Enable email notifications
      </Checkbox.Content>
    </Checkbox>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DefaultSelected />
    </div>
  );
}
