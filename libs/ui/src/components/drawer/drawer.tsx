// Ported from HeroUI v3.2.6 packages/react/src/components/drawer/drawer.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components` → `@rivetjs/cdk` (`dialog` `DialogTrigger` /
//   `Dialog` / `OverlayTriggerStateContext`, `heading`, `button`, `modal` `ModalOverlay` / `Modal` on the div overlay layer);
//   `@heroui/styles` → vendored `styles/`; `mergeProps` (`state` → `isOpen` / `onOpenChange`) → a plain spread.
// - `DrawerContext` carries plain data instead of the tv `slots` object: `{ inDrawer, placement, isDismissable }` (resumable
//   token `rv-ui-drawer`, default `{}` → parts outside a `Drawer` get only their `class`). Slots = `drawerVariants({ placement })`
//   memoized per variant key at module level. `Drawer.Backdrop` / `Drawer.Container` always mark the context as inside a drawer
//   (upstream merges the full slots there, so a controlled Backdrop without a root is styled).
// - `useDrawerDrag` → `drawerDrag` (`./drawer.utils.ts`): DOM listeners attached from a client effect on the dialog element
//   (explicit `ref`), same gesture rules; drag + settle on `@rivetjs/cdk/motion` instead of a CSS transition.
// - `Drawer.Backdrop` / `Drawer.Container` hand the cdk part a render-function child that provides the context (upstream: the
//   same); function children: `typeof children === "function"` → `!isSlot(children)` (Rivet JSX children are compiler slots).
// - Rivet (identity spec §4.2): the upstream `Drawer.Content` (the cdk Modal: placement, slide) is `Drawer.Container`
//   (`data-slot="drawer-content"`, `drawer__content` class kept); `Drawer.Content` = Backdrop + Container + Dialog with a
//   `Drawer.CloseTrigger` first (`closeButton={false}` drops it), like `Modal.Content`. `placement` on the root (read once:
//   it picks the slide direction and the drag axis; a Container `placement` prop wins and is live). `Drawer.Header` wraps
//   string children in a `Drawer.Heading`.
// - Live `class` / variant props → a render-prop function for the cdk part (the composed class is a local: it reaches the cdk part as a plain value); the context values
//   for descendants (`placement`, `isDismissable`) are read once.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { Dialog as DialogPrimitive, DialogTrigger as DrawerTriggerPrimitive, OverlayTriggerStateContext } from "@rivetjs/cdk/dialog";
import type { DialogProps as DialogPrimitiveProps, DialogRenderProps, DialogTriggerProps } from "@rivetjs/cdk/dialog";
import { Heading as HeadingPrimitive } from "@rivetjs/cdk/heading";
import type { HeadingProps as HeadingPrimitiveProps } from "@rivetjs/cdk/heading";
import { ModalOverlay as ModalOverlayPrimitive, Modal as ModalPrimitive } from "@rivetjs/cdk/modal";
import { overlayMotion } from "../../utils/overlay-motion.ts";
import { portalTheme } from "../../utils/portal-theme.ts";
import type { ModalOverlayProps, ModalRenderProps } from "@rivetjs/cdk/modal";
import { closeOverlay } from "@rivetjs/cdk/state/overlays";
import type { OverlayTriggerState } from "@rivetjs/cdk/state/overlays";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";

import type { DrawerVariants } from "../../../styles/src/components/drawer/index.ts";
import { drawerVariants } from "../../../styles/src/components/drawer/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import type { UseOverlayStateReturn } from "../../hooks/use-overlay-state.tsx";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { withLabel } from "../../utils/with-label.tsx";
import { CloseButton } from "../close-button/index.ts";
import type { CloseButtonRootProps } from "../close-button/index.ts";
import { SurfaceContext } from "../surface/index.ts";

import { drawerDrag } from "./drawer.utils.ts";
import type { DrawerPlacement } from "./drawer.utils.ts";

const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

/* -------------------------------------------------------------------------------------------------
 * Drawer Context
 * -----------------------------------------------------------------------------------------------*/
