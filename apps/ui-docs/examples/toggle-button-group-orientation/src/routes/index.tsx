// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toggle-button-group/orientation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Bold, Italic, Underline } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";

export const head = { title: "ToggleButtonGroup: Orientation" };

// #region demo
export function Orientation() {
  return (
    <div class="flex items-start gap-8">
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted">Horizontal</span>
        <ToggleButtonGroup orientation="horizontal" selectionMode="multiple">
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
        <span class="text-sm text-muted">Vertical</span>
        <ToggleButtonGroup orientation="vertical" selectionMode="multiple">
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
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Orientation />
    </div>
  );
}
