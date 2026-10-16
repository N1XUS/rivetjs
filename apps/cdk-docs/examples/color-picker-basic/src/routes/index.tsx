import { signal } from "@rivetjs/reactivity";
import { toColor, type Color } from "@rivetjs/cdk/color";
import { ColorArea } from "@rivetjs/cdk/color-area";
import { ColorField } from "@rivetjs/cdk/color-field";
import { ColorPicker } from "@rivetjs/cdk/color-picker";
import { ColorSlider } from "@rivetjs/cdk/color-slider";
import { ColorSwatch } from "@rivetjs/cdk/color-swatch";
import { ColorSwatchPicker, ColorSwatchPickerItem } from "@rivetjs/cdk/color-swatch-picker";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { SliderTrack } from "@rivetjs/cdk/slider";

export const head = { title: "ColorPicker composition" };

const thumb = "top-1/2 h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]";
const item = "rounded p-0.5 data-[selected]:ring-2 data-[selected]:ring-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600";

// #region demo
export default function Picker() {
  const color = signal<string | Color>("#2563eb");
  return (
    <div class="m-4 grid w-56 gap-3 text-sm">
      <ColorPicker value={color}>
        <ColorArea colorSpace="hsb" xChannel="saturation" yChannel="brightness" class="h-36 w-56 rounded-lg">
          <ColorThumb class="h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]" />
        </ColorArea>
        <div id="picker-hue">
          <ColorSlider colorSpace="hsb" channel="hue" aria-label="Hue">
            <SliderTrack class="h-6 rounded">
              <ColorThumb class={thumb} />
            </SliderTrack>
          </ColorSlider>
        </div>
        <div class="flex items-end gap-2">
          <ColorSwatch id="picker-swatch" class="h-9 w-9 rounded" />
          <div id="picker-field">
            <ColorField class="grid gap-1">
              <Label>Hex</Label>
              <Input class="w-28 rounded border border-slate-300 px-2 py-1 font-mono" />
            </ColorField>
          </div>
        </div>
        <ColorSwatchPicker id="picker-swatches" class="flex gap-1">
          <ColorSwatchPickerItem color="#2563eb" class={item}>
            <ColorSwatch class="h-6 w-6 rounded" />
          </ColorSwatchPickerItem>
          <ColorSwatchPickerItem color="#dc2626" class={item}>
            <ColorSwatch class="h-6 w-6 rounded" />
          </ColorSwatchPickerItem>
          <ColorSwatchPickerItem color="#16a34a" class={item}>
            <ColorSwatch class="h-6 w-6 rounded" />
          </ColorSwatchPickerItem>
        </ColorSwatchPicker>
      </ColorPicker>
      <output id="picker-value" class="font-mono">
        {toColor(color())!.toString("hex")}
      </output>
    </div>
  );
}
// #endregion