type DrawerContext = {
  /** Rivet: set by `Drawer` / `Drawer.Backdrop` / `Drawer.Container` (upstream: `slots`). */
  inDrawer?: boolean;
  placement?: DrawerPlacement;
  isDismissable?: boolean;
};

const DrawerContext = createContext<DrawerContext>({});

type DrawerSlots = ReturnType<typeof drawerVariants>;
const SLOTS = new Map<string, DrawerSlots>();
// @rivet-class-resolvers variantSlots
/** `drawerVariants(variants)`, one object per variant combination. */
const variantSlots = (variants: { placement?: DrawerPlacement; variant?: DrawerVariants["variant"] }): DrawerSlots => {
  const key = `${variants.placement}|${variants.variant}`;
  let slots = SLOTS.get(key);
  if (!slots) SLOTS.set(key, (slots = drawerVariants(variants)));
  return slots;
};
/** Upstream `use(DrawerContext).slots`: inside a `Drawer` the slots of the nearest content's placement, `undefined` outside. */
const slotsOf = (context: DrawerContext): DrawerSlots | undefined => (context.inDrawer ? variantSlots({ placement: context.placement }) : undefined);

const ROOT_CONTEXT: DrawerContext = { inDrawer: true, placement: undefined, isDismissable: true };

const renderChildren = (children: unknown, renderProps: ModalRenderProps): Content =>
  typeof children === "function" && !isSlot(children) ? (children as (v: ModalRenderProps) => Content)(renderProps) : (children as Content);

/* -------------------------------------------------------------------------------------------------
 * Drawer Root
 * -----------------------------------------------------------------------------------------------*/
interface DrawerRootProps extends DialogTriggerProps {
  state?: UseOverlayStateReturn;
  /** Rivet: the side the drawer slides in from (read once; a `Drawer.Container` `placement` wins). @default "bottom" */
  placement?: DrawerPlacement;
}

