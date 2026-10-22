// Rivet addition (no HeroUI v3.2.6 counterpart): a settings-cell slider, the whole cell is the track. Feature set inspired by
// HeroUI Pro's public docs (CellSlider: `variant` default / secondary; parts `.Label`, `.Output`, `.Track`, `.Fill`, `.Thumb`);
// independent implementation, Rivet-authored styles on HeroUI tokens.
// - Root = cdk `Slider` (value / defaultValue / two-way Signal / onChange / onChangeEnd, minValue / maxValue / step,
//   formatOptions, isDisabled; stepped sliders drag freely and snap with an animated release, cdk `snap`). Context
//   `rv-ui-cell-slider` `{ inCell, variant }`.
// - Track = cdk `SliderTrack` stretched over the whole cell (pointer down anywhere moves the value), Fill = cdk `SliderFill`
//   (accent tint), Thumb = cdk `SliderThumb` (focusable hidden range input; drawn as a thin pill at the fill edge). Label =
//   cdk `Label` and Output = cdk `SliderOutput` (default: the thumb value labels) sit above the track with
//   `pointer-events: none`, so presses on them reach the track.
// - Shorthand (identity spec §4.2, plan T22): no children = Track(Fill, Thumb) + Label (`label`) + Output.
import { Label as LabelPrimitive } from "@rivetjs/cdk/label";
import type { LabelProps as LabelPrimitiveProps } from "@rivetjs/cdk/label";
import {
  Slider as SliderPrimitive,
  SliderFill as SliderFillPrimitive,
  SliderOutput as SliderOutputPrimitive,
  SliderThumb as SliderThumbPrimitive,
  SliderTrack as SliderTrackPrimitive,
  getThumbValueLabel,
  sliderValues,
} from "@rivetjs/cdk/slider";
import type {
  SliderFillProps as SliderFillPrimitiveProps,
  SliderFillRenderProps,
  SliderOutputProps as SliderOutputPrimitiveProps,
  SliderProps as SliderPrimitiveProps,
  SliderRenderProps,
  SliderThumbProps as SliderThumbPrimitiveProps,
  SliderThumbRenderProps,
  SliderTrackProps as SliderTrackPrimitiveProps,
  SliderTrackRenderProps,
} from "@rivetjs/cdk/slider";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";

import type { CellSliderVariants } from "../../../styles/src/components/cell-slider/index.ts";
import { cellSliderVariants } from "../../../styles/src/components/cell-slider/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DEV } from "#dev";

/* -------------------------------------------------------------------------------------------------
 * CellSlider Context
 * -----------------------------------------------------------------------------------------------*/
interface CellSliderContext {
  /** Set inside a CellSlider. */
  inCell?: true;
  variant?: CellSliderVariants["variant"];
}

const CellSliderContext = resumableContext(createContext<CellSliderContext>({}, { id: "rv-ui-cell-slider" }));

type Slots = ReturnType<typeof cellSliderVariants>;

/** Module-level memo per `variant` (tv slot functions are pure). */
const SLOTS: Record<string, Slots> = {};
const slotsFor = (variant: CellSliderVariants["variant"]): Slots => (SLOTS[String(variant)] ??= cellSliderVariants({ variant }));
const slotsOf = (context: CellSliderContext): Slots => slotsFor(context.variant);

/* -------------------------------------------------------------------------------------------------
 * CellSlider Root
 * -----------------------------------------------------------------------------------------------*/
interface CellSliderRootProps extends Omit<SliderPrimitiveProps<number>, "orientation">, CellSliderVariants {
  /** Shorthand (no children): the Label; the Track, Fill, Thumb and Output render too. */
  label?: Content;
}

