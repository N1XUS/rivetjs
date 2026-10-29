// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no sheet). Feature set (parts, props, defaults, data attributes)
// scoped from public docs of commercial UI kits; independent implementation. Structure follows `../drawer/drawer.tsx`:
// - Root = cdk `DialogTrigger` in a `SheetContext` provider; the context carries the sheet state (`./sheet-state.ts`,
//   state: plain data + signals + the caller's callbacks → resumes). Parts read slots from a module memo.
// - Backdrop = cdk `ModalOverlay` (div overlay layer: inert outside, focus trap, scroll lock; never native dialog /
//   popover), Content = cdk `Modal`; both re-provide the context through render-function children. `isModal={false}`:
//   no backdrop, Content = own presence (portal `Overlay` without focus containment, enter / exit animation, Escape via
//   `@rivetjs/cdk/overlay`), the page stays usable.
// - Dialog = cdk `Dialog`; its client effects attach the gesture (`./sheet.utils.ts` → `@rivetjs/cdk/sheet-motion`: drag to
//   dismiss, snap points, Motion1D physics, reduced motion → jump), follow the active snap point and the open state.
//   The first render places a snap sheet with a CSS `transform` expression (no measurement, server-rendered too).
import { createEnterAnimation, createExitAnimation } from "@rivetjs/cdk/animation";
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { Dialog as DialogPrimitive, DialogTrigger as SheetTriggerPrimitive, OverlayTriggerStateContext } from "@rivetjs/cdk/dialog";
import type { DialogProps as DialogPrimitiveProps, DialogTriggerProps } from "@rivetjs/cdk/dialog";
import { Heading as HeadingPrimitive } from "@rivetjs/cdk/heading";
import type { HeadingProps as HeadingPrimitiveProps } from "@rivetjs/cdk/heading";
import { createId } from "@rivetjs/cdk/id";
import { ModalOverlay as ModalOverlayPrimitive, Modal as ModalPrimitive } from "@rivetjs/cdk/modal";
import { overlayMotion } from "../../utils/overlay-motion.ts";
import { portalTheme } from "../../utils/portal-theme.ts";
import type { ModalOverlayProps, ModalRenderProps } from "@rivetjs/cdk/modal";
import { overlay } from "@rivetjs/cdk/overlay";
import { Overlay } from "@rivetjs/cdk/portal";
import { snapPointTransform } from "@rivetjs/cdk/sheet-motion";
import { closeOverlay } from "@rivetjs/cdk/state/overlays";
import type { OverlayTriggerState } from "@rivetjs/cdk/state/overlays";
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { Provider, Show, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Ref } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";

import type { SheetVariants } from "../../../styles/src/components/sheet/index.ts";
import { sheetVariants } from "../../../styles/src/components/sheet/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import type { UseOverlayStateReturn } from "../../hooks/use-overlay-state.tsx";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { CloseButton } from "../close-button/index.ts";
import type { CloseButtonRootProps } from "../close-button/index.ts";
import { SurfaceContext } from "../surface/index.ts";

import { createSheetState, cycleSheetSnap, sheetSnapIndex } from "./sheet-state.ts";
import type { SheetOptions, SheetPlacement, SheetSnapPoint, SheetState } from "./sheet-state.ts";
import { attachSheetDialog, followSheetSnap, sheetBackdropExit, sheetOpenChanged } from "./sheet.utils.ts";
import type { SheetDialogHolder } from "./sheet.utils.ts";

const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

/* -------------------------------------------------------------------------------------------------
 * Sheet Context
 * -----------------------------------------------------------------------------------------------*/
type SheetContext = {
  /** The sheet state (`undefined` outside a `Sheet`: parts get only their `class`). */
  state?: SheetState;
};

const SheetContext = createContext<SheetContext>({});

