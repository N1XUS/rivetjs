// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/icon-only.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Ellipsis, Settings, Trash2 } from "lucide";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "Button: Icon Only" };

// #region demo
export function IconOnly() {
  return (
    <div class="flex gap-3">
      <Button isIconOnly aria-label="More options" variant="tertiary">
        <Icon icon={Ellipsis} size={16} />
      </Button>
      <Button isIconOnly aria-label="Settings" variant="secondary">
        <Icon icon={Settings} size={16} />
      </Button>
      <Button isIconOnly aria-label="Delete" variant="danger">
        <Icon icon={Trash2} size={16} />
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <IconOnly />
    </div>
  );
}
