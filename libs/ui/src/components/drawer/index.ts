// Ported from HeroUI v3.2.6 packages/react/src/components/drawer/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types (`…DivProps` for the generic `div` parts); `@heroui/styles` →
// vendored `styles/`.
import {
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContainer,
  DrawerContent,
  DrawerDialog,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerHeading,
  DrawerRoot,
  DrawerTrigger,
} from "./drawer.tsx";
import type {
  DrawerBackdropProps,
  DrawerCloseTriggerProps,
  DrawerContainerProps,
  DrawerContentProps,
  DrawerDialogProps,
  DrawerHeadingProps,
  DrawerPartDivProps,
  DrawerRootProps,
  DrawerTriggerProps,
} from "./drawer.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Drawer = Object.assign(DrawerRoot, {
  Root: DrawerRoot,
  Trigger: DrawerTrigger,
  Backdrop: DrawerBackdrop,
  Container: DrawerContainer,
  Content: DrawerContent,
  Dialog: DrawerDialog,
  Header: DrawerHeader,
  Heading: DrawerHeading,
  Body: DrawerBody,
  Footer: DrawerFooter,
  Handle: DrawerHandle,
  CloseTrigger: DrawerCloseTrigger,
});

export type Drawer = {
  Props: DrawerRootProps;
  RootProps: DrawerRootProps;
  TriggerProps: DrawerTriggerProps;
  BackdropProps: DrawerBackdropProps;
  ContainerProps: DrawerContainerProps;
  ContentProps: DrawerContentProps;
  DialogProps: DrawerDialogProps;
  HeaderProps: DrawerPartDivProps;
  HeadingProps: DrawerHeadingProps;
  BodyProps: DrawerPartDivProps;
  FooterProps: DrawerPartDivProps;
  HandleProps: DrawerPartDivProps;
  CloseTriggerProps: DrawerCloseTriggerProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
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
  DrawerRootProps as DrawerProps,
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
  DrawerCloseTriggerProps,
} from "./drawer.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { drawerVariants } from "../../../styles/src/components/drawer/index.ts";

export type { DrawerVariants } from "../../../styles/src/components/drawer/index.ts";
