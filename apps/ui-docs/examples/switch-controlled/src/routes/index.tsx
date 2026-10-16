// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/switch/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Switch } from "@rivetjs/ui/switch";

export const head = { title: "Switch: Controlled" };

// #region demo
export function Controlled() {
  const isSelected = signal(false);

  return (
    <div class="flex flex-col gap-4">
      <Switch isSelected={isSelected}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Enable notifications
        </Switch.Content>
      </Switch>
      <p class="text-sm text-muted">Switch is {isSelected() ? "on" : "off"}</p>
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
