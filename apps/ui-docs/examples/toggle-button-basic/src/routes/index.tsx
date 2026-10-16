// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toggle-button/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Heart } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";

export const head = { title: "ToggleButton: Usage" };

// #region demo
export function Basic() {
  return (
    <ToggleButton>
      <Icon icon={Heart} size={16} />
      Like
    </ToggleButton>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
