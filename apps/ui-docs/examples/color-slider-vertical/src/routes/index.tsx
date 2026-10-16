// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-slider/vertical.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorSlider } from "@rivetjs/ui/color-slider";

export const head = { title: "ColorSlider: Vertical" };

// #region demo
export function Vertical() {
  return (
    <div class="flex h-48 gap-4">
      <ColorSlider aria-label="Hue" channel="hue" defaultValue="hsl(0, 100%, 50%)" orientation="vertical">
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider>
      <ColorSlider aria-label="Saturation" channel="saturation" defaultValue="hsl(0, 100%, 50%)" orientation="vertical">
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider>
      <ColorSlider aria-label="Lightness" channel="lightness" defaultValue="hsl(0, 100%, 50%)" orientation="vertical">
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Vertical />
    </div>
  );
}
