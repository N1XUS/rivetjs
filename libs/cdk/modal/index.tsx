// Ported from packages/react-aria-components/src/Modal.tsx (ModalOverlay, Modal, ModalContext), Apache-2.0, © Adobe.
// RAC DOM: `<ModalOverlay>` = the underlay `div.rv-ModalOverlay` in the overlay layer (`<Overlay>`:
// a portal with a focus scope), `<Modal>` = the modal `div.rv-Modal` inside it, the `<Dialog>`
// (`../dialog`) inside that. A `<Modal>` without a `<ModalOverlay>` wraps itself in one.
// Rivet:
// - presence: a `<Show>` while `state.isOpen() || isExiting()` (RAC returns null), wrapped in an own
//   binding site (`span[data-rv-overlay-anchor]`, `display: contents`, rendered in place): on a resumed
//   page the first open / close re-creates only the overlay, from serializable locals (context values
//   are resolved in the outer component and passed down as props).
// - enter / exit: `../utils/animation.tsx` (RA useEnterAnimation / useExitAnimation) → `data-entering` /
//   `data-exiting="true"`; `onEnter` / `onExit` promises; `isEntering` / `isExiting` props accept an
//   accessor too (a Signal: the component runs once, RAC re-renders).
// - useModalOverlay → `modalOverlay(modalElement, props, state)` from a client effect while open
//   (Escape, outside interaction, scroll lock, `inert` outside; `isEntering` → keepVisible) +
//   `modalUnderlayPointerDown` on the underlay.
// - `--visual-viewport-width/height`, `--page-width/height` are set once measured in the browser (the
//   server HTML of an open modal has none: React Aria never server-renders a modal).
// - the underlay keeps inline `position: fixed; inset: 0; z-index: 100` (behaviour styles, cdk rule).
// - the PortalProvider container is resolved in the outer component (`useContext(PortalContext)`) and
//   handed to `<Overlay>` (re-created overlays have no provider chain).
// Deviations: `UNSTABLE_portalContainer` deleted (PortalProvider only, decision 12); `render` (RAC DOMRenderProps) replaces the ModalOverlay and Modal `<div>`s (inline stacking, `data-rv-overlay` and the underlay pointer-down stay);
// the keyboard-deferred reveal (`runAfterKeyboard(() => setIsOpen(true))`) reveals on the first client
// effect (the iOS keyboard module stays lazy).
import { computed, createContext, signal, untrack, useContext } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as createRef, type Ref } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { hasLive, liveOmit, liveOptions } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";
import { splitProps } from "@rivetjs/runtime/props";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { DEV, isScrollable, viewportSize, type ViewportSize } from "../utils/dom.ts";
import { createEnterAnimation, createExitAnimationState, watchExitAnimation, type ExitAnimationState } from "../utils/animation.tsx";
import { overlayPresence, type OverlayPresence } from "@rivetjs/kit/transition";
import { DismissButton } from "../overlay/dismiss-button.tsx";
import { modalOverlay, modalUnderlayPointerDown, type AriaModalOverlayProps } from "../overlay/modal-overlay.ts";
import { OverlayTriggerStateContext } from "../overlay/contexts.ts";
import { PressResponderContext } from "../interactions/press.tsx";
import { Overlay, PortalContext, type PortalMount } from "../portal/index.tsx";
import { closeOverlay, createOverlayTriggerState, setOpen, type OverlayTriggerProps, type OverlayTriggerState } from "../state/overlays.ts";
import {
  Provider,
  contextProps,
  mergeRefValues,
  renderProps,
  resumableContext,
  type ClassNameOrFunction,
  type ContextValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
} from "../slots/index.tsx";
import { DialogContext, type DialogContextValue } from "../dialog/contexts.ts";

export type { OverlayTriggerState };

export interface ModalRenderProps {
  /**
   * Whether the modal is currently entering. Use this to apply animations.
   * @selector [data-entering]
   */
  isEntering: () => boolean;
  /**
   * Whether the modal is currently exiting. Use this to apply animations.
   * @selector [data-exiting]
   */
  isExiting: () => boolean;
  /** State of the modal. */
  state: OverlayTriggerState;
}

