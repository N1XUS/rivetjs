// Ported from React Aria Components (Tooltip.tsx: TooltipTrigger, Tooltip, TooltipInner,
// TooltipContext, TooltipTriggerStateContext), Apache-2.0, © Adobe.
// A tooltip displays a description of an element on hover or focus. TooltipTrigger wraps around a
// trigger element and a Tooltip (`<TooltipTrigger><Button/><Tooltip>Edit</Tooltip></TooltipTrigger>`).
// Rivet:
// - TooltipTrigger renders no element: the trigger props reach its focusable child through
//   FocusableProvider (RAC) — a cdk Button / Link, or a custom element wrapped in `<Focusable>`. The
//   provider's `ref` is the trigger element (`triggerRef`: positioning target, `aria-describedby` set while
//   open by `attachTooltip`).
// - Tooltip renders in the div overlay layer (`<Portal>`, no focus management: not modal, focus never
//   moves) while open or exiting; the presence sits in its own binding site
//   (`span[data-rv-overlay-anchor]`, `display: contents`), so a resumed page re-creates only the
//   tooltip, never the trigger. Nothing renders at SSR while closed.
// - enter / exit: `createEnterAnimation` / `createExitAnimation` (`@rivetjs/cdk/animation`), skipped
//   while moving between warm tooltips (`state.shouldSkipAnimation`); `data-entering` / `data-exiting`.
//   The exit state lives on the outer Tooltip (`createExitAnimationState`), its effect in TooltipInner
//   (`watchExitAnimation`): a closed tooltip records no client effect (a resumed page stays cold at load).
// - render props are accessors (`placement()`, `isEntering()`, `isExiting()`); `class` (RAC
//   `className`), default `rv-Tooltip`; OverlayArrow through `OverlayArrowContext`.
// - the PortalProvider container is resolved by Tooltip outside its presence (a re-created region has
//   no context above it).
// - collection build pass (`isHidden()`): children render directly.
// Deviations: no `UNSTABLE_portalContainer` (PortalProvider only); `render` (RAC DOMRenderProps) on the tooltip element: given, the attributes object (handlers included) goes to `render(attrs, TooltipRenderProps)` instead of the default `<div>`.
import { type DOMRenderProps } from "../utils/render.ts";
import { read as readAccessor, type MaybeAccessor } from "../interactions/utils.ts";
import { createContext, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content, Ref } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { Provider, contextProps, type ClassNameOrFunction, type ContextValue, type RefValue, type RenderProps, type StyleOrFunction } from "../slots/index.tsx";
import { createEnterAnimation, createExitAnimationState, watchExitAnimation, type ExitAnimationState } from "../utils/animation.tsx";
import { dataBool } from "../utils/data-attrs.tsx";
import { resumedId } from "../utils/id.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { isHidden } from "../collections/hidden.ts";
import { FocusableProvider } from "../focus/focusable.tsx";
import { OverlayArrowContext, type ArrowOffset } from "../overlay/contexts.ts";
import { Portal, PortalContext } from "../portal/index.tsx";
import { createTooltipTriggerState, type TooltipTriggerProps, type TooltipTriggerState } from "../state/tooltip.ts";
import type { OverlayTriggerProps } from "../state/overlays.ts";
import {
  attachTooltip,
  tooltipPointerEnter,
  tooltipPointerLeave,
  tooltipTriggerBlur,
  tooltipTriggerFocus,
  tooltipTriggerPointerEnter,
  tooltipTriggerPointerLeave,
  type Placement,
  type PlacementAxis,
  type TooltipPositionOptions,
  type TooltipTriggerOptions,
} from "./behaviour.tsx";
import { renderPropsOf } from "../slots/index.tsx";
import { hasLive, isLive, liveAt, liveOptions, liveView } from "../utils/live.tsx";

/** TooltipTrigger props that stay live (LIVE-SWEEP round 2: read at event time); `isOpen` is controlled. */
const TRIGGER_LIVE = ["isDisabled", "delay", "closeDelay", "trigger", "shouldCloseOnPress"] as const;

export type { Placement, PlacementAxis, TooltipTriggerState, TooltipTriggerProps };
export { createTooltipTriggerState, openTooltip, closeTooltip } from "../state/tooltip.ts";

export interface TooltipTriggerComponentProps extends TooltipTriggerProps {
  /** The trigger (a cdk Button / Link, or a custom element in `<Focusable>`) and its `<Tooltip>`. */
  children?: Content;
}

export interface TooltipRenderProps {
  /** The placement of the tooltip relative to the trigger. @selector [data-placement="left | right | top | bottom"] */
  placement: () => PlacementAxis | null;
  /** Whether the tooltip is currently entering. Use this to apply animations. @selector [data-entering] */
  isEntering: () => boolean;
  /** Whether the tooltip is currently exiting. Use this to apply animations. @selector [data-exiting] */
  isExiting: () => boolean;
  /** State of the tooltip. */
  state: TooltipTriggerState;
}

