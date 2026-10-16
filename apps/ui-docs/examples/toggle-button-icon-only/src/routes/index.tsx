// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toggle-button/icon-only.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Bookmark, Heart } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";

export const head = { title: "ToggleButton: Icon Only" };

// #region demo
export function IconOnly() {
  return (
    <div class="flex items-center gap-3">
      <ToggleButton isIconOnly aria-label="Like">
        <Icon icon={Heart} size={16} />
      </ToggleButton>
      <ToggleButton isIconOnly aria-label="Bookmark" variant="ghost">
        <Icon icon={Bookmark} size={16} />
      </ToggleButton>
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