export interface ModalOverlayProps
  extends
    Omit<AriaModalOverlayProps, "isEntering" | "overrideFocus">,
    OverlayTriggerProps,
    RenderProps<ModalRenderProps>,
    DOMRenderProps<"div", ModalRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /**
   * The CSS class of the element. A function may be provided to compute the class based on component state.
   * @default 'rv-ModalOverlay' (ModalOverlay) / 'rv-Modal' (Modal)
   */
  class?: ClassNameOrFunction<ModalRenderProps>;
  /** Whether the modal is currently performing an entry animation (a value or an accessor). */
  isEntering?: MaybeAccessor<boolean | undefined>;
  /** Whether the modal is currently performing an exit animation (a value or an accessor). */
  isExiting?: MaybeAccessor<boolean | undefined>;
  /** Callback when the modal starts entering. Return a promise to indicate when the entry animation has completed. */
  onEnter?: (element: HTMLElement) => void | Promise<void>;
  /** Callback when the modal starts exiting. Return a promise to indicate when the exit animation has completed. */
  onExit?: (element: HTMLElement) => void | Promise<void>;
  /**
   * Whether to wait until the entry animation completes before hiding content outside the modal and moving focus into it.
   * @private
   */
  UNSTABLE_deferUntilEntered?: boolean;
  /** @private Patch focus() so it does not scroll the page (RA `UNSTABLE_overrideFocus`). */
  UNSTABLE_overrideFocus?: boolean;
  id?: string;
  ref?: RefValue<HTMLDivElement>;
}

export type ModalProps = ModalOverlayProps;

interface InternalModalContextValue {
  modalRef: Ref<HTMLDivElement>;
  /** Whether the modal is revealed (RA `isOpen` of ModalOverlayInner: after the keyboard check). */
  isOpen: () => boolean;
  isExiting: () => boolean;
  isDismissable?: boolean | (() => boolean | undefined);
  /** The Modal's `onExit` (RA `onExitRef`): the overlay's exit animation of the modal element calls it. */
  onExit: { current?: (element: HTMLElement) => void | Promise<void> };
  state: OverlayTriggerState;
}

/** Props for the nearest `<ModalOverlay>` / `<Modal>` from a parent (RAC `ModalContext`). */
export const ModalContext = resumableContext(createContext<ContextValue<ModalOverlayProps, HTMLDivElement>>(null, { id: "rv-modal-props" }));
/** @private What a ModalOverlay passes to its Modal (RAC `InternalModalContext`). */
export const InternalModalContext = resumableContext(createContext<InternalModalContextValue | null>(null, { id: "rv-modal-internal" }));

/** Props the outer components hand to the overlay body (resolved contexts, serializable). */
interface ResolvedOverlayProps {
  props: ModalOverlayProps;
  ref: RefValue<HTMLDivElement> | undefined;
  state: OverlayTriggerState;
  portal: PortalMount;
  dialogContext: ContextValue<DialogContextValue, HTMLElement>;
  /** Standalone `<Modal>`: the props of the modal element (RAC `ModalContent {...otherProps}`). */
  modal?: ModalOverlayProps;
}

/**
 * Opt-in work per open (a styled layer registers it, e.g. @rivetjs/ui's overlays: the motion token): `open(overlay,
 * modal)` runs once per open, the overlay in the document. Unset (cdk alone): nothing runs, nothing ships.
 */
export const modalHooks: { open?(overlay: HTMLElement, modal: HTMLElement): void } = {};
/** The motion token (`--rv-motion-spring` → inline spring timing; motion spec D17) for `modalHooks.open`. */
export { applyMotionToken } from "../utils/motion-token.ts";

/** Motion presence per open-state owner (`modalExit`), see `ModalOverlayPresence`. */
const presences = new WeakMap<object, OverlayPresence>();

