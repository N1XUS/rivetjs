// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-slider/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ColorSlider: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <ColorSlider channel="hue" class="w-full max-w-sm" defaultValue="hsl(220, 70%, 50%)">
      <Label class="font-medium text-foreground">Hue</Label>
      <ColorSlider.Output class="text-muted tabular-nums" />
      <ColorSlider.Track class="h-4! rounded-none! ring-1 ring-border [&::after]:rounded-r-sm! [&::before]:rounded-l-sm!">
        <ColorSlider.Thumb class="size-4 rounded-sm! border-2 border-background shadow-md ring-1 ring-black/10 dark:ring-white/20" />
      </ColorSlider.Track>
    </ColorSlider>
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
