// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no sidebar). Behaviour + parts = shadcn/ui Sidebar (shadcn@4.21.4, MIT,
// © 2023 shadcn) through `@rivetjs/cdk/sidebar`; look = HeroUI tokens and conventions (vendored-format tv slots in
// `styles/src/components/sidebar/`, BEM CSS `styles/components/sidebar.css`, both Rivet-authored).
// Rivet:
// - Every part is the cdk part with the `sidebar__*` slot class (+ HeroUI `button` / `input` / `separator` / `tooltip` /
//   `skeleton` classes where shadcn composes its Button / Input / Separator / Tooltip / Skeleton), same elements, props,
//   `data-slot` / `data-sidebar` / state attributes as the cdk (= shadcn) parts.
// - `Sidebar.Trigger` default content: lucide `PanelLeft` (via `@rivetjs/kit/icon`); the cdk trigger adds the visually hidden "Toggle Sidebar"
//   label after any children (= shadcn's `PanelLeftIcon` + `sr-only` span; cdk `visuallyHidden` inline style).
// - Extensions (feature set inspired by HeroUI Pro's public Sidebar docs; independent implementation): `MenuTrigger`,
//   `MenuIndicator` (default lucide `ChevronRight`), `MenuActions`, `MenuChip` (cdk MenuBadge with HeroUI chip classes),
//   `Pages` / `Page`; the provider / Sidebar / menu props pass through to the cdk parts.
// - `Sidebar resizable` (Rivet extension, cdk `./resize.ts`): a window-splitter handle on the panel's inner edge
//   (`sidebar__resize-handle`: 1 px separator line on hover, 2 px accent while dragging / focused, `col-resize`).
// - `Sidebar.Provider` `closeMobileOnAction` defaults to `true` (app-shell navigation closes the mobile sheet, HeroUI Pro);
//   the cdk default is `false` (= shadcn).
// - Live props: `class` (and MenuButton `size` / `variant`) are read lazily (`splitLive`); a live one goes to the cdk part
//   as a class function (cdk structural parts / Button / Link call it in a binding); static path = one string.
import { Icon } from "@rivetjs/kit/icon";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { ChevronRight, PanelLeft } from "lucide";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent as SidebarContentPrimitive,
  SidebarFooter as SidebarFooterPrimitive,
  SidebarGroup as SidebarGroupPrimitive,
  SidebarGroupAction as SidebarGroupActionPrimitive,
  SidebarGroupContent as SidebarGroupContentPrimitive,
  SidebarGroupLabel as SidebarGroupLabelPrimitive,
  SidebarHeader as SidebarHeaderPrimitive,
  SidebarInput as SidebarInputPrimitive,
  SidebarInset as SidebarInsetPrimitive,
  SidebarMenu as SidebarMenuPrimitive,
  SidebarMenuAction as SidebarMenuActionPrimitive,
  SidebarMenuActions as SidebarMenuActionsPrimitive,
  SidebarMenuIndicator as SidebarMenuIndicatorPrimitive,
  SidebarMenuTrigger as SidebarMenuTriggerPrimitive,
  SidebarPage as SidebarPagePrimitive,
  SidebarPages as SidebarPagesPrimitive,
  SidebarMenuBadge as SidebarMenuBadgePrimitive,
  SidebarMenuButton as SidebarMenuButtonPrimitive,
  SidebarMenuItem as SidebarMenuItemPrimitive,
  SidebarMenuSkeleton as SidebarMenuSkeletonPrimitive,
  SidebarMenuSub as SidebarMenuSubPrimitive,
  SidebarMenuSubButton as SidebarMenuSubButtonPrimitive,
  SidebarMenuSubItem as SidebarMenuSubItemPrimitive,
  SidebarProvider as SidebarProviderPrimitive,
  SidebarRail as SidebarRailPrimitive,
  SidebarSeparator as SidebarSeparatorPrimitive,
  SidebarTrigger as SidebarTriggerPrimitive,
} from "@rivetjs/cdk/sidebar";
import type {
  SidebarContentProps as SidebarContentPrimitiveProps,
  SidebarFooterProps as SidebarFooterPrimitiveProps,
  SidebarGroupActionProps as SidebarGroupActionPrimitiveProps,
  SidebarGroupContentProps as SidebarGroupContentPrimitiveProps,
  SidebarGroupLabelProps as SidebarGroupLabelPrimitiveProps,
  SidebarGroupProps as SidebarGroupPrimitiveProps,
  SidebarHeaderProps as SidebarHeaderPrimitiveProps,
  SidebarInputProps as SidebarInputPrimitiveProps,
  SidebarInsetProps as SidebarInsetPrimitiveProps,
  SidebarMenuActionProps as SidebarMenuActionPrimitiveProps,
  SidebarMenuActionsProps as SidebarMenuActionsPrimitiveProps,
  SidebarMenuIndicatorProps as SidebarMenuIndicatorPrimitiveProps,
  SidebarMenuTriggerProps as SidebarMenuTriggerPrimitiveProps,
  SidebarPageProps as SidebarPagePrimitiveProps,
  SidebarPagesProps as SidebarPagesPrimitiveProps,
  SidebarMenuBadgeProps as SidebarMenuBadgePrimitiveProps,
  SidebarMenuButtonProps as SidebarMenuButtonPrimitiveProps,
  SidebarMenuItemProps as SidebarMenuItemPrimitiveProps,
  SidebarMenuProps as SidebarMenuPrimitiveProps,
  SidebarMenuSkeletonProps as SidebarMenuSkeletonPrimitiveProps,
  SidebarMenuSubButtonProps as SidebarMenuSubButtonPrimitiveProps,
  SidebarMenuSubItemProps as SidebarMenuSubItemPrimitiveProps,
  SidebarMenuSubProps as SidebarMenuSubPrimitiveProps,
  SidebarProps as SidebarPrimitiveProps,
  SidebarProviderProps as SidebarProviderPrimitiveProps,
  SidebarRailProps as SidebarRailPrimitiveProps,
  SidebarSeparatorProps as SidebarSeparatorPrimitiveProps,
  SidebarTriggerProps as SidebarTriggerPrimitiveProps,
} from "@rivetjs/cdk/sidebar";
import type { TooltipProps } from "@rivetjs/cdk/tooltip";

