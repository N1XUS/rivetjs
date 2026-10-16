// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toggle-button-group/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Bold, Italic, Underline } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";

export const head = { title: "ToggleButtonGroup: Disabled" };

// #region demo
export function Disabled() {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted">All buttons disabled</span>
        <ToggleButtonGroup isDisabled selectionMode="multiple">
          <ToggleButton isIconOnly aria-label="Bold" id="bold">
            <Icon icon={Bold} size={16} />
          </ToggleButton>
          <ToggleButton isIconOnly aria-label="Italic" id="italic">
            <ToggleButtonGroup.Separator />
            <Icon icon={Italic} size={16} />
          </ToggleButton>
          <ToggleButton isIconOnly aria-label="Underline" id="underline">
            <ToggleButtonGroup.Separator />
            <Icon icon={Underline} size={16} />
          </ToggleButton>
        </ToggleButtonGroup>
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted">Individual button disabled</span>
        <ToggleButtonGroup selectionMode="multiple">
          <ToggleButton isIconOnly aria-label="Bold" id="bold">
            <Icon icon={Bold} size={16} />
          </ToggleButton>
          <ToggleButton isDisabled isIconOnly aria-label="Italic" id="italic">
            <ToggleButtonGroup.Separator />
            <Icon icon={Italic} size={16} />
          </ToggleButton>
          <ToggleButton isIconOnly aria-label="Underline" id="underline">
            <ToggleButtonGroup.Separator />
            <Icon icon={Underline} size={16} />
          </ToggleButton>
        </ToggleButtonGroup>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
