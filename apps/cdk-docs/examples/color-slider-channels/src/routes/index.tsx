import { signal } from "@rivetjs/reactivity";
import { toColor, type Color } from "@rivetjs/cdk/color";
import { ColorSlider } from "@rivetjs/cdk/color-slider";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";
import { Label } from "@rivetjs/cdk/label";
import { SliderOutput, SliderTrack } from "@rivetjs/cdk/slider";

export const head = { title: "ColorSlider channels, orientation, disabled" };

const thumb = "top-1/2 left-1/2 h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]";

// #region demo
export default function Channels() {
  const color = signal<string | Color>("hsla(200, 80%, 50%, 1)");
  return (
    <div class="m-4 flex gap-6 text-sm">
      <div class="grid w-56 gap-3">
        <div id="alpha">
          <ColorSlider channel="alpha" value={color} class="grid grid-cols-[1fr_auto]">
            <Label />
            <SliderOutput />
            <SliderTrack class="col-span-2 h-6 rounded">
              <ColorThumb class={thumb} />
            </SliderTrack>
          </ColorSlider>
        </div>
        <ColorSlider channel="lightness" colorSpace="hsl" value={color} class="grid grid-cols-[1fr_auto]">
          <Label />
          <SliderOutput />
          <SliderTrack class="col-span-2 h-6 rounded">
            <ColorThumb class={thumb} />
          </SliderTrack>
        </ColorSlider>
        <div id="disabled-slider">
          <ColorSlider channel="saturation" value={color} isDisabled class="grid grid-cols-[1fr_auto] disabled:opacity-40">
            <Label />
            <SliderOutput />
            <SliderTrack class="col-span-2 h-6 rounded">
              <ColorThumb class={thumb} />
            </SliderTrack>
          </ColorSlider>
        </div>
        <output id="channels-value" class="font-mono">
          {toColor(color())!.toString("hsla")}
        </output>
      </div>
      <div id="vertical">
        <ColorSlider channel="hue" value={color} orientation="vertical" aria-label="Hue">
          <SliderTrack class="h-32 w-6 rounded">
            <ColorThumb class={thumb} />
          </SliderTrack>
        </ColorSlider>
      </div>
    </div>
  );
}
// #endregion
