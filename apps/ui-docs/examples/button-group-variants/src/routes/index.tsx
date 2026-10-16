// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button-group/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";

export const head = { title: "ButtonGroup: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <p class="text-sm text-muted">Primary</p>
        <ButtonGroup variant="primary">
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
      <div class="flex flex-col gap-2">
        <p class="text-sm text-muted">Secondary</p>
        <ButtonGroup variant="secondary">
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
      <div class="flex flex-col gap-2">
        <p class="text-sm text-muted">Tertiary</p>
        <ButtonGroup variant="tertiary">
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
      <div class="flex flex-col gap-2">
        <p class="text-sm text-muted">Outline</p>
        <ButtonGroup variant="outline">
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
      <div class="flex flex-col gap-2">
        <p class="text-sm text-muted">Ghost</p>
        <ButtonGroup variant="ghost">
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
      <div class="flex flex-col gap-2">
        <p class="text-sm text-muted">Danger</p>
        <ButtonGroup variant="danger">
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
      <Variants />
    </div>
  );
}