export interface TooltipProps
  extends
    TooltipPositionOptions,
    Pick<OverlayTriggerProps, "isOpen" | "defaultOpen" | "onOpenChange">,
    RenderProps<TooltipRenderProps>,
    DOMRenderProps<"div", TooltipRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The CSS class for the element. A function may be provided to compute the class based on component state. @default 'rv-Tooltip' */
  class?: ClassNameOrFunction<TooltipRenderProps>;
  /** The inline style for the element. A function may be provided to compute the style based on component state. */
  style?: StyleOrFunction<TooltipRenderProps>;
  /**
   * The ref for the element which the tooltip positions itself with respect to.
   *
   * When used within a TooltipTrigger this is set automatically. It is only required when used standalone.
   */
  triggerRef?: Ref<Element> | (() => Element | null | undefined);
  /** Whether the tooltip is currently performing an entry animation. */
  isEntering?: MaybeAccessor<boolean | undefined>;
  /** Whether the tooltip is currently performing an exit animation. */
  isExiting?: MaybeAccessor<boolean | undefined>;
  /** By default, opens for both focus and hover. Can be made to open only for focus. Live (read at event time). */
  trigger?: "hover" | "focus";
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `TooltipTriggerStateContext`: the state of the nearest TooltipTrigger. */
export const TooltipTriggerStateContext = createContext<TooltipTriggerState | null>(null);

/** RAC `TooltipContext`: props for the Tooltip inside a TooltipTrigger (`triggerRef`, the tooltip `id`). */
export const TooltipContext = createContext<ContextValue<TooltipProps, HTMLDivElement>>(null);

/**
 * TooltipTrigger wraps around a trigger element and a Tooltip. It handles opening and closing the
 * Tooltip when the user hovers over or focuses the trigger, and positioning the Tooltip relative to
 * the trigger.
 */
export function TooltipTrigger(props: TooltipTriggerComponentProps) {
  // Live props: a controlled `isOpen={open()}` stays live (accessor; `controllable` reads it, never writes it).
  const live = hasLive(props) ? liveOptions(props, TRIGGER_LIVE as never, ["isOpen"]) : props;
  const state = createTooltipTriggerState(live);
  const triggerRef = createRef<Element>();
  const tooltipId = resumedId();
  const options: TooltipTriggerOptions = { isDisabled: live.isDisabled, trigger: live.trigger, shouldCloseOnPress: live.shouldCloseOnPress };
  const children = props.children;
  return (
    <Provider
      values={[
        [TooltipTriggerStateContext, state],
        [TooltipContext, { id: tooltipId, triggerRef }],
      ]}
    >
      {() => (
        <FocusableProvider
          ref={triggerRef}
          onPointerEnter={(event: PointerEvent) => tooltipTriggerPointerEnter(event, options, state)}
          onPointerLeave={(event: PointerEvent) => tooltipTriggerPointerLeave(event, options, state)}
          onFocus={(event: FocusEvent) => tooltipTriggerFocus(event, options, state)}
          onBlur={(event: FocusEvent) => tooltipTriggerBlur(event, options, state)}
        >
          {children}
        </FocusableProvider>
      )}
    </Provider>
  );
}

/** A tooltip displays a description of an element on hover or focus. */
export function Tooltip(props: TooltipProps) {
  const element = createRef<HTMLDivElement>();
  const [merged, mergedRef] = contextProps(props as TooltipProps, element, TooltipContext);
  const p = merged as TooltipProps;
  // The user's own ref receives the element too.
  const ownRef = props.ref;
  if (ownRef)
    clientEffect(() => {
      const el = element() ?? null;
      untrack(() => {
        if (typeof ownRef === "function") {
          const signalRef = ownRef as unknown as { set?: (v: HTMLDivElement | undefined) => void };
          if (signalRef.set) signalRef.set(el ?? undefined);
          else (ownRef as (e: HTMLDivElement | null) => void)(el);
        } else ownRef.current = el;
      });
    });

  // If we are in a hidden tree, we still need to preserve our children.
  if (isHidden()) {
    const children = p.children;
    if (typeof children === "function" && !isSlot(children)) return null;
    return renderSlot(children as Content);
  }

  const contextState = useContext(TooltipTriggerStateContext);
  const state = p.isOpen != null || p.defaultOpen != null || !contextState ? createTooltipTriggerState(liveOptions(p, [], ["isOpen"])) : contextState;
  // The exit effect is attached in TooltipInner (mounted while open / exiting): a closed tooltip records no client
  // effect, so a resumed page with closed tooltips stays cold.
  const exitAnimation = createExitAnimationState(state.isOpen);
  const explicitExiting = p.isExiting;
  // Closing instantly (swapping between warm tooltips) skips the exit animation.
  const isExiting = () => !!readAccessor(explicitExiting) || (!state.shouldSkipAnimation() && exitAnimation.isExiting());
  // Resolved here (a selector / ref serializes): a re-created tooltip region has no context above it.
  const mount = useContext(PortalContext);
  const id = p.id ?? resumedId();
  return (
    <span data-rv-overlay-anchor="" style={{ display: "contents" }}>
      <Show when={() => state.isOpen() || isExiting()}>
        {() => (
          <Portal mount={mount}>
            <TooltipInner
              {...p}
              id={id}
              state={state}
              element={element}
              tooltipRef={mergedRef as Ref<HTMLDivElement>}
              isExitingNow={isExiting}
              exit={exitAnimation}
            />
          </Portal>
        )}
      </Show>
    </span>
  );
}

