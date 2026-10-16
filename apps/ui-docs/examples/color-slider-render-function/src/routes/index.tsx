// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-slider/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ColorSlider: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <ColorSlider channel="hue" class="w-full max-w-xs" defaultValue="hsl(0, 100%, 50%)" render={(props) => <div {...props} data-custom="foo" />}>
      <Label>Hue</Label>
      <ColorSlider.Output />
      <ColorSlider.Track>
        <ColorSlider.Thumb />
      </ColorSlider.Track>
    </ColorSlider>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}
