// Ported from HeroUI v3.2.6 packages/react/src/components/slider/slider.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
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
// - Live `class` → render-prop class functions (the composed class is a local: it reaches the cdk part as a plain value). `value` takes a two-way signal.
import {
  Slider as SliderPrimitive,
  SliderFill as SliderFillPrimitive,
  SliderOutput as SliderOutputPrimitive,
  SliderStateContext,
  SliderThumb as SliderThumbPrimitive,
  SliderTrack as SliderTrackPrimitive,
  getThumbPositionPercent,
  getThumbValueLabel,
  sliderValues,
} from "@rivetjs/cdk/slider";
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
import { warnShorthandIgnored } from "../../utils/shorthand.ts";

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
  if (DEV && (rest as { children?: unknown }).children !== undefined) warnShorthandIgnored("Slider", local, ["label"]);
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
 * Slider Marks (upstream TODO: a styled `div` slot)
 * -----------------------------------------------------------------------------------------------*/
interface SliderMarksProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  class?: string;
}

type SliderMarksDivProps = SliderMarksProps & Omit<JSX.IntrinsicElements["div"], keyof SliderMarksProps>;

const SliderMarks = <E extends keyof JSX.IntrinsicElements = "div">(props: SliderMarksProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SliderMarksDivProps, ["class"]);
  const state = useContext(SliderStateContext);

  return <dom.div class={composeSlotClassName(slotsOf(state)?.marks, local.class)} data-slot="slider-marks" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { SliderRoot, SliderOutput, SliderTrack, SliderFill, SliderThumb, SliderMarks };

export type { SliderRootProps, SliderOutputProps, SliderTrackProps, SliderFillProps, SliderThumbProps, SliderMarksProps };
export type { SliderRenderProps, SliderTrackRenderProps, SliderFillRenderProps, SliderThumbRenderProps, SliderState };
