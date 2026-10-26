// Ported from HeroUI v3.2.6 packages/react/src/components/alert-dialog/alert-dialog.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components` → `@rivetjs/cdk` (`dialog` `DialogTrigger` /
//   `Dialog`, `heading`, `modal` `ModalOverlay` / `Modal` on the div overlay layer, `interactions/pressable`); `@heroui/styles`
//   → vendored `styles/`.
// - `AlertDialogContext` carries plain data instead of the tv `slots` object: `{ inAlertDialog, size, placement }` (resumable
//   token `rv-ui-alert-dialog`, default `{}` → parts outside an `AlertDialog` get only their `class`). Slots =
//   `alertDialogVariants({ size })`, memoized per key at module level (upstream: `useMemo` per part). `AlertDialog.Backdrop`
//   provides nothing (its `variant` only changes its own slot) and passes children straight to the cdk part (upstream's
//   wrapper re-provides the same context; its stray `{" "}` text node is dropped); `AlertDialog.Container` re-provides
//   `{ size, placement }` through a render-function child (function children: `!isSlot(children)`).
// - `AlertDialog.Icon` default icons: upstream's inline `InfoIcon` / `SuccessIcon` / `WarningIcon` / `DangerIcon` svgs →
//   lucide `Info` / `CircleCheck` / `TriangleAlert` / `CircleAlert` via `@rivetjs/kit/icon` (as `Alert`), same
//   `data-slot="alert-dialog-default-icon"` (the vendored CSS sizes it). Visual diff (stroked lucide vs filled glyphs).
// - `AlertDialog.Trigger`: cdk `Pressable` takes a render-function child (no clone): the `div` spreads its press / focus props.
// - Live `class` / variant props → a render-prop function for the cdk part (the composed class is a local: it reaches the cdk part as a plain value); the context values
//   for descendants (`size`, `placement`) are read once.
import { Dialog as DialogPrimitive, DialogTrigger as AlertDialogTriggerPrimitive } from "@rivetjs/cdk/dialog";
import type { DialogProps as DialogPrimitiveProps, DialogTriggerProps } from "@rivetjs/cdk/dialog";
import { Heading as HeadingPrimitive } from "@rivetjs/cdk/heading";
import type { HeadingProps as HeadingPrimitiveProps } from "@rivetjs/cdk/heading";
import { Pressable as PressablePrimitive } from "@rivetjs/cdk/interactions/pressable";
import { ModalOverlay as ModalOverlayPrimitive, Modal as ModalPrimitive } from "@rivetjs/cdk/modal";
import { overlayMotion } from "../../utils/overlay-motion.ts";
import { portalTheme } from "../../utils/portal-theme.ts";
import type { ModalOverlayProps, ModalRenderProps } from "@rivetjs/cdk/modal";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide";

import type { AlertDialogVariants } from "../../../styles/src/components/alert-dialog/index.ts";
import { alertDialogVariants } from "../../../styles/src/components/alert-dialog/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { CloseButton } from "../close-button/index.ts";
import type { CloseButtonRootProps } from "../close-button/index.ts";

type AlertDialogPlacement = "auto" | "top" | "center" | "bottom";

type AlertDialogStatus = "default" | "accent" | "success" | "warning" | "danger";

/* -------------------------------------------------------------------------------------------------
 * AlertDialog Context
 * -----------------------------------------------------------------------------------------------*/
type AlertDialogContext = {
  /** Rivet: set by `AlertDialog` (upstream: `slots`). */
  inAlertDialog?: boolean;
  size?: AlertDialogVariants["size"];
  placement?: AlertDialogPlacement;
};

const AlertDialogContext = createContext<AlertDialogContext>({});

type AlertDialogSlots = ReturnType<typeof alertDialogVariants>;
const SLOTS = new Map<string, AlertDialogSlots>();
// @rivet-class-resolvers variantSlots
/** `alertDialogVariants(variants)`, one object per variant combination. */
const variantSlots = (variants: {
  size?: AlertDialogVariants["size"];
  status?: AlertDialogVariants["status"];
  variant?: AlertDialogVariants["variant"];
}): AlertDialogSlots => {
  const key = `${variants.size}|${variants.status}|${variants.variant}`;
  let slots = SLOTS.get(key);
  if (!slots) SLOTS.set(key, (slots = alertDialogVariants(variants)));
  return slots;
};
/** Upstream `use(AlertDialogContext).slots`: inside an `AlertDialog` the slots of the nearest container's size, `undefined` outside. */
const slotsOf = (context: AlertDialogContext): AlertDialogSlots | undefined => (context.inAlertDialog ? variantSlots({ size: context.size }) : undefined);

