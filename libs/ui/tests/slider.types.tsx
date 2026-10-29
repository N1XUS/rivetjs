// Type-level tests (`tsc -p libs/ui` only): Slider props.
import { signal } from "@rivetjs/reactivity";
import { getThumbValueLabel, sliderValues } from "@rivetjs/cdk/slider";
import { Slider } from "../src/components/slider/index.ts";
import type { Slider as SliderTypes, SliderRenderProps, SliderThumbRenderProps } from "../src/components/slider/index.ts";

const volume = signal(25);
const range = signal([10, 20]);

export const ok = [
  <Slider class="w-full" defaultValue={30} minValue={0} maxValue={100} step={5} onChange={(v: number | number[]) => v} snap="drag">
    <Slider.Output class="o" />
    <Slider.Track class="t">
      <Slider.Fill class="f" />
      <Slider.Steps class="s" />
      <Slider.Thumb class={(s: SliderThumbRenderProps) => (s.isDragging() ? "d" : "")} index={0} />
    </Slider.Track>
    <Slider.Marks class="m">
      <Slider.Mark value={0} />
      <Slider.Mark value={50} class="mk" style={{ color: "red" }}>
        Half
      </Slider.Mark>
    </Slider.Marks>
  </Slider>,
  <Slider value={volume} orientation="vertical" isDisabled formatOptions={{ style: "percent" }}>
    <Slider.Output>
      {({ state }: SliderRenderProps) =>
        sliderValues(state)
          .map((_, i) => getThumbValueLabel(state, i))
          .join(" – ")
      }
    </Slider.Output>
  </Slider>,
  <Slider value={range} render={(props) => <div {...props} data-custom="foo" />}>
    <Slider.Track>{({ state }) => state.defaultValues.map((_, i) => <Slider.Thumb index={i} />)}</Slider.Track>
  </Slider>,
];

export const props: SliderTypes["Props"] = { defaultValue: 1 };

// @ts-expect-error unknown orientation
export const bad1 = <Slider orientation="diagonal" />;
// @ts-expect-error Marks is a div slot, no render props
export const bad2 = <Slider.Marks class={() => "x"} />;
// @ts-expect-error Mark needs a value
export const bad3 = <Slider.Mark />;
// @ts-expect-error Steps generates its own children
export const bad4 = <Slider.Steps>x</Slider.Steps>;
