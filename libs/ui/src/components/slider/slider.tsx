// Ported from HeroUI v3.2.6 packages/react/src/components/slider/slider.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Slider.Steps / Slider.Marks / Slider.Mark (+ `getIndicatorProps` / `getDecimalPlaces`): ported from the HeroUI `v3` branch
// @ e5feb0a3 (post-3.2.6, same file, Apache-2.0, © 2025 NextUI Inc.; modified), replacing the former `Marks` stub.
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/Slider` → `@rivetjs/cdk/slider` (accessor render
//   props; `state` = the cdk `SliderState`, read through `sliderValues(state)` / `getThumbValueLabel(state, i)` / …);
//   `@heroui/styles` → vendored `styles/`.
// - No `SliderContext`: the parts read the cdk `SliderStateContext` (upstream's `state.state`) and the slots from one
//   module-level memo (`sliderVariants({})` has no variants), `undefined` outside a Slider (= upstream `slots?.x`).
// - `Slider.Fill` = the cdk `SliderFill` (upstream: a `dom.div` with `left` / `width` from `getThumbPercent`): same box, plus
//   RTL (`inset-inline-start`, upstream TODO) and the cdk free drag + Motion1D snap-on-release (`snap`, default `"release"`;
//   `getThumbPositionPercent`, `data-snapping`). No `render` prop on the Fill (the cdk part has none on its own div either way).
// - `Slider.Track` `data-fill-start` / `data-fill-end` follow the thumb positions (accessors, free drag included).
// - `Slider.Output` default children: the thumb value labels joined with " – " (upstream), a function child of the cdk output.
// - Children: upstream's `(values) => typeof children === "function" ? children(values) : children` = what the cdk parts do
//   with `children` themselves (passed through).
// - Shorthand (identity spec §4.2): no children = Label (`label`) + Output + Track(Fill, one Thumb per value: two for an array
//   `value` / `defaultValue`, read once at mount).
// - Steps / Marks / Mark read the cdk state (range, step, orientation, read once at mount; `data-filled` follows the thumb
//   positions, free drag included, the way the Fill does) and the cdk locale direction (`useLocale()` from `@rivetjs/cdk/i18n`).
//   Dots and marks render on the server with their positions (static styles), so resumed markup = client markup.
// - Live `class` → render-prop class functions (the composed class is a local: it reaches the cdk part as a plain value). `value` takes a two-way signal.
import {
  Slider as SliderPrimitive,
  SliderFill as SliderFillPrimitive,
  SliderOutput as SliderOutputPrimitive,
  SliderStateContext,
  SliderThumb as SliderThumbPrimitive,
  SliderTrack as SliderTrackPrimitive,
  getFormattedValue,
  getThumbPositionPercent,
  getThumbValueLabel,
  getValuePercent,
  isSliderDisabled,
  sliderMax,
  sliderMin,
  sliderStep,
  sliderValues,
} from "@rivetjs/cdk/slider";
import { useLocale } from "@rivetjs/cdk/i18n";
import type {
  SliderFillProps as SliderFillPrimitiveProps,
  SliderFillRenderProps,
  SliderOutputProps as SliderOutputPrimitiveProps,
  SliderProps as SliderPrimitiveProps,
  SliderRenderProps,
  SliderState,
  SliderThumbProps as SliderThumbPrimitiveProps,
  SliderThumbRenderProps,
  SliderTrackProps as SliderTrackPrimitiveProps,
  SliderTrackRenderProps,
} from "@rivetjs/cdk/slider";
import { untrack, useContext } from "@rivetjs/reactivity";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { SliderVariants } from "../../../styles/src/components/slider/index.ts";
import { sliderVariants } from "../../../styles/src/components/slider/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { LabelRoot } from "../label/label.tsx";
import { DEV } from "#dev";

type SliderSlots = ReturnType<typeof sliderVariants>;

let SLOTS: SliderSlots | undefined;
/** Module-level memo (upstream `useMemo(() => sliderVariants({}), [])` per root; tv slot functions are pure). */
const slotsFor = (): SliderSlots => (SLOTS ??= sliderVariants({}));

/** Upstream `use(SliderContext).slots`: `undefined` outside a Slider. */
const slotsOf = (state: SliderState | null | undefined): SliderSlots | undefined => (state ? slotsFor() : undefined);

/* -------------------------------------------------------------------------------------------------
 * Slider Root
 * -----------------------------------------------------------------------------------------------*/
interface SliderRootProps<T extends number | number[] = number | number[]> extends SliderPrimitiveProps<T>, SliderVariants {
  /** Shorthand (no children): the Label; the Output, Track, Fill and Thumbs render too. */
  label?: Content;
}

const SliderRoot = <T extends number | number[] = number | number[]>(props: SliderRootProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as unknown as SliderRootProps, ["class", "label", "orientation"]);
  if (DEV && (rest as { children?: unknown }).children !== undefined) DEV.shorthandIgnored("Slider", local, ["label"]);
  const classOf = (): string | ((values: SliderRenderProps) => string) => composeTwRenderProps(local.class as never, slotsFor().base());
  const cls = hasLiveProp(local, ["class"]) ? (values: SliderRenderProps) => renderClass(classOf(), values) : classOf();

  if ((rest as { children?: unknown }).children !== undefined)
    return <SliderPrimitive data-slot="slider" orientation={local.orientation ?? "horizontal"} {...(rest as object)} class={cls as never} />;
  const initial = untrack(() => {
    const v = (rest as { value?: unknown; defaultValue?: unknown }).value ?? (rest as { defaultValue?: unknown }).defaultValue;
    return typeof v === "function" ? (v as () => unknown)() : v;
  });
  const thumbs = Array.isArray(initial) ? initial.length : 1;
  return (
    <SliderPrimitive data-slot="slider" orientation={local.orientation ?? "horizontal"} {...(rest as object)} class={cls as never}>
      {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
      <SliderOutput />
      <SliderTrack>
        <SliderFill />
        {Array.from({ length: thumbs }, (_, index) => (
          <SliderThumb index={index} />
        ))}
      </SliderTrack>
    </SliderPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Slider Output
 * -----------------------------------------------------------------------------------------------*/
interface SliderOutputProps extends SliderOutputPrimitiveProps {}

const SliderOutput = (props: SliderOutputProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const state = useContext(SliderStateContext);
  const classOf = (): string | ((values: SliderRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(state)?.output());
  const cls = hasLiveProp(local, ["class"]) ? (values: SliderRenderProps) => renderClass(classOf(), values) : classOf();

  // `children` as a prop: a function JSX child would be a slot accessor, not the cdk render-prop child.
  const children =
    local.children !== undefined
      ? local.children
      : ({ state: s }: SliderRenderProps) =>
          sliderValues(s)
            .map((_, i) => getThumbValueLabel(s, i))
            .join(" – ");
  return <SliderOutputPrimitive class={cls as never} data-slot="slider-output" {...(rest as object)} children={children as never} />;
};

/* -------------------------------------------------------------------------------------------------
 * Slider Track
 * -----------------------------------------------------------------------------------------------*/
interface SliderTrackProps extends SliderTrackPrimitiveProps {}

/** Upstream `[startOffset, endOffset]`: the fill's 0–1 range (first thumb or 0 → last thumb). */
function fillRange(state: SliderState): [number, number] {
  const count = sliderValues(state).length;
  const start = count > 1 ? getThumbPositionPercent(state, 0) : 0;
  const end = getThumbPositionPercent(state, count ? count - 1 : 0);
  return start <= end ? [start, end] : [end, start];
}

const SliderTrack = (props: SliderTrackProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const state = useContext(SliderStateContext);
  const classOf = (): string | ((values: SliderTrackRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(state)?.track());
  const cls = hasLiveProp(local, ["class"]) ? (values: SliderTrackRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <SliderTrackPrimitive
      class={cls as never}
      data-slot="slider-track"
      {...({
        "data-fill-start": () => {
          if (!state) return undefined;
          const [start, end] = fillRange(state);
          return (sliderValues(state).length === 1 ? end - start > 0 : start === 0) || undefined;
        },
        "data-fill-end": () => {
          if (!state) return undefined;
          const [start, end] = fillRange(state);
          return (sliderValues(state).length === 1 ? (end - start) * 100 === 100 : start * 100 + (end - start) * 100 === 100) || undefined;
        },
      } as object)}
      {...(rest as object)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Slider Fill
 * -----------------------------------------------------------------------------------------------*/
interface SliderFillProps extends SliderFillPrimitiveProps {}

const SliderFill = (props: SliderFillProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const state = useContext(SliderStateContext);
  const classOf = (): string | ((values: SliderFillRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(state)?.fill());
  const cls = hasLiveProp(local, ["class"]) ? (values: SliderFillRenderProps) => renderClass(classOf(), values) : classOf();

  return <SliderFillPrimitive class={cls as never} data-slot="slider-fill" {...(rest as object)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Slider Thumb
 * -----------------------------------------------------------------------------------------------*/
interface SliderThumbProps extends SliderThumbPrimitiveProps {}

const SliderThumb = (props: SliderThumbProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const state = useContext(SliderStateContext);
  const classOf = (): string | ((values: SliderThumbRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(state)?.thumb());
  const cls = hasLiveProp(local, ["class"]) ? (values: SliderThumbRenderProps) => renderClass(classOf(), values) : classOf();

  return <SliderThumbPrimitive class={cls as never} data-slot="slider-thumb" {...(rest as object)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Slider Indicators (Steps / Marks / Mark: upstream v3 branch after 3.2.6, see the header)
 * -----------------------------------------------------------------------------------------------*/
type Direction = "ltr" | "rtl";

/** Upstream `getIndicatorProps`: `data-filled` (between the fill's ends, endpoints included), `data-value`, the position. */
function indicatorProps(state: SliderState, value: number, direction: Direction, min: number, max: number) {
  const percent = min === max ? 0 : getValuePercent(state, value);
  const side = state.orientation === "vertical" ? "bottom" : direction === "rtl" ? "right" : "left";
  return {
    "data-disabled": disabledOf(state),
    // Rivet: against the thumb positions (free during a pointer drag, as the fill), not only the stepped values.
    "data-filled": () => {
      const [start, end] = fillRange(state);
      return (percent >= start - EPSILON && percent <= end + EPSILON) || undefined;
    },
    "data-value": value,
    position: { [side]: `${percent * 100}%` } as Record<string, string>,
  };
}

const EPSILON = 1e-9;

/** `data-disabled` of an indicator: the slider's disabled state (an accessor when `isDisabled` is live). */
const disabledOf = (state: SliderState): true | undefined | (() => true | undefined) =>
  state.disabled ? () => isSliderDisabled(state) || undefined : state.isDisabled || undefined;

/** An attribute value or its accessor, read (inline reads in JSX attributes are reactive). */
const read = <V,>(v: V | (() => V)): V => (typeof v === "function" ? (v as () => V)() : v);

function getDecimalPlaces(value: number): number {
  const [coefficient, exponent = "0"] = value.toString().split("e");
  return Math.max(0, (coefficient!.split(".")[1]?.length ?? 0) - Number(exponent));
}

/** Merges a caller `style` object with the indicator position (upstream `{ ...style, ...position }`). */
function withPosition(style: unknown, position: Record<string, string>): Record<string, string> {
  return { ...((style as Record<string, string> | undefined) ?? {}), ...position };
}

/* -------------------------------------------------------------------------------------------------
 * Slider Steps
 * -----------------------------------------------------------------------------------------------*/
interface SliderStepsProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  class?: string;
  /** The dots are generated (one per step). */
  children?: never;
}

type SliderStepsDivProps = SliderStepsProps & Omit<JSX.IntrinsicElements["div"], keyof SliderStepsProps | "children">;

/**
 * Decorative dots at each step, composed inside Slider.Track.
 * Omitted for invalid ranges or more than 1,000 dots to avoid unbounded DOM output.
 * Exposes slider-steps and slider-step data-slot hooks; dots expose data-value and data-filled.
 * Rivet: the range and step are read once at mount (a live `minValue` / `maxValue` / `step` keeps the first dots).
 */
const SliderSteps = <E extends keyof JSX.IntrinsicElements = "div">(props: SliderStepsProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as unknown as SliderStepsDivProps, ["class"]);
  const state = useContext(SliderStateContext);
  if (!state) return null as unknown as JSX.Element;
  const { direction } = useLocale();
  const [min, max, step] = untrack(() => [sliderMin(state), sliderMax(state), sliderStep(state)]);
  const stepCount = (max - min) / step;
  // Account for decimal division such as (0.3 - 0) / 0.1 without adding an off-step endpoint.
  const count = Math.floor(stepCount + Number.EPSILON * Math.max(1, stepCount) * 4) + 1;
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    max < min ||
    !Number.isFinite(step) ||
    step <= 0 ||
    !Number.isFinite(count) ||
    count <= 0 ||
    count > 1000
  )
    return null as unknown as JSX.Element;
  const precision = Math.max(getDecimalPlaces(min), getDecimalPlaces(step));
  const slots = slotsFor();

  return (
    <dom.div
      class={composeSlotClassName(slots.steps, local.class)}
      data-direction={direction}
      data-disabled={disabledOf(state)}
      data-orientation={state.orientation}
      data-slot="slider-steps"
      {...rest}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => {
        // Avoid cumulative floating-point drift in decimal steps and data-value hooks.
        const raw = min + index * step;
        const value = Math.min(max, precision <= 100 ? Number(raw.toFixed(precision)) : raw);
        const ind = indicatorProps(state, value, direction, min, max);
        return (
          <span
            class={slots.step()}
            data-slot="slider-step"
            data-disabled={read(ind["data-disabled"])}
            data-filled={ind["data-filled"]()}
            data-value={value}
            style={ind.position}
          />
        );
      })}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Slider Marks
 * -----------------------------------------------------------------------------------------------*/
interface SliderMarksProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  class?: string;
}

type SliderMarksDivProps = SliderMarksProps & Omit<JSX.IntrinsicElements["div"], keyof SliderMarksProps>;

/** Composed after Slider.Track. Contains Slider.Mark labels and exposes data-slot="slider-marks". */
const SliderMarks = <E extends keyof JSX.IntrinsicElements = "div">(props: SliderMarksProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SliderMarksDivProps, ["class"]);
  const state = useContext(SliderStateContext);
  const { direction } = useLocale();

  return (
    <dom.div
      class={composeSlotClassName(slotsOf(state)?.marks, local.class)}
      data-direction={direction}
      data-disabled={state ? disabledOf(state) : undefined}
      data-orientation={state?.orientation}
      data-slot="slider-marks"
      dir={direction}
      {...rest}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Slider Mark
 * -----------------------------------------------------------------------------------------------*/
interface SliderMarkProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  class?: string;
  /** Value at which to position the label. Values outside the slider bounds are not rendered. */
  value: number;
}

type SliderMarkDivProps = SliderMarkProps & Omit<JSX.IntrinsicElements["div"], keyof SliderMarkProps>;

/**
 * Exposes data-slot="slider-mark", data-value, data-filled, and data-disabled.
 * Rivet: the bounds are read once at mount (upstream `getThumbMinValue(0)` / `getThumbMaxValue(last)` = the slider's
 * `minValue` / `maxValue`); without children the label is `getFormattedValue(state, value)` (locale + `formatOptions`).
 */
const SliderMark = <E extends keyof JSX.IntrinsicElements = "div">(props: SliderMarkProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as unknown as SliderMarkDivProps, ["children", "class", "style", "value"]);
  const state = useContext(SliderStateContext);
  const value = local.value;
  if (!state) return null as unknown as JSX.Element;
  const [min, max] = untrack(() => [sliderMin(state), sliderMax(state)]);
  if (!Number.isFinite(value) || value < min || value > max) return null as unknown as JSX.Element;
  const { direction } = useLocale();
  const { position, ...attrs } = indicatorProps(state, value, direction, min, max);

  return (
    <dom.div
      class={composeSlotClassName(slotsFor().mark, local.class)}
      data-slot="slider-mark"
      {...attrs}
      {...rest}
      style={withPosition(local.style, position)}
    >
      {local.children ?? getFormattedValue(state, value)}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { SliderRoot, SliderOutput, SliderTrack, SliderFill, SliderThumb, SliderSteps, SliderMarks, SliderMark };

export type { SliderRootProps, SliderOutputProps, SliderTrackProps, SliderFillProps, SliderThumbProps, SliderStepsProps, SliderMarksProps, SliderMarkProps };
export type { SliderRenderProps, SliderTrackRenderProps, SliderFillRenderProps, SliderThumbRenderProps, SliderState };
