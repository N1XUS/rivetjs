// Ported from HeroUI v3.2.6 packages/react/src/components/color-slider/color-slider.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/ColorSlider` → `@rivetjs/cdk/color-slider` (+ the cdk
//   `SliderOutput` / `SliderTrack` from `@rivetjs/cdk/slider`, `ColorThumb` from `@rivetjs/cdk/color-thumb`; accessor render props);
//   `@heroui/styles` → vendored `styles/`.
// - No `ColorSliderContext`: the parts read the cdk `ColorSliderStateContext` (upstream's `state.state`; `state.channel` = upstream's
//   context `channel`) and the slots from one module-level memo (`colorSliderVariants({})` has no variants), `undefined` outside a
//   ColorSlider (= upstream `slots?.x`). Edge colors are computed per style binding run (upstream `useMemo` over `displayColor`).
// - `getValidColorSpace`: the auto-correction always runs; the console warning is development-only (`#dev`; upstream checks
//   `process.env.NODE_ENV`).
// - `ColorSlider.Output` default children: the color slider's thumb value label (`getThumbValueLabel(state)` from `@rivetjs/cdk/color`).
// - `value` / `defaultValue` reach the cdk slider in their string form (`../../utils/color-value.ts`); a controlled `value` may be a
//   two-way Signal. Live `class` → render-prop class functions. Style functions are inline arrows (resumable).
// - Drag: the cdk color slider's free drag + animated snap to the channel step on release (`snap="release"` default, as the
//   Slider; `snap="drag"` = RAC); the value stays stepped (hue step 1 of 360, alpha / percentage channels 1%).
import { ColorSlider as ColorSliderPrimitive, ColorSliderStateContext } from "@rivetjs/cdk/color-slider";
import type { ColorSliderProps as ColorSliderPrimitiveProps, ColorSliderRenderProps } from "@rivetjs/cdk/color-slider";
import { ColorThumb as ColorThumbPrimitive } from "@rivetjs/cdk/color-thumb";
import type { ColorThumbProps as ColorThumbPrimitiveProps, ColorThumbRenderProps } from "@rivetjs/cdk/color-thumb";
import { getDisplayColor, getThumbValueLabel } from "@rivetjs/cdk/color";
import type { ColorChannel, ColorSliderState, ColorSpace } from "@rivetjs/cdk/color";
import { SliderOutput as SliderOutputPrimitive, SliderTrack as SliderTrackPrimitive } from "@rivetjs/cdk/slider";
import type {
  SliderOutputProps as SliderOutputPrimitiveProps,
  SliderRenderProps,
  SliderTrackProps as SliderTrackPrimitiveProps,
  SliderTrackRenderProps,
} from "@rivetjs/cdk/slider";
import { useContext } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { DEV } from "#dev";

import type { ColorSliderVariants } from "../../../styles/src/components/color-slider/index.ts";
import { colorSliderVariants } from "../../../styles/src/components/color-slider/index.ts";
import { colorProps } from "../../utils/color-value.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

type StyleObject = Record<string, string | number | undefined>;

/* -------------------------------------------------------------------------------------------------
 * ColorSlider Channel Types
 * -----------------------------------------------------------------------------------------------*/
/** Channels available in HSL color space */
type HSLChannel = "hue" | "saturation" | "lightness" | "alpha";
/** Channels available in HSB color space */
type HSBChannel = "hue" | "saturation" | "brightness" | "alpha";
/** Channels available in RGB color space */
type RGBChannel = "red" | "green" | "blue" | "alpha";
/** Channels shared between HSL and HSB (but NOT RGB) */
type HSLHSBSharedChannel = "hue" | "saturation";
/** Alpha channel works across ALL color spaces */
type AlphaChannel = "alpha";

/**
 * Discriminated union type for valid channel/colorSpace combinations.
 * This ensures TypeScript will error on invalid combinations like
 * `channel="red"` with `colorSpace="hsl"` or `channel="saturation"` with `colorSpace="rgb"`.
 */