/** A modal is an overlay element which blocks interaction with elements outside it (RAC `Modal`). */
export function Modal(props: ModalOverlayProps) {
  const ctx = useContext(InternalModalContext);
  if (ctx) {
    if (DEV && (props.onOpenChange || props.defaultOpen !== undefined || props.isOpen !== undefined)) {
      // create a list of props that are passed in but not allowed when using an external ModalOverlay
      const invalidSet = new Set([
        "isDismissable",
        "isKeyboardDismissDisabled",
        "isOpen",
        "defaultOpen",
        "onOpenChange",
        "isEntering",
        "isExiting",
        "shouldCloseOnInteractOutside",
      ]);
      const invalidProps = Object.keys(props).filter((key) => invalidSet.has(key));
      console.warn(`This modal is already wrapped in a ModalOverlay, props [${invalidProps.join(", ")}] should be placed on the ModalOverlay instead.`);
    }
    return <ModalContent props={props} ctx={ctx} />;
  }
  if (hasLive(props)) {
    // Live props (P5): the overlay keys forward unread (controlled `isOpen` / dismiss flags become accessors), the rest
    // goes to the modal element unread.
    const overlay = liveOptions(splitProps(props as Record<string, unknown>, OVERLAY_KEYS)[0] as ModalOverlayProps, LIVE_KEYS, ["isOpen"]);
    return resolveOverlay(overlay, undefined, liveOmit(props, OVERLAY_KEYS) as ModalOverlayProps);
  }
  const {
    isDismissable,
    isKeyboardDismissDisabled,
    isOpen,
    defaultOpen,
    onOpenChange,
    isEntering,
    isExiting,
    shouldCloseOnInteractOutside,
    UNSTABLE_deferUntilEntered,
    UNSTABLE_overrideFocus,
    ...otherProps
  } = props;
  const overlayProps: ModalOverlayProps = {
    isDismissable,
    isKeyboardDismissDisabled,
    isOpen,
    defaultOpen,
    onOpenChange,
    isEntering,
    isExiting,
    shouldCloseOnInteractOutside,
    UNSTABLE_deferUntilEntered,
    UNSTABLE_overrideFocus,
  };
  return resolveOverlay(overlayProps, undefined, otherProps);
}

const OVERLAY_KEYS = [
  "isDismissable",
  "isKeyboardDismissDisabled",
  "isOpen",
  "defaultOpen",
  "onOpenChange",
  "isEntering",
  "isExiting",
  "shouldCloseOnInteractOutside",
  "UNSTABLE_deferUntilEntered",
  "UNSTABLE_overrideFocus",
] as const;
/** Live props (P5): dismiss flags read at interaction time when live. */
const LIVE_KEYS = ["isDismissable", "isKeyboardDismissDisabled", "isEntering", "isExiting"] as never as (keyof ModalOverlayProps)[];

/** A ModalOverlay is a wrapper for a Modal which allows customizing the backdrop element (RAC `ModalOverlay`). */
export function ModalOverlay(props: ModalOverlayProps) {
  const [merged, ref] = contextProps(props, props.ref, ModalContext);
  return resolveOverlay(liveOptions(merged, LIVE_KEYS, ["isOpen"]), ref);
}

function resolveOverlay(props: ModalOverlayProps, ref: RefValue<HTMLDivElement> | undefined, modal?: ModalOverlayProps) {
  const contextState = useContext(OverlayTriggerStateContext);
  const localState = untrack(() => createOverlayTriggerState(props));
  const state = untrack(() => props.isOpen != null || props.defaultOpen != null) || !contextState ? localState : contextState;
  if (state === contextState && DEV && (props.onOpenChange || props.defaultOpen !== undefined || props.isOpen !== undefined)) {
    console.warn("This modals state is controlled by a trigger, place onOpenChange on the trigger instead.");
  }
  const portal = useContext(PortalContext);
  const dialogContext = useContext(DialogContext);
  // Own binding site: on a resumed page the first open re-creates only the overlay.
  return (
    <span data-rv-overlay-anchor="" style={{ display: "contents" }}>
      <ModalOverlayPresence props={props} ref={ref} state={state} portal={portal} dialogContext={dialogContext} modal={modal} />
    </span>
  );
}

