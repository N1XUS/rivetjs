// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no sheet). Feature set scoped from public docs of commercial UI kits;
// independent implementation. `@rivetjs/ui/sheet`: compound `Sheet.*`, named parts, prop types, `sheetVariants`.
import {
  SheetBackdrop,
  SheetBody,
  SheetClose,
  SheetCloseTrigger,
  SheetContent,
  SheetDialog,
  SheetFooter,
  SheetHandle,
  SheetHeader,
  SheetHeading,
  SheetNestedRoot,
  SheetRoot,
  SheetTrigger,
} from "./sheet.tsx";
import type {
  SheetBackdropProps,
  SheetCloseProps,
  SheetCloseTriggerProps,
  SheetContentProps,
  SheetDialogProps,
  SheetHandleProps,
  SheetHeadingProps,
  SheetPartDivProps,
  SheetRootProps,
  SheetTriggerProps,
} from "./sheet.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Sheet = Object.assign(SheetRoot, {
  Root: SheetRoot,
  NestedRoot: SheetNestedRoot,
  Trigger: SheetTrigger,
  Backdrop: SheetBackdrop,
  Content: SheetContent,
  Dialog: SheetDialog,
  Handle: SheetHandle,
  CloseTrigger: SheetCloseTrigger,
  Header: SheetHeader,
  Heading: SheetHeading,
  Body: SheetBody,
  Footer: SheetFooter,
  Close: SheetClose,
});

export type Sheet = {
  Props: SheetRootProps;
  RootProps: SheetRootProps;
  NestedRootProps: Omit<SheetRootProps, "isNested">;
  TriggerProps: SheetTriggerProps;
  BackdropProps: SheetBackdropProps;
  ContentProps: SheetContentProps;
  DialogProps: SheetDialogProps;
  HandleProps: SheetHandleProps;
  CloseTriggerProps: SheetCloseTriggerProps;
  HeaderProps: SheetPartDivProps;
  HeadingProps: SheetHeadingProps;
  BodyProps: SheetPartDivProps;
  FooterProps: SheetPartDivProps;
  CloseProps: SheetCloseProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
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
  SheetRootProps as SheetProps,
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
  SheetPlacement,
  SheetSnapPoint,
} from "./sheet.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { sheetVariants } from "../../../styles/src/components/sheet/index.ts";

export type { SheetVariants } from "../../../styles/src/components/sheet/index.ts";
