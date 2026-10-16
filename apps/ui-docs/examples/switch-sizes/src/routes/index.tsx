// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/switch/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Switch } from "@rivetjs/ui/switch";

export const head = { title: "Switch: Sizes" };

// #region demo
export function Sizes() {
  return (
    <div class="flex gap-6">
      <Switch size="sm">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Small
        </Switch.Content>
      </Switch>
      <Switch size="md">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Medium
        </Switch.Content>
      </Switch>
      <Switch size="lg">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Large
        </Switch.Content>
      </Switch>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Sizes />
    </div>
  );
}