import { chipVariants, type ChipVariants } from "../../../styles/src/components/chip/index.ts";
import { buttonVariants } from "../../../styles/src/components/button/index.ts";
import { inputVariants } from "../../../styles/src/components/input/index.ts";
import { separatorVariants } from "../../../styles/src/components/separator/index.ts";
import type { SidebarVariants } from "../../../styles/src/components/sidebar/index.ts";
import { sidebarVariants } from "../../../styles/src/components/sidebar/index.ts";
import { skeletonVariants } from "../../../styles/src/components/skeleton/index.ts";
import { tooltipVariants } from "../../../styles/src/components/tooltip/index.ts";
import { hasLiveProp, splitLive } from "../../utils/live.tsx";

/** The default slots (no variant): one tv call per module. */
const SLOTS = sidebarVariants();
type MenuButtonSize = NonNullable<SidebarVariants["size"]>;
type MenuButtonVariant = NonNullable<SidebarVariants["variant"]>;
type MenuSubButtonSize = NonNullable<SidebarVariants["subSize"]>;
const BUTTON_SLOTS: Record<string, ReturnType<typeof sidebarVariants>> = {};
/** Menu button slots per `size|variant` (tv slot functions are pure; memo = one call per combination). */
const menuButtonSlots = (size: MenuButtonSize, variant: MenuButtonVariant) => (BUTTON_SLOTS[`${size}|${variant}`] ??= sidebarVariants({ size, variant }));
const SUB_SLOTS: Partial<Record<MenuSubButtonSize, ReturnType<typeof sidebarVariants>>> = {};
const menuSubButtonSlots = (subSize: MenuSubButtonSize) => (SUB_SLOTS[subSize] ??= sidebarVariants({ subSize }));
const TRIGGER_CLASS = `${buttonVariants({ isIconOnly: true, size: "sm", variant: "ghost" })} ${SLOTS.trigger()}`;
const INPUT_CLASS = `${inputVariants({ fullWidth: true })} ${SLOTS.input()}`;
const SEPARATOR_CLASS = `${separatorVariants()} ${SLOTS.separator()}`;
const TOOLTIP_CLASS = `${tooltipVariants().base()} ${SLOTS.tooltip()}`;
const SKELETON_CLASS = skeletonVariants().base();

