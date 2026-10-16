// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/switch/group.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Switch } from "@rivetjs/ui/switch";
import { SwitchGroup } from "@rivetjs/ui/switch-group";

export const head = { title: "Switch: Group" };

// #region demo
export function Group() {
  return (
    <SwitchGroup>
      <Switch name="notifications">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Allow Notifications
        </Switch.Content>
      </Switch>
      <Switch name="marketing">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Marketing emails
        </Switch.Content>
      </Switch>
      <Switch name="social">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Social media updates
        </Switch.Content>
      </Switch>
    </SwitchGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Group />
    </div>
  );
}
