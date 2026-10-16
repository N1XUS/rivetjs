// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button-group/orientation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { TextAlignCenter, TextAlignJustify, TextAlignStart, TextAlignEnd } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";

export const head = { title: "ButtonGroup: Orientation" };

// #region demo
export function Orientation() {
  return (
    <div class="flex items-start gap-8">
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted">Horizontal</span>
        <ButtonGroup orientation="horizontal" variant="tertiary">
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
          <Button isIconOnly aria-label="Justify">
            <ButtonGroup.Separator />
            <Icon icon={TextAlignJustify} size={16} />
          </Button>
        </ButtonGroup>
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted">Vertical</span>
        <ButtonGroup orientation="vertical" variant="tertiary">
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
          <Button isIconOnly aria-label="Justify">
            <ButtonGroup.Separator />
            <Icon icon={TextAlignJustify} size={16} />
          </Button>
        </ButtonGroup>
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
