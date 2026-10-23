// Ported from HeroUI v3.2.6 packages/react/src/components/tooltip/tooltip.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/Tooltip` → `@rivetjs/cdk/tooltip` (div overlay layer),
//   `useFocusable` → cdk `focusableProps` (reads the `FocusableContext` the cdk `TooltipTrigger` provides), `@heroui/styles` →
//   vendored `styles/`.
// - `TooltipContext` carries plain data `{ inTooltip: true }` instead of the tv `slots` (`tooltipVariants` has no variants: one
//   module-level slots object); resumable token `rv-ui-tooltip`, default `{}` → parts outside a `Tooltip` get only their `class`.
// - `delay` / `closeDelay` fall back to `--tooltip-delay` / `--tooltip-close-delay` through `useCSSVariable` (client-created
//   tooltips only: the server and a resumed page keep the cdk defaults 1500 / 500 ms, = the vendored theme values).
// - `TooltipAnimationScope`: re-provides the cdk `TooltipTriggerStateContext` with a `shouldSkipAnimation` signal that stays
//   `false` (upstream: `{ ...state, shouldSkipAnimation: false }`; cdk state fields are signals).
// - `Tooltip.Arrow`: upstream's default inline `<svg><path d=…/></svg>` → a CSS-shaped tip (`span`, `clip-path`, `background:
//   var(--overlay)`; icon rule: no hand-written SVG geometry) with the same `data-slot="overlay-arrow"` (vendored rotate rules
//   apply; the `stroke-border/40` outline has no CSS equivalent on the span). Custom children are not cloned: give them
//   `data-slot="overlay-arrow"` yourself.
// - Live `class` → a render-prop function for the cdk part (the composed class is a local: it reaches the cdk part as a plain value).
import { mergeProps } from "@rivetjs/cdk/interactions/merge-props";
import { focusableProps } from "@rivetjs/cdk/focusable";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import type { OverlayArrowProps } from "@rivetjs/cdk/overlay-arrow";
import { Tooltip as TooltipPrimitive, TooltipTrigger as TooltipTriggerPrimitive, TooltipTriggerStateContext } from "@rivetjs/cdk/tooltip";
import type { TooltipProps as TooltipPrimitiveProps, TooltipRenderProps, TooltipTriggerComponentProps } from "@rivetjs/cdk/tooltip";
import { createContext, signal, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";

import type { TooltipVariants } from "../../../styles/src/components/tooltip/index.ts";
import { tooltipVariants } from "../../../styles/src/components/tooltip/index.ts";
import { useCSSVariable } from "../../hooks/use-css-variable.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { parseCSSTime } from "../../utils/css.ts";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { portalTheme } from "../../utils/portal-theme.ts";

/* -------------------------------------------------------------------------------------------------
 * Tooltip Context
 * -----------------------------------------------------------------------------------------------*/
type TooltipContext = {
  /** Rivet: set by `Tooltip` (upstream: `slots`). */
  inTooltip?: boolean;
};

const TooltipContext = createContext<TooltipContext>({});

type TooltipSlots = ReturnType<typeof tooltipVariants>;
let SLOTS: TooltipSlots | undefined;
/** Upstream `use(TooltipContext).slots`: `tooltipVariants()` inside a `Tooltip`, `undefined` outside. */
const slotsOf = (context: TooltipContext): TooltipSlots | undefined => (context.inTooltip ? (SLOTS ??= tooltipVariants()) : undefined);

const ROOT_CONTEXT: TooltipContext = { inTooltip: true };

/* -------------------------------------------------------------------------------------------------
 * Tooltip Animation Scope
 * -----------------------------------------------------------------------------------------------*/
type TooltipAnimationScopeProps = {
  children: Content;
  shouldSkipAnimation?: boolean;
};

// React Aria sets `shouldSkipAnimation` while its global warmup timer is active, which makes
// `Tooltip` drop `data-entering` / `data-exiting` when one tooltip replaces another. HeroUI drives
// both phases from CSS keyframes, so the flag is cleared for descendants to keep the fade on swap.
const TooltipAnimationScope = (props: TooltipAnimationScopeProps): JSX.Element => {
  const state = useContext(TooltipTriggerStateContext);
  const children = props.children;

  if (!state || props.shouldSkipAnimation) return renderSlot(children) as JSX.Element;

  const scoped = { ...state, shouldSkipAnimation: signal(false) };
  return (
    <Provider token={TooltipTriggerStateContext} value={scoped}>
      {children}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Tooltip Root
 * -----------------------------------------------------------------------------------------------*/
type TooltipRootProps = TooltipTriggerComponentProps & {
  /**
   * Whether to let React Aria skip the enter and exit animations while its global warmup timer is
   * active, i.e. when moving quickly from one tooltip to another.
   *
   * @default false
   */
  shouldSkipAnimation?: boolean;
};

const TooltipRoot = (props: TooltipRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "closeDelay", "delay", "shouldSkipAnimation"]);

  const cssDelay = useCSSVariable("--tooltip-delay");
  const cssCloseDelay = useCSSVariable("--tooltip-close-delay");

  const resolvedDelay = local.delay ?? parseCSSTime(cssDelay);
  const resolvedCloseDelay = local.closeDelay ?? parseCSSTime(cssCloseDelay);
  const shouldSkipAnimation = local.shouldSkipAnimation ?? false;
  const children = local.children;

  // A function: Rivet JSX builds nodes eagerly, the trigger must be created inside the provider.
  const content = () => (
    <TooltipTriggerPrimitive closeDelay={resolvedCloseDelay} data-slot="tooltip-root" delay={resolvedDelay} {...rest}>
      <TooltipAnimationScope shouldSkipAnimation={shouldSkipAnimation}>{children}</TooltipAnimationScope>
    </TooltipTriggerPrimitive>
  );

  return (
    <Provider token={TooltipContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Tooltip Content
 * -----------------------------------------------------------------------------------------------*/
interface TooltipContentProps extends Omit<TooltipPrimitiveProps, "children">, TooltipVariants {
  showArrow?: boolean;
  children: Content;
}

const TooltipContent = (props: TooltipContentProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "offset", "showArrow"]);
  const context = useContext(TooltipContext);
  const offset = local.offset ? local.offset : (local.showArrow ?? false) ? 7 : 3;
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.base()) as string | ((v: TooltipRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: TooltipRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <TooltipPrimitive {...rest} class={cls as never} offset={offset}>
      {local.children}
    </TooltipPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Tooltip Arrow
 * -----------------------------------------------------------------------------------------------*/
type TooltipArrowProps = Omit<OverlayArrowProps, "children"> & {
  children?: Content;
};

/** The default tip: 12×12 box, triangle in the upper 8px (upstream svg viewBox), filled with the overlay colour. */
const ARROW_STYLE = {
  display: "block",
  width: "12px",
  height: "12px",
  background: "var(--overlay)",
  "clip-path": "polygon(0 0, 100% 0, 50% 66.667%)",
};

const TooltipArrow = (props: TooltipArrowProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const arrow = () => (local.children !== undefined ? local.children : <span aria-hidden="true" data-slot="overlay-arrow" style={ARROW_STYLE} />);

  return (
    <OverlayArrow data-slot="tooltip-arrow" {...rest} class={local.class}>
      {arrow()}
    </OverlayArrow>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Tooltip Trigger
 * -----------------------------------------------------------------------------------------------*/
interface TooltipTriggerProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `TooltipTrigger` props for the default element (`div`). */
type TooltipTriggerDivProps = TooltipTriggerProps & Omit<JSX.IntrinsicElements["div"], keyof TooltipTriggerProps>;

const TooltipTrigger = <E extends keyof JSX.IntrinsicElements = "div">(props: TooltipTriggerProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as TooltipTriggerDivProps, ["children", "class"]);
  const context = useContext(TooltipContext);
  // Use `focusableProps` directly rather than the `<Focusable>` wrapper component (upstream: `useFocusable` instead of
  // `<Focusable>`): both consume the FocusableContext of the cdk TooltipTrigger (trigger handlers + triggerRef); the wrapper
  // runs a dev-only focusable check that warns falsely inside an inert subtree (behind an open Drawer / Modal).
  // No own ref: `ref` is then the context's trigger ref itself (cdk `mergeRefValues`), a Rivet ref that resumes.
  const focusable = focusableProps({});
  const merged = mergeProps(focusable, rest as Record<string, unknown>);
  const cls = () => composeSlotClassName(slotsOf(context)?.trigger, local.class);

  if (merged.render)
    return (
      <dom.div class={cls()} data-slot="tooltip-trigger" role="button" {...merged}>
        {local.children}
      </dom.div>
    );

  // A plain element with an explicit `ref` (a `ref` inside a `dom.*` spread is not resumed: the trigger ref positions the
  // tooltip and receives `aria-describedby` on a resumed page).
  return (
    <div class={cls()} data-slot="tooltip-trigger" role="button" {...(merged as JSX.IntrinsicElements["div"])} ref={merged.ref as never}>
      {local.children}
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { TooltipRoot, TooltipTrigger, TooltipContent, TooltipArrow };

export type { TooltipRootProps, TooltipArrowProps, TooltipContentProps, TooltipTriggerProps, TooltipTriggerDivProps };