function ModalOverlayPresence(resolved: ResolvedOverlayProps) {
  const { props, state } = resolved;
  const overlayRef = createRef<HTMLDivElement>();
  const modalRef = createRef<HTMLDivElement>();
  const onExit = props.onExit;
  const modalExit: InternalModalContextValue["onExit"] = {};
  // Object literal values, not arguments / local consts passed as arguments: the animation effects capture them (R2).
  const fns = {
    isOpen: () => state.isOpen(),
    onOverlayExit: (element: HTMLElement) => {
      const user = onExit?.(element);
      const exits = presences.get(modalExit)?.take();
      return exits ? Promise.all([user, exits]).then(() => undefined) : user;
    },
    onModalExit: (element: HTMLElement) => modalExit.current?.(element),
  };
  // Exits of nested `@rivetjs/motion` elements: a presence scope over the open state, only when Motion is in the bundle
  // (it fills kit `overlayPresence`; nothing here otherwise). Kept in a module map keyed by `modalExit`, never
  // captured: closures capture eagerly (resume) and the presence holds functions.
  const presence = overlayPresence.create?.(fns.isOpen);
  if (presence) presences.set(modalExit, presence);
  // Exit states here, their effects inside the branch (`watchExitAnimation` in ModalOverlayInner): a closed modal
  // records no client effect, so a resumed page with a closed Modal / Drawer does not boot the runtime at load.
  const overlayExit = createExitAnimationState(fns.isOpen);
  const modalExitState = createExitAnimationState(fns.isOpen);
  const isExitingProp = props.isExiting;
  const isExiting = computed(() => overlayExit.isExiting() || modalExitState.isExiting() || !!read(isExitingProp) || false);
  return (
    <Show when={() => state.isOpen() || isExiting()}>
      {() => {
        const inner = () => (
          <ModalOverlayInner
            {...resolved}
            overlayRef={overlayRef}
            modalRef={modalRef}
            isExiting={isExiting}
            modalExit={modalExit}
            exits={{ overlay: overlayExit, modal: modalExitState, onOverlayExit: fns.onOverlayExit, onModalExit: fns.onModalExit }}
          />
        );
        const presence = presences.get(modalExit);
        return presence ? presence.wrap(inner) : inner();
      }}
    </Show>
  );
}

const OWNED = ["style", "onPointerDown"] as const;

