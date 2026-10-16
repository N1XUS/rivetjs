// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/switch/label-position.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Switch } from "@rivetjs/ui/switch";

export const head = { title: "Switch: Label Position" };

// #region demo
export function LabelPosition() {
  return (
    <div class="flex flex-col gap-4">
      <Switch>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Label after
        </Switch.Content>
      </Switch>
      <Switch>
        <Switch.Content>
          Label before
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <LabelPosition />
    </div>
  );
}
