// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/release-outline-variant.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";

export const head = { title: "Button: Outline Variant" };

// #region demo
export function OutlineVariant() {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <p class="text-sm text-muted">Button</p>
        <div class="flex flex-wrap gap-3">
          <Button variant="outline">Outline</Button>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <p class="text-sm text-muted">ButtonGroup</p>
        <ButtonGroup variant="outline">
          <Button>First</Button>
          <Button>Second</Button>
          <Button>Third</Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OutlineVariant />
    </div>
  );
}
