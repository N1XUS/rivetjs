// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button-group/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";

export const head = { title: "ButtonGroup: Sizes" };

// #region demo
export function Sizes() {
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col items-start gap-2">
        <p class="text-sm text-muted">Small</p>
        <ButtonGroup size="sm" variant="secondary">
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
        <p class="text-sm text-muted">Medium (default)</p>
        <ButtonGroup size="md" variant="secondary">
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
        <p class="text-sm text-muted">Large</p>
        <ButtonGroup size="lg" variant="secondary">
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
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Sizes />
    </div>
  );
}