const DrawerRoot = (props: DrawerRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "placement", "state"]);
  const rootContext: DrawerContext = local.placement === undefined ? ROOT_CONTEXT : { ...ROOT_CONTEXT, placement: local.placement };
  const state = local.state;
  const controlledProps = state ? { isOpen: state.isOpen, onOpenChange: (isOpen: boolean) => state.setOpen(isOpen) } : {};
  const children = local.children;
  // A function: Rivet JSX builds nodes eagerly, the trigger must be created inside the provider.
  const content = () => (
    <DrawerTriggerPrimitive data-slot="drawer-root" {...rest} {...controlledProps}>
      {children}
    </DrawerTriggerPrimitive>
  );

  return (
    <Provider token={DrawerContext} value={rootContext}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Drawer Trigger
 * -----------------------------------------------------------------------------------------------*/
type DrawerTriggerProps = ButtonPrimitiveProps & {};

const DrawerTrigger = (props: DrawerTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(DrawerContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.trigger()) as string | ((v: ButtonRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive class={cls as never} data-slot="drawer-trigger" {...rest}>
      {local.children}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Drawer Backdrop
 * -----------------------------------------------------------------------------------------------*/
interface DrawerBackdropProps extends ModalOverlayProps {
  variant?: DrawerVariants["variant"];
  /**
   * Whether to close the drawer when the user interacts outside it.
   * @default true
   */
  isDismissable?: boolean;
}

const DrawerBackdrop = (props: DrawerBackdropProps): JSX.Element => {
  overlayMotion();
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "isDismissable", "variant"]);
  const context = useContext(DrawerContext);
  const isDismissable = local.isDismissable ?? true;
  const classOf = () =>
    composeTwRenderProps(local.class as never, variantSlots({ variant: local.variant }).backdrop()) as string | ((v: ModalRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: ModalRenderProps) => renderClass(classOf(), values) : classOf();
  const updated: DrawerContext = { inDrawer: true, isDismissable, placement: context.placement };

  return (
    <ModalOverlayPrimitive class={cls as never} data-slot="drawer-backdrop" isDismissable={isDismissable} {...rest}>
      {(renderProps: ModalRenderProps) => (
        <Provider token={DrawerContext} value={updated}>
          {renderChildren(local.children, renderProps)}
        </Provider>
      )}
    </ModalOverlayPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Drawer Container (upstream `Drawer.Content`)
 * -----------------------------------------------------------------------------------------------*/
interface DrawerContainerProps extends Omit<ModalOverlayProps, Exclude<keyof DrawerBackdropProps, "children" | "class">> {
  placement?: DrawerPlacement;
}

const DrawerContainer = (props: DrawerContainerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "placement"]);
  const context = useContext(DrawerContext);
  const placement = local.placement ?? context.placement ?? "bottom";
  const classOf = () =>
    composeTwRenderProps(local.class as never, variantSlots({ placement: local.placement ?? context.placement ?? "bottom" }).content()) as
      string | ((v: ModalRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "placement"]) ? (values: ModalRenderProps) => renderClass(classOf(), values) : classOf();
  const updated: DrawerContext = { inDrawer: true, placement, isDismissable: context.isDismissable };

  return (
    <ModalPrimitive class={cls as never} data-placement={placement} data-slot="drawer-content" {...rest}>
      {(renderProps: ModalRenderProps) => (
        <Provider token={DrawerContext} value={updated}>
          {renderChildren(local.children, renderProps)}
        </Provider>
      )}
    </ModalPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Drawer Dialog
 * -----------------------------------------------------------------------------------------------*/
type DrawerDialogProps = Omit<DialogPrimitiveProps, "class"> & {
  class?: string;
};

const DrawerDialog = (props: DrawerDialogProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(DrawerContext);
  const isDismissable = context.isDismissable ?? true;
  const placement = context.placement;
  const overlayState = useContext(OverlayTriggerStateContext) as OverlayTriggerState | null | undefined;
  const dialogRef = createRef<HTMLElement>();
  // Drag-to-dismiss (upstream `useDrawerDrag`) while the dialog is mounted.
  clientEffect(() => {
    const el = dialogRef();
    if (!el || !isDismissable) return;
    return drawerDrag(el, { placement, close: () => overlayState && closeOverlay(overlayState) });
  });
  const classOf = () => composeSlotClassName(slotsOf(context)?.dialog, local.class) ?? "";
  const cls = hasLiveProp(local, ["class"]) ? () => classOf() : classOf();
  const content = () => (
    <DialogPrimitive
      ref={dialogRef}
      class={cls as never}
      data-placement={placement}
      data-slot="drawer-dialog"
      style={isDismissable ? { touchAction: "none" } : undefined}
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
 * Drawer Header / Body / Footer
 * -----------------------------------------------------------------------------------------------*/
interface DrawerPartProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type DrawerHeaderProps<E extends keyof JSX.IntrinsicElements = "div"> = DrawerPartProps<E>;
type DrawerBodyProps<E extends keyof JSX.IntrinsicElements = "div"> = DrawerPartProps<E>;
type DrawerFooterProps<E extends keyof JSX.IntrinsicElements = "div"> = DrawerPartProps<E>;
type DrawerHandleProps<E extends keyof JSX.IntrinsicElements = "div"> = DrawerPartProps<E>;

/** Part props for the default element (`div`). */
type DrawerPartDivProps = DrawerPartProps & Omit<JSX.IntrinsicElements["div"], keyof DrawerPartProps>;

const DrawerHeader = <E extends keyof JSX.IntrinsicElements = "div">(props: DrawerHeaderProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as DrawerPartDivProps, ["children", "class"]);
  const context = useContext(DrawerContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.header, local.class)} data-slot="drawer-header" {...rest}>
      {withLabel(local.children, DrawerHeading)}
    </dom.div>
  );
};

const DrawerBody = <E extends keyof JSX.IntrinsicElements = "div">(props: DrawerBodyProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as DrawerPartDivProps, ["children", "class"]);
  const context = useContext(DrawerContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.body, local.class)} data-slot="drawer-body" style={{ touchAction: "pan-y" }} {...rest}>
      {local.children}
    </dom.div>
  );
};

const DrawerFooter = <E extends keyof JSX.IntrinsicElements = "div">(props: DrawerFooterProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as DrawerPartDivProps, ["children", "class"]);
  const context = useContext(DrawerContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.footer, local.class)} data-slot="drawer-footer" {...rest}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Drawer Heading
 * -----------------------------------------------------------------------------------------------*/
