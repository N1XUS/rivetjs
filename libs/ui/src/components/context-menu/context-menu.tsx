// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no context menu). Feature set inspired by HeroUI Pro's public Context
// Menu docs (a right-click menu at the pointer with sections, selection and submenus, long press on touch; parts `.Trigger`,
// `.Popover`, `.Menu`, `.Item`, `.ItemIndicator`, `.Section`, `.SubmenuTrigger`, `.SubmenuIndicator`, `.Separator`);
// independent implementation, Rivet-authored styles on HeroUI tokens.
// - Root = cdk `MenuTrigger trigger="contextMenu"` (RA useContextMenu port: `contextmenu` opens the menu at the pointer, macOS
//   Ctrl+Enter / Shift+F10 through the browser's own contextmenu event on a focusable trigger, a right click outside closes;
//   `isOpen` value or two-way Signal / `defaultOpen` / `onOpenChange`; its trigger props carry `data-cm`: the resume loader
//   cancels the browser's menu for a cold first right click and the replay opens this one). `isDisabled` (read once): no
//   MenuTrigger at all, so the browser's own context menu appears and `.Popover` renders nothing.
// - `.Trigger` = a `div` (not focusable unless `tabIndex` is passed) taking the MenuTrigger's press-responder props through cdk
//   `pressProps` (the `<Pressable>` wrapper would warn about a non-focusable child) and its `ref`. Its children render inside
//   `ClearPressResponder` (RA): a Button / Checkbox / table cell inside the trigger keeps its own props (before, each one took
//   the trigger's `data-cm`, aria-haspopup and id: duplicate ids, B4 2026-10-27). iOS fires no `contextmenu`:
//   the trigger runs a touch long press (500 ms) there (`contextMenuUsesLongPress`, cdk `menuTriggerContextMenuLongPress`).
// - `.Popover` = cdk Popover with the dropdown surface (placement / offset from the trigger's PopoverContext: `bottom start` at
//   the pointer, offset 0; a submenu's from its SubmenuTrigger; pass `placement` / `offset` to override); `.Menu` = `Dropdown.Menu` (closes
//   on action, focused on open), `.Item` / `.ItemIndicator` / `.Section` / `.SubmenuTrigger` / `.SubmenuIndicator` = the Dropdown
//   parts; `.Separator` = ui `Separator` (a collection leaf).
import { MenuTrigger as MenuTriggerPrimitive, RootMenuTriggerStateContext } from "@rivetjs/cdk/menu";
import type { MenuTriggerProps } from "@rivetjs/cdk/menu";
import { contextMenuUsesLongPress, menuTriggerContextMenuLongPress } from "@rivetjs/cdk/menu/behaviour";
import { longPressEnd, longPressStart } from "@rivetjs/cdk/interactions/long-press";
import { pressProps } from "@rivetjs/cdk/interactions/press";
import { ClearPressResponder, PressResponderContext } from "@rivetjs/cdk/interactions/pressable";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { contextMenuVariants } from "../../../styles/src/components/context-menu/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { portalTheme } from "../../utils/portal-theme.ts";
import { DropdownContext, DropdownMenu, popoverContextOf } from "../dropdown/dropdown.tsx";
import type { DropdownMenuProps } from "../dropdown/dropdown.tsx";
import { SeparatorRoot } from "../separator/separator.tsx";
import type { SeparatorRootProps } from "../separator/separator.tsx";
import { SurfaceContext } from "../surface/index.ts";

const SLOTS = contextMenuVariants();

interface ContextMenuContext {
  disabled?: boolean;
}
const ContextMenuContext = createContext<ContextMenuContext>({});
const DISABLED: ContextMenuContext = { disabled: true };
const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

/* -------------------------------------------------------------------------------------------------
 * ContextMenu Root
 * -----------------------------------------------------------------------------------------------*/
interface ContextMenuRootProps extends Omit<MenuTriggerProps, "trigger"> {
  /** No custom menu: the browser's own context menu appears. Read once. @default false */
  isDisabled?: boolean;
}

