// Type-level suite (`tsc -p libs/ui` only): color parts accept the cdk props + `class` / variants, string / Color / Signal values,
// style + class render functions, the `ColorSlider` channel / colorSpace discriminated union, `X["…Props"]`; errors: an invalid
// channel / colorSpace pair, unknown variants.
import { parseColor } from "@rivetjs/cdk/color";
import type { Color } from "@rivetjs/cdk/color";
import { signal } from "@rivetjs/reactivity";
import { ColorArea } from "../src/components/color-area/index.ts";
import { ColorField } from "../src/components/color-field/index.ts";
import type { ColorValue } from "../src/components/color-field/index.ts";
import { ColorInputGroup } from "../src/components/color-input-group/index.ts";
import { ColorPicker } from "../src/components/color-picker/index.ts";
import { ColorSlider } from "../src/components/color-slider/index.ts";
import type { ColorSliderChannelProps } from "../src/components/color-slider/index.ts";
import { ColorSwatch } from "../src/components/color-swatch/index.ts";
import { ColorSwatchPicker } from "../src/components/color-swatch-picker/index.ts";

const value = signal<string | Color>("#ff0000");
const field = signal<string | Color | null>(null);

export const ok = () => (
  <>
    <ColorSwatch color="#0485F7" shape="square" size="xl" colorName="Blue" class="c" style={{ width: "1px" }} />
    <ColorSwatch color={parseColor("#0485F7")} />
    <ColorArea aria-label="Area" value={value} colorSpace="hsb" xChannel="saturation" yChannel="brightness" showDots onChange={(c) => void c.toString()}>
      <ColorArea.Thumb class={({ isDragging }) => (isDragging() ? "d" : "")} />
    </ColorArea>
    <ColorSlider channel="hue" colorSpace="hsl" value={value} orientation="vertical">
      <ColorSlider.Output />
      <ColorSlider.Track>
        <ColorSlider.Thumb />
      </ColorSlider.Track>
    </ColorSlider>
    <ColorSlider channel="red" colorSpace="rgb" defaultValue="#ff0000" />
    <ColorSlider channel="alpha" colorSpace="hsb" />
    <ColorField name="color" value={field} fullWidth isRequired channel="hue" colorSpace="hsl">
      <ColorField.Group variant="secondary" fullWidth>
        <ColorField.Prefix>p</ColorField.Prefix>
        <ColorField.Input class="i" />
        <ColorField.Suffix>s</ColorField.Suffix>
      </ColorField.Group>
    </ColorField>
    <ColorInputGroup variant="primary">
      <ColorInputGroup.Input />
    </ColorInputGroup>
    <ColorSwatchPicker aria-label="Presets" value={value} layout="stack" size="xs" variant="square">
      <ColorSwatchPicker.Item color="#ff0000">
        <ColorSwatchPicker.Swatch />
        <ColorSwatchPicker.Indicator>{({ isSelected }) => (isSelected() ? "x" : "")}</ColorSwatchPicker.Indicator>
      </ColorSwatchPicker.Item>
    </ColorSwatchPicker>
    <ColorPicker value={value} onChange={(c) => void c.toString("hex")}>
      <ColorPicker.Trigger>
        <ColorSwatch />
      </ColorPicker.Trigger>
      <ColorPicker.Popover placement="top">
        <ColorArea aria-label="Area" />
      </ColorPicker.Popover>
    </ColorPicker>
  </>
);

export const props: [
  ColorSwatch["Props"],
  ColorArea["ThumbProps"],
  ColorSlider["TrackProps"],
  ColorField["GroupProps"],
  ColorSwatchPicker["ItemProps"],
  ColorPicker["PopoverProps"],
] = [{}, {}, {}, { variant: "primary" }, { color: "#000" }, { children: null }];
export const channel: ColorSliderChannelProps = { channel: "brightness", colorSpace: "hsb" };
export const color: ColorValue = parseColor("#000");

export const bad = () => (
  <>
    {/* @ts-expect-error red is an rgb channel */}
    <ColorSlider channel="red" colorSpace="hsl" />
    {/* @ts-expect-error unknown swatch size */}
    <ColorSwatch size="xxl" />
    {/* @ts-expect-error unknown group variant */}
    <ColorField.Group variant="tertiary" />
    {/* @ts-expect-error unknown picker layout */}
    <ColorSwatchPicker layout="row" />
  </>
);
