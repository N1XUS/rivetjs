// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/switch/with-description.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Switch } from "@rivetjs/ui/switch";

export const head = { title: "Switch: With Description" };

// #region demo
export function WithDescription() {
  return (
    <div class="max-w-sm">
      <Switch>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Public profile
        </Switch.Content>
        <Description>Allow others to see your profile information</Description>
      </Switch>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithDescription />
    </div>
  );
}
