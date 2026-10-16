// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no sidebar). Compound API in the HeroUI shape (`Sidebar.Header`,
// `Sidebar.Menu`, `Sidebar.MenuButton`, …) mapping 1:1 to the shadcn/ui Sidebar parts (shadcn@4.21.4, MIT, © 2023 shadcn)
// of `@rivetjs/cdk/sidebar` + its Rivet extensions (MenuTrigger / MenuIndicator / MenuActions / MenuChip / Pages / Page;
// feature set inspired by HeroUI Pro's public docs, independent implementation).
import {
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
  SidebarMenuChip,
  SidebarMenuIndicator,
  SidebarMenuTrigger,
  SidebarPage,
  SidebarPages,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarRoot,
  SidebarSeparator,
  SidebarTrigger,
} from "./sidebar.tsx";
import type {
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
  SidebarMenuChipProps,
  SidebarMenuIndicatorProps,
  SidebarMenuTriggerProps,
  SidebarPageProps,
  SidebarPagesProps,
  SidebarMenuBadgeProps,
  SidebarMenuButtonProps,
  SidebarMenuItemProps,
  SidebarMenuProps,
  SidebarMenuSkeletonProps,
  SidebarMenuSubButtonProps,
  SidebarMenuSubItemProps,
  SidebarMenuSubProps,
  SidebarProviderProps,
  SidebarRailProps,
  SidebarRootProps,
  SidebarSeparatorProps,
  SidebarTriggerProps,
} from "./sidebar.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Sidebar = Object.assign(SidebarRoot, {
  Root: SidebarRoot,
  Provider: SidebarProvider,
  Trigger: SidebarTrigger,
  Rail: SidebarRail,
  Inset: SidebarInset,
  Input: SidebarInput,
  Header: SidebarHeader,
  Footer: SidebarFooter,
  Separator: SidebarSeparator,
  Content: SidebarContent,
  Group: SidebarGroup,
  GroupLabel: SidebarGroupLabel,
  GroupAction: SidebarGroupAction,
  GroupContent: SidebarGroupContent,
  Menu: SidebarMenu,
  MenuItem: SidebarMenuItem,
  MenuButton: SidebarMenuButton,
  MenuAction: SidebarMenuAction,
  MenuActions: SidebarMenuActions,
  MenuChip: SidebarMenuChip,
  MenuTrigger: SidebarMenuTrigger,
  MenuIndicator: SidebarMenuIndicator,
  Pages: SidebarPages,
  Page: SidebarPage,
  MenuBadge: SidebarMenuBadge,
  MenuSkeleton: SidebarMenuSkeleton,
  MenuSub: SidebarMenuSub,
  MenuSubItem: SidebarMenuSubItem,
  MenuSubButton: SidebarMenuSubButton,
});

export type Sidebar = {
  Props: SidebarRootProps;
  RootProps: SidebarRootProps;
  ProviderProps: SidebarProviderProps;
  TriggerProps: SidebarTriggerProps;
  RailProps: SidebarRailProps;
  InsetProps: SidebarInsetProps;
  InputProps: SidebarInputProps;
  HeaderProps: SidebarHeaderProps;
  FooterProps: SidebarFooterProps;
  SeparatorProps: SidebarSeparatorProps;
  ContentProps: SidebarContentProps;
  GroupProps: SidebarGroupProps;
  GroupLabelProps: SidebarGroupLabelProps;
  GroupActionProps: SidebarGroupActionProps;
  GroupContentProps: SidebarGroupContentProps;
  MenuProps: SidebarMenuProps;
  MenuItemProps: SidebarMenuItemProps;
  MenuButtonProps: SidebarMenuButtonProps;
  MenuActionProps: SidebarMenuActionProps;
  MenuActionsProps: SidebarMenuActionsProps;
  MenuChipProps: SidebarMenuChipProps;
  MenuTriggerProps: SidebarMenuTriggerProps;
  MenuIndicatorProps: SidebarMenuIndicatorProps;
  PagesProps: SidebarPagesProps;
  PageProps: SidebarPageProps;
  MenuBadgeProps: SidebarMenuBadgeProps;
  MenuSkeletonProps: SidebarMenuSkeletonProps;
  MenuSubProps: SidebarMenuSubProps;
  MenuSubItemProps: SidebarMenuSubItemProps;
  MenuSubButtonProps: SidebarMenuSubButtonProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Components
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
  SidebarMenuChip,
  SidebarMenuIndicator,
  SidebarMenuTrigger,
  SidebarPage,
  SidebarPages,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
  SidebarMenuChipProps,
  SidebarMenuIndicatorProps,
  SidebarMenuTriggerProps,
  SidebarPageProps,
  SidebarPagesProps,
  SidebarMenuBadgeProps,
  SidebarMenuButtonProps,
  SidebarMenuItemProps,
  SidebarMenuProps,
  SidebarMenuSkeletonProps,
  SidebarMenuSubButtonProps,
  SidebarMenuSubItemProps,
  SidebarMenuSubProps,
  SidebarProviderProps,
  SidebarRailProps,
  SidebarRootProps,
  SidebarRootProps as SidebarProps,
  SidebarSeparatorProps,
  SidebarTriggerProps,
};

/* -------------------------------------------------------------------------------------------------
 * State (behaviour from @rivetjs/cdk/sidebar)
 * -----------------------------------------------------------------------------------------------*/
export { useSidebar, useSidebarPages, sidebarCookieOpen } from "@rivetjs/cdk/sidebar";
export type { SidebarContextValue, SidebarPagesContextValue } from "@rivetjs/cdk/sidebar";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { sidebarVariants } from "../../../styles/src/components/sidebar/index.ts";

export type { SidebarVariants } from "../../../styles/src/components/sidebar/index.ts";