type DrawerHeadingProps = HeadingPrimitiveProps & {};

const DrawerHeading = (props: DrawerHeadingProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(DrawerContext);

  return (
    <HeadingPrimitive
      class={composeSlotClassName(slotsOf(context)?.heading, local.class as string | undefined)}
      data-slot="drawer-heading"
      slot="title"
      {...rest}
    >
      {local.children}
    </HeadingPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Drawer Handle
 * -----------------------------------------------------------------------------------------------*/
const DrawerHandle = <E extends keyof JSX.IntrinsicElements = "div">(props: DrawerHandleProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as DrawerPartDivProps, ["children", "class"]);
  const context = useContext(DrawerContext);

  return (
    <dom.div aria-hidden="true" class={composeSlotClassName(slotsOf(context)?.handle, local.class)} data-slot="drawer-handle" {...rest}>
      <div data-slot="drawer-handle-bar" />
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Drawer Close Trigger
 * -----------------------------------------------------------------------------------------------*/
type DrawerCloseTriggerProps = CloseButtonRootProps & {
  children?: Content;
};

const DrawerCloseTrigger = (props: DrawerCloseTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(DrawerContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.closeTrigger()) as string | ((v: never) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: never) => renderClass(classOf(), values) : classOf();

  return <CloseButton class={cls as never} data-slot="drawer-close-trigger" slot="close" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Drawer Content (Rivet)
 * -----------------------------------------------------------------------------------------------*/
type DrawerContentProps = Omit<DrawerDialogProps, "children"> &
  Pick<DrawerBackdropProps, "isOpen" | "defaultOpen" | "onOpenChange" | "isDismissable" | "isKeyboardDismissDisabled" | "shouldCloseOnInteractOutside"> & {
    /** Backdrop style (`Drawer.Backdrop` `variant`). @default "opaque" */
    backdrop?: DrawerVariants["variant"];
    /** Render a `Drawer.CloseTrigger` before the content. @default true */
    closeButton?: boolean;
    /** The side the drawer slides in from (default: the root's `placement`, else `"bottom"`). */
    placement?: DrawerPlacement;
    children?: Content | ((opts: DialogRenderProps) => Content);
  };

/** `Drawer.Backdrop` + `Drawer.Container` + `Drawer.Dialog` (+ `Drawer.CloseTrigger`): the parts without an own choice, folded. */
const DrawerContent = (props: DrawerContentProps): JSX.Element => {
  const [local, others] = splitLive(props, ["backdrop", "children", "closeButton", "placement"]);
  const [overlay, rest] = splitLive(others, [
    "isOpen",
    "defaultOpen",
    "onOpenChange",
    "isDismissable",
    "isKeyboardDismissDisabled",
    "shouldCloseOnInteractOutside",
  ]);
  const children = local.children;
  return (
    <DrawerBackdrop variant={local.backdrop} {...overlay}>
      <DrawerContainer placement={local.placement}>
        <DrawerDialog {...rest}>
          {(renderProps: DialogRenderProps) => (
            <>
              {local.closeButton !== false && <DrawerCloseTrigger />}
              {renderSlot(children, renderProps)}
            </>
          )}
        </DrawerDialog>
      </DrawerContainer>
    </DrawerBackdrop>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  DrawerRoot,
  DrawerTrigger,
  DrawerBackdrop,
  DrawerContainer,
  DrawerContent,
  DrawerDialog,
  DrawerHeader,
  DrawerHeading,
  DrawerBody,
  DrawerFooter,
  DrawerHandle,
  DrawerCloseTrigger,
};

export type {
  DrawerRootProps,
  DrawerTriggerProps,
  DrawerBackdropProps,
  DrawerContainerProps,
  DrawerContentProps,
  DrawerDialogProps,
  DrawerHeaderProps,
  DrawerHeadingProps,
  DrawerBodyProps,
  DrawerFooterProps,
  DrawerHandleProps,
  DrawerPartDivProps,
  DrawerCloseTriggerProps,
  DrawerPlacement,
};
