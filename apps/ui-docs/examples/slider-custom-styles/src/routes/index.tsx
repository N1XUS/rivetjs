// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/slider/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Slider class="w-full max-w-xs" defaultValue={40}>
      <Label class="font-medium text-foreground">Brightness</Label>
      <Slider.Output class="text-xs text-muted tabular-nums" />
      <Slider.Track class="bg-default">
        <Slider.Fill class="bg-accent" />
        <Slider.Thumb class="bg-accent after:bg-accent-foreground" />
      </Slider.Track>
    </Slider>
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