/* -------------------------------------------------------------------------------------------------
 * Sidebar Provider
 * -----------------------------------------------------------------------------------------------*/
interface SidebarProviderProps extends Omit<SidebarProviderPrimitiveProps, "class"> {
  class?: string;
  /** Close the mobile sheet when a menu button / sub button is pressed (groups, menus and items override it). @default true */
  closeMobileOnAction?: boolean;
}

const SidebarProvider = (props: SidebarProviderProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.wrapper({ class: local.class }) : SLOTS.wrapper({ class: local.class });
  // Rivet ui: an app-shell sidebar closes its mobile sheet on navigation (HeroUI Pro); the cdk default (= shadcn) keeps it.
  return (
    <SidebarProviderPrimitive
      {...(rest as SidebarProviderPrimitiveProps)}
      closeMobileOnAction={(rest as SidebarProviderPrimitiveProps).closeMobileOnAction ?? true}
      class={cls}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Sidebar Root
 * -----------------------------------------------------------------------------------------------*/
interface SidebarRootProps extends Omit<
  SidebarPrimitiveProps,
  "class" | "rootClass" | "gapClass" | "innerClass" | "overlayClass" | "sheetClass" | "dialogClass" | "resizeHandleClass"
> {
  /** Class of the panel: the desktop container (`sidebar__container`), the mobile sheet, or the static panel (`collapsible="none"`). */
  class?: string;
}

const SidebarRoot = (props: SidebarRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "collapsible"]);
  // `collapsible="none"` picks the element once (as the cdk part): the static panel carries the root class.
  const isStatic = (typeof local.collapsible === "function" ? local.collapsible() : local.collapsible) === "none";
  const classOf = () => (isStatic ? SLOTS.root({ class: local.class }) : SLOTS.container({ class: local.class }));
  const cls = hasLiveProp(local, ["class"]) ? () => classOf() : classOf();
  return (
    <SidebarPrimitive
      {...(rest as SidebarPrimitiveProps)}
      collapsible={local.collapsible}
      class={cls}
      rootClass={SLOTS.root()}
      gapClass={SLOTS.gap()}
      innerClass={SLOTS.inner()}
      overlayClass={SLOTS.sheetBackdrop()}
      sheetClass={SLOTS.sheet()}
      dialogClass={SLOTS.sheetDialog()}
      resizeHandleClass={SLOTS.resizeHandle()}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Sidebar Trigger / Rail / Inset
 * -----------------------------------------------------------------------------------------------*/
interface SidebarTriggerProps extends Omit<SidebarTriggerPrimitiveProps, "class"> {
  class?: string;
}

const SidebarTrigger = (props: SidebarTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const cls = hasLiveProp(local, ["class"])
    ? () => `${TRIGGER_CLASS}${local.class ? ` ${local.class}` : ""}`
    : `${TRIGGER_CLASS}${local.class ? ` ${local.class}` : ""}`;
  return (
    <SidebarTriggerPrimitive {...(rest as SidebarTriggerPrimitiveProps)} class={cls}>
      {local.children ?? <Icon icon={PanelLeft} size={16} data-slot="sidebar-trigger-icon" />}
    </SidebarTriggerPrimitive>
  );
};

interface SidebarRailProps extends Omit<SidebarRailPrimitiveProps, "class"> {
  class?: string;
}

const SidebarRail = (props: SidebarRailProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.rail({ class: local.class }) : SLOTS.rail({ class: local.class });
  return <SidebarRailPrimitive {...(rest as SidebarRailPrimitiveProps)} class={cls} />;
};

interface SidebarInsetProps extends Omit<SidebarInsetPrimitiveProps, "class"> {
  class?: string;
}

const SidebarInset = (props: SidebarInsetProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.inset({ class: local.class }) : SLOTS.inset({ class: local.class });
  return <SidebarInsetPrimitive {...(rest as SidebarInsetPrimitiveProps)} class={cls} />;
};

/* -------------------------------------------------------------------------------------------------
 * Sidebar Input / Separator
 * -----------------------------------------------------------------------------------------------*/
interface SidebarInputProps extends Omit<SidebarInputPrimitiveProps, "class"> {
  class?: string;
}

const SidebarInput = (props: SidebarInputProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"])
    ? () => `${INPUT_CLASS}${local.class ? ` ${local.class}` : ""}`
    : `${INPUT_CLASS}${local.class ? ` ${local.class}` : ""}`;
  return <SidebarInputPrimitive {...(rest as {})} class={cls as never} />;
};

interface SidebarSeparatorProps extends Omit<SidebarSeparatorPrimitiveProps, "class"> {
  class?: string;
}

/** `class` is read once (cdk Separator takes a string class). */
const SidebarSeparator = (props: SidebarSeparatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <SidebarSeparatorPrimitive {...(rest as SidebarSeparatorPrimitiveProps)} class={`${SEPARATOR_CLASS}${local.class ? ` ${local.class}` : ""}`} />;
};

/* -------------------------------------------------------------------------------------------------
 * Sidebar Header / Footer / Content
 * -----------------------------------------------------------------------------------------------*/
interface SidebarHeaderProps extends Omit<SidebarHeaderPrimitiveProps, "class"> {
  class?: string;
}

const SidebarHeader = (props: SidebarHeaderProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.header({ class: local.class }) : SLOTS.header({ class: local.class });
  return <SidebarHeaderPrimitive {...(rest as SidebarHeaderPrimitiveProps)} class={cls} />;
};

interface SidebarFooterProps extends Omit<SidebarFooterPrimitiveProps, "class"> {
  class?: string;
}

const SidebarFooter = (props: SidebarFooterProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.footer({ class: local.class }) : SLOTS.footer({ class: local.class });
  return <SidebarFooterPrimitive {...(rest as SidebarFooterPrimitiveProps)} class={cls} />;
};

interface SidebarContentProps extends Omit<SidebarContentPrimitiveProps, "class"> {
  class?: string;
}

const SidebarContent = (props: SidebarContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.content({ class: local.class }) : SLOTS.content({ class: local.class });
  return <SidebarContentPrimitive {...(rest as SidebarContentPrimitiveProps)} class={cls} />;
};

/* -------------------------------------------------------------------------------------------------
 * Sidebar Group
 * -----------------------------------------------------------------------------------------------*/
interface SidebarGroupProps extends Omit<SidebarGroupPrimitiveProps, "class"> {
  class?: string;
}

const SidebarGroup = (props: SidebarGroupProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.group({ class: local.class }) : SLOTS.group({ class: local.class });
  return <SidebarGroupPrimitive {...(rest as SidebarGroupPrimitiveProps)} class={cls} />;
};

interface SidebarGroupLabelProps extends Omit<SidebarGroupLabelPrimitiveProps, "class"> {
  class?: string;
}

const SidebarGroupLabel = (props: SidebarGroupLabelProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.groupLabel({ class: local.class }) : SLOTS.groupLabel({ class: local.class });
  return <SidebarGroupLabelPrimitive {...(rest as SidebarGroupLabelPrimitiveProps)} class={cls} />;
};

interface SidebarGroupActionProps extends Omit<SidebarGroupActionPrimitiveProps, "class"> {
  class?: string;
}

const SidebarGroupAction = (props: SidebarGroupActionProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.groupAction({ class: local.class }) : SLOTS.groupAction({ class: local.class });
  return <SidebarGroupActionPrimitive {...(rest as SidebarGroupActionPrimitiveProps)} class={cls} />;
};

interface SidebarGroupContentProps extends Omit<SidebarGroupContentPrimitiveProps, "class"> {
  class?: string;
}

const SidebarGroupContent = (props: SidebarGroupContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.groupContent({ class: local.class }) : SLOTS.groupContent({ class: local.class });
  return <SidebarGroupContentPrimitive {...(rest as SidebarGroupContentPrimitiveProps)} class={cls} />;
};

/* -------------------------------------------------------------------------------------------------
 * Sidebar Menu
 * -----------------------------------------------------------------------------------------------*/
interface SidebarMenuProps extends Omit<SidebarMenuPrimitiveProps, "class"> {
  class?: string;
}

const SidebarMenu = (props: SidebarMenuProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.menu({ class: local.class }) : SLOTS.menu({ class: local.class });
  return <SidebarMenuPrimitive {...(rest as SidebarMenuPrimitiveProps)} class={cls} />;
};

interface SidebarMenuItemProps extends Omit<SidebarMenuItemPrimitiveProps, "class"> {
  class?: string;
}

const SidebarMenuItem = (props: SidebarMenuItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.menuItem({ class: local.class }) : SLOTS.menuItem({ class: local.class });
  return <SidebarMenuItemPrimitive {...(rest as SidebarMenuItemPrimitiveProps)} class={cls} />;
};

type SidebarMenuButtonProps = Omit<SidebarMenuButtonPrimitiveProps, "class"> & { class?: string };

const SidebarMenuButton = (props: SidebarMenuButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props as SidebarMenuButtonProps & { size?: MenuButtonSize; variant?: MenuButtonVariant }, [
    "class",
    "size",
    "tooltip",
    "variant",
  ]);
  const classOf = () => menuButtonSlots(local.size ?? "default", local.variant ?? "default").menuButton({ class: local.class });
  const cls = hasLiveProp(local, ["class", "size", "variant"]) ? () => classOf() : classOf();
  // HeroUI tooltip look on the collapsed-only tooltip (cdk Tooltip props; a string = its text).
  const tooltip = local.tooltip;
  const tip: TooltipProps | undefined =
    tooltip === undefined
      ? undefined
      : typeof tooltip === "string"
        ? { children: tooltip, class: TOOLTIP_CLASS }
        : { ...tooltip, class: tooltip.class ?? TOOLTIP_CLASS };
  return (
    <SidebarMenuButtonPrimitive {...(rest as SidebarMenuButtonPrimitiveProps)} size={local.size} variant={local.variant} tooltip={tip} class={cls as never} />
  );
};

interface SidebarMenuActionProps extends Omit<SidebarMenuActionPrimitiveProps, "class"> {
  class?: string;
}

const SidebarMenuAction = (props: SidebarMenuActionProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.menuAction({ class: local.class }) : SLOTS.menuAction({ class: local.class });
  return <SidebarMenuActionPrimitive {...(rest as SidebarMenuActionPrimitiveProps)} class={cls} />;
};

interface SidebarMenuBadgeProps extends Omit<SidebarMenuBadgePrimitiveProps, "class"> {
  class?: string;
}

const SidebarMenuBadge = (props: SidebarMenuBadgeProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.menuBadge({ class: local.class }) : SLOTS.menuBadge({ class: local.class });
  return <SidebarMenuBadgePrimitive {...(rest as SidebarMenuBadgePrimitiveProps)} class={cls} />;
};

interface SidebarMenuSkeletonProps extends Omit<SidebarMenuSkeletonPrimitiveProps, "class" | "iconClass" | "textClass"> {
  class?: string;
}

const SidebarMenuSkeleton = (props: SidebarMenuSkeletonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.menuSkeleton({ class: local.class }) : SLOTS.menuSkeleton({ class: local.class });
  return (
    <SidebarMenuSkeletonPrimitive
      {...(rest as SidebarMenuSkeletonPrimitiveProps)}
      class={cls}
      iconClass={SLOTS.menuSkeletonIcon({ class: SKELETON_CLASS })}
      textClass={SLOTS.menuSkeletonText({ class: SKELETON_CLASS })}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Sidebar Menu Sub
 * -----------------------------------------------------------------------------------------------*/
interface SidebarMenuSubProps extends Omit<SidebarMenuSubPrimitiveProps, "class" | "panelClass"> {
  class?: string;
}

const SidebarMenuSub = (props: SidebarMenuSubProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.menuSub({ class: local.class }) : SLOTS.menuSub({ class: local.class });
  return <SidebarMenuSubPrimitive {...(rest as SidebarMenuSubPrimitiveProps)} class={cls} panelClass={SLOTS.menuSubPanel()} />;
};

interface SidebarMenuSubItemProps extends Omit<SidebarMenuSubItemPrimitiveProps, "class"> {
  class?: string;
}

const SidebarMenuSubItem = (props: SidebarMenuSubItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.menuSubItem({ class: local.class }) : SLOTS.menuSubItem({ class: local.class });
  return <SidebarMenuSubItemPrimitive {...(rest as SidebarMenuSubItemPrimitiveProps)} class={cls} />;
};

type SidebarMenuSubButtonProps = Omit<SidebarMenuSubButtonPrimitiveProps, "class"> & { class?: string };

const SidebarMenuSubButton = (props: SidebarMenuSubButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props as SidebarMenuSubButtonProps & { size?: MenuSubButtonSize }, ["class", "size"]);
  const classOf = () => menuSubButtonSlots(local.size ?? "md").menuSubButton({ class: local.class });
  const cls = hasLiveProp(local, ["class", "size"]) ? () => classOf() : classOf();
  return <SidebarMenuSubButtonPrimitive {...(rest as SidebarMenuSubButtonPrimitiveProps)} size={local.size} class={cls as never} />;
};

/* -------------------------------------------------------------------------------------------------
 * Sidebar extensions: tree trigger / indicator, actions group, chip, pages
 * -----------------------------------------------------------------------------------------------*/
type SidebarMenuTriggerProps = Omit<SidebarMenuTriggerPrimitiveProps, "class"> & { class?: string };

/** The expand / collapse button of an expandable `Sidebar.MenuItem` (a menu button, `slot="trigger"`). */
const SidebarMenuTrigger = (props: SidebarMenuTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props as SidebarMenuTriggerProps & { size?: MenuButtonSize; variant?: MenuButtonVariant }, [
    "class",
    "size",
    "tooltip",
    "variant",
  ]);
  const classOf = () => menuButtonSlots(local.size ?? "default", local.variant ?? "default").menuButton({ class: local.class });
  const cls = hasLiveProp(local, ["class", "size", "variant"]) ? () => classOf() : classOf();
  const tooltip = local.tooltip;
  const tip: TooltipProps | undefined =
    tooltip === undefined
      ? undefined
      : typeof tooltip === "string"
        ? { children: tooltip, class: TOOLTIP_CLASS }
        : { ...tooltip, class: tooltip.class ?? TOOLTIP_CLASS };
  return (
    <SidebarMenuTriggerPrimitive {...(rest as SidebarMenuTriggerPrimitiveProps)} size={local.size} variant={local.variant} tooltip={tip} class={cls as never} />
  );
};

interface SidebarMenuIndicatorProps extends Omit<SidebarMenuIndicatorPrimitiveProps, "class"> {
  class?: string;
}

/** The rotating indicator of a `Sidebar.MenuTrigger`; default icon lucide `ChevronRight`. */
const SidebarMenuIndicator = (props: SidebarMenuIndicatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.menuIndicator({ class: local.class }) : SLOTS.menuIndicator({ class: local.class });
  return (
    <SidebarMenuIndicatorPrimitive {...(rest as SidebarMenuIndicatorPrimitiveProps)} class={cls}>
      {local.children ?? <Icon icon={ChevronRight} size={16} />}
    </SidebarMenuIndicatorPrimitive>
  );
};

interface SidebarMenuActionsProps extends Omit<SidebarMenuActionsPrimitiveProps, "class"> {
  class?: string;
}

/** Several `Sidebar.MenuAction`s at the end of a menu item. */
const SidebarMenuActions = (props: SidebarMenuActionsProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = hasLiveProp(local, ["class"]) ? () => SLOTS.menuActions({ class: local.class }) : SLOTS.menuActions({ class: local.class });
  return <SidebarMenuActionsPrimitive {...(rest as SidebarMenuActionsPrimitiveProps)} class={cls} />;
};

interface SidebarMenuChipProps extends Omit<SidebarMenuBadgePrimitiveProps, "class"> {
  class?: string;
  /** Chip color. @default "accent" */
  color?: NonNullable<ChipVariants["color"]>;
  /** Chip variant. @default "soft" */
  variant?: NonNullable<ChipVariants["variant"]>;
}

/** A Chip in a menu item (the cdk `SidebarMenuBadge` part with chip classes). */
const SidebarMenuChip = (props: SidebarMenuChipProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "color", "variant"]);
  const classOf = () =>
    `${chipVariants({ color: local.color ?? "accent", size: "sm", variant: local.variant ?? "soft" }).base()} ${SLOTS.menuChip({ class: local.class })}`;
  const cls = hasLiveProp(local, ["class", "color", "variant"]) ? () => classOf() : classOf();
  return <SidebarMenuBadgePrimitive {...(rest as SidebarMenuBadgePrimitiveProps)} class={cls} />;
};

