// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-picker/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorArea } from "@rivetjs/ui/color-area";
import { ColorPicker } from "@rivetjs/ui/color-picker";
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ColorPicker: Usage" };

// #region demo
export function Basic() {
  return (
    <ColorPicker defaultValue="#0485F7">
      <ColorPicker.Trigger>
        <ColorSwatch size="lg" />
        <Label>Pick a color</Label>
      </ColorPicker.Trigger>
      <ColorPicker.Popover>
        <ColorArea aria-label="Color area" class="max-w-full" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider channel="hue" class="gap-1 px-1" colorSpace="hsb">
          <Label>Hue</Label>
          <ColorSlider.Output class="text-muted" />
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
      </ColorPicker.Popover>
    </ColorPicker>
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
