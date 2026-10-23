// Ported from HeroUI v3.2.6 packages/react/src/components/modal/modal.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components` → `@rivetjs/cdk` (`dialog` `DialogTrigger` /
//   `Dialog`, `heading`, `modal` `ModalOverlay` / `Modal` on the div overlay layer, `interactions/pressable`); `@heroui/styles`
//   → vendored `styles/`; `mergeProps` (`state` → `isOpen` / `onOpenChange`) → a plain spread (no handler chaining needed:
//   `state` is the only source).
// - `ModalContext` carries plain data instead of the tv `slots` object: `{ inModal, scroll, size, placement }` (resumable token
//   `rv-ui-modal`, default `{}` → parts outside a `Modal` get only their `class`). Slots = `modalVariants({ scroll, size })`,
//   memoized per variant key at module level (upstream: `useMemo` per part). `Modal.Backdrop` provides nothing (upstream merges
//   `modalVariants({ variant })` slots, which only change the backdrop slot it renders itself);
//   `Modal.Container` provides `{ scroll, size, placement }` (upstream: `{ placement, slots: modalVariants({ scroll, size }) }`).
// - `state` (`useOverlayState()`): `isOpen` = its read-only accessor (controlled) + `onOpenChange` → `state.setOpen`.
// - `Modal.Container` hands the cdk part a render-function child that provides the context (upstream: the same); function
//   children: `typeof children === "function"` → `!isSlot(children)` (Rivet JSX children are compiler slots). `Modal.Backdrop`
//   passes its children straight to the cdk part (upstream's wrapper re-provides the same context; its stray `{" "}` text node
//   after the children is dropped).
// - `Modal.Trigger`: cdk `Pressable` takes a render-function child (no clone): the `dom.div` spreads its press / focus props.
// - Rivet addition `Modal.Content` = Backdrop + Container + Dialog (identity spec §4.2: wrappers without an own choice fold):
//   `backdrop` → Backdrop `variant`, overlay state / dismiss props → Backdrop, `placement` / `scroll` / `size` → Container,
//   `class` + the rest → Dialog; a `Modal.CloseTrigger` first unless `closeButton={false}`. Explicit parts stay exported.
// - Rivet: `Modal.Header` wraps string / number children in a `Modal.Heading` (the dialog's `aria-labelledby` title).
// - Live `class` / variant props → a render-prop function for the cdk part (the composed class is a local: it reaches the cdk part as a plain value); the context values
//   for descendants (`scroll`, `size`, `placement`) are read once.
import { Dialog as DialogPrimitive, DialogTrigger as ModalTriggerPrimitive } from "@rivetjs/cdk/dialog";
import type { DialogProps as DialogPrimitiveProps, DialogRenderProps, DialogTriggerProps } from "@rivetjs/cdk/dialog";
import { Heading as HeadingPrimitive } from "@rivetjs/cdk/heading";
import type { HeadingProps as HeadingPrimitiveProps } from "@rivetjs/cdk/heading";
import { Pressable as PressablePrimitive } from "@rivetjs/cdk/interactions/pressable";
import { ModalOverlay as ModalOverlayPrimitive, Modal as ModalPrimitive } from "@rivetjs/cdk/modal";
import { overlayMotion } from "../../utils/overlay-motion.ts";
import { portalTheme } from "../../utils/portal-theme.ts";
import type { ModalOverlayProps, ModalRenderProps } from "@rivetjs/cdk/modal";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";

import type { ModalVariants } from "../../../styles/src/components/modal/index.ts";
import { modalVariants } from "../../../styles/src/components/modal/index.ts";
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

const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

type ModalPlacement = "auto" | "top" | "center" | "bottom";

/* -------------------------------------------------------------------------------------------------
 * Modal Context
 * -----------------------------------------------------------------------------------------------*/
type ModalContext = {
  /** Rivet: set by `Modal` (upstream: `slots`). */
  inModal?: boolean;
  scroll?: ModalVariants["scroll"];
  size?: ModalVariants["size"];
  placement?: ModalPlacement;
};

const ModalContext = createContext<ModalContext>({});

type ModalSlots = ReturnType<typeof modalVariants>;
const SLOTS = new Map<string, ModalSlots>();
/** `modalVariants(variants)`, one object per variant combination. */
const variantSlots = (variants: { scroll?: ModalVariants["scroll"]; size?: ModalVariants["size"]; variant?: ModalVariants["variant"] }): ModalSlots => {
  const key = `${variants.scroll}|${variants.size}|${variants.variant}`;
  let slots = SLOTS.get(key);
  if (!slots) SLOTS.set(key, (slots = modalVariants(variants)));
  return slots;
};
/** Upstream `use(ModalContext).slots`: inside a `Modal` the slots of the nearest container's variants, `undefined` outside. */
const slotsOf = (context: ModalContext): ModalSlots | undefined => (context.inModal ? variantSlots({ scroll: context.scroll, size: context.size }) : undefined);