type SheetSlots = ReturnType<typeof sheetVariants>;
const SLOTS = new Map<string, SheetSlots>();
// @rivet-class-resolvers variantSlots
/** `sheetVariants(variants)`, one object per variant combination. */
const variantSlots = (variants: { placement?: SheetPlacement; isDetached?: boolean; variant?: SheetVariants["variant"] }): SheetSlots => {
  const key = `${variants.placement}|${variants.isDetached}|${variants.variant}`;
  let slots = SLOTS.get(key);
  if (!slots) SLOTS.set(key, (slots = sheetVariants(variants)));
  return slots;
};
/** Inside a `Sheet`: the slots for its placement / detached look; `undefined` outside. */
const slotsOf = (context: SheetContext): SheetSlots | undefined =>
  context.state ? variantSlots({ placement: context.state.placement, isDetached: context.state.isDetached }) : undefined;

const renderChildren = (children: unknown, renderProps: ModalRenderProps): Content =>
  typeof children === "function" && !isSlot(children) ? (children as (v: ModalRenderProps) => Content)(renderProps) : (children as Content);

/** Default `fadeFromIndex` (the last snap point). */
const fadeFromOf = (state: SheetState): number => state.fadeFromIndex ?? (state.snapPoints ? state.snapPoints.length - 1 : 0);

const OPTION_KEYS = [
  "placement",
  "isDismissable",
  "isDetached",
  "isModal",
  "isHandleOnly",
  "snapPoints",
  "activeSnapPoint",
  "defaultActiveSnapPoint",
  "onActiveSnapPointChange",
  "fadeFromIndex",
  "closeThreshold",
  "shouldScaleBackground",
  "snapToSequentialPoint",
  "onDrag",
  "onRelease",
  "onAnimationEnd",
  "shouldAutoFocus",
] as const;

/* -------------------------------------------------------------------------------------------------
 * Sheet Root
 * -----------------------------------------------------------------------------------------------*/
interface SheetRootProps extends DialogTriggerProps, SheetOptions {
  /** `useOverlayState()` result (controlled open state). */
  state?: UseOverlayStateReturn;
  /** Nested in another sheet: the parent steps back while this one is open (`Sheet.NestedRoot` sets it). @default false */
  isNested?: boolean;
  /** Called after the sheet closed (any reason). */
  onClose?: () => void;
}

const SheetRoot = (props: SheetRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "state", "isNested", "onClose", "onOpenChange", ...OPTION_KEYS]);
  const parent = useContext(SheetContext);
  const state = createSheetState(local, createId(), local.isNested ? parent.state?.sheetId : undefined);
  const value: SheetContext = { state };
  const overlayState = local.state;
  const userOnOpenChange = local.onOpenChange,
    onClose = local.onClose;
  const controlledProps = overlayState ? { isOpen: overlayState.isOpen } : {};
  const onOpenChange = (isOpen: boolean) => {
    overlayState?.setOpen(isOpen);
    userOnOpenChange?.(isOpen);
    if (!isOpen) onClose?.();
  };
  const children = local.children;
  // A function: Rivet JSX builds nodes eagerly, the trigger must be created inside the provider.
  const content = () => (
    <SheetTriggerPrimitive data-slot="sheet-root" {...rest} {...controlledProps} onOpenChange={onOpenChange}>
      {children}
    </SheetTriggerPrimitive>
  );

  return (
    <Provider token={SheetContext} value={value}>
      {content()}
    </Provider>
  );
};

/** A sheet opened from inside another sheet (`isNested`). */
const SheetNestedRoot = (props: Omit<SheetRootProps, "isNested">): JSX.Element => <SheetRoot {...props} isNested />;

/* -------------------------------------------------------------------------------------------------
 * Sheet Trigger / Close
 * -----------------------------------------------------------------------------------------------*/
type SheetTriggerProps = ButtonPrimitiveProps & {};
type SheetCloseProps = ButtonPrimitiveProps & {};