type ColorSliderChannelProps =
  | { channel: HSLChannel; colorSpace?: "hsl" }
  | { channel: HSBChannel; colorSpace?: "hsb" }
  | { channel: RGBChannel; colorSpace?: "rgb" }
  | { channel: HSLHSBSharedChannel; colorSpace?: "hsl" | "hsb" }
  | { channel: AlphaChannel; colorSpace?: ColorSpace };

/* -------------------------------------------------------------------------------------------------
 * ColorSlider Validation Utilities
 * -----------------------------------------------------------------------------------------------*/
/** Maps channels to their required color space (for channels that are color-space specific) */
const CHANNEL_TO_REQUIRED_COLORSPACE: Partial<Record<string, ColorSpace>> = {
  red: "rgb",
  green: "rgb",
  blue: "rgb",
  lightness: "hsl",
  brightness: "hsb",
};

/** Channels that only work with HSL or HSB (not RGB) */
const HSL_HSB_ONLY_CHANNELS = new Set(["hue", "saturation"]);

/** Rivet: development-only (`#dev`); upstream guards on `process.env.NODE_ENV`. */
function warnInDev(message: string) {
  if (DEV) {
    // eslint-disable-next-line no-console
    console.warn(message);
  }
}

/**
 * Validates and returns a valid colorSpace for the given channel.
 * If an invalid combination is detected, logs a warning and returns the correct colorSpace.
 */
function getValidColorSpace(channel: string, colorSpace?: ColorSpace): ColorSpace | undefined {
  // Check if channel requires a specific color space (e.g., "red" requires "rgb")
  const requiredSpace = CHANNEL_TO_REQUIRED_COLORSPACE[channel];

  if (requiredSpace && colorSpace && colorSpace !== requiredSpace) {
    warnInDev(
      `[HeroUI ColorSlider] Invalid combination: channel="${channel}" requires colorSpace="${requiredSpace}", ` +
        `but received colorSpace="${colorSpace}". Auto-correcting to "${requiredSpace}".`,
    );

    return requiredSpace;
  }

  // Check if channel is HSL/HSB only (hue, saturation) but RGB was specified
  if (HSL_HSB_ONLY_CHANNELS.has(channel) && colorSpace === "rgb") {
    warnInDev(
      `[HeroUI ColorSlider] Invalid combination: channel="${channel}" is not available in RGB color space. ` +
        `Use colorSpace="hsl" or colorSpace="hsb" instead. Auto-correcting to "hsl".`,
    );

    return "hsl";
  }

  return colorSpace;
}

type ColorSliderSlots = ReturnType<typeof colorSliderVariants>;

let SLOTS: ColorSliderSlots | undefined;
/** Module-level memo (upstream `useMemo(() => colorSliderVariants({}), [])` per root; tv slot functions are pure). */
const slotsFor = (): ColorSliderSlots => (SLOTS ??= colorSliderVariants({}));

/** Upstream `use(ColorSliderContext).slots`: `undefined` outside a ColorSlider. */
const slotsOf = (state: ColorSliderState | null | undefined): ColorSliderSlots | undefined => (state ? slotsFor() : undefined);

/* -------------------------------------------------------------------------------------------------
 * ColorSlider Root
 * -----------------------------------------------------------------------------------------------*/
interface ColorSliderRootBaseProps extends Omit<ColorSliderPrimitiveProps, "channel" | "colorSpace">, ColorSliderVariants {}

type ColorSliderRootProps = ColorSliderRootBaseProps & ColorSliderChannelProps;

