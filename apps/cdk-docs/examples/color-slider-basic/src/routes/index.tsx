import { ColorSlider } from "@rivetjs/cdk/color-slider";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";
import { Label } from "@rivetjs/cdk/label";
import { SliderOutput, SliderTrack } from "@rivetjs/cdk/slider";

export const head = { title: "ColorSlider: hue" };

// #region demo
export default function HueSlider() {
  return (
    <div id="hue-demo" class="m-4 w-56 text-sm">
      <ColorSlider channel="hue" defaultValue="hsl(0, 100%, 50%)" class="grid grid-cols-[1fr_auto] gap-1">
        <Label />
        <SliderOutput class="font-mono" />
        <SliderTrack class="col-span-2 h-7 rounded-md">
          <ColorThumb class="top-1/2 h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)] focus-visible:h-6 focus-visible:w-6 dragging:h-6 dragging:w-6" />
        </SliderTrack>
      </ColorSlider>
    </div>
  );
}
// #endregion
