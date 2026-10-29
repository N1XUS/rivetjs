// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no command palette). Feature set inspired by commercial UI kits' public Command
// docs (a modal palette: search, filtered list with groups, header / footer; sizes; backdrop variants; parts `.Backdrop`,
// `.Container`, `.Dialog`, `.Header`, `.InputGroup` (+ `.Prefix` / `.Input` / `.ClearButton` / `.Suffix`), `.List`, `.Group`,
// `.Item`, `.Separator`, `.Footer`); independent implementation, Rivet-authored styles on HeroUI tokens.
// - Root = cdk `DialogTrigger` (a `<Button>` child opens it; `isOpen` value or two-way Signal / `defaultOpen` / `onOpenChange`).
// - `.Backdrop` = cdk `ModalOverlay` (div overlay layer, `isDismissable` default true, `variant` opaque / blur / transparent),
//   `.Container` = cdk `Modal` (`size` sm / md / lg → the dialog's max width and height, through context).
// - `.Dialog` = cdk `Dialog` (default `aria-label` "Command palette") wrapping a cdk `Autocomplete`: the search field drives the
//   list with virtual focus (arrows move, Enter runs); `inputValue` / `defaultInputValue` / `onInputChange`; `filter` default =
//   case- and accent-insensitive substring of the item's `textValue` (collator created on first use).
// - `.InputGroup` = cdk `SearchField` (`autoFocus` default true, `data-empty` hides `.ClearButton`; Escape clears, then closes);
//   `.InputGroup.Input` = cdk `Input` (placeholder "Search commands..."), `.ClearButton` = ui `CloseButton` (the field's clear
//   button through its ButtonContext).
// - `.List` = cdk `Menu` (`renderEmptyState` default "No results"), `.Item` = `Dropdown.Item` (icon / description / shortcut
//   sugar; `textValue` carries extra search terms), `.Group` = `Dropdown.Section` with a `heading`, `.Separator` = ui `Separator`.
import { Dialog as DialogPrimitive, DialogTrigger as DialogTriggerPrimitive } from "@rivetjs/cdk/dialog";
import type { DialogProps as DialogPrimitiveProps, DialogTriggerProps } from "@rivetjs/cdk/dialog";
import { Autocomplete as AutocompletePrimitive } from "@rivetjs/cdk/autocomplete";
import type { AutocompleteProps as AutocompletePrimitiveProps } from "@rivetjs/cdk/autocomplete";
import { createFilter, type Filter } from "@rivetjs/cdk/i18n/filter";
import { Input as InputPrimitive } from "@rivetjs/cdk/input";
import type { InputProps as InputPrimitiveProps } from "@rivetjs/cdk/input";
import { Menu as MenuPrimitive } from "@rivetjs/cdk/menu";
import type { MenuProps as MenuPrimitiveProps } from "@rivetjs/cdk/menu";
import { ModalOverlay as ModalOverlayPrimitive, Modal as ModalPrimitive } from "@rivetjs/cdk/modal";
import type { ModalOverlayProps } from "@rivetjs/cdk/modal";
import { SearchField as SearchFieldPrimitive } from "@rivetjs/cdk/search-field";
import type { SearchFieldProps as SearchFieldPrimitiveProps } from "@rivetjs/cdk/search-field";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { CommandVariants } from "../../../styles/src/components/command/index.ts";
import { commandVariants } from "../../../styles/src/components/command/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { overlayMotion } from "../../utils/overlay-motion.ts";
import { portalTheme } from "../../utils/portal-theme.ts";
import { splitLive } from "../../utils/live.tsx";
import { CloseButtonRoot } from "../close-button/close-button.tsx";
import type { CloseButtonRootProps } from "../close-button/close-button.tsx";
import { DropdownItem, DropdownSection } from "../dropdown/dropdown.tsx";
import type { DropdownItemProps, DropdownSectionProps } from "../dropdown/dropdown.tsx";
import { HeaderRoot } from "../header/header.tsx";
import { SeparatorRoot } from "../separator/separator.tsx";
import type { SeparatorRootProps } from "../separator/separator.tsx";
import { SurfaceContext } from "../surface/index.ts";