const ROOT_CONTEXT: ModalContext = { inModal: true };

/* -------------------------------------------------------------------------------------------------
 * Modal Root
 * -----------------------------------------------------------------------------------------------*/
interface ModalRootProps extends DialogTriggerProps {
  state?: UseOverlayStateReturn;
}

const ModalRoot = (props: ModalRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "state"]);
  const state = local.state;
  const controlledProps = state ? { isOpen: state.isOpen, onOpenChange: (isOpen: boolean) => state.setOpen(isOpen) } : {};
  const children = local.children;
  // A function: Rivet JSX builds nodes eagerly, the trigger must be created inside the provider.
  const content = () => (
    <ModalTriggerPrimitive data-slot="modal-root" {...rest} {...controlledProps}>
      {children}
    </ModalTriggerPrimitive>
  );

  return (
    <Provider token={ModalContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Modal Trigger
 * -----------------------------------------------------------------------------------------------*/
interface ModalTriggerProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `ModalTrigger` props for the default element (`div`). */
type ModalTriggerDivProps = ModalTriggerProps & Omit<JSX.IntrinsicElements["div"], keyof ModalTriggerProps>;

const ModalTrigger = <E extends keyof JSX.IntrinsicElements = "div">(props: ModalTriggerProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ModalTriggerDivProps, ["children", "class"]);
  const context = useContext(ModalContext);

  return (
    <PressablePrimitive>
      {(pressProps: Record<string, unknown>) => (
        <dom.div
          class={composeSlotClassName(slotsOf(context)?.trigger, local.class)}
          data-slot="modal-trigger"
          role="button"
          {...pressProps}
          {...rest}
          ref={pressProps.ref as never}
        >
          {local.children}
        </dom.div>
      )}
    </PressablePrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Modal Backdrop
 * -----------------------------------------------------------------------------------------------*/
interface ModalBackdropProps extends ModalOverlayProps {
  variant?: ModalVariants["variant"];
  /**
   * Whether to close the modal when the user interacts outside it.
   * @default true
   */
  isDismissable?: boolean;
}

const ModalBackdrop = (props: ModalBackdropProps): JSX.Element => {
  overlayMotion();
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "isDismissable", "onClick", "variant"]);
  const classOf = () =>
    composeTwRenderProps(local.class as never, variantSlots({ variant: local.variant }).backdrop()) as string | ((v: ModalRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: ModalRenderProps) => renderClass(classOf(), values) : classOf();
  const onClick = local.onClick as ((event: MouseEvent) => void) | undefined;

  // The cdk part renders function children with its render props (upstream's `(renderProps) => …` wrapper re-provides the
  // root context unchanged: not needed).
  return (
    <ModalOverlayPrimitive
      class={cls as never}
      data-slot="modal-backdrop"
      isDismissable={local.isDismissable ?? true}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      {...rest}
    >
      {local.children}
    </ModalOverlayPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Modal Container
 * -----------------------------------------------------------------------------------------------*/
interface ModalContainerProps extends Omit<ModalOverlayProps, Exclude<keyof ModalBackdropProps, "children" | "class">> {
  placement?: ModalPlacement;
  scroll?: ModalVariants["scroll"];
  size?: ModalVariants["size"];
}

const ModalContainer = (props: ModalContainerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "placement", "scroll", "size"]);
  const placement = local.placement ?? "auto";
  const classOf = () =>
    composeTwRenderProps(local.class as never, variantSlots({ scroll: local.scroll, size: local.size }).container()) as
      string | ((v: ModalRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "scroll", "size"]) ? (values: ModalRenderProps) => renderClass(classOf(), values) : classOf();
  const updated: ModalContext = { inModal: true, placement, scroll: local.scroll, size: local.size };

  return (
    <ModalPrimitive class={cls as never} data-placement={placement} data-slot="modal-container" {...rest}>
      {(renderProps: ModalRenderProps) => (
        <Provider token={ModalContext} value={updated}>
          {typeof local.children === "function" && !isSlot(local.children)
            ? (local.children as (v: ModalRenderProps) => Content)(renderProps)
            : (local.children as Content)}
        </Provider>
      )}
    </ModalPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Modal Dialog
 * -----------------------------------------------------------------------------------------------*/
type ModalDialogProps = Omit<DialogPrimitiveProps, "class"> & {
  class?: string;
};

const ModalDialog = (props: ModalDialogProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ModalContext);
  const classOf = () => composeSlotClassName(slotsOf(context)?.dialog, local.class) ?? "";
  const cls = hasLiveProp(local, ["class"]) ? () => classOf() : classOf();
  const content = () => (
    <DialogPrimitive class={cls as never} data-placement={context.placement} data-slot="modal-dialog" {...rest}>
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
 * Modal Header / Body / Footer / Icon
 * -----------------------------------------------------------------------------------------------*/
interface ModalPartProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type ModalHeaderProps<E extends keyof JSX.IntrinsicElements = "div"> = ModalPartProps<E>;
type ModalBodyProps<E extends keyof JSX.IntrinsicElements = "div"> = ModalPartProps<E>;
type ModalFooterProps<E extends keyof JSX.IntrinsicElements = "div"> = ModalPartProps<E>;
type ModalIconProps<E extends keyof JSX.IntrinsicElements = "div"> = ModalPartProps<E>;

/** Part props for the default element (`div`). */
type ModalPartDivProps = ModalPartProps & Omit<JSX.IntrinsicElements["div"], keyof ModalPartProps>;

const ModalHeader = <E extends keyof JSX.IntrinsicElements = "div">(props: ModalHeaderProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ModalPartDivProps, ["children", "class"]);
  const context = useContext(ModalContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.header, local.class)} data-slot="modal-header" {...rest}>
      {withLabel(local.children, ModalHeading)}
    </dom.div>
  );
};

const ModalBody = <E extends keyof JSX.IntrinsicElements = "div">(props: ModalBodyProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ModalPartDivProps, ["children", "class"]);
  const context = useContext(ModalContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.body, local.class)} data-slot="modal-body" {...rest}>
      {local.children}
    </dom.div>
  );
};