const SheetTrigger = (props: SheetTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(SheetContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.trigger()) as string | ((v: ButtonRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive class={cls as never} data-slot="sheet-trigger" {...rest}>
      {local.children}
    </ButtonPrimitive>
  );
};

/** A button that closes the sheet (the dialog's `close` slot). */
const SheetClose = (props: SheetCloseProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(SheetContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.close()) as string | ((v: ButtonRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive class={cls as never} data-slot="sheet-close" slot="close" {...rest}>
      {local.children}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Sheet Backdrop
 * -----------------------------------------------------------------------------------------------*/
interface SheetBackdropProps extends Omit<ModalOverlayProps, "isDismissable" | "isKeyboardDismissDisabled" | "isOpen" | "defaultOpen" | "onOpenChange"> {
  /** @default "opaque" */
  variant?: SheetVariants["variant"];
}

const SheetBackdrop = (props: SheetBackdropProps): JSX.Element => {
  overlayMotion();
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "variant", "style", "onExit"]);
  const context = useContext(SheetContext);
  const state = context.state;
  const onExit = local.onExit;
  // Non-modal: no underlay (the page stays usable); Content runs its own presence.
  if (state && !state.isModal) return (<>{local.children}</>) as JSX.Element;
  const isDismissable = state?.isDismissable ?? true;
  const classOf = () =>
    composeTwRenderProps(local.class as never, variantSlots({ variant: local.variant ?? "opaque" }).backdrop()) as string | ((v: ModalRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: ModalRenderProps) => renderClass(classOf(), values) : classOf();
  // Snap points: the colour opacity of the opening point (the motion takes over once attached).
  const initialStyle = state?.snapPoints ? { "--sheet-backdrop-opacity": untrack(() => sheetSnapIndex(state)) >= fadeFromOf(state) ? "1" : "0" } : undefined;

  return (
    <ModalOverlayPrimitive
      class={cls as never}
      data-slot="sheet-backdrop"
      data-sheet-snap-points={state?.snapPoints ? "true" : undefined}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable}
      style={(local.style ?? initialStyle) as never}
      onExit={(element: HTMLElement) => {
        sheetBackdropExit(element);
        return onExit?.(element);
      }}
      {...rest}
    >
      {(renderProps: ModalRenderProps) => (
        <Provider token={SheetContext} value={context}>
          {renderChildren(local.children, renderProps)}
        </Provider>
      )}
    </ModalOverlayPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Sheet Content
 * -----------------------------------------------------------------------------------------------*/
type SheetContentProps = Omit<SheetBackdropProps, "variant">;

const SheetContent = (props: SheetContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(SheetContext);
  const state = context.state;
  const placement = state?.placement ?? "bottom";
  const classOf = () =>
    composeTwRenderProps(local.class as never, variantSlots({ placement, isDetached: state?.isDetached }).content()) as
      string | ((v: ModalRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: ModalRenderProps) => renderClass(classOf(), values) : classOf();
  if (state && !state.isModal) return <SheetModelessContent cls={cls} placement={placement} context={context} children={local.children} />;

  return (
    <ModalPrimitive
      class={cls as never}
      data-placement={placement}
      data-sheet-detached={state?.isDetached ? "true" : undefined}
      data-slot="sheet-content"
      {...rest}
    >
      {(renderProps: ModalRenderProps) => (
        <Provider token={SheetContext} value={context}>
          {renderChildren(local.children, renderProps)}
        </Provider>
      )}
    </ModalPrimitive>
  );
};

interface ModelessProps {
  cls: string | ((v: ModalRenderProps) => string);
  placement: SheetPlacement;
  context: SheetContext;
  children?: unknown;
}

/** `isModal={false}`: mounted while open or exiting, portaled without focus containment / inert / scroll lock. */
function SheetModelessContent(props: ModelessProps) {
  const overlayState = useContext(OverlayTriggerStateContext) as OverlayTriggerState | null | undefined;
  const contentRef = createRef<HTMLDivElement>();
  // Object literal value: the animation effect captures it (must be resumable).
  const fns = { isOpen: () => !!overlayState?.isOpen() };
  const isExiting = createExitAnimation(contentRef, fns.isOpen);
  return (
    <span data-rv-overlay-anchor="" style={{ display: "contents" }}>
      <Show when={() => fns.isOpen() || isExiting()}>
        {() => <SheetModelessInner {...props} contentRef={contentRef} isExiting={isExiting} overlayState={overlayState} />}
      </Show>
    </span>
  );
}

function SheetModelessInner(
  props: ModelessProps & { contentRef: Ref<HTMLDivElement>; isExiting: () => boolean; overlayState: OverlayTriggerState | null | undefined },
) {
  const { contentRef, isExiting, overlayState, context } = props;
  const entering = createEnterAnimation(contentRef);
  const isDismissable = context.state?.isDismissable ?? true;
  // Escape closes (React Aria `useOverlay`); no outside-press dismissal (the page is usable).
  clientEffect(() => {
    const el = contentRef();
    if (!el || !overlayState?.isOpen()) return;
    return untrack(() => overlay(el, { isOpen: true, onClose: () => closeOverlay(overlayState), isKeyboardDismissDisabled: !isDismissable }));
  });
  const values: ModalRenderProps = { isEntering: entering, isExiting, state: overlayState as OverlayTriggerState };
  const cls = props.cls;
  const children = props.children;
  return (
    <Overlay isExiting={isExiting}>
      <div
        ref={contentRef}
        class={(typeof cls === "function" ? () => cls(values) : cls) as never}
        data-entering={() => (entering() ? "true" : undefined)}
        data-exiting={() => (isExiting() ? "true" : undefined)}
        data-placement={props.placement}
        data-sheet-detached={context.state?.isDetached ? "true" : undefined}
        data-sheet-modal="false"
        data-slot="sheet-content"
      >
        <Provider token={SheetContext} value={context}>
          {renderChildren(children, values)}
        </Provider>
      </div>
    </Overlay>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Sheet Dialog
 * -----------------------------------------------------------------------------------------------*/
type SheetDialogProps = Omit<DialogPrimitiveProps, "class"> & {
  class?: string;
};

const SheetDialog = (props: SheetDialogProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "style"]);
  const context = useContext(SheetContext);
  const state = context.state;
  const placement = state?.placement ?? "bottom";
  const points = state?.snapPoints;
  const overlayState = useContext(OverlayTriggerStateContext) as OverlayTriggerState | null | undefined;
  const dialogRef = createRef<HTMLElement>();
  const holder: SheetDialogHolder = {};
  // Gesture while mounted (resumed pages: a server-rendered open sheet attaches at load).
  clientEffect(() => {
    const el = dialogRef();
    if (!el || !state) return;
    return untrack(() => attachSheetDialog(el, state, overlayState, holder));
  });
  // A controlled / handle-driven snap change moves the sheet.
  clientEffect(() => {
    if (!state?.snapPoints) return;
    const index = sheetSnapIndex(state);
    untrack(() => followSheetSnap(state, holder, index));
  });
  // Open state: background scaling, nested step back, `onAnimationEnd`.
  clientEffect(() => {
    const el = dialogRef();
    if (!el || !state) return;
    const open = !!overlayState?.isOpen();
    return untrack(() => sheetOpenChanged(el, state, open));
  });
  const initial =
    state && points
      ? snapPointTransform(
          placement,
          points[
            Math.max(
              0,
              untrack(() => sheetSnapIndex(state)),
            )
          ],
        )
      : undefined;
  const classOf = () => composeSlotClassName(slotsOf(context)?.dialog, local.class) ?? "";
  const cls = hasLiveProp(local, ["class"]) ? () => classOf() : classOf();
  const content = () => (
    <DialogPrimitive
      ref={dialogRef}
      class={cls as never}
      data-placement={placement}
      data-sheet-detached={state?.isDetached ? "true" : undefined}
      data-sheet-drawer=""
      data-sheet-id={state?.sheetId}
      data-sheet-snap-points={points ? "true" : undefined}
      data-slot="sheet-dialog"
      style={(local.style ?? (initial ? { transform: initial } : undefined)) as never}
      {...rest}
    >
      {local.children}
    </DialogPrimitive>
  );

  return (
    <Provider token={SurfaceContext} value={DEFAULT_SURFACE_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Sheet Header / Body / Footer / Handle
 * -----------------------------------------------------------------------------------------------*/
interface SheetPartProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type SheetHeaderProps<E extends keyof JSX.IntrinsicElements = "div"> = SheetPartProps<E>;
type SheetBodyProps<E extends keyof JSX.IntrinsicElements = "div"> = SheetPartProps<E>;
type SheetFooterProps<E extends keyof JSX.IntrinsicElements = "div"> = SheetPartProps<E>;
type SheetHandleProps<E extends keyof JSX.IntrinsicElements = "div"> = SheetPartProps<E> & {
  /** A press does not cycle through the snap points. @default false */
  preventCycle?: boolean;
};

/** Part props for the default element (`div`). */
type SheetPartDivProps = SheetPartProps & Omit<JSX.IntrinsicElements["div"], keyof SheetPartProps>;

const SheetHeader = <E extends keyof JSX.IntrinsicElements = "div">(props: SheetHeaderProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SheetPartDivProps, ["children", "class"]);
  const context = useContext(SheetContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.header, local.class)} data-slot="sheet-header" {...rest}>
      {local.children}
    </dom.div>
  );
};

const SheetBody = <E extends keyof JSX.IntrinsicElements = "div">(props: SheetBodyProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SheetPartDivProps, ["children", "class"]);
  const context = useContext(SheetContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.body, local.class)} data-slot="sheet-body" {...rest}>
      {local.children}
    </dom.div>
  );
};

const SheetFooter = <E extends keyof JSX.IntrinsicElements = "div">(props: SheetFooterProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SheetPartDivProps, ["children", "class"]);
  const context = useContext(SheetContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.footer, local.class)} data-slot="sheet-footer" {...rest}>
      {local.children}
    </dom.div>
  );
};

