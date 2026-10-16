// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toolbar/with-button-group.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Bold, Italic, Redo2, TextAlignCenter, TextAlignEnd, TextAlignStart, Underline, Undo2 } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";
import { Separator } from "@rivetjs/ui/separator";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";
import { Toolbar } from "@rivetjs/ui/toolbar";

export const head = { title: "Toolbar: With ButtonGroup" };

// #region demo
export function WithButtonGroup() {
  return (
    <Toolbar aria-label="Editor toolbar">
      <ButtonGroup variant="tertiary">
        <Button>
          <Icon icon={Undo2} size={16} />
          Undo
        </Button>
        <Button>
          <ButtonGroup.Separator />
          <Icon icon={Redo2} size={16} />
          Redo
        </Button>
      </ButtonGroup>
      <Separator />
      <ToggleButtonGroup aria-label="Text style" selectionMode="multiple">
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
      <Separator />
      <ButtonGroup variant="tertiary">
        <Button isIconOnly aria-label="Align left">
          <Icon icon={TextAlignStart} size={16} />
        </Button>
        <Button isIconOnly aria-label="Align center">
          <ButtonGroup.Separator />
          <Icon icon={TextAlignCenter} size={16} />
        </Button>
        <Button isIconOnly aria-label="Align right">
          <ButtonGroup.Separator />
          <Icon icon={TextAlignEnd} size={16} />
        </Button>
      </ButtonGroup>
    </Toolbar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithButtonGroup />
    </div>
  );
}
