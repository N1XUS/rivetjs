// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/close-button/with-custom-icon.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CircleX, X } from "lucide";
import { CloseButton } from "@rivetjs/ui/close-button";

export const head = { title: "CloseButton: With Custom Icon" };

// #region demo
export function WithCustomIcon() {
  return (
    <div class="flex items-center gap-4">
      <div class="flex flex-col items-center gap-2">
        <CloseButton>
          <Icon icon={CircleX} size={16} />
        </CloseButton>
        <span class="text-xs text-muted">Custom Icon</span>
      </div>
      <div class="flex flex-col items-center gap-2">
        <CloseButton>
          <Icon icon={X} size={16} />
        </CloseButton>
        <span class="text-xs text-muted">Alternative Icon</span>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithCustomIcon />
    </div>
  );
}
