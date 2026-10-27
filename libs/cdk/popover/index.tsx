// Ported from React Aria Components (Popover.tsx), Apache-2.0, © Adobe.
// A popover is an overlay element positioned relative to a trigger. Trigger components (DialogTrigger,
// MenuTrigger, Select, ComboBox, DatePicker, PreviewTrigger, SubmenuTrigger) feed it through
// `PopoverContext` (`trigger` name, `triggerRef`, placement, …) and `OverlayTriggerStateContext`;
// standalone it takes `triggerRef` + `isOpen` / `defaultOpen` / `onOpenChange`.
// Rivet:
// - renders in the div overlay layer (`<Overlay>`: portal + focus scope) while open or exiting; the
//   presence sits in its own binding site (`span[data-rv-overlay-anchor]`, `display: contents`), so on a
//   resumed page the first open re-creates only the popover, never the trigger.
// - usePopover (`popoverProps`, ./use-popover.ts) runs from a client effect while open (released on
//   close / unmount); positioning writes styles through CSSOM, `data-placement` on popover + arrow.
// - enter / exit: `createEnterAnimation` / `createExitAnimation` (`@rivetjs/cdk/animation`), state on
//   `data-entering` / `data-exiting` (`"true"`); render props are accessors (`placement()`, `isEntering()`).
// - `class` (RAC `className`), default `rv-Popover`; `ref` is a Rivet ref.
// - RAC's role detection runs in a client effect: role=dialog (and the id) once the element is mounted,
//   unless a `[role=dialog]` is nested; the server renders RAC's initial state (dialog only for
//   PreviewTrigger).
// - collection build pass (`isHidden()`): children render directly (RAC `useIsHidden`).
// Deviations: no `UNSTABLE_portalContainer` (PortalProvider only, decision 12); `render` (RAC DOMRenderProps) replaces the popover `<div>` (the underlay, `data-rv-overlay` marker and the JS-set stacking stay); no
//   `runAfterKeyboard` defer of the reveal (the virtual keyboard tracker is lazy-loaded); focus
//   containment is decided once when the popover renders (`!isNonModal || SubmenuTrigger`, never for
//   PreviewTrigger) — RAC also contains when a nested Dialog calls `useOverlayFocusContain` inside a
//   non-modal popover.
import { read as readAccessor, type MaybeAccessor } from "../interactions/utils.ts";
import { createContext, effect, signal, untrack, useContext, type Context, type Signal } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content, Ref } from "@rivetjs/runtime/jsx-runtime";
import {
  Provider,
  contextProps,
  slottedContext,
  type ClassNameOrFunction,
  type RenderProps,
  type RefValue,
  type SlotProps,
  type StyleObject,
  type StyleOrFunction,
} from "../slots/index.tsx";
import { createEnterAnimation, createExitAnimationState, watchExitAnimation, type ExitAnimationState } from "../utils/animation.tsx";
import { dataBool } from "../utils/data-attrs.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import type { AriaLabelingProps } from "../utils/types.ts";
import { isFocusWithin } from "../utils/dom-core.ts";
import { focusSafely } from "../focus/index.ts";
import { getInteractionModality } from "../interactions/focus-visible.tsx";
import { useLocale } from "../i18n/index.ts";
import { isHidden } from "../collections/hidden.ts";
import { slotProbing } from "#server";
import { DismissButton } from "../overlay/dismiss-button.tsx";
import { OverlayArrowContext, OverlayTriggerStateContext, PopoverContext, type ArrowOffset, type PopoverContextValue } from "../overlay/contexts.ts";
import type { Placement, PlacementAxis, PositionProps } from "../overlay/position.ts";
import { Overlay } from "../portal/index.tsx";
import { closeOverlay, createOverlayTriggerState, type OverlayTriggerProps, type OverlayTriggerState } from "../state/overlays.ts";
import { popoverProps, type AriaPopoverProps } from "./use-popover.ts";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { renderPropsOf } from "../slots/index.tsx";
import { liveOptions } from "../utils/live.tsx";

export type { Placement, PlacementAxis, OverlayTriggerState, PopoverContextValue };
export { PopoverContext, OverlayTriggerStateContext };