const ContextMenuRoot = (props: ContextMenuRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "isDisabled"]);
  const children = local.children;
  if (local.isDisabled)
    return (
      <Provider token={ContextMenuContext} value={DISABLED}>
        {children}
      </Provider>
    );
  return (
    <MenuTriggerPrimitive {...(rest as MenuTriggerProps)} trigger="contextMenu">
      {children}
    </MenuTriggerPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ContextMenu Trigger
 * -----------------------------------------------------------------------------------------------*/
type ContextMenuTriggerProps = Omit<JSX.IntrinsicElements["div"], "class"> & { class?: string; children?: Content };

const ContextMenuTrigger = (props: ContextMenuTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const cls = () => composeSlotClassName(SLOTS.trigger, local.class);
  if (useContext(ContextMenuContext).disabled)
    return (
      <div class={cls()} data-slot="context-menu-trigger" data-disabled="true" {...rest}>
        {local.children}
      </div>
    );
  const responder = useContext(PressResponderContext) as { ref?: unknown } | null;
  const state = useContext(RootMenuTriggerStateContext)!;
  // iOS: a touch long press stands in for the missing `contextmenu` event (RA useContextMenu).
  const lp = {
    props: { pointerType: "touch" as const, onLongPress: (e: { target: Element; x: number; y: number }) => menuTriggerContextMenuLongPress(e, {}, state) },
    state: { timer: undefined, globals: [] },
  };
  const press = pressProps({
    onPressStart: (e) => {
      if (contextMenuUsesLongPress()) longPressStart(lp as never, e);
    },
    onPressEnd: (e) => {
      if (contextMenuUsesLongPress()) longPressEnd(lp as never, e);
    },
  });
  return (
    <div class={cls()} data-slot="context-menu-trigger" {...(press.pressProps as object)} {...rest} ref={responder?.ref as never}>
      <ClearPressResponder>{local.children}</ClearPressResponder>
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ContextMenu Popover
 * -----------------------------------------------------------------------------------------------*/
interface ContextMenuPopoverProps extends Omit<PopoverPrimitiveProps, "children" | "isOpen" | "triggerRef"> {
  children?: Content;
}

const ContextMenuPopover = (props: ContextMenuPopoverProps): JSX.Element | null => {
  portalTheme();
  if (useContext(ContextMenuContext).disabled) return null;
  const [local, rest] = splitLive(props, ["children", "class"]);
  // A submenu's `.Menu` sits in the popover like Dropdown.Popover's: without this it opened a second, unpositioned popover.
  const dropdown = popoverContextOf(useContext(DropdownContext));
  const classOf = () => composeTwRenderProps(local.class as never, SLOTS.popover()) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <PopoverPrimitive data-slot="context-menu-popover" {...(rest as PopoverPrimitiveProps)} class={cls as never}>
      {local.children}
    </PopoverPrimitive>
  );
  return (
    <Provider token={SurfaceContext} value={DEFAULT_SURFACE_CONTEXT}>
      <Provider token={DropdownContext} value={dropdown}>
        {content()}
      </Provider>
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ContextMenu Menu / Separator
 * -----------------------------------------------------------------------------------------------*/
type ContextMenuMenuProps<T extends object = object> = Omit<DropdownMenuProps<T>, "placement" | "offset" | "crossOffset" | "shouldFlip">;

function ContextMenuMenu<T extends object = object>(props: ContextMenuMenuProps<T>): JSX.Element {
  const [local, rest] = splitLive(props as ContextMenuMenuProps<object>, ["class"]);
  return (
    <DropdownMenu
      data-slot="context-menu-menu"
      {...(rest as DropdownMenuProps<object>)}
      class={composeSlotClassName(SLOTS.menu, local.class as string | undefined)}
    />
  );
}

type ContextMenuSeparatorProps = SeparatorRootProps;

const ContextMenuSeparator = (props: ContextMenuSeparatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <SeparatorRoot {...rest} class={composeSlotClassName(SLOTS.separator, local.class as string | undefined)} />;
};

export { ContextMenuRoot, ContextMenuTrigger, ContextMenuPopover, ContextMenuMenu, ContextMenuSeparator };
export type { ContextMenuRootProps, ContextMenuTriggerProps, ContextMenuPopoverProps, ContextMenuMenuProps, ContextMenuSeparatorProps };
