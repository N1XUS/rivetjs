// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toggle-button/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Heart } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";

export const head = { title: "ToggleButton: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex items-center gap-3">
      <ToggleButton>
        <Icon icon={Heart} size={16} />
        Default
      </ToggleButton>
      <ToggleButton variant="ghost">
        <Icon icon={Heart} size={16} />
        Ghost
      </ToggleButton>
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
