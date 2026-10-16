// Ported from HeroUI v3.2.6 packages/react/src/components/modal/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types (`…DivProps` for the generic `div` parts); `@heroui/styles` →
// vendored `styles/`.
import {
  ModalBackdrop,
  ModalBody,
  ModalCloseTrigger,
  ModalContainer,
  ModalContent,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalHeading,
  ModalIcon,
  ModalRoot,
  ModalTrigger,
} from "./modal.tsx";
import type {
  ModalBackdropProps,
  ModalCloseTriggerProps,
  ModalContainerProps,
  ModalContentProps,
  ModalDialogProps,
  ModalHeadingProps,
  ModalPartDivProps,
  ModalRootProps,
  ModalTriggerDivProps,
} from "./modal.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Modal = Object.assign(ModalRoot, {
  Root: ModalRoot,
  Trigger: ModalTrigger,
  Backdrop: ModalBackdrop,
  Container: ModalContainer,
  Dialog: ModalDialog,
  Content: ModalContent,
  Header: ModalHeader,
  Icon: ModalIcon,
  Heading: ModalHeading,
  Body: ModalBody,
  Footer: ModalFooter,
  CloseTrigger: ModalCloseTrigger,
});

export type Modal = {
  Props: ModalRootProps;
  RootProps: ModalRootProps;
  TriggerProps: ModalTriggerDivProps;
  BackdropProps: ModalBackdropProps;
  ContainerProps: ModalContainerProps;
  DialogProps: ModalDialogProps;
  ContentProps: ModalContentProps;
  HeaderProps: ModalPartDivProps;
  IconProps: ModalPartDivProps;
  HeadingProps: ModalHeadingProps;
  BodyProps: ModalPartDivProps;
  FooterProps: ModalPartDivProps;
  CloseTriggerProps: ModalCloseTriggerProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
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
  ModalRootProps as ModalProps,
  ModalTriggerProps,
  ModalBackdropProps,
  ModalContainerProps,
  ModalDialogProps,
  ModalContentProps,
  ModalHeaderProps,
  ModalIconProps,
  ModalHeadingProps,
  ModalBodyProps,
  ModalFooterProps,
  ModalCloseTriggerProps,
} from "./modal.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { modalVariants } from "../../../styles/src/components/modal/index.ts";

export type { ModalVariants } from "../../../styles/src/components/modal/index.ts";
