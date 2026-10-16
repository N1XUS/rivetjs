// Ported from HeroUI v3.2.6 packages/styles/src/components/switch-group/switch-group.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/switch-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const switchGroupVariants = tv({
  defaultVariants: {
    orientation: "vertical",
  },
  slots: {
    base: "switch-group",
    items: "switch-group__items",
  },
  variants: {
    orientation: {
      horizontal: {
        base: "switch-group--horizontal",
      },
      vertical: {
        base: "switch-group--vertical",
      },
    },
  },
});

export type SwitchGroupVariants = VariantProps<typeof switchGroupVariants>;
