// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-picker/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { ColorArea } from "@rivetjs/ui/color-area";
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorPicker } from "@rivetjs/ui/color-picker";
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";
import { Label } from "@rivetjs/ui/label";
import { parseColor } from "@rivetjs/cdk/color";
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Shuffle } from "lucide";

export const head = { title: "ColorPicker: Controlled" };

// #region demo
export function Controlled() {
  // Rivet: a controlled value is a two-way signal of the color string (Color instances are not resumable).
  const color = signal("#325578");

  const colorPresets = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e"];

  const shuffleColor = () => {
    const randomHue = Math.floor(Math.random() * 360);
    const randomSaturation = 50 + Math.floor(Math.random() * 50); // 50-100%
    const randomLightness = 40 + Math.floor(Math.random() * 30); // 40-70%

    color.set(`hsl(${randomHue}, ${randomSaturation}%, ${randomLightness}%)`);
  };

  return (
    <div class="flex flex-col gap-4">
      <ColorPicker value={color}>
        <ColorPicker.Trigger>
          <ColorSwatch size="lg" />
          <Label>Pick a color</Label>
        </ColorPicker.Trigger>
        <ColorPicker.Popover class="gap-2">
          <ColorSwatchPicker class="justify-center pt-2" size="xs">
            {colorPresets.map((preset) => (
              <ColorSwatchPicker.Item color={preset}>
                <ColorSwatchPicker.Swatch />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>
          <ColorArea aria-label="Color area" class="max-w-full" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
            <ColorArea.Thumb />
          </ColorArea>
          <div class="flex items-center gap-2 px-1">
            <ColorSlider aria-label="Hue slider" channel="hue" class="flex-1" colorSpace="hsb">
              <ColorSlider.Track>
                <ColorSlider.Thumb />
              </ColorSlider.Track>
            </ColorSlider>
            <Button isIconOnly aria-label="Shuffle color" size="sm" variant="tertiary" onPress={shuffleColor}>
              <Icon class="size-4" icon={Shuffle} />
            </Button>
          </div>
          <ColorField aria-label="Color field">
            <ColorField.Group variant="secondary">
              <ColorField.Prefix>
                <ColorSwatch size="xs" />
              </ColorField.Prefix>
              <ColorField.Input />
            </ColorField.Group>
          </ColorField>
        </ColorPicker.Popover>
      </ColorPicker>
      <p class="w-60 text-sm text-muted">
        Selected: <span class="font-medium">{parseColor(color()).toString("hex")}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
