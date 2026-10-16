// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/switch/render-props.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Switch } from "@rivetjs/ui/switch";

export const head = { title: "Switch: Render Props" };

// #region demo
export function RenderProps() {
  return (
    <Switch>
      {({ isSelected }) => (
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          {isSelected() ? "Enabled" : "Disabled"}
        </Switch.Content>
      )}
    </Switch>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderProps />
    </div>
  );
}
