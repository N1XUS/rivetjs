// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button-group/full-width.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { TextAlignCenter, TextAlignStart, TextAlignEnd } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";

export const head = { title: "ButtonGroup: Full Width" };

// #region demo
export function FullWidth() {
  return (
    <div class="w-[400px] space-y-3">
      <ButtonGroup fullWidth>
        <Button>First</Button>
        <Button>
          <ButtonGroup.Separator />
          Second
        </Button>
        <Button>
          <ButtonGroup.Separator />
          Third
        </Button>
      </ButtonGroup>
      <ButtonGroup fullWidth>
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
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FullWidth />
    </div>
  );
}
