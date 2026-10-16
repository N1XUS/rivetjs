// Ported from HeroUI v3.2.6 packages/react/src/components/alert-dialog/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types (`AlertDialogIconDivProps` for the generic icon); `@heroui/styles` →
// vendored `styles/`.
import {
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogCloseTrigger,
  AlertDialogContainer,
  AlertDialogDialog,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogHeading,
  AlertDialogIcon,
  AlertDialogRoot,
  AlertDialogTrigger,
} from "./alert-dialog.tsx";
import type {
  AlertDialogBackdropProps,
  AlertDialogBodyProps,
  AlertDialogCloseTriggerProps,
  AlertDialogContainerProps,
  AlertDialogDialogProps,
  AlertDialogFooterProps,
  AlertDialogHeaderProps,
  AlertDialogHeadingProps,
  AlertDialogIconDivProps,
  AlertDialogRootProps,
  AlertDialogTriggerProps,
} from "./alert-dialog.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const AlertDialog = Object.assign(AlertDialogRoot, {
  Root: AlertDialogRoot,
  Trigger: AlertDialogTrigger,
  Backdrop: AlertDialogBackdrop,
  Container: AlertDialogContainer,
  Dialog: AlertDialogDialog,
  Header: AlertDialogHeader,
  Heading: AlertDialogHeading,
  Body: AlertDialogBody,
  Footer: AlertDialogFooter,
  Icon: AlertDialogIcon,
  CloseTrigger: AlertDialogCloseTrigger,
});

export type AlertDialog = {
  Props: AlertDialogRootProps;
  RootProps: AlertDialogRootProps;
  TriggerProps: AlertDialogTriggerProps;
  BackdropProps: AlertDialogBackdropProps;
  ContainerProps: AlertDialogContainerProps;
  DialogProps: AlertDialogDialogProps;
  HeaderProps: AlertDialogHeaderProps;
  HeadingProps: AlertDialogHeadingProps;
  BodyProps: AlertDialogBodyProps;
  FooterProps: AlertDialogFooterProps;
  IconProps: AlertDialogIconDivProps;
  CloseTriggerProps: AlertDialogCloseTriggerProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
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
  AlertDialogRootProps as AlertDialogProps,
  AlertDialogTriggerProps,
  AlertDialogBackdropProps,
  AlertDialogContainerProps,
  AlertDialogDialogProps,
  AlertDialogHeaderProps,
  AlertDialogHeadingProps,
  AlertDialogBodyProps,
  AlertDialogFooterProps,
  AlertDialogIconProps,
  AlertDialogCloseTriggerProps,
} from "./alert-dialog.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { alertDialogVariants } from "../../../styles/src/components/alert-dialog/index.ts";

export type { AlertDialogVariants } from "../../../styles/src/components/alert-dialog/index.ts";
