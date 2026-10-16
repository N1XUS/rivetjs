// Slider stories (lane C4a): single and range sliders over two-way Signals with a Label, SliderOutput and
// SliderFill on a resumed page. Thumb drag, track click, keys and the label click must work after resume.
// `#stepped` (step 10): free drag + animated snap on release (Rivet `snap="release"` default).
import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/cdk/label";
import { Slider, SliderFill, SliderOutput, SliderThumb, SliderTrack } from "@rivetjs/cdk/slider";

const track = { width: "200px", height: "20px", background: "#ddd" };
const fill = { background: "#36c" };
const thumb = { width: "16px", height: "16px", top: "50%", borderRadius: "50%", background: "#123" };

export default function SliderStories() {
  const volume = signal(30);
  const range = signal([0.2, 0.6]);
  return (
    <main>
      <h1>Slider</h1>
      <Slider id="volume" value={volume}>
        <Label>Volume</Label>
        <SliderOutput id="volume-output" />
        <SliderTrack id="volume-track" style={track}>
          <SliderFill style={fill} />
          <SliderThumb style={thumb} />
        </SliderTrack>
      </Slider>
      <output id="volume-value">{String(volume())}</output>
      <Slider id="range" value={range} formatOptions={{ style: "percent", maximumFractionDigits: 0 }} minValue={0} maxValue={1} step={0.01}>
        <Label>Range</Label>
        <SliderOutput id="range-output" />
        <SliderTrack id="range-track" style={track}>
          <SliderFill style={fill} />
          <SliderThumb index={0} style={thumb} />
          <SliderThumb index={1} style={thumb} />
        </SliderTrack>
      </Slider>
      <output id="range-value">{range().join(",")}</output>
      <Slider id="stepped" defaultValue={0} step={10}>
        <Label>Stepped</Label>
        <SliderOutput id="stepped-output" />
        <SliderTrack id="stepped-track" style={track}>
          <SliderFill style={fill} />
          <SliderThumb style={thumb} />
        </SliderTrack>
      </Slider>
    </main>
  );
}
