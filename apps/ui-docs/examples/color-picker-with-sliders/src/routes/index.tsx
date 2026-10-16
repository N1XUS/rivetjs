// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-picker/with-sliders.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { Key } from "@rivetjs/cdk/collections";
import type { ColorChannel } from "@rivetjs/cdk/color";
import { ColorPicker } from "@rivetjs/ui/color-picker";
import { ColorSlider } from "@rivetjs/ui/color-slider";
import type { ColorSpace } from "@rivetjs/cdk/color";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";

export const head = { title: "ColorPicker: With Sliders" };

// #region demo
export function WithSliders() {
  // Rivet: the Select value is a two-way signal; the channel sliders read `colorSpace` once, so a keyed Show re-creates them.
  const colorSpace = signal<Key | null>("hsl");

  const colorChannelsByColorSpace: Record<ColorSpace, ColorChannel[]> = {
    hsb: ["hue", "saturation", "brightness", "alpha"],
    hsl: ["hue", "saturation", "lightness", "alpha"],
    rgb: ["red", "green", "blue", "alpha"],
  };

  return (
    <ColorPicker defaultValue="hsl(219, 58%, 93%)">
      <ColorPicker.Trigger>
        <ColorSwatch size="lg" />
        <Label>Pick a color</Label>
      </ColorPicker.Trigger>
      <ColorPicker.Popover class="max-w-62 gap-2 px-2 py-3">
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
            <div class="flex flex-col gap-2">
              {colorChannelsByColorSpace[space()].map((channel: ColorChannel) => (
                // @ts-expect-error - TypeScript can't correlate dynamic colorSpace with channel type
                <ColorSlider aria-label={channel} channel={channel} class="gap-1 px-1" colorSpace={space()}>
                  <Label class="capitalize">{channel}</Label>
                  <ColorSlider.Output class="text-muted" />
                  <ColorSlider.Track>
                    <ColorSlider.Thumb />
                  </ColorSlider.Track>
                </ColorSlider>
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
      <WithSliders />
    </div>
  );
}
