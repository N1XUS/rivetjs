// Ported from HeroUI v3.2.6 packages/styles/src/components/menu-item/menu-item.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/menu-item.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const menuItemVariants = tv({
  defaultVariants: {
    variant: "default",
  },
  slots: {
    // Rivet: Dropdown.Item sugar parts (icon / text column / shortcut; TWEAKS.md TW-147)
    icon: "menu-item__icon",
    indicator: "menu-item__indicator",
    item: "menu-item",
    shortcut: "menu-item__shortcut",
    submenuIndicator: "menu-item__indicator menu-item__indicator--submenu",
    text: "menu-item__text",
  },
  variants: {
    variant: {
      danger: {
        item: "menu-item--danger",
      },
      default: {
        item: "menu-item--default",
      },
    },
  },
});

export type MenuItemVariants = VariantProps<typeof menuItemVariants>;