/** Drag handle (decorative bar, `aria-hidden`); a press moves to the next snap point (past the last: closes). */
const SheetHandle = <E extends keyof JSX.IntrinsicElements = "div">(props: SheetHandleProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SheetPartDivProps & { preventCycle?: boolean }, ["children", "class", "preventCycle"]);
  const context = useContext(SheetContext);
  const state = context.state;
  const overlayState = useContext(OverlayTriggerStateContext) as OverlayTriggerState | null | undefined;
  const preventCycle = !!local.preventCycle;

  return (
    <dom.div
      aria-hidden="true"
      class={composeSlotClassName(slotsOf(context)?.handle, local.class)}
      data-slot="sheet-handle"
      onClick={() => {
        if (!preventCycle && state) cycleSheetSnap(state, overlayState);
      }}
      {...rest}
    >
      <div data-slot="sheet-handle-bar" />
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Sheet Heading
 * -----------------------------------------------------------------------------------------------*/
type SheetHeadingProps = HeadingPrimitiveProps & {};

const SheetHeading = (props: SheetHeadingProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(SheetContext);

  return (
    <HeadingPrimitive
      class={composeSlotClassName(slotsOf(context)?.heading, local.class as string | undefined)}
      data-slot="sheet-heading"
      slot="title"
      {...rest}
    >
      {local.children}
    </HeadingPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Sheet Close Trigger
 * -----------------------------------------------------------------------------------------------*/
type SheetCloseTriggerProps = CloseButtonRootProps & {
  children?: Content;
};

const SheetCloseTrigger = (props: SheetCloseTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(SheetContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.closeTrigger()) as string | ((v: never) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: never) => renderClass(classOf(), values) : classOf();

  return <CloseButton class={cls as never} data-slot="sheet-close-trigger" slot="close" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  SheetRoot,
  SheetNestedRoot,
  SheetTrigger,
  SheetBackdrop,
  SheetContent,
  SheetDialog,
  SheetHandle,
  SheetCloseTrigger,
  SheetHeader,
  SheetHeading,
  SheetBody,
  SheetFooter,
  SheetClose,
};

export type {
  SheetRootProps,
  SheetTriggerProps,
  SheetBackdropProps,
  SheetContentProps,
  SheetDialogProps,
  SheetHandleProps,
  SheetCloseTriggerProps,
  SheetHeaderProps,
  SheetHeadingProps,
  SheetBodyProps,
  SheetFooterProps,
  SheetCloseProps,
  SheetPartDivProps,
  SheetPlacement,
  SheetSnapPoint,
};
