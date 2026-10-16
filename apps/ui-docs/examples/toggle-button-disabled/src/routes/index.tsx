// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toggle-button/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Heart } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";

export const head = { title: "ToggleButton: Disabled" };

// #region demo
export function Disabled() {
  return (
    <div class="flex items-center gap-3">
      <ToggleButton isDisabled>
        <Icon icon={Heart} size={16} />
        Like
      </ToggleButton>
      <ToggleButton defaultSelected isDisabled>
        <Icon icon={Heart} size={16} fill="currentColor" />
        Like
      </ToggleButton>
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
