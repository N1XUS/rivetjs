// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toolbar/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Bold, Italic, Underline } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";
import { Toolbar } from "@rivetjs/ui/toolbar";

export const head = { title: "Toolbar: Tailwind CSS" };

// #region demo
const toggleClass = "rounded-lg data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground";

export function CustomStyles() {
  return (
    <Toolbar aria-label="Formatting toolbar" class="gap-1 rounded-xl border border-border/80 bg-surface-secondary p-1.5">
      <ToggleButtonGroup aria-label="Text style" class="gap-0.5" selectionMode="multiple">
        <ToggleButton isIconOnly aria-label="Bold" class={toggleClass} id="bold">
          <Icon icon={Bold} size={16} />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Italic" class={toggleClass} id="italic">
          <Icon icon={Italic} size={16} />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Underline" class={toggleClass} id="underline">
          <Icon icon={Underline} size={16} />
        </ToggleButton>
      </ToggleButtonGroup>
    </Toolbar>
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
