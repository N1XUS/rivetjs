// Rivet addition (no HeroUI v3.2.6 counterpart): command palette; feature set inspired by HeroUI Pro's public Command docs,
// independent implementation (see `command.tsx`).
import {
  CommandBackdrop,
  CommandClearButton,
  CommandContainer,
  CommandDialog,
  CommandFooter,
  CommandGroup,
  CommandHeader,
  CommandInput,
  CommandInputGroup,
  CommandInputGroupPrefix,
  CommandInputGroupSuffix,
  CommandItem,
  CommandList,
  CommandRoot,
  CommandSeparator,
} from "./command.tsx";
import type {
  CommandBackdropProps,
  CommandClearButtonProps,
  CommandContainerProps,
  CommandDialogProps,
  CommandGroupProps,
  CommandInputGroupProps,
  CommandInputProps,
  CommandItemProps,
  CommandListProps,
  CommandPartProps,
  CommandRootProps,
  CommandSeparatorProps,
} from "./command.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
const InputGroup = Object.assign(CommandInputGroup, {
  Prefix: CommandInputGroupPrefix,
  Input: CommandInput,
  ClearButton: CommandClearButton,
  Suffix: CommandInputGroupSuffix,
});

export const Command = Object.assign(CommandRoot, {
  Root: CommandRoot,
  Backdrop: CommandBackdrop,
  Container: CommandContainer,
  Dialog: CommandDialog,
  Header: CommandHeader,
  InputGroup,
  List: CommandList,
  Group: CommandGroup,
  Item: CommandItem,
  Separator: CommandSeparator,
  Footer: CommandFooter,
});

export type Command = {
  Props: CommandRootProps;
  RootProps: CommandRootProps;
  BackdropProps: CommandBackdropProps;
  ContainerProps: CommandContainerProps;
  DialogProps: CommandDialogProps;
  PartProps: CommandPartProps;
  InputGroupProps: CommandInputGroupProps;
  InputProps: CommandInputProps;
  ClearButtonProps: CommandClearButtonProps;
  ListProps: CommandListProps;
  GroupProps: CommandGroupProps;
  ItemProps: CommandItemProps;
  SeparatorProps: CommandSeparatorProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  CommandRoot,
  CommandBackdrop,
  CommandContainer,
  CommandDialog,
  CommandHeader,
  CommandFooter,
  CommandInputGroup,
  CommandInputGroupPrefix,
  CommandInput,
  CommandClearButton,
  CommandInputGroupSuffix,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandSeparator,
} from "./command.tsx";
export type {
  CommandRootProps,
  CommandRootProps as CommandProps,
  CommandBackdropProps,
  CommandContainerProps,
  CommandDialogProps,
  CommandPartProps,
  CommandInputGroupProps,
  CommandInputProps,
  CommandClearButtonProps,
  CommandListProps,
  CommandItemProps,
  CommandGroupProps,
  CommandSeparatorProps,
} from "./command.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { commandVariants } from "../../../styles/src/components/command/index.ts";

export type { CommandVariants } from "../../../styles/src/components/command/index.ts";
