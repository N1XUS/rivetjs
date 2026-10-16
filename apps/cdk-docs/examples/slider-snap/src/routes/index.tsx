import { Label } from "@rivetjs/cdk/label";
import { Slider, SliderFill, SliderOutput, SliderThumb, SliderTrack } from "@rivetjs/cdk/slider";

export const head = { title: "Slider snap" };

// #region demo
export default function SnapSliders() {
  return (
    <div class="demo">
      {/* Default snap="release": the thumb follows the pointer, the value stays on steps. */}
      <Slider id="free" defaultValue={50} step={25}>
        <Label>Free drag (default)</Label>
        <SliderOutput />
        <SliderTrack>
          <SliderFill />
          <SliderThumb />
        </SliderTrack>
      </Slider>
      {/* snap="drag": React Aria behaviour, the thumb jumps between steps while dragging. */}
      <Slider id="stepped" defaultValue={50} step={25} snap="drag">
        <Label>Snap during drag</Label>
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