const CellSliderRoot = (props: CellSliderRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "label", "variant"]);
  if (DEV && local.children !== undefined) DEV.shorthandIgnored("CellSlider", local, ["label"]);
  const contextValue: CellSliderContext = hasLiveProp(local, ["variant"])
    ? {
        inCell: true,
        get variant() {
          return local.variant;
        },
      }
    : { inCell: true, variant: local.variant };
  const classOf = (): string | ((values: SliderRenderProps) => string) => composeTwRenderProps(local.class as never, slotsFor(local.variant).base());
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: SliderRenderProps) => renderClass(classOf(), values) : classOf();

  // A function: Rivet JSX builds nodes eagerly, so the slider is created inside the provider.
  const content = () => (
    <SliderPrimitive data-slot="cell-slider" {...(rest as object)} orientation="horizontal" class={cls as never}>
      {local.children !== undefined ? (
        (local.children as Content)
      ) : (
        <>
          <CellSliderTrack>
            <CellSliderFill />
            <CellSliderThumb />
          </CellSliderTrack>
          {local.label !== undefined && <CellSliderLabel>{local.label}</CellSliderLabel>}
          <CellSliderOutput />
        </>
      )}
    </SliderPrimitive>
  );
  return (
    <Provider token={CellSliderContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CellSlider Label / Output
 * -----------------------------------------------------------------------------------------------*/
interface CellSliderLabelProps extends LabelPrimitiveProps {}

const CellSliderLabel = (props: CellSliderLabelProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(CellSliderContext);
  return (
    <LabelPrimitive
      data-slot="cell-slider-label"
      {...(rest as object)}
      class={composeSlotClassName(slotsOf(context).label, local.class as string | undefined)}
    />
  );
};

interface CellSliderOutputProps extends SliderOutputPrimitiveProps {}

const CellSliderOutput = (props: CellSliderOutputProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CellSliderContext);
  const classOf = (): string | ((values: SliderRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context).output());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, ["variant"]) ? (values: SliderRenderProps) => renderClass(classOf(), values) : classOf();
  const children =
    local.children !== undefined
      ? local.children
      : ({ state }: SliderRenderProps) =>
          sliderValues(state)
            .map((_, i) => getThumbValueLabel(state, i))
            .join(" – ");
  return <SliderOutputPrimitive data-slot="cell-slider-output" {...(rest as object)} class={cls as never} children={children as never} />;
};

/* -------------------------------------------------------------------------------------------------
 * CellSlider Track / Fill / Thumb
 * -----------------------------------------------------------------------------------------------*/
interface CellSliderTrackProps extends SliderTrackPrimitiveProps {}

const TRACK_STYLE = { position: "absolute", inset: "0" } as const;

const CellSliderTrack = (props: CellSliderTrackProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(CellSliderContext);
  const classOf = (): string | ((values: SliderTrackRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context).track());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["variant"]) ? (values: SliderTrackRenderProps) => renderClass(classOf(), values) : classOf();
  // The cdk track bag sets `position: relative` inline: the cell track covers the whole cell (`absolute`, inset 0).
  return <SliderTrackPrimitive data-slot="cell-slider-track" style={TRACK_STYLE} {...(rest as object)} class={cls as never} />;
};

interface CellSliderFillProps extends SliderFillPrimitiveProps {}

const CellSliderFill = (props: CellSliderFillProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(CellSliderContext);
  const classOf = (): string | ((values: SliderFillRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context).fill());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["variant"]) ? (values: SliderFillRenderProps) => renderClass(classOf(), values) : classOf();
  return <SliderFillPrimitive data-slot="cell-slider-fill" {...(rest as object)} class={cls as never} />;
};

interface CellSliderThumbProps extends SliderThumbPrimitiveProps {}

const CellSliderThumb = (props: CellSliderThumbProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(CellSliderContext);
  const classOf = (): string | ((values: SliderThumbRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context).thumb());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["variant"]) ? (values: SliderThumbRenderProps) => renderClass(classOf(), values) : classOf();
  return <SliderThumbPrimitive data-slot="cell-slider-thumb" {...(rest as object)} class={cls as never} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { CellSliderRoot, CellSliderLabel, CellSliderOutput, CellSliderTrack, CellSliderFill, CellSliderThumb, CellSliderContext };
export type {
  CellSliderRootProps,
  CellSliderLabelProps,
  CellSliderOutputProps,
  CellSliderTrackProps,
  CellSliderFillProps,
  CellSliderThumbProps,
  SliderRenderProps as CellSliderRenderProps,
};