export interface PopoverRenderProps {
  /** The name of the component that triggered the popover, e.g. "DialogTrigger" or "ComboBox". @selector [data-trigger="..."] */
  trigger: string | null;
  /** The placement of the popover relative to the trigger. @selector [data-placement="left | right | top | bottom"] */
  placement: () => PlacementAxis | null;
  /** Whether the popover is currently entering. Use this to apply animations. @selector [data-entering] */
  isEntering: () => boolean;
  /** Whether the popover is currently exiting. Use this to apply animations. @selector [data-exiting] */
  isExiting: () => boolean;
}

export interface PopoverProps
  extends
    Omit<PositionProps, "isOpen">,
    Omit<AriaPopoverProps, "popoverRef" | "triggerRef" | "groupRef" | "arrowRef" | "offset" | "arrowSize" | "trigger" | "target" | "overlay">,
    OverlayTriggerProps,
    RenderProps<PopoverRenderProps>,
    DOMRenderProps<"div", PopoverRenderProps>,
    SlotProps,
    AriaLabelingProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The CSS class for the element. A function may be provided to compute the class based on component state. @default 'rv-Popover' */
  class?: ClassNameOrFunction<PopoverRenderProps>;
  /** The inline style for the element. A function may be provided to compute the style based on component state. */
  style?: StyleOrFunction<PopoverRenderProps>;
  /**
   * The name of the component that triggered the popover. This is reflected on the element as the
   * `data-trigger` attribute, and can be used to provide specific styles for the popover depending on
   * which element triggered it.
   */
  trigger?: string;
  /**
   * The ref for the element which the popover positions itself with respect to.
   *
   * When used within a trigger component such as DialogTrigger, MenuTrigger, Select, etc., this is set
   * automatically. It is only required when used standalone.
   */
  triggerRef?: Ref<Element> | (() => Element | null | undefined);
  /** Whether the popover is currently performing an entry animation. */
  isEntering?: MaybeAccessor<boolean | undefined>;
  /** Whether the popover is currently performing an exit animation. */
  isExiting?: MaybeAccessor<boolean | undefined>;
  /**
   * Whether the popover should appear and disappear without an entry or exit animation. This is used by
   * components such as PreviewTrigger to skip animations when quickly swapping between overlays.
   */
  shouldSkipAnimation?: boolean | (() => boolean);
  /** The additional offset applied along the main axis between the element and its anchor element. @default 8 */
  offset?: number;
  /** The element's unique identifier (set while the popover is a dialog). */
  id?: string;
  ref?: RefValue<HTMLElement>;
}

/** Stores a ref for the portal container for a group of popovers (e.g. submenus). */
const PopoverGroupContext = createContext<Ref<HTMLDivElement> | null>(null);

const readBool = (value: boolean | (() => boolean) | undefined): boolean => (typeof value === "function" ? value() : !!value);
/** Context values may be accessors (e.g. DialogTrigger's `aria-labelledby`): read inside the binding. */
const readValue = <T,>(value: T | (() => T)): T => (typeof value === "function" ? (value as () => T)() : value);