interface TooltipInnerProps extends TooltipProps {
  id: string;
  state: TooltipTriggerState;
  element: Ref<HTMLDivElement>;
  tooltipRef: Ref<HTMLDivElement>;
  isExitingNow: () => boolean;
  exit: ExitAnimationState;
}

/** Global DOM events the tooltip handles itself (hover keeps it open); the user's handlers run from its own. */
const OWNED = ["style", "onPointerEnter", "onPointerLeave"] as const;

function TooltipInner(props: TooltipInnerProps) {
  const { state, element, tooltipRef, isExitingNow: isExiting, exit } = props;
  watchExitAnimation(element, exit);
  const arrowRef = createRef<HTMLDivElement>();
  const placement: Signal<PlacementAxis | null> = signal<PlacementAxis | null>(null);
  const arrowOffset = signal<ArrowOffset | null>(null);
  const enterAnimation = createEnterAnimation(element, () => !!placement());
  const explicitEntering = props.isEntering;
  const isEntering = () => !!readAccessor(explicitEntering) || (!state.shouldSkipAnimation() && enterAnimation());
  const rp = renderPropsOf<TooltipRenderProps>(props, {
    defaultClassName: "rv-Tooltip",
    values: { placement, isEntering, isExiting, state },
  });
  const options = {
    triggerRef: props.triggerRef ?? null,
    arrowRef,
    placement: props.placement ?? "top",
    offset: props.offset,
    crossOffset: props.crossOffset,
    containerPadding: props.containerPadding,
    shouldFlip: props.shouldFlip,
    arrowBoundaryOffset: props.arrowBoundaryOffset,
    placement$: placement,
    arrowOffset$: arrowOffset,
  };
  clientEffect(() => {
    const el = element();
    if (!el || !state.isOpen()) return;
    // RAC: overlayProps' zIndex is overridden by the render props' style.
    return attachTooltip(el, state, { ...options, zIndex: untrack(() => rp.style()?.zIndex) != null ? null : undefined });
  });
  const hover = { trigger: isLive(props, "trigger") ? liveAt(liveView(props, ["trigger"]), "trigger") : props.trigger };
  const { onPointerEnter, onPointerLeave } = props;
  // Read up front: an element with a spread is one binding; it captures these locals, not `props`.
  const domProps = globalDOMProps(props, OWNED),
    id = props.id,
    ariaLabel = props["aria-label"],
    ariaLabelledBy = props["aria-labelledby"],
    ariaDescribedBy = props["aria-describedby"];
  if (props.render) {
    const attrs = {
      ...domProps,
      id,
      role: "tooltip",
      class: () => rp.class(),
      style: () => rp.style(),
      ref: tooltipRef,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-describedby": ariaDescribedBy,
      "data-placement": () => placement() ?? undefined,
      "data-entering": () => dataBool(isEntering()),
      "data-exiting": () => dataBool(isExiting()),
      onPointerEnter: (event: PointerEvent) => {
        tooltipPointerEnter(event as never, hover, state);
        onPointerEnter?.(event as never);
      },
      onPointerLeave: (event: PointerEvent) => {
        tooltipPointerLeave(event as never, hover, state);
        onPointerLeave?.(event as never);
      },
      children: () => <Provider values={[[OverlayArrowContext, { placement, ref: arrowRef, offset: arrowOffset }]]}>{() => () => rp.children()}</Provider>,
    };
    return props.render(attrs as never, { placement, isEntering, isExiting, state });
  }
  return (
    <div
      {...domProps}
      id={id}
      role="tooltip"
      class={rp.class()}
      style={rp.style()}
      ref={tooltipRef}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      data-placement={placement() ?? undefined}
      data-entering={dataBool(isEntering())}
      data-exiting={dataBool(isExiting())}
      onPointerEnter={(event) => {
        tooltipPointerEnter(event, hover, state);
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        tooltipPointerLeave(event, hover, state);
        onPointerLeave?.(event);
      }}
    >
      <Provider values={[[OverlayArrowContext, { placement, ref: arrowRef, offset: arrowOffset }]]}>{() => () => rp.children()}</Provider>
    </div>
  );
}
