// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toast/custom-indicator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Star } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { toast, Toast } from "@rivetjs/ui/toast";

export const head = { title: "Toast: Custom Indicator" };

// #region demo
export function CustomIndicator() {
  return (
    <div class="flex h-full max-w-xl flex-col items-center justify-center">
      <Button
        size="sm"
        variant="secondary"
        onPress={() =>
          toast("Custom icon indicator", {
            indicator: <Icon icon={Star} />,
          })
        }
      >
        Custom indicator
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Toast.Provider />
      <CustomIndicator />
    </div>
  );
}
