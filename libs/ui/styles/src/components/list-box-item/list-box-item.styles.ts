// Ported from HeroUI v3.2.6 packages/styles/src/components/list-box-item/list-box-item.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/list-box-item.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const listboxItemVariants = tv({
  defaultVariants: {
    variant: "default",
  },
  slots: {
    indicator: "list-box-item__indicator",
    item: "list-box-item",
  },
  variants: {
    variant: {
      danger: {
        item: "list-box-item--danger",
      },
      default: {
        item: "list-box-item--default",
      },
    },
  },
});

export type ListBoxItemVariants = VariantProps<typeof listboxItemVariants>;
