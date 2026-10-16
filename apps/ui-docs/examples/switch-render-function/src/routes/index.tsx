// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/switch/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Switch } from "@rivetjs/ui/switch";

export const head = { title: "Switch: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <Switch render={(props) => <div {...props} data-custom="foo" />}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        Enable notifications
      </Switch.Content>
    </Switch>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}
