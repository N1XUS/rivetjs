// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button-group/without-separator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";

export const head = { title: "ButtonGroup: Without Separator" };

// #region demo
export function WithoutSeparator() {
  return (
    <ButtonGroup>
      <Button>First</Button>
      <Button>Second</Button>
      <Button>Third</Button>
    </ButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithoutSeparator />
    </div>
  );
}
