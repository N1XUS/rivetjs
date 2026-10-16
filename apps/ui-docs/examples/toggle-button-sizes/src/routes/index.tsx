// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toggle-button/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Heart } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";

export const head = { title: "ToggleButton: Sizes" };

// #region demo
export function Sizes() {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex items-center gap-3">
        <ToggleButton size="sm">
          <Icon icon={Heart} size={16} />
          Small
        </ToggleButton>
        <ToggleButton size="md">
          <Icon icon={Heart} size={16} />
          Medium
        </ToggleButton>
        <ToggleButton size="lg">
          <Icon icon={Heart} size={16} />
          Large
        </ToggleButton>
      </div>
      <div class="flex items-center gap-3">
        <ToggleButton isIconOnly aria-label="Like" size="sm">
          <Icon icon={Heart} size={16} />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Like" size="md">
          <Icon icon={Heart} size={16} />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Like" size="lg">
          <Icon icon={Heart} size={16} />
        </ToggleButton>
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