/** A popover is an overlay element positioned relative to a trigger. */
export function Popover(props: PopoverProps) {
  // The trigger's ref (PopoverContext `ref`, e.g. ComboBox's popoverRef) is the element ref itself when it is a Rivet
  // ref: RA mergeRefs assigns it at commit, before any child effect; a merged copy (`mergeRefValues`) would wait for
  // a client effect — on a resumed page until idle — and a popover opened by a cold press would see it unset (ComboBox:
  // the listbox's first virtual focus blurred the input "outside" the popover and closed it).
  const contextRef = (slottedContext(PopoverContext, props.slot) as { ref?: unknown } | null | undefined)?.ref;
  // A Rivet `ref()` (browser: a signal; server render: a `rivet.ref` cell function) — not a callback / `{ current }` ref.
  const isRivetRef =
    typeof contextRef === "function" && (typeof (contextRef as { set?: unknown }).set === "function" || Symbol.for("rivet.ref") in (contextRef as object));
  const element = isRivetRef ? (contextRef as Ref<HTMLElement>) : createRef<HTMLElement>();
  // RA mergeIds: a user id replaces the trigger's generated id, so the trigger's ARIA follows it.
  const rawContext = useContext(PopoverContext) as PopoverContextValue | null;
  if (rawContext?.idRef && props.id) rawContext.idRef.set(props.id);
  const [merged, mergedRef] = contextProps(props as PopoverProps & PopoverContextValue, element, PopoverContext);
  const p = merged as PopoverProps & PopoverContextValue;
  // The user's own ref receives the element too.
  const ownRef = props.ref;
  if (ownRef)
    clientEffect(() => {
      const el = element() ?? null;
      untrack(() => {
        if (typeof ownRef === "function") {
          const signalRef = ownRef as unknown as { set?: (v: HTMLElement | undefined) => void };
          if (signalRef.set) signalRef.set(el ?? undefined);
          else (ownRef as (e: HTMLElement | null) => void)(el);
        } else ownRef.current = el;
      });
    });

  // If we are in a hidden tree, we still need to preserve our children.
  if (isHidden()) {
    // A field's server slot probe stops here: the popover's contexts are cleared in the real render (`probeSlots`).
    if (slotProbing) return null;
    const children = p.children;
    if (typeof children === "function" && !isSlot(children))
      return (children as (v: PopoverRenderProps & { defaultChildren: Content | undefined }) => Content)({
        trigger: p.trigger || null,
        placement: () => "bottom",
        isEntering: () => false,
        isExiting: () => false,
        defaultChildren: null,
      });
    return renderSlot(children as Content);
  }

  const contextState = useContext(OverlayTriggerStateContext);
  const state = p.isOpen != null || p.defaultOpen != null || !contextState ? createOverlayTriggerState(liveOptions(p, [], ["isOpen"])) : contextState;
  // Skip the automatic exit animation when closing instantly (e.g. swapping between previews during
  // warmup). An explicitly provided isExiting prop still takes precedence.
  // State here, its effect inside the branch (`watchExitAnimation` in PopoverInner): a closed popover records no
  // client effect, so a resumed page with a closed Select / popover does not boot the runtime at load (tooltip: same).
  const exit = createExitAnimationState(state.isOpen);
  const explicitExiting = p.isExiting,
    skip = p.shouldSkipAnimation;
  const isExiting = () => !!readAccessor(explicitExiting) || (!readBool(skip) && exit.isExiting());
  const { direction } = useLocale();
  const popoverRef = mergedRef as Ref<HTMLElement>;
  return (
    <span data-rv-overlay-anchor="" style={{ display: "contents" }}>
      <Show when={() => state.isOpen() || isExiting()}>
        {() => <PopoverInner {...p} state={state} popoverRef={popoverRef} element={element} isExitingNow={isExiting} exit={exit} dir={direction} />}
      </Show>
    </span>
  );
}

interface PopoverInnerProps extends PopoverProps, PopoverContextValue {
  state: OverlayTriggerState;
  popoverRef: Ref<HTMLElement>;
  element: Ref<HTMLElement>;
  isExitingNow: () => boolean;
  exit: ExitAnimationState;
  dir?: "ltr" | "rtl";
}

/** Global DOM props the popover sets itself. */
const OWNED = ["style"] as const;

