// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toggle-button-group/selection-mode.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Bold, Italic, Strikethrough, TextAlignCenter, TextAlignStart, TextAlignEnd, Underline } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";

export const head = { title: "ToggleButtonGroup: Selection Mode" };

// #region demo
export function SelectionMode() {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted">Single selection</span>
        <ToggleButtonGroup defaultSelectedKeys={["center"]} selectionMode="single">
          <ToggleButton id="left">
            <Icon icon={TextAlignStart} size={16} />
            Left
          </ToggleButton>
          <ToggleButton id="center">
            <ToggleButtonGroup.Separator />
            <Icon icon={TextAlignCenter} size={16} />
            Center
          </ToggleButton>
          <ToggleButton id="right">
            <ToggleButtonGroup.Separator />
            <Icon icon={TextAlignEnd} size={16} />
            Right
          </ToggleButton>
        </ToggleButtonGroup>
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted">Multiple selection</span>
        <ToggleButtonGroup defaultSelectedKeys={["bold", "underline"]} selectionMode="multiple">
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
          <ToggleButton isIconOnly aria-label="Strikethrough" id="strikethrough">
            <ToggleButtonGroup.Separator />
            <Icon icon={Strikethrough} size={16} />
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
      <SelectionMode />
    </div>
  );
}