interface SidebarPagesProps extends Omit<SidebarPagesPrimitiveProps, "class"> {
  class?: string;
}

/** An animated page switcher inside the sidebar (`Sidebar.Page value` children). */
const SidebarPages = (props: SidebarPagesProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <SidebarPagesPrimitive {...(rest as SidebarPagesPrimitiveProps)} class={SLOTS.pages({ class: local.class })} />;
};

interface SidebarPageProps extends Omit<SidebarPagePrimitiveProps, "class"> {
  class?: string;
}

/** One page of `Sidebar.Pages`. */
const SidebarPage = (props: SidebarPageProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <SidebarPagePrimitive {...(rest as SidebarPagePrimitiveProps)} class={SLOTS.page({ class: local.class })} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuActions,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuChip,
  SidebarMenuIndicator,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuTrigger,
  SidebarPage,
  SidebarPages,
  SidebarProvider,
  SidebarRail,
  SidebarRoot,
  SidebarSeparator,
  SidebarTrigger,
};

export type {
  SidebarContentProps,
  SidebarFooterProps,
  SidebarGroupActionProps,
  SidebarGroupContentProps,
  SidebarGroupLabelProps,
  SidebarGroupProps,
  SidebarHeaderProps,
  SidebarInputProps,
  SidebarInsetProps,
  SidebarMenuActionProps,
  SidebarMenuActionsProps,
  SidebarMenuBadgeProps,
  SidebarMenuButtonProps,
  SidebarMenuChipProps,
  SidebarMenuIndicatorProps,
  SidebarMenuItemProps,
  SidebarMenuProps,
  SidebarMenuSkeletonProps,
  SidebarMenuSubButtonProps,
  SidebarMenuSubItemProps,
  SidebarMenuSubProps,
  SidebarMenuTriggerProps,
  SidebarPageProps,
  SidebarPagesProps,
  SidebarProviderProps,
  SidebarRailProps,
  SidebarRootProps,
  SidebarSeparatorProps,
  SidebarTriggerProps,
};
