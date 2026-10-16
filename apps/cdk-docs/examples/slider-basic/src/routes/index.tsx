import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/cdk/label";
import { Slider, SliderFill, SliderOutput, SliderThumb, SliderTrack } from "@rivetjs/cdk/slider";

export const head = { title: "Slider with a label, output and fill" };

// #region demo
export default function VolumeSlider() {
  const volume = signal(30);
  return (
    <div id="volume" class="m-4 w-64 text-sm">
      <Slider value={volume} class="grid grid-cols-[1fr_auto] gap-2">
        <Label>Volume</Label>
        <SliderOutput class="font-mono text-slate-600" />
        <SliderTrack class="col-span-2 h-2 rounded-full bg-slate-200">
          <SliderFill class="rounded-full bg-teal-600" />
          <SliderThumb class="top-1/2 h-5 w-5 rounded-full border-2 border-teal-600 bg-white shadow data-[dragging]:scale-110 data-[focus-visible]:ring-4 data-[focus-visible]:ring-teal-200" />
        </SliderTrack>
      </Slider>
      <p class="mt-3 text-slate-500">
        Signal value: <span id="volume-value">{volume()}</span>
      </p>
    </div>
  );
}
// #endregion
