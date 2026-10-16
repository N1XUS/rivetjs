// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toolbar/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Bold, Copy, Italic, Scissors, Underline } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";
import { Separator } from "@rivetjs/ui/separator";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";
import { Toolbar } from "@rivetjs/ui/toolbar";

export const head = { title: "Toolbar: Usage" };

// #region demo
export function Basic() {
  return (
    <Toolbar aria-label="Text formatting">
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
        <Button isIconOnly aria-label="Copy">
          <Icon icon={Copy} size={16} />
        </Button>
        <Button isIconOnly aria-label="Cut">
          <ButtonGroup.Separator />
          <Icon icon={Scissors} size={16} />
        </Button>
      </ButtonGroup>
    </Toolbar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
