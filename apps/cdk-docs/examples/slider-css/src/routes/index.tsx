import { Label } from "@rivetjs/cdk/label";
import { Slider, SliderFill, SliderOutput, SliderThumb, SliderTrack } from "@rivetjs/cdk/slider";

export const head = { title: "Slider with plain CSS" };

// #region demo
export default function CssSliders() {
  return (
    <div class="demo">
      <Slider id="brightness" defaultValue={70}>
        <Label>Brightness</Label>
        <SliderOutput />
        <SliderTrack>
          <SliderFill />
          <SliderThumb />
        </SliderTrack>
      </Slider>
      <Slider id="level" orientation="vertical" defaultValue={50}>
        <Label>Level</Label>
        <SliderOutput />
        <SliderTrack>
          <SliderFill />
          <SliderThumb />
        </SliderTrack>
      </Slider>
    </div>
  );
}
// #endregion
