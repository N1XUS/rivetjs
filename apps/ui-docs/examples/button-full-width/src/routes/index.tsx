// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/full-width.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Plus } from "lucide";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "Button: Full Width" };

// #region demo
export function FullWidth() {
  return (
    <div class="w-[400px] space-y-3">
      <Button fullWidth>Primary Button</Button>
      <Button fullWidth>
        <Icon icon={Plus} size={16} />
        With Icon
      </Button>
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
