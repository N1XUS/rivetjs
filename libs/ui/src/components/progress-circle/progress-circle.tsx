// Ported from HeroUI v3.2.6 packages/react/src/components/progress-circle/progress-circle.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; React types → Rivet JSX types; `react-aria-components/ProgressBar` →
//   `@rivetjs/cdk/progress-bar`; `@heroui/styles` → vendored `styles/`.
// - `ProgressCircleContext` carries `{ color, size, state }` instead of `{ slots, state }`: a resumable token
//   (`rv-ui-progress-circle`, same `{}` default); `color` / `size` are getters over the live props, `state` = the cdk render
//   props (accessors). Parts look the slots up in a module-level memo (`slotsFor`), `undefined` outside a `ProgressCircle`.
// - Live props as `progress-bar` (value props forwarded as getters, `renderClass`); the fill circle's `stroke-dashoffset` is a binding
//   over `state`, so a value change moves the ring in place.
// - SVG geometry = upstream constants (`STROKE_WIDTH` 4, `CENTER` 18, `RADIUS` 16, `CIRCUMFERENCE` 2πr); React's camelCase
//   `strokeWidth` / `strokeDasharray` / `strokeDashoffset` / `strokeLinecap` are written as the SVG attribute names
//   (`stroke-width`, …: React renames them, Rivet does not), so the DOM attributes are the same.
// - Function children: `typeof children === "function"` → `!isSlot(children)` (Rivet JSX children are compiler slots).
// - Bodies cast `props` to the default-element shape before splitting (upstream casts `props as any`).
import type { ProgressBarProps as ProgressBarPrimitiveProps, ProgressBarRenderProps } from "@rivetjs/cdk/progress-bar";
import { ProgressBar as ProgressBarPrimitive } from "@rivetjs/cdk/progress-bar";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";

import type { ProgressCircleVariants } from "../../../styles/src/components/progress-circle/index.ts";
import { progressCircleVariants } from "../../../styles/src/components/progress-circle/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * ProgressCircle Constants
 * -----------------------------------------------------------------------------------------------*/
const STROKE_WIDTH = 4;
const CENTER = 18;
const RADIUS = CENTER - STROKE_WIDTH / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/* -------------------------------------------------------------------------------------------------
 * ProgressCircle Context
 * -----------------------------------------------------------------------------------------------*/
interface ProgressCircleContext {
  color?: ProgressCircleVariants["color"];
  size?: ProgressCircleVariants["size"];
  /** The cdk render props (accessors); set inside a `ProgressCircle`. */
  state?: ProgressBarRenderProps;
}

const ProgressCircleContext = createContext<ProgressCircleContext>({});

type ProgressCircleSlots = ReturnType<typeof progressCircleVariants>;

/** Module-level memo per `color|size` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, ProgressCircleSlots> = {};
const slotsFor = (color: ProgressCircleVariants["color"], size: ProgressCircleVariants["size"]): ProgressCircleSlots =>
  (SLOTS[`${color}|${size}`] ??= progressCircleVariants({ color, size }));

/** Upstream `use(ProgressCircleContext).slots`: `undefined` outside a `ProgressCircle`. Read inside the part's bindings. */
const slotsOf = (context: ProgressCircleContext): ProgressCircleSlots | undefined =>
  context.state === undefined ? undefined : slotsFor(context.color, context.size);

/* -------------------------------------------------------------------------------------------------
 * ProgressCircle Root
 * -----------------------------------------------------------------------------------------------*/
interface ProgressCircleRootProps extends ProgressBarPrimitiveProps, ProgressCircleVariants {}

const STYLE_PROPS = ["class", "color", "size"] as const;
const OWN_PROPS = ["children", ...STYLE_PROPS, "value", "minValue", "maxValue", "valueLabel", "isIndeterminate"] as const;

