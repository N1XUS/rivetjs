// Ported from HeroUI v3.2.6 packages/react/src/components/progress-bar/progress-bar.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; React types → Rivet JSX types; `react-aria-components/ProgressBar` →
//   `@rivetjs/cdk/progress-bar`; `@heroui/styles` → vendored `styles/`.
// - `ProgressBarContext` carries `{ color, size, state }` instead of `{ slots, state }`: a resumable token (`rv-ui-progress-bar`,
//   same `{}` default); `color` / `size` are getters over the live props, `state` = the cdk render props, which are accessors
//   (`state.percentage()`, `state.valueText()`, `state.isIndeterminate()`), not snapshot values. Parts look the slots up in a
//   module-level memo (`slotsFor`, key `${color}|${size}`), `undefined` outside a `ProgressBar` (= upstream `slots?.x`).
// - Live props: `value` / `minValue` / `maxValue` / `valueLabel` / `isIndeterminate` reach cdk as live getters (cdk keeps
//   them live), `class` / `color` / `size` make the cdk `class` a
//   render-prop function (`renderClass`); the fill width and the output text are bindings over `state`, so a value change updates
//   them in place (no re-created nodes).
// - Function children: `typeof children === "function"` → `!isSlot(children)` (Rivet JSX children are compiler slots).
// - `Output`: `children ?? state?.valueText` → the default text only when no children are given (Rivet children are slots; see
//   `../../../CLAUDE.md` Known diffs for `children ??`).
// - Bodies cast `props` to the default-element shape before splitting (upstream casts `props as any`).
import type { ProgressBarProps as ProgressBarPrimitiveProps, ProgressBarRenderProps } from "@rivetjs/cdk/progress-bar";
import { ProgressBar as ProgressBarPrimitive } from "@rivetjs/cdk/progress-bar";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";

import type { ProgressBarVariants } from "../../../styles/src/components/progress-bar/index.ts";
import { progressBarVariants } from "../../../styles/src/components/progress-bar/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * ProgressBar Context
 * -----------------------------------------------------------------------------------------------*/
interface ProgressBarContext {
  color?: ProgressBarVariants["color"];
  size?: ProgressBarVariants["size"];
  /** The cdk render props (accessors); set inside a `ProgressBar`. */
  state?: ProgressBarRenderProps;
}

const ProgressBarContext = createContext<ProgressBarContext>({});

type ProgressBarSlots = ReturnType<typeof progressBarVariants>;

/** Module-level memo per `color|size` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, ProgressBarSlots> = {};
const slotsFor = (color: ProgressBarVariants["color"], size: ProgressBarVariants["size"]): ProgressBarSlots =>
  (SLOTS[`${color}|${size}`] ??= progressBarVariants({ color, size }));

/** Upstream `use(ProgressBarContext).slots`: `undefined` outside a `ProgressBar`. Read inside the part's bindings. */
const slotsOf = (context: ProgressBarContext): ProgressBarSlots | undefined =>
  context.state === undefined ? undefined : slotsFor(context.color, context.size);

/* -------------------------------------------------------------------------------------------------
 * ProgressBar Root
 * -----------------------------------------------------------------------------------------------*/
interface ProgressBarRootProps extends ProgressBarPrimitiveProps, ProgressBarVariants {}

const STYLE_PROPS = ["class", "color", "size"] as const;
const OWN_PROPS = ["children", ...STYLE_PROPS, "value", "minValue", "maxValue", "valueLabel", "isIndeterminate"] as const;

const ProgressBarRoot = (props: ProgressBarRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, OWN_PROPS);
  // A body const, not inline in the JSX: the compiler registers a const initializer holding a function as a resumable symbol
  // (re-evaluated on resume with its captures); a call inside the JSX getter would hand cdk an unregistered closure.
  const classOf = (): string | ((values: never) => string) => composeTwRenderProps(local.class, slotsFor(local.color, local.size).base());
  const cls = hasLiveProp(local, STYLE_PROPS) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  return (
    <ProgressBarPrimitive
      data-slot="progress-bar"
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
          <Provider token={ProgressBarContext} value={context}>
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
 * ProgressBar Output
 * -----------------------------------------------------------------------------------------------*/
interface ProgressBarOutputProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `ProgressBarOutput` props for the default element (`span`). */
type ProgressBarOutputSpanProps = ProgressBarOutputProps & Omit<JSX.IntrinsicElements["span"], keyof ProgressBarOutputProps>;

const ProgressBarOutput = <E extends keyof JSX.IntrinsicElements = "span">(props: ProgressBarOutputProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ProgressBarOutputSpanProps, ["children", "class"]);
  const context = useContext(ProgressBarContext);

  return (
    <dom.span class={composeSlotClassName(slotsOf(context)?.output, local.class)} data-slot="progress-bar-output" {...rest}>
      {local.children ?? context.state?.valueText()}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ProgressBar Track
 * -----------------------------------------------------------------------------------------------*/
interface ProgressBarTrackProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `ProgressBarTrack` props for the default element (`div`). */
type ProgressBarTrackDivProps = ProgressBarTrackProps & Omit<JSX.IntrinsicElements["div"], keyof ProgressBarTrackProps>;

const ProgressBarTrack = <E extends keyof JSX.IntrinsicElements = "div">(props: ProgressBarTrackProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ProgressBarTrackDivProps, ["class"]);
  const context = useContext(ProgressBarContext);

  return <dom.div class={composeSlotClassName(slotsOf(context)?.track, local.class)} data-slot="progress-bar-track" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * ProgressBar Fill
 * -----------------------------------------------------------------------------------------------*/
interface ProgressBarFillProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
  style?: JSX.IntrinsicElements["div"]["style"];
}

/** `ProgressBarFill` props for the default element (`div`). */
type ProgressBarFillDivProps = ProgressBarFillProps & Omit<JSX.IntrinsicElements["div"], keyof ProgressBarFillProps>;

const ProgressBarFill = <E extends keyof JSX.IntrinsicElements = "div">(props: ProgressBarFillProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ProgressBarFillDivProps, ["class", "style"]);
  const context = useContext(ProgressBarContext);

  return (
    <dom.div
      class={composeSlotClassName(slotsOf(context)?.fill, local.class)}
      data-slot="progress-bar-fill"
      style={{
        ...local.style,
        width: context.state?.isIndeterminate() ? undefined : `${context.state?.percentage() ?? 0}%`,
      }}
      {...rest}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ProgressBarRoot, ProgressBarOutput, ProgressBarTrack, ProgressBarFill, ProgressBarContext };

export type {
  ProgressBarRootProps,
  ProgressBarOutputProps,
  ProgressBarTrackProps,
  ProgressBarFillProps,
  ProgressBarOutputSpanProps,
  ProgressBarTrackDivProps,
  ProgressBarFillDivProps,
};