const SLOTS = commandVariants();
const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

interface CommandContext {
  size?: CommandVariants["size"];
}
const CommandContext = createContext<CommandContext>({});

let collator: Filter | undefined;
/** Default filter: substring match, case- and accent-insensitive (collator created on first use). */
function containsText(textValue: string, inputValue: string): boolean {
  return (collator ??= createFilter({ sensitivity: "base" })).contains(textValue, inputValue);
}

type DivProps = Omit<JSX.IntrinsicElements["div"], "class"> & { class?: string; children?: Content };

/* -------------------------------------------------------------------------------------------------
 * Command Root / Backdrop / Container
 * -----------------------------------------------------------------------------------------------*/
type CommandRootProps = DialogTriggerProps;

const CommandRoot = (props: CommandRootProps): JSX.Element => <DialogTriggerPrimitive {...props} />;

interface CommandBackdropProps extends ModalOverlayProps {
  /** Backdrop look. @default "opaque" */
  variant?: CommandVariants["variant"];
  /** Close on a press outside the palette. @default true */
  isDismissable?: boolean;
}

const CommandBackdrop = (props: CommandBackdropProps): JSX.Element => {
  overlayMotion();
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "isDismissable", "variant"]);
  return (
    <ModalOverlayPrimitive
      data-slot="command-backdrop"
      {...rest}
      class={commandVariants({ variant: local.variant }).backdrop({ class: local.class as string | undefined })}
      isDismissable={local.isDismissable ?? true}
    >
      {local.children}
    </ModalOverlayPrimitive>
  );
};

interface CommandContainerProps extends Omit<ModalOverlayProps, "isDismissable"> {
  /** Palette width and maximum height. @default "md" */
  size?: CommandVariants["size"];
}

const CommandContainer = (props: CommandContainerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "size"]);
  const context: CommandContext = {
    get size() {
      return local.size;
    },
  };
  const children = local.children;
  return (
    <ModalPrimitive data-slot="command-container" {...rest} class={composeSlotClassName(SLOTS.container, local.class as string | undefined)}>
      {() => (
        <Provider token={CommandContext} value={context}>
          {children as Content}
        </Provider>
      )}
    </ModalPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Command Dialog (cdk Dialog + Autocomplete)
 * -----------------------------------------------------------------------------------------------*/
interface CommandDialogProps
  extends Omit<DialogPrimitiveProps, "class" | "children">, Pick<AutocompletePrimitiveProps, "inputValue" | "defaultInputValue" | "onInputChange" | "filter"> {
  class?: string;
  children?: Content;
}

const CommandDialog = (props: CommandDialogProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "defaultInputValue", "filter", "inputValue", "onInputChange"]);
  const context = useContext(CommandContext);
  const children = local.children;
  const filter = local.filter ?? containsText;
  const content = () => (
    <DialogPrimitive
      aria-label="Command palette"
      data-slot="command-dialog"
      {...rest}
      class={commandVariants({ size: context.size }).dialog({ class: local.class })}
    >
      <AutocompletePrimitive
        defaultInputValue={local.defaultInputValue}
        filter={filter}
        inputValue={local.inputValue as never}
        onInputChange={local.onInputChange}
      >
        {children}
      </AutocompletePrimitive>
    </DialogPrimitive>
  );
  return (
    <Provider token={SurfaceContext} value={DEFAULT_SURFACE_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Command Header / Footer / InputGroup parts
 * -----------------------------------------------------------------------------------------------*/
const divPart =
  (slot: "header" | "footer" | "prefix" | "suffix", dataSlot: string) =>
  (props: DivProps): JSX.Element => {
    const [local, rest] = splitLive(props, ["children", "class"]);
    return (
      <div class={composeSlotClassName(SLOTS[slot], local.class)} data-slot={dataSlot} {...rest}>
        {local.children}
      </div>
    );
  };

const CommandHeader = divPart("header", "command-header");
const CommandFooter = divPart("footer", "command-footer");
const CommandInputGroupPrefix = divPart("prefix", "command-input-group-prefix");
const CommandInputGroupSuffix = divPart("suffix", "command-input-group-suffix");

interface CommandInputGroupProps extends Omit<SearchFieldPrimitiveProps, "class" | "children"> {
  class?: string;
  children?: Content;
}

const CommandInputGroup = (props: CommandInputGroupProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["autoFocus", "children", "class"]);
  return (
    <SearchFieldPrimitive
      aria-label="Search commands"
      data-slot="command-input-group"
      {...rest}
      autoFocus={local.autoFocus ?? true}
      class={composeSlotClassName(SLOTS.inputGroup, local.class)}
    >
      {local.children}
    </SearchFieldPrimitive>
  );
};

type CommandInputProps = Omit<InputPrimitiveProps, "class"> & { class?: string };

const CommandInput = (props: CommandInputProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "placeholder"]);
  return (
    <InputPrimitive
      data-slot="command-input"
      {...(rest as object)}
      class={composeSlotClassName(SLOTS.input, local.class)}
      placeholder={(local.placeholder ?? "Search commands...") as never}
    />
  );
};