const ProgressCircleRoot = (props: ProgressCircleRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, OWN_PROPS);
  // A body const, not inline in the JSX: the compiler registers a const initializer holding a function as a resumable symbol
  // (re-evaluated on resume with its captures); a call inside the JSX getter would hand cdk an unregistered closure.
  const classOf = (): string | ((values: never) => string) => composeTwRenderProps(local.class, slotsFor(local.color, local.size).base());
  const cls = hasLiveProp(local, STYLE_PROPS) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  return (
    <ProgressBarPrimitive
      data-slot="progress-circle"
      {...rest}
      value={local.value as never}
      minValue={local.minValue as never}
      maxValue={local.maxValue as never}
      valueLabel={local.valueLabel as never}
      isIndeterminate={local.isIndeterminate as never}
      class={cls as never}
    >
      {(values: ProgressBarRenderProps) => {
        // The getter object is its own const initializer (compiler-registered, so its getters stay live on resume; an inline
        // literal in the JSX attribute would encode as a snapshot).
        const context = {
          get color() {
            return local.color;
          },
          get size() {
            return local.size;
          },
          state: values,
        };
        return (
          <Provider token={ProgressCircleContext} value={context}>
            {typeof local.children === "function" && !isSlot(local.children)
              ? (local.children as (v: ProgressBarRenderProps) => Content)(values)
              : (local.children as Content)}
          </Provider>
        );
      }}
    </ProgressBarPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ProgressCircle Track
 * -----------------------------------------------------------------------------------------------*/
interface ProgressCircleTrackProps<E extends keyof JSX.IntrinsicElements = "svg"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `ProgressCircleTrack` props for the default element (`svg`). */
type ProgressCircleTrackSvgProps = ProgressCircleTrackProps & Omit<JSX.IntrinsicElements["svg"], keyof ProgressCircleTrackProps>;

const ProgressCircleTrack = <E extends keyof JSX.IntrinsicElements = "svg">(props: ProgressCircleTrackProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ProgressCircleTrackSvgProps, ["class"]);
  const context = useContext(ProgressCircleContext);

  return (
    <dom.svg
      class={composeSlotClassName(slotsOf(context)?.track, local.class)}
      data-slot="progress-circle-track"
      fill="none"
      viewBox={`0 0 ${CENTER * 2} ${CENTER * 2}`}
      {...rest}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * ProgressCircle TrackCircle
 * -----------------------------------------------------------------------------------------------*/
interface ProgressCircleTrackCircleProps<E extends keyof JSX.IntrinsicElements = "circle"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `ProgressCircleTrackCircle` props for the default element (`circle`). */
type ProgressCircleTrackCircleCircleProps = ProgressCircleTrackCircleProps & Omit<JSX.IntrinsicElements["circle"], keyof ProgressCircleTrackCircleProps>;

const ProgressCircleTrackCircle = <E extends keyof JSX.IntrinsicElements = "circle">(
  props: ProgressCircleTrackCircleProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as ProgressCircleTrackCircleCircleProps, ["class"]);
  const context = useContext(ProgressCircleContext);

  return (
    <dom.circle
      class={composeSlotClassName(slotsOf(context)?.trackCircle, local.class)}
      cx={CENTER}
      cy={CENTER}
      data-slot="progress-circle-track-circle"
      r={RADIUS}
      stroke-width={STROKE_WIDTH}
      {...rest}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * ProgressCircle FillCircle
 * -----------------------------------------------------------------------------------------------*/
interface ProgressCircleFillCircleProps<E extends keyof JSX.IntrinsicElements = "circle"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `ProgressCircleFillCircle` props for the default element (`circle`). */
type ProgressCircleFillCircleCircleProps = ProgressCircleFillCircleProps & Omit<JSX.IntrinsicElements["circle"], keyof ProgressCircleFillCircleProps>;

/** Upstream `strokeDashoffset`: a quarter ring while indeterminate, else the unfilled part of the circumference. */
const dashOffset = (state: ProgressBarRenderProps | undefined): number => {
  const percentage = state?.percentage() ?? 0;
  const isIndeterminate = state?.isIndeterminate() ?? false;
  return isIndeterminate ? CIRCUMFERENCE * 0.75 : CIRCUMFERENCE - (percentage / 100) * CIRCUMFERENCE;
};

const ProgressCircleFillCircle = <E extends keyof JSX.IntrinsicElements = "circle">(
  props: ProgressCircleFillCircleProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as ProgressCircleFillCircleCircleProps, ["class"]);
  const context = useContext(ProgressCircleContext);

  return (
    <dom.circle
      class={composeSlotClassName(slotsOf(context)?.fillCircle, local.class)}
      cx={CENTER}
      cy={CENTER}
      data-slot="progress-circle-fill-circle"
      r={RADIUS}
      stroke-dasharray={CIRCUMFERENCE}
      stroke-dashoffset={dashOffset(context.state)}
      stroke-linecap="round"
      stroke-width={STROKE_WIDTH}
      transform={`rotate(-90 ${CENTER} ${CENTER})`}
      {...rest}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ProgressCircleRoot, ProgressCircleTrack, ProgressCircleTrackCircle, ProgressCircleFillCircle, ProgressCircleContext, CIRCUMFERENCE, RADIUS };

export type {
  ProgressCircleRootProps,
  ProgressCircleTrackProps,
  ProgressCircleTrackCircleProps,
  ProgressCircleFillCircleProps,
  ProgressCircleTrackSvgProps,
  ProgressCircleTrackCircleCircleProps,
  ProgressCircleFillCircleCircleProps,
};
