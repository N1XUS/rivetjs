// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Checkbox } from "@rivetjs/ui/checkbox";

export const head = { title: "Checkbox: Controlled" };

// #region demo
export function Controlled() {
  const isSelected = signal(true);

  return (
    <div class="flex flex-col gap-3">
      <Checkbox id="email-notifications" isSelected={isSelected}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Email notifications
        </Checkbox.Content>
      </Checkbox>
      <p class="text-sm text-muted">
        Status: <span class="font-medium">{isSelected() ? "Enabled" : "Disabled"}</span>
      </p>
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
