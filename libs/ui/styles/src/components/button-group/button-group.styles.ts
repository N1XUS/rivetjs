// Ported from HeroUI v3.2.6 packages/styles/src/components/button-group/button-group.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/button-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const buttonGroupVariants = tv({
  defaultVariants: {
    fullWidth: false,
    orientation: "horizontal",
  },
  slots: {
    base: "button-group",
    separator: "button-group__separator",
  },
  variants: {
    fullWidth: {
      false: {},
      true: {
        base: "button-group--full-width",
      },
    },
    orientation: {
      horizontal: {
        base: "button-group--horizontal",
      },
      vertical: {
        base: "button-group--vertical",
      },
    },
  },
});

export type ButtonGroupVariants = VariantProps<typeof buttonGroupVariants>;
