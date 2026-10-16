// Type-level suite (`tsc -p libs/ui` only): `CellSlider` props (variant union, value number / Signal, Slider props, no
// `orientation`), parts; errors: bad variant, `orientation`, array value.
import { signal } from "@rivetjs/reactivity";
import { CellSlider } from "../src/components/cell-slider/index.ts";
import type { CellSliderProps } from "../src/components/cell-slider/index.ts";

const props: CellSlider["Props"] = { variant: "secondary", defaultValue: 3, minValue: 0, maxValue: 10, step: 1 };
const rootProps: CellSliderProps = props;
const value = signal(4);

export const ok = () => (
  <>
    <CellSlider {...rootProps} onChange={(v: number) => void v} onChangeEnd={(v: number) => void v}>
      <CellSlider.Track class="t">
        <CellSlider.Fill class="f" />
        <CellSlider.Thumb name="x" />
      </CellSlider.Track>
      <CellSlider.Label class="l">L</CellSlider.Label>
      <CellSlider.Output>{({ isDisabled }) => (isDisabled() ? "off" : "on")}</CellSlider.Output>
    </CellSlider>
    <CellSlider value={value} aria-label="Two-way" isDisabled>
      <CellSlider.Track>
        <CellSlider.Thumb />
      </CellSlider.Track>
    </CellSlider>
  </>
);

// @ts-expect-error unknown variant
export const badVariant = () => <CellSlider variant="ghost" />;
// @ts-expect-error cells are horizontal
export const badOrientation = () => <CellSlider orientation="vertical" />;
// @ts-expect-error one thumb
export const badRange = () => <CellSlider defaultValue={[1, 2]} />;
