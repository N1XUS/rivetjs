// Ported from HeroUI v3.2.6 packages/styles/src/components/spinner/spinner.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/spinner.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const spinnerVariants = tv({
  base: "spinner",
  defaultVariants: {
    color: "accent",
    size: "md",
  },
  variants: {
    color: {
      accent: "spinner--accent",
      current: "spinner--current",
      danger: "spinner--danger",
      success: "spinner--success",
      warning: "spinner--warning",
    },
    size: {
      lg: "spinner--lg",
      md: "spinner--md",
      sm: "spinner--sm",
      xl: "spinner--xl",
    },
  },
});

export type SpinnerVariants = VariantProps<typeof spinnerVariants>;
