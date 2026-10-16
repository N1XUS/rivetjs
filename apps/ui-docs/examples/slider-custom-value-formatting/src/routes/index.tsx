// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/slider/custom-value-formatting.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: Custom Value Formatting" };

// #region demo
export function CustomValueFormatting() {
  return (
    <Slider class="w-full max-w-xs" defaultValue={60} formatOptions={{ currency: "USD", style: "currency" }}>
      <Label>Price</Label>
      <Slider.Output />
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomValueFormatting />
    </div>
  );
}
