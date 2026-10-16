// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";

export const head = { title: "Button: Disabled State" };

// #region demo
export function Disabled() {
  return (
    <div class="flex flex-wrap gap-3">
      <Button isDisabled>Primary</Button>
      <Button isDisabled variant="secondary">
        Secondary
      </Button>
      <Button isDisabled variant="tertiary">
        Tertiary
      </Button>
      <Button isDisabled variant="outline">
        Outline
      </Button>
      <Button isDisabled variant="ghost">
        Ghost
      </Button>
      <Button isDisabled variant="danger">
        Danger
      </Button>
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
