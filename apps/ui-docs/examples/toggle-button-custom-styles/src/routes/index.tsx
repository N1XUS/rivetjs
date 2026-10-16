// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toggle-button/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Heart } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";

export const head = { title: "ToggleButton: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <ToggleButton class="gap-2 rounded-full border border-border/80 bg-surface px-4 text-foreground shadow-sm data-[selected=true]:border-accent/30 data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-soft-foreground [&_svg]:text-muted data-[selected=true]:[&_svg]:text-accent">
      <Icon icon={Heart} size={16} />
      Save article
    </ToggleButton>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