function ModalOverlayInner(
  resolved: ResolvedOverlayProps & {
    overlayRef: Ref<HTMLDivElement>;
    modalRef: Ref<HTMLDivElement>;
    isExiting: () => boolean;
    modalExit: InternalModalContextValue["onExit"];
    exits: {
      overlay: ExitAnimationState;
      modal: ExitAnimationState;
      onOverlayExit: (element: HTMLElement) => void | Promise<void>;
      onModalExit: (element: HTMLElement) => void | Promise<void>;
    };
  },
) {
  const { props, state, overlayRef, modalRef, isExiting, modalExit, dialogContext, exits } = resolved;
  watchExitAnimation(overlayRef, exits.overlay, exits.onOverlayExit);
  watchExitAnimation(modalRef, exits.modal, exits.onModalExit);
  // Motion token (`--rv-motion-spring`, `modalHooks.open`): registered by @rivetjs/ui's overlays; cdk alone pays nothing.
  // Read through the module object (by reference on resumed pages, never captured).
  if (modalHooks.open)
    clientEffect(() => {
      const overlay = overlayRef(),
        modal = modalRef();
      // A microtask later: after the portal mount puts the overlay in the document, where the token inherits.
      if (overlay && modal) queueMicrotask(() => modalHooks.open?.(overlay, modal));
    });
  const deferUntilEntered = !!props.UNSTABLE_deferUntilEntered;
  // RA: revealed after `runAfterKeyboard` (an auto-focused input may open the on-screen keyboard).
  // Rivet: a server-rendered overlay is already revealed (true is serialized), so a resumed page never runs the
  // enter animation's not-ready hide: its effects may run before this one at load, which flashed the open overlay
  // hidden and left an empty `style=""` on the overlay / modal elements (resume fuzz `/modal-open`, ui `/drawer-open`).
  const isOpen = signal(typeof document === "undefined");
  clientEffect(() => {
    isOpen.set(true);
  });
  const onEnter = props.onEnter;
  const enterFns = { onEnter: (element: HTMLElement) => onEnter?.(element) };
  const entered = createEnterAnimation(overlayRef, isOpen, enterFns.onEnter);
  const isEnteringProp = props.isEntering;
  const entering = () => entered() || !!read(isEnteringProp) || false;
  const isDeferred = () => deferUntilEntered && (!isOpen() || entering());

  const modalOptions: AriaModalOverlayProps = {
    isDismissable: props.isDismissable,
    isKeyboardDismissDisabled: props.isKeyboardDismissDisabled,
    shouldCloseOnInteractOutside: props.shouldCloseOnInteractOutside,
    overrideFocus: props.UNSTABLE_overrideFocus,
  };
  // The portal move is a client effect that may run after this one (a client render: content effects first): hiding
  // the outside before the move hid the page's siblings of the in-place anchor instead of the page around the portal
  // (RA: createPortal places the modal before useModalOverlay's layout effect). `onPlaced` gates it.
  const placed = signal(false);
  // useModalOverlay while open: released on close (the exit animation runs unblocked) and on unmount.
  clientEffect(() => {
    const element = modalRef();
    if (!element || !state.isOpen() || !placed()) return;
    const isEntering = isDeferred();
    return untrack(() => modalOverlay(element, { ...modalOptions, isEntering }, state));
  });

  // Pass the entering state to the dialog so it waits to move focus until the modal has entered.
  const mergedDialogContext = deferUntilEntered ? mergeDialogContext(dialogContext, { isEntering: isDeferred }) : dialogContext;

  const values: ModalRenderProps = { isEntering: entering, isExiting, state };
  const rp = renderProps(
    { class: props.class, style: props.style, children: props.children, values, defaultClassName: "rv-ModalOverlay" },
    hasLive(props) ? (liveRenderProps(props) as never) : undefined,
  );

  // useViewportSize + page size (browser only).
  const viewport = signal<ViewportSize | null>(null);
  // Capture the style accessor only: `rp` also holds `children` (a JSX slot, not serializable).
  const userStyle = rp.style;
  clientEffect(() =>
    untrack(() => {
      // RA useViewportSize: the shared viewport signal, mirrored into this overlay's signal.
      const { size, dispose } = viewportSize();
      viewport.set(size());
      const win = window,
        target: EventTarget = win.visualViewport ?? win;
      const sync = () => queueMicrotask(() => viewport.set(size()));
      target.addEventListener("resize", sync);
      return () => {
        target.removeEventListener("resize", sync);
        dispose();
      };
    }),
  );
  const style = () => {
    const vp = viewport();
    let pageWidth: number | undefined, pageHeight: number | undefined;
    if (vp && typeof document !== "undefined") {
      const scrollingElement = isScrollable(document.body) ? document.body : document.scrollingElement || document.documentElement;
      // Prevent Firefox from adding scrollbars when the page has a fractional width/height.
      const rect = scrollingElement.getBoundingClientRect();
      pageWidth = scrollingElement.scrollWidth - (rect.width % 1);
      pageHeight = scrollingElement.scrollHeight - (rect.height % 1);
    }
    return {
      position: "fixed",
      inset: "0",
      zIndex: 100,
      ...userStyle(),
      "--visual-viewport-width": vp ? vp.width + "px" : undefined,
      "--visual-viewport-height": vp ? vp.height + "px" : undefined,
      "--page-width": pageWidth !== undefined ? pageWidth + "px" : undefined,
      "--page-height": pageHeight !== undefined ? pageHeight + "px" : undefined,
    };
  };

  const dom = globalDOMProps(props, OWNED);
  const onPointerDown = props.onPointerDown;
  const ref = mergeRefValues(overlayRef as RefValue<HTMLDivElement>, resolved.ref) as Ref<HTMLDivElement>;
  const internal: InternalModalContextValue = { modalRef, isOpen, isExiting, isDismissable: props.isDismissable, onExit: modalExit, state };
  const modal = resolved.modal;
  const id = props.id,
    slot = props.slot ?? undefined;
  const providerValues = (): never =>
    [
      [InternalModalContext, internal],
      [OverlayTriggerStateContext, state],
      [DialogContext, mergedDialogContext],
      // RA Overlay's ClearPressResponder: the trigger's PressResponder must not reach buttons inside.
      [PressResponderContext, { register: () => {} }],
    ] as never;
  const overlayAttrs = props.render && {
    ...dom,
    id,
    slot,
    class: () => rp.class(),
    style,
    ref,
    "data-entering": () => dataBool(entering()),
    "data-exiting": () => dataBool(isExiting()),
    onPointerDown: (event: PointerEvent) => {
      modalUnderlayPointerDown(event as never);
      onPointerDown?.(event as never);
    },
    children: () => <Provider values={providerValues()}>{modal ? <ModalContent props={modal} ctx={internal} /> : rp.children()}</Provider>,
  };
  if (props.render)
    return (
      <Overlay portalContainer={resolved.portal} shouldContainFocus isExiting={isExiting()} onPlaced={() => placed.set(true)}>
        {props.render(overlayAttrs as never, values)}
      </Overlay>
    );
  return (
    <Overlay portalContainer={resolved.portal} shouldContainFocus isExiting={isExiting()} onPlaced={() => placed.set(true)}>
      <div
        {...dom}
        id={id}
        slot={slot}
        class={rp.class()}
        style={style()}
        ref={ref}
        data-entering={dataBool(entering())}
        data-exiting={dataBool(isExiting())}
        onPointerDown={(event) => {
          modalUnderlayPointerDown(event);
          onPointerDown?.(event);
        }}
      >
        <Provider
          values={[
            [InternalModalContext, internal],
            [OverlayTriggerStateContext, state],
            [DialogContext, mergedDialogContext],
            // RA Overlay's ClearPressResponder: the trigger's PressResponder must not reach buttons inside.
            [PressResponderContext, { register: () => {} }],
          ]}
        >
          {modal ? <ModalContent props={modal} ctx={internal} /> : rp.children()}
        </Provider>
      </div>
    </Overlay>
  );
}