function PopoverInner(props: PopoverInnerProps) {
  const { state, popoverRef, element, isExitingNow: isExiting, exit } = props;
  // Out of flow from creation (RA: `useOverlayPosition`'s style is `position: absolute` from the first render, before a
  // position exists). Unpositioned, the popover was a static block: in its in-place host it pushed the trigger's
  // siblings down, then the portal move inserted it in flow into the overlay layer — a `PortalProvider` container above
  // the viewport (ui-docs home `#home-overlays`) grew by the popover's height and scroll anchoring scrolled the page by
  // it on every open (UI-BUGS 2026-10-27). First effect of the instance: before the self-focus and the move. A user
  // `style.position` (already bound) wins; positioning writes `absolute` again.
  clientEffect(() => {
    const el = element();
    if (el && !el.style.position) el.style.position = "absolute";
  });
  watchExitAnimation(element, exit);
  const arrowRef = createRef<HTMLDivElement>();
  const containerRef = createRef<HTMLDivElement>();
  const groupCtx = useContext(PopoverGroupContext);
  const trigger = props.trigger;
  const isSubPopover = !!groupCtx && trigger === "SubmenuTrigger";
  const isNonModal = !!props.isNonModal;

  const placement: Signal<PlacementAxis | null> = signal<PlacementAxis | null>(null);
  const arrowOffset = signal<ArrowOffset | null>(null);
  const isOpen = signal(false);
  // Skip the automatic entry animation when opening instantly (e.g. swapping between previews during
  // warmup). An explicitly provided isEntering prop still takes precedence.
  const enterAnimation = createEnterAnimation(element, () => !!placement() && isOpen());
  const explicitEntering = props.isEntering,
    skip = props.shouldSkipAnimation;
  const isEntering = () => !!readAccessor(explicitEntering) || (!readBool(skip) && enterAnimation());
  const rp = renderPropsOf<PopoverRenderProps>(props, {
    defaultClassName: "rv-Popover",
    values: { trigger: trigger || null, placement, isEntering, isExiting },
  });

  // Automatically render Popover with role=dialog except when isNonModal is true,
  // or a dialog is already nested inside the popover.
  const shouldBeDialog = !isNonModal || trigger === "SubmenuTrigger" || trigger === "PreviewTrigger";
  const isDialog = signal(trigger === "PreviewTrigger");

  // usePopover while open (released on close / unmount).
  const options = {
    triggerRef: props.triggerRef ?? null,
    popoverRef: element,
    arrowRef,
    arrowStyle: false,
    // If this is a submenu/subdialog, use the root popover's container to detect outside interaction and add aria-hidden.
    groupRef: isSubPopover ? groupCtx : containerRef,
    placement: props.placement ?? "bottom",
    offset: props.offset ?? 8,
    crossOffset: props.crossOffset,
    containerPadding: props.containerPadding,
    shouldFlip: props.shouldFlip,
    maxHeight: props.maxHeight,
    arrowBoundaryOffset: props.arrowBoundaryOffset,
    boundaryElement: props.boundaryElement,
    scroll: props.scroll,
    shouldUpdatePosition: props.shouldUpdatePosition,
    getTargetRect: props.getTargetRect,
    isNonModal,
    isKeyboardDismissDisabled: props.isKeyboardDismissDisabled,
    shouldCloseOnInteractOutside: props.shouldCloseOnInteractOutside,
    onFocusWithin: props.onFocusWithin,
    onBlurWithin: props.onBlurWithin,
    onFocusWithinChange: props.onFocusWithinChange,
    trigger,
  };
  // Positioned once the Overlay's portal has moved the popover into the overlay layer (`onPlaced`): before that its
  // host sits in place (a flex item next to the trigger: a gap shifts the trigger), the first position was off by
  // that shift and the ResizeObserver re-positioned it inside its own callback ("ResizeObserver loop completed with
  // undelivered notifications"). RA positions in a layout effect, after the portal rendered.
  const placed = signal(false);
  const triggerSource = options.triggerRef;
  clientEffect(() => {
    const el = element();
    if (!el || !state.isOpen() || !placed()) return;
    // RA positions in a layout effect once the trigger and the overlay both exist, in either order. On a resumed
    // page the trigger's ref can bind after the popover opened (a cold press before the ref's client binding ran):
    // track it, so the popover positions when it arrives instead of staying unpositioned.
    if (typeof triggerSource === "function") triggerSource();
    return untrack(() => {
      // RAC: overlayProps' zIndex is overridden by the render props' style.
      const aria = popoverProps(rp.style()?.zIndex != null ? { ...options, zIndex: null } : options, state);
      const stop = effect(() => {
        placement.set(aria.placement());
        const result = aria.position();
        arrowOffset.set(result ? { left: result.arrowOffsetLeft, top: result.arrowOffsetTop } : null);
      });
      return () => {
        stop();
        aria.dispose();
      };
    });
  });
  // Since our trigger may open the OSK, RAC defers the reveal as a courtesy (here: right after mount).
  clientEffect(() => {
    if (element()) untrack(() => isOpen.set(true));
  });
  // Role detection, then focus the popover itself on mount, unless a child element is already focused.
  // Skip this for submenus since hovering a submenutrigger should keep focus on the trigger.
  clientEffect(() => {
    const el = element();
    if (!el) return;
    untrack(() => {
      const dialog = shouldBeDialog && !el.querySelector("[role=dialog]");
      isDialog.set(dialog);
      if (dialog && trigger !== "PreviewTrigger" && (trigger !== "SubmenuTrigger" || getInteractionModality() !== "pointer") && !isFocusWithin(el)) {
        // On a resumed page the `tabIndex` binding flushes after this effect: a div without tabindex is
        // not focusable, so write it now (the binding writes the same value).
        if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
        focusSafely(el);
      }
    });
  });

  // Read up front: an element with a spread is one binding, and it must not capture `props`.
  const domProps = globalDOMProps(props, OWNED),
    id = props.id,
    ariaLabel = props["aria-label"],
    ariaLabelledBy = props["aria-labelledby"],
    slot = props.slot || undefined,
    dir = props.dir;
  // RAC: the trigger's contexts (Label, Button, Input, … of a ComboBox) do not leak into the popover.
  const clearContexts = (props.clearContexts ?? []) as readonly Context<unknown>[];
  const children = () => (
    <Provider
      values={[
        [OverlayArrowContext, { placement, ref: arrowRef, offset: arrowOffset }],
        [PopoverContext, null],
        ...clearContexts.map((context): [Context<unknown>, null] => [context, null]),
      ]}
    >
      {() => () => rp.children()}
    </Provider>
  );
  const overlay = () => {
    if (props.render) {
      const attrs = {
        ...domProps,
        class: () => rp.class(),
        style: () => rp.style(),
        id: () => (isDialog() ? id : undefined),
        role: () => (isDialog() ? "dialog" : undefined),
        tabindex: () => (isDialog() ? -1 : undefined),
        "aria-label": () => readValue(ariaLabel),
        "aria-labelledby": () => readValue(ariaLabelledBy),
        ref: popoverRef,
        slot,
        dir,
        "data-trigger": trigger,
        "data-placement": () => placement() ?? undefined,
        "data-entering": () => dataBool(isEntering()),
        "data-exiting": () => dataBool(isExiting()),
        "data-rv-overlay": "",
        children: () => [
          !isNonModal ? <DismissButton onDismiss={() => closeOverlay(state)} /> : null,
          children(),
          <DismissButton onDismiss={() => closeOverlay(state)} />,
        ],
      };
      return props.render(attrs as never, { trigger: trigger || null, placement, isEntering, isExiting });
    }
    return (
      <div
        {...domProps}
        class={rp.class()}
        style={rp.style()}
        id={isDialog() ? id : undefined}
        role={isDialog() ? "dialog" : undefined}
        tabIndex={isDialog() ? -1 : undefined}
        aria-label={readValue(ariaLabel)}
        aria-labelledby={readValue(ariaLabelledBy)}
        ref={popoverRef}
        slot={slot}
        dir={dir}
        data-trigger={trigger}
        data-placement={placement() ?? undefined}
        data-entering={dataBool(isEntering())}
        data-exiting={dataBool(isExiting())}
        data-rv-overlay=""
      >
        {!isNonModal ? <DismissButton onDismiss={() => closeOverlay(state)} /> : null}
        {children()}
        <DismissButton onDismiss={() => closeOverlay(state)} />
      </div>
    );
  };
  const shouldContainFocus = shouldBeDialog && trigger !== "PreviewTrigger";

  // Submenus/subdialogs are mounted into the root popover's container.
  if (isSubPopover)
    return (
      <Overlay shouldContainFocus={shouldContainFocus} portalContainer={groupCtx ?? undefined} onPlaced={() => placed.set(true)}>
        {overlay()}
      </Overlay>
    );

  // A root popover renders an extra div to act as the portal container for submenus/subdialogs.
  return (
    <Overlay shouldContainFocus={shouldContainFocus} onPlaced={() => placed.set(true)}>
      {/* Own binding: reading `state.isOpen()` directly in the slot re-creates the whole overlay content on close (exit animation). */}
      {() =>
        !isNonModal && state.isOpen() ? (
          <div
            data-testid="underlay"
            data-rv-underlay=""
            onPointerDown={(event) => event.target === event.currentTarget && event.preventDefault()}
            style={{ position: "fixed", inset: "0" }}
          />
        ) : null
      }
      <div ref={containerRef} style={{ display: "contents" }}>
        <Provider values={[[PopoverGroupContext, containerRef]]}>{() => overlay()}</Provider>
      </div>
    </Overlay>
  );
}

export type { StyleObject };
export * from "./use-popover.ts";
