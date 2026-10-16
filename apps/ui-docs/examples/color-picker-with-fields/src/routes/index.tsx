// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-picker/with-fields.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { Key } from "@rivetjs/cdk/collections";
import { ColorArea } from "@rivetjs/ui/color-area";
import type { ColorChannel } from "@rivetjs/cdk/color";
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorPicker } from "@rivetjs/ui/color-picker";
import { ColorSlider } from "@rivetjs/ui/color-slider";
import type { ColorSpace } from "@rivetjs/cdk/color";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";

export const head = { title: "ColorPicker: With Fields" };

// #region demo
export function WithFields() {
  // Rivet: the Select value is a two-way signal; the channel fields read `colorSpace` once, so a keyed Show re-creates them.
  const colorSpace = signal<Key | null>("hsl");

  const colorChannelsByColorSpace: Record<ColorSpace, ColorChannel[]> = {
    hsb: ["hue", "saturation", "brightness"],
    hsl: ["hue", "saturation", "lightness"],
    rgb: ["red", "green", "blue"],
  };

  return (
    <ColorPicker defaultValue="hsla(220, 90%, 50%, 0.8)">
      <ColorPicker.Trigger>
        <ColorSwatch size="lg" />
        <Label>Pick a color</Label>
      </ColorPicker.Trigger>
      <ColorPicker.Popover class="max-w-62 gap-2">
        <ColorArea class="max-w-full" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider channel="hue" class="gap-1 px-1" colorSpace="hsb">
          <Label>Hue</Label>
          <ColorSlider.Output class="text-muted" />
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
        <Select aria-label="Color space" value={colorSpace} variant="secondary">
          <Select.Trigger>
            <Select.Value class="uppercase" />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {Object.keys(colorChannelsByColorSpace).map((space) => (
                <ListBox.Item class="uppercase" id={space} textValue={space}>
                  {space}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Show keyed when={colorSpace() as ColorSpace}>
          {(space) => (
            <div class="grid w-full grid-cols-3 items-center gap-2">
              {colorChannelsByColorSpace[space()].map((channel) => (
                <ColorField aria-label={channel} channel={channel} colorSpace={space()}>
                  <ColorField.Group variant="secondary">
                    <ColorField.Input />
                  </ColorField.Group>
                </ColorField>
              ))}
            </div>
          )}
        </Show>
      </ColorPicker.Popover>
    </ColorPicker>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithFields />
    </div>
  );
}
