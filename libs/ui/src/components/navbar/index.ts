// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no navbar). Feature set scoped from public docs of commercial UI kits;
// independent implementation. `@rivetjs/ui/navbar`: compound `Navbar.*`, named parts, `useNavbar`, prop types, `navbarVariants`.
import {
  NavbarBrand,
  NavbarContent,
  NavbarHeader,
  NavbarItem,
  NavbarLabel,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  NavbarRoot,
  NavbarSeparator,
  NavbarSpacer,
} from "./navbar.tsx";
import type {
  NavbarHeaderProps,
  NavbarItemProps,
  NavbarLabelProps,
  NavbarMenuToggleProps,
  NavbarPartDivProps,
  NavbarRootProps,
  NavbarSeparatorProps,
} from "./navbar.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Navbar = Object.assign(NavbarRoot, {
  Root: NavbarRoot,
  Header: NavbarHeader,
  Brand: NavbarBrand,
  Content: NavbarContent,
  Item: NavbarItem,
  Label: NavbarLabel,
  Separator: NavbarSeparator,
  Spacer: NavbarSpacer,
  MenuToggle: NavbarMenuToggle,
  Menu: NavbarMenu,
  MenuItem: NavbarMenuItem,
});

export type Navbar = {
  Props: NavbarRootProps;
  RootProps: NavbarRootProps;
  HeaderProps: NavbarHeaderProps;
  BrandProps: NavbarPartDivProps;
  ContentProps: NavbarPartDivProps;
  ItemProps: NavbarItemProps;
  LabelProps: NavbarLabelProps;
  SeparatorProps: NavbarSeparatorProps;
  SpacerProps: NavbarPartDivProps;
  MenuToggleProps: NavbarMenuToggleProps;
  MenuProps: NavbarPartDivProps;
  MenuItemProps: NavbarItemProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  NavbarRoot,
  NavbarHeader,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarLabel,
  NavbarSeparator,
  NavbarSpacer,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
};
export { useNavbar } from "./navbar.tsx";

export type {
  NavbarRootProps,
  NavbarRootProps as NavbarProps,
  NavbarHeaderProps,
  NavbarBrandProps,
  NavbarContentProps,
  NavbarItemProps,
  NavbarLabelProps,
  NavbarSeparatorProps,
  NavbarSpacerProps,
  NavbarMenuToggleProps,
  NavbarMenuProps,
  NavbarMenuItemProps,
  NavbarSize,
  UseNavbarReturn,
} from "./navbar.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { navbarVariants } from "../../../styles/src/components/navbar/index.ts";

export type { NavbarVariants } from "../../../styles/src/components/navbar/index.ts";
