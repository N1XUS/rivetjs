import { ColorSlider } from "@rivetjs/cdk/color-slider";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";
import { Label } from "@rivetjs/cdk/label";
import { SliderOutput, SliderTrack } from "@rivetjs/cdk/slider";

export const head = { title: "ColorSlider with plain CSS" };

// #region demo
export default function CssSlider() {
  return (
    <div id="css-slider" class="demo">
      <ColorSlider channel="saturation" defaultValue="hsl(140, 50%, 40%)">
        <Label />
        <SliderOutput />
        <SliderTrack>
          <ColorThumb />
        </SliderTrack>
      </ColorSlider>
    </div>
  );
}
// #endregion
