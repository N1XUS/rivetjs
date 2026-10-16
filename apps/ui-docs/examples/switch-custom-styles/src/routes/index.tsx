// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/switch/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Switch } from "@rivetjs/ui/switch";

export const head = { title: "Switch: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Switch id="autosave">
      <Switch.Content>
        <Switch.Control class="[--switch-control-bg-checked-hover:var(--success)] [--switch-control-bg-checked:var(--success)]">
          <Switch.Thumb />
        </Switch.Control>
        <div class="flex flex-col gap-0.5">
          <Label>Auto-save drafts</Label>
          <Description>Changes are saved as you type.</Description>
        </div>
      </Switch.Content>
    </Switch>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
