// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button-group/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";

export const head = { title: "ButtonGroup: Disabled State" };

// #region demo
export function Disabled() {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col items-start gap-2">
        <p class="text-sm text-muted">All buttons disabled</p>
        <ButtonGroup isDisabled>
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
      </div>
      <div class="flex flex-col items-start gap-2">
        <p class="text-sm text-muted">Group disabled, but one button overrides</p>
        <ButtonGroup isDisabled>
          <Button>First</Button>
          <Button>
            <ButtonGroup.Separator />
            Second
          </Button>
          <Button isDisabled={false}>
            <ButtonGroup.Separator />
            Third (enabled)
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
      <Disabled />
    </div>
  );
}