const ROOT_CONTEXT: AlertDialogContext = { inAlertDialog: true };

/* -------------------------------------------------------------------------------------------------
 * AlertDialog Root
 * -----------------------------------------------------------------------------------------------*/
type AlertDialogRootProps = DialogTriggerProps;

const AlertDialogRoot = (props: AlertDialogRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children"]);
  // A function: Rivet JSX builds nodes eagerly, the trigger must be created inside the provider.
  const content = () => (
    <AlertDialogTriggerPrimitive data-slot="alert-dialog-root" {...rest}>
      {local.children}
    </AlertDialogTriggerPrimitive>
  );

  return (
    <Provider token={AlertDialogContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AlertDialog Trigger
 * -----------------------------------------------------------------------------------------------*/
type AlertDialogTriggerProps = JSX.IntrinsicElements["div"];

const AlertDialogTrigger = (props: AlertDialogTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(AlertDialogContext);

  return (
    <PressablePrimitive>
      {(pressProps: Record<string, unknown>) => (
        <div
          class={composeSlotClassName(slotsOf(context)?.trigger, local.class as string | undefined)}
          data-slot="alert-dialog-trigger"
          role="button"
          {...(pressProps as JSX.IntrinsicElements["div"])}
          {...rest}
          ref={pressProps.ref as never}
        >
          {local.children}
        </div>
      )}
    </PressablePrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AlertDialog Backdrop
 * -----------------------------------------------------------------------------------------------*/
interface AlertDialogBackdropProps extends ModalOverlayProps {
  variant?: AlertDialogVariants["variant"];
  /**
   * Whether to close the alert dialog when the user interacts outside it.
   * Alert dialogs typically require explicit action, so this defaults to false.
   * @default false
   */
  isDismissable?: boolean;
  /**
   * Whether pressing the escape key to close the modal should be disabled.
   * Alert dialogs typically require explicit action, so this defaults to true.
   * @default true
   */
  isKeyboardDismissDisabled?: boolean;
}

const AlertDialogBackdrop = (props: AlertDialogBackdropProps): JSX.Element => {
  overlayMotion();
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "isDismissable", "isKeyboardDismissDisabled", "onClick", "variant"]);
  const classOf = () =>
    composeTwRenderProps(local.class as never, variantSlots({ variant: local.variant }).backdrop()) as string | ((v: ModalRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: ModalRenderProps) => renderClass(classOf(), values) : classOf();
  const onClick = local.onClick as ((event: MouseEvent) => void) | undefined;

  return (
    <ModalOverlayPrimitive
      class={cls as never}
      data-slot="alert-dialog-backdrop"
      isDismissable={local.isDismissable ?? false}
      isKeyboardDismissDisabled={local.isKeyboardDismissDisabled ?? true}
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
 * AlertDialog Container
 * -----------------------------------------------------------------------------------------------*/
interface AlertDialogContainerProps extends Omit<ModalOverlayProps, Exclude<keyof AlertDialogBackdropProps, "children" | "class">> {
  /**
   * The placement of the alert dialog on the screen.
   * @default "auto"
   */
  placement?: AlertDialogPlacement;
  size?: AlertDialogVariants["size"];
}

const AlertDialogContainer = (props: AlertDialogContainerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "placement", "size"]);
  const placement = local.placement ?? "auto";
  const classOf = () =>
    composeTwRenderProps(local.class as never, variantSlots({ size: local.size }).container()) as string | ((v: ModalRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "size"]) ? (values: ModalRenderProps) => renderClass(classOf(), values) : classOf();
  const updated: AlertDialogContext = { inAlertDialog: true, placement, size: local.size };

  return (
    <ModalPrimitive class={cls as never} data-placement={placement} data-slot="alert-dialog-container" {...rest}>
      {(renderProps: ModalRenderProps) => (
        <Provider token={AlertDialogContext} value={updated}>
          {typeof local.children === "function" && !isSlot(local.children)
            ? (local.children as (v: ModalRenderProps) => Content)(renderProps)
            : (local.children as Content)}
        </Provider>
      )}
    </ModalPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AlertDialog Dialog
 * -----------------------------------------------------------------------------------------------*/
type AlertDialogDialogProps = Omit<DialogPrimitiveProps, "class"> & {
  class?: string;
};

const AlertDialogDialog = (props: AlertDialogDialogProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(AlertDialogContext);
  const classOf = () => composeSlotClassName(slotsOf(context)?.dialog, local.class) ?? "";
  const cls = hasLiveProp(local, ["class"]) ? () => classOf() : classOf();

  return (
    <DialogPrimitive class={cls as never} data-placement={context.placement} data-slot="alert-dialog-dialog" role="alertdialog" {...rest}>
      {local.children}
    </DialogPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AlertDialog Header / Body / Footer
 * -----------------------------------------------------------------------------------------------*/
type AlertDialogHeaderProps = JSX.IntrinsicElements["div"];
type AlertDialogBodyProps = JSX.IntrinsicElements["div"];
type AlertDialogFooterProps = JSX.IntrinsicElements["div"];

const AlertDialogHeader = (props: AlertDialogHeaderProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(AlertDialogContext);

  return (
    <div class={composeSlotClassName(slotsOf(context)?.header, local.class as string | undefined)} data-slot="alert-dialog-header" {...rest}>
      {local.children}
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AlertDialog Heading
 * -----------------------------------------------------------------------------------------------*/
type AlertDialogHeadingProps = HeadingPrimitiveProps & {};

const AlertDialogHeading = (props: AlertDialogHeadingProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(AlertDialogContext);

  return (
    <HeadingPrimitive
      class={composeSlotClassName(slotsOf(context)?.heading, local.class as string | undefined)}
      data-slot="alert-dialog-heading"
      slot="title"
      {...rest}
    >
      {local.children}
    </HeadingPrimitive>
  );
};

const AlertDialogBody = (props: AlertDialogBodyProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(AlertDialogContext);

  return (
    <div class={composeSlotClassName(slotsOf(context)?.body, local.class as string | undefined)} data-slot="alert-dialog-body" {...rest}>
      {local.children}
    </div>
  );
};

const AlertDialogFooter = (props: AlertDialogFooterProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(AlertDialogContext);

  return (
    <div class={composeSlotClassName(slotsOf(context)?.footer, local.class as string | undefined)} data-slot="alert-dialog-footer" {...rest}>
      {local.children}
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AlertDialog Icon
 * -----------------------------------------------------------------------------------------------*/
interface AlertDialogIconProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
  /**
   * The semantic status of the icon, affects background color and default icon
   * @default "danger"
   */
  status?: AlertDialogStatus;
}

/** `AlertDialogIcon` props for the default element (`div`). */
type AlertDialogIconDivProps = AlertDialogIconProps & Omit<JSX.IntrinsicElements["div"], keyof AlertDialogIconProps>;

const AlertDialogIcon = <E extends keyof JSX.IntrinsicElements = "div">(props: AlertDialogIconProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as AlertDialogIconDivProps, ["children", "class", "status"]);
  const status = () => local.status ?? "danger";

  const getDefaultIcon = () => {
    switch (status()) {
      case "default":
        return <Icon icon={Info} data-slot="alert-dialog-default-icon" />;
      case "accent":
        return <Icon icon={Info} data-slot="alert-dialog-default-icon" />;
      case "success":
        return <Icon icon={CircleCheck} data-slot="alert-dialog-default-icon" />;
      case "warning":
        return <Icon icon={TriangleAlert} data-slot="alert-dialog-default-icon" />;
      case "danger":
        return <Icon icon={CircleAlert} data-slot="alert-dialog-default-icon" />;
      default:
        return <Icon icon={CircleAlert} data-slot="alert-dialog-default-icon" />;
    }
  };

  return (
    <dom.div class={variantSlots({ status: status() }).icon({ class: local.class })} data-slot="alert-dialog-icon" {...rest}>
      {local.children ?? getDefaultIcon()}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AlertDialog Close Trigger
 * -----------------------------------------------------------------------------------------------*/
type AlertDialogCloseTriggerProps = CloseButtonRootProps;

const AlertDialogCloseTrigger = (props: AlertDialogCloseTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(AlertDialogContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.closeTrigger()) as string | ((v: never) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: never) => renderClass(classOf(), values) : classOf();

  return <CloseButton class={cls as never} data-slot="alert-dialog-close-trigger" slot="close" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  AlertDialogRoot,
  AlertDialogTrigger,
  AlertDialogBackdrop,
  AlertDialogContainer,
  AlertDialogDialog,
  AlertDialogHeader,
  AlertDialogHeading,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogIcon,
  AlertDialogCloseTrigger,
};

export type {
  AlertDialogRootProps,
  AlertDialogTriggerProps,
  AlertDialogBackdropProps,
  AlertDialogContainerProps,
  AlertDialogDialogProps,
  AlertDialogHeaderProps,
  AlertDialogHeadingProps,
  AlertDialogBodyProps,
  AlertDialogFooterProps,
  AlertDialogIconProps,
  AlertDialogIconDivProps,
  AlertDialogCloseTriggerProps,
  AlertDialogStatus,
  AlertDialogPlacement,
};