type CommandClearButtonProps = CloseButtonRootProps;

const CommandClearButton = (props: CommandClearButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <CloseButtonRoot aria-label="Clear search" {...rest} class={composeSlotClassName(SLOTS.clearButton, local.class as string | undefined)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Command List / Item / Group / Separator
 * -----------------------------------------------------------------------------------------------*/
interface CommandListProps<T extends object = object> extends Omit<MenuPrimitiveProps<T>, "class"> {
  class?: string;
}

function CommandList<T extends object = object>(props: CommandListProps<T>): JSX.Element {
  const [local, rest] = splitLive(props as CommandListProps<object>, ["class", "renderEmptyState"]);
  const empty = local.renderEmptyState;
  return (
    <MenuPrimitive
      aria-label="Commands"
      data-slot="command-list"
      {...(rest as MenuPrimitiveProps<object>)}
      class={composeSlotClassName(SLOTS.list, local.class)}
      renderEmptyState={() => <div class={SLOTS.empty()}>{empty ? empty() : "No results"}</div>}
    />
  );
}

type CommandItemProps = DropdownItemProps;

const CommandItem = (props: CommandItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <DropdownItem data-slot="command-item" {...rest} class={composeSlotClassName(SLOTS.item, local.class as string | undefined) as never} />;
};

interface CommandGroupProps extends DropdownSectionProps {
  /** The group's label. */
  heading?: Content;
}

const CommandGroup = (props: CommandGroupProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "heading"]);
  const heading = local.heading;
  return (
    <DropdownSection data-slot="command-group" {...rest} class={composeSlotClassName(SLOTS.group, local.class as string | undefined) as never}>
      {heading !== undefined && <HeaderRoot class={SLOTS.groupHeading()}>{heading}</HeaderRoot>}
      {local.children}
    </DropdownSection>
  );
};

type CommandSeparatorProps = SeparatorRootProps;

const CommandSeparator = (props: CommandSeparatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <SeparatorRoot {...rest} class={composeSlotClassName(SLOTS.separator, local.class as string | undefined)} />;
};

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
};
export type {
  CommandRootProps,
  CommandBackdropProps,
  CommandContainerProps,
  CommandDialogProps,
  DivProps as CommandPartProps,
  CommandInputGroupProps,
  CommandInputProps,
  CommandClearButtonProps,
  CommandListProps,
  CommandItemProps,
  CommandGroupProps,
  CommandSeparatorProps,
};