const ModalFooter = <E extends keyof JSX.IntrinsicElements = "div">(props: ModalFooterProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ModalPartDivProps, ["children", "class"]);
  const context = useContext(ModalContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.footer, local.class)} data-slot="modal-footer" {...rest}>
      {local.children}
    </dom.div>
  );
};

const ModalIcon = <E extends keyof JSX.IntrinsicElements = "div">(props: ModalIconProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ModalPartDivProps, ["children", "class"]);
  const context = useContext(ModalContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.icon, local.class)} data-slot="modal-icon" {...rest}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Modal Heading
 * -----------------------------------------------------------------------------------------------*/
type ModalHeadingProps = HeadingPrimitiveProps & {};

const ModalHeading = (props: ModalHeadingProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ModalContext);

  return (
    <HeadingPrimitive
      class={composeSlotClassName(slotsOf(context)?.heading, local.class as string | undefined)}
      data-slot="modal-heading"
      slot="title"
      {...rest}
    >
      {local.children}
    </HeadingPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Modal Close Trigger
 * -----------------------------------------------------------------------------------------------*/
type ModalCloseTriggerProps = CloseButtonRootProps & {
  children?: Content;
};

const ModalCloseTrigger = (props: ModalCloseTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(ModalContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.closeTrigger()) as string | ((v: never) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: never) => renderClass(classOf(), values) : classOf();

  return <CloseButton class={cls as never} data-slot="modal-close-trigger" slot="close" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Modal Content (Rivet)
 * -----------------------------------------------------------------------------------------------*/
type ModalContentProps = Omit<ModalDialogProps, "children"> &
  Pick<ModalBackdropProps, "isOpen" | "defaultOpen" | "onOpenChange" | "isDismissable" | "isKeyboardDismissDisabled" | "shouldCloseOnInteractOutside"> & {
    /** Backdrop style (`Modal.Backdrop` `variant`). @default "opaque" */
    backdrop?: ModalVariants["variant"];
    /** Render a `Modal.CloseTrigger` before the content. @default true */
    closeButton?: boolean;
    placement?: ModalPlacement;
    scroll?: ModalVariants["scroll"];
    size?: ModalVariants["size"];
    children?: Content | ((opts: DialogRenderProps) => Content);
  };

/** `Modal.Backdrop` + `Modal.Container` + `Modal.Dialog` (+ `Modal.CloseTrigger`): the parts without an own choice, folded. */
const ModalContent = (props: ModalContentProps): JSX.Element => {
  const [local, others] = splitLive(props, ["backdrop", "children", "closeButton", "placement", "scroll", "size"]);
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
    <ModalBackdrop variant={local.backdrop} {...overlay}>
      <ModalContainer placement={local.placement} scroll={local.scroll} size={local.size}>
        <ModalDialog {...rest}>
          {(renderProps: DialogRenderProps) => (
            <>
              {local.closeButton !== false && <ModalCloseTrigger />}
              {renderSlot(children, renderProps)}
            </>
          )}
        </ModalDialog>
      </ModalContainer>
    </ModalBackdrop>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  ModalRoot,
  ModalTrigger,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalContent,
  ModalHeader,
  ModalIcon,
  ModalHeading,
  ModalBody,
  ModalFooter,
  ModalCloseTrigger,
};

export type {
  ModalRootProps,
  ModalTriggerProps,
  ModalTriggerDivProps,
  ModalBackdropProps,
  ModalContainerProps,
  ModalDialogProps,
  ModalContentProps,
  ModalHeaderProps,
  ModalIconProps,
  ModalHeadingProps,
  ModalBodyProps,
  ModalFooterProps,
  ModalPartDivProps,
  ModalCloseTriggerProps,
  ModalPlacement,
};
