import { Label } from "@rivetjs/cdk/label";
import { Slider, SliderFill, SliderOutput, SliderThumb, SliderTrack } from "@rivetjs/cdk/slider";

export const head = { title: "Range slider with formatted values" };

const thumb = "top-1/2 h-5 w-5 rounded-full border-2 border-indigo-600 bg-white shadow data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function PriceRange() {
  return (
    <div id="price" class="m-4 w-72 text-sm">
      <Slider
        defaultValue={[200, 600]}
        minValue={0}
        maxValue={1000}
        step={10}
        formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
        class="grid grid-cols-[1fr_auto] gap-2"
      >
        <Label>Price range</Label>
        <SliderOutput class="font-mono text-slate-600" />
        <SliderTrack class="col-span-2 h-2 rounded-full bg-slate-200">
          <SliderFill class="rounded-full bg-indigo-600" />
          <SliderThumb index={0} aria-label="Minimum" class={thumb} />
          <SliderThumb index={1} aria-label="Maximum" class={thumb} />
        </SliderTrack>
      </Slider>
    </div>
  );
}
// #endregion
