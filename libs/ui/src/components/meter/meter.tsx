// Ported from HeroUI v3.2.6 packages/react/src/components/meter/meter.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; React types → Rivet JSX types; `react-aria-components/Meter` →
//   `@rivetjs/cdk/meter`; `@heroui/styles` → vendored `styles/`.
// - `MeterContext` carries `{ color, size, state }` instead of `{ slots, state }`: a resumable token (`rv-ui-meter`,
//   same `{}` default); `color` / `size` are getters over the live props, `state` = the cdk render props, which are accessors
//   (`state.percentage()`, `state.valueText()`), not snapshot values. Parts look the slots up in a
//   module-level memo (`slotsFor`, key `${color}|${size}`), `undefined` outside a `Meter` (= upstream `slots?.x`).
// - Live props: `value` / `minValue` / `maxValue` / `valueLabel` reach cdk as live getters (cdk keeps
//   them live), `class` / `color` / `size` make the cdk `class` a
//   render-prop function (`renderClass`); the fill width and the output text are bindings over `state`, so a value change updates
//   them in place (no re-created nodes).
// - Function children: `typeof children === "function"` → `!isSlot(children)` (Rivet JSX children are compiler slots).
// - `Output`: `children ?? state?.valueText` → the default text only when no children are given (Rivet children are slots; see
//   `../../../CLAUDE.md` Known diffs for `children ??`).
// - Bodies cast `props` to the default-element shape before splitting (upstream casts `props as any`).
import type { MeterProps as MeterPrimitiveProps, MeterRenderProps } from "@rivetjs/cdk/meter";
import { Meter as MeterPrimitive } from "@rivetjs/cdk/meter";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { isSlot } from "@rivetjs/runtime/slot";

import type { MeterVariants } from "../../../styles/src/components/meter/index.ts";
import { meterVariants } from "../../../styles/src/components/meter/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Meter Context
 * -----------------------------------------------------------------------------------------------*/
interface MeterContext {
  color?: MeterVariants["color"];
  size?: MeterVariants["size"];
  /** The cdk render props (accessors); set inside a `Meter`. */
  state?: MeterRenderProps;
}

const MeterContext = resumableContext(createContext<MeterContext>({}, { id: "rv-ui-meter" }));

type MeterSlots = ReturnType<typeof meterVariants>;

/** Module-level memo per `color|size` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, MeterSlots> = {};
const slotsFor = (color: MeterVariants["color"], size: MeterVariants["size"]): MeterSlots => (SLOTS[`${color}|${size}`] ??= meterVariants({ color, size }));

/** Upstream `use(MeterContext).slots`: `undefined` outside a `Meter`. Read inside the part's bindings. */
const slotsOf = (context: MeterContext): MeterSlots | undefined => (context.state === undefined ? undefined : slotsFor(context.color, context.size));

/* -------------------------------------------------------------------------------------------------
 * Meter Root
 * -----------------------------------------------------------------------------------------------*/
interface MeterRootProps extends MeterPrimitiveProps, MeterVariants {}

const STYLE_PROPS = ["class", "color", "size"] as const;
const OWN_PROPS = ["children", ...STYLE_PROPS, "value", "minValue", "maxValue", "valueLabel"] as const;

const MeterRoot = (props: MeterRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, OWN_PROPS);
  // A body const, not inline in the JSX: the compiler registers a const initializer holding a function as a resumable symbol
  // (re-evaluated on resume with its captures); a call inside the JSX getter would hand cdk an unregistered closure.
  const classOf = (): string | ((values: never) => string) => composeTwRenderProps(local.class, slotsFor(local.color, local.size).base());
  const cls = hasLiveProp(local, STYLE_PROPS) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  return (
    <MeterPrimitive
      data-slot="meter"
      {...rest}
      value={local.value as never}
      minValue={local.minValue as never}
      maxValue={local.maxValue as never}
      valueLabel={local.valueLabel as never}
      class={cls as never}
    >
      {(values: MeterRenderProps) => {
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
          <Provider token={MeterContext} value={context}>
            {typeof local.children === "function" && !isSlot(local.children)
              ? (local.children as (v: MeterRenderProps) => Content)(values)
              : (local.children as Content)}
          </Provider>
        );
      }}
    </MeterPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Meter Output
 * -----------------------------------------------------------------------------------------------*/
interface MeterOutputProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `MeterOutput` props for the default element (`span`). */
type MeterOutputSpanProps = MeterOutputProps & Omit<JSX.IntrinsicElements["span"], keyof MeterOutputProps>;

const MeterOutput = <E extends keyof JSX.IntrinsicElements = "span">(props: MeterOutputProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as MeterOutputSpanProps, ["children", "class"]);
  const context = useContext(MeterContext);

  return (
    <dom.span class={composeSlotClassName(slotsOf(context)?.output, local.class)} data-slot="meter-output" {...rest}>
      {local.children ?? context.state?.valueText()}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Meter Track
 * -----------------------------------------------------------------------------------------------*/
interface MeterTrackProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `MeterTrack` props for the default element (`div`). */
type MeterTrackDivProps = MeterTrackProps & Omit<JSX.IntrinsicElements["div"], keyof MeterTrackProps>;

const MeterTrack = <E extends keyof JSX.IntrinsicElements = "div">(props: MeterTrackProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as MeterTrackDivProps, ["class"]);
  const context = useContext(MeterContext);

  return <dom.div class={composeSlotClassName(slotsOf(context)?.track, local.class)} data-slot="meter-track" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Meter Fill
 * -----------------------------------------------------------------------------------------------*/
interface MeterFillProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
  style?: JSX.IntrinsicElements["div"]["style"];
}

/** `MeterFill` props for the default element (`div`). */
type MeterFillDivProps = MeterFillProps & Omit<JSX.IntrinsicElements["div"], keyof MeterFillProps>;

const MeterFill = <E extends keyof JSX.IntrinsicElements = "div">(props: MeterFillProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as MeterFillDivProps, ["class", "style"]);
  const context = useContext(MeterContext);

  return (
    <dom.div
      class={composeSlotClassName(slotsOf(context)?.fill, local.class)}
      data-slot="meter-fill"
      style={{
        ...local.style,
        width: `${context.state?.percentage() ?? 0}%`,
      }}
      {...rest}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { MeterRoot, MeterOutput, MeterTrack, MeterFill, MeterContext };

export type { MeterRootProps, MeterOutputProps, MeterTrackProps, MeterFillProps, MeterOutputSpanProps, MeterTrackDivProps, MeterFillDivProps };
