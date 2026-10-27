// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no sidebar): tv() slots of @rivetjs/ui/sidebar in the
// vendored format. Extension slots (menu indicator / sub panel / actions / chip, pages): feature set inspired by HeroUI
// Pro's public Sidebar docs, independent implementation. Behaviour + parts = shadcn/ui Sidebar (shadcn@4.21.4, MIT, © 2023 shadcn) via @rivetjs/cdk/sidebar.
import "../../../out/sidebar.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const sidebarVariants = tv({
  defaultVariants: {
    contained: false,
    size: "default",
    subSize: "md",
    variant: "default",
  },
  slots: {
    container: "sidebar__container",
    content: "sidebar__content",
    footer: "sidebar__footer",
    gap: "sidebar__gap",
    group: "sidebar__group",
    groupAction: "sidebar__group-action",
    groupContent: "sidebar__group-content",
    groupLabel: "sidebar__group-label",
    header: "sidebar__header",
    inner: "sidebar__inner",
    input: "sidebar__input",
    inset: "sidebar__inset",
    menu: "sidebar__menu",
    menuAction: "sidebar__menu-action",
    menuActions: "sidebar__menu-actions",
    menuBadge: "sidebar__menu-badge",
    menuButton: "sidebar__menu-button",
    menuChip: "sidebar__menu-chip",
    menuIndicator: "sidebar__menu-indicator",
    menuItem: "sidebar__menu-item",
    menuSkeleton: "sidebar__menu-skeleton",
    menuSkeletonIcon: "sidebar__menu-skeleton-icon",
    menuSkeletonText: "sidebar__menu-skeleton-text",
    menuSub: "sidebar__menu-sub",
    menuSubButton: "sidebar__menu-sub-button",
    menuSubItem: "sidebar__menu-sub-item",
    menuSubPanel: "sidebar__menu-sub-panel",
    page: "sidebar__page",
    pages: "sidebar__pages",
    rail: "sidebar__rail",
    resizeHandle: "sidebar__resize-handle",
    root: "sidebar",
    separator: "sidebar__separator",
    sheet: "sidebar__sheet",
    sheetBackdrop: "sidebar__sheet-backdrop",
    sheetDialog: "sidebar__sheet-dialog",
    tooltip: "sidebar__tooltip",
    trigger: "sidebar__trigger",
    wrapper: "sidebar-wrapper",
  },
  variants: {
    contained: {
      false: {},
      true: {
        wrapper: "sidebar-wrapper--contained",
      },
    },
    size: {
      default: {},
      lg: {
        menuButton: "sidebar__menu-button--lg",
      },
      sm: {
        menuButton: "sidebar__menu-button--sm",
      },
    },
    subSize: {
      md: {},
      sm: {
        menuSubButton: "sidebar__menu-sub-button--sm",
      },
    },
    variant: {
      default: {},
      outline: {
        menuButton: "sidebar__menu-button--outline",
      },
    },
  },
});

export type SidebarVariants = VariantProps<typeof sidebarVariants>;