function mergeDialogContext(
  context: ContextValue<DialogContextValue, HTMLElement>,
  props: Partial<DialogContextValue>,
): ContextValue<DialogContextValue, HTMLElement> {
  if (context && "slots" in context && context.slots) {
    const slots: Record<string, DialogContextValue> = {};
    for (const key in context.slots) slots[key] = { ...context.slots[key], ...props } as DialogContextValue;
    return { ...context, slots };
  }
  return { ...(context as DialogContextValue | null), ...props };
}

/** The modal element (RAC `ModalContent`): render props, `data-entering` / `data-exiting`, DismissButton. */
function ModalContent(input: { props: ModalOverlayProps; ctx: InternalModalContextValue }) {
  const { props, ctx } = input;
  const { modalRef, isExiting, isDismissable, isOpen, state } = ctx;
  const ref = mergeRefValues(modalRef as RefValue<HTMLDivElement>, props.ref) as Ref<HTMLDivElement>;
  const onEnter = props.onEnter;
  const enterFns = { onEnter: (element: HTMLElement) => onEnter?.(element) };
  const entering = createEnterAnimation(modalRef, isOpen, enterFns.onEnter);
  // RA: `onExitRef.current = props.onExit` (layout effect) — the overlay's exit animation of this element calls it.
  ctx.onExit.current = props.onExit;
  const values: ModalRenderProps = { isEntering: entering, isExiting, state };
  const rp = renderProps(
    { class: props.class, style: props.style, children: props.children, values, defaultClassName: "rv-Modal" },
    hasLive(props) ? (liveRenderProps(props) as never) : undefined,
  );
  const dom = globalDOMProps(props, ["style"]);
  const id = props.id,
    slot = props.slot ?? undefined;
  if (props.render) {
    const attrs = {
      ...dom,
      id,
      slot,
      class: () => rp.class(),
      style: () => rp.style(),
      ref,
      "data-rv-overlay": "",
      "data-entering": () => dataBool(entering()),
      "data-exiting": () => dataBool(isExiting()),
      children: () => [
        typeof isDismissable === "function" ? (
          <Show when={isDismissable}>{() => <DismissButton onDismiss={() => closeOverlay(state)} />}</Show>
        ) : isDismissable ? (
          <DismissButton onDismiss={() => closeOverlay(state)} />
        ) : null,
        <Provider values={[[InternalModalContext, null]]}>{rp.children()}</Provider>,
      ],
    };
    return props.render(attrs as never, values);
  }
  return (
    <div
      {...dom}
      id={id}
      slot={slot}
      class={rp.class()}
      style={rp.style()}
      ref={ref}
      data-rv-overlay=""
      data-entering={dataBool(entering())}
      data-exiting={dataBool(isExiting())}
    >
      {typeof isDismissable === "function" ? (
        // Live props (P5): a live `isDismissable` shows / hides the DismissButton.
        <Show when={isDismissable}>{() => <DismissButton onDismiss={() => closeOverlay(state)} />}</Show>
      ) : isDismissable ? (
        <DismissButton onDismiss={() => closeOverlay(state)} />
      ) : null}
      {/* Deviation: cleared for the content, so a nested DialogTrigger's <Modal> opens its own overlay
          (RAC leaves it set: a nested Modal would render inline as this overlay's modal). */}
      <Provider values={[[InternalModalContext, null]]}>{rp.children()}</Provider>
    </div>
  );
}

/** @internal Opens / closes a modal state (re-exported for callers of the old API). */
export { setOpen };

// react-aria hooks (useModal / ModalProvider / OverlayContainer).
export * from "./provider.tsx";