const ColorSliderRoot = (props: ColorSliderRootProps): JSX.Element => {
  const [local, rest] = splitLive(props as ColorSliderRootBaseProps & { channel: ColorChannel; colorSpace?: ColorSpace }, [
    "channel",
    "class",
    "colorSpace",
    "orientation",
    "value",
    "defaultValue",
  ]);
  // Validate and auto-correct invalid channel/colorSpace combinations
  const validColorSpace = getValidColorSpace(local.channel, local.colorSpace);
  const classOf = () => composeTwRenderProps(local.class as never, slotsFor().base());
  const cls = hasLiveProp(local, ["class"]) ? (values: ColorSliderRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ColorSliderPrimitive
      channel={local.channel}
      colorSpace={validColorSpace}
      data-slot="color-slider"
      orientation={local.orientation ?? "horizontal"}
      {...(rest as object)}
      {...colorProps(local, ["value", "defaultValue"])}
      class={cls as never}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * ColorSlider Output
 * -----------------------------------------------------------------------------------------------*/
interface ColorSliderOutputProps extends SliderOutputPrimitiveProps {}

const ColorSliderOutput = (props: ColorSliderOutputProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const state = useContext(ColorSliderStateContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(state)?.output());
  const cls = hasLiveProp(local, ["class"]) ? (values: SliderRenderProps) => renderClass(classOf(), values) : classOf();

  // `children` as a prop: a function JSX child would be a slot accessor, not the cdk render-prop child.
  const children = local.children !== undefined ? local.children : () => (state ? getThumbValueLabel(state) : "");
  return <SliderOutputPrimitive class={cls as never} data-slot="color-slider-output" {...(rest as object)} children={children as never} />;
};

/* -------------------------------------------------------------------------------------------------
 * ColorSlider Track
 * -----------------------------------------------------------------------------------------------*/
interface ColorSliderTrackProps extends SliderTrackPrimitiveProps {}

const ColorSliderTrack = (props: ColorSliderTrackProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "style"]);
  const state = useContext(ColorSliderStateContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(state)?.track());
  const cls = hasLiveProp(local, ["class"]) ? (values: SliderTrackRenderProps) => renderClass(classOf(), values) : classOf();
  const style = local.style;

  return (
    <SliderTrackPrimitive
      class={cls as never}
      data-slot="color-slider-track"
      style={(renderProps: SliderTrackRenderProps & { defaultStyle: StyleObject }) => {
        // Calculate start and end colors for the gradient edge caps
        let start = "transparent";
        let end = "transparent";
        if (state) {
          const displayColor = getDisplayColor(state);
          const range = displayColor.getChannelRange(state.channel);
          // Get colors at min and max values of the channel
          start = displayColor.withChannelValue(state.channel, range.minValue).toString("css");
          end = displayColor.withChannelValue(state.channel, range.maxValue).toString("css");
        }
        const userStyle = typeof style === "function" ? (style as (v: unknown) => StyleObject)(renderProps) : style;
        return {
          // Add transparency checkerboard pattern for alpha channel
          background: `${renderProps.defaultStyle.background}, repeating-conic-gradient(#efefef 0% 25%, #f7f7f7 0% 50%) 50% / 16px 16px`,
          // Pass edge colors as CSS custom properties for ::before and ::after
          "--track-end-color": end,
          "--track-start-color": start,
          ...(userStyle as StyleObject),
        };
      }}
      {...(rest as object)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * ColorSlider Thumb
 * -----------------------------------------------------------------------------------------------*/
interface ColorSliderThumbProps extends ColorThumbPrimitiveProps {}

const ColorSliderThumb = (props: ColorSliderThumbProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "style"]);
  const state = useContext(ColorSliderStateContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(state)?.thumb());
  const cls = hasLiveProp(local, ["class"]) ? (values: ColorThumbRenderProps) => renderClass(classOf(), values) : classOf();
  const style = local.style;

  return (
    <ColorThumbPrimitive
      class={cls as never}
      data-slot="color-slider-thumb"
      style={(renderProps: ColorThumbRenderProps & { defaultStyle: StyleObject }) => {
        const userStyle = typeof style === "function" ? (style as (v: unknown) => StyleObject)(renderProps) : style;
        return {
          ...renderProps.defaultStyle,
          backgroundColor: renderProps.isDisabled() ? undefined : renderProps.defaultStyle.backgroundColor,
          ...(userStyle as StyleObject),
        };
      }}
      {...(rest as object)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ColorSliderRoot, ColorSliderOutput, ColorSliderTrack, ColorSliderThumb };

export type {
  ColorSliderRootProps,
  ColorSliderOutputProps,
  ColorSliderTrackProps,
  ColorSliderThumbProps,
  // Channel types for type-safe usage
  HSLChannel,
  HSBChannel,
  RGBChannel,
  HSLHSBSharedChannel,
  AlphaChannel,
  ColorSliderChannelProps,
};
