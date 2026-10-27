// Ported from HeroUI v3.2.6 packages/styles/src/components/empty-state/empty-state.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/empty-state.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const emptyStateVariants = tv({
  base: "empty-state",
  // Rivet: sizes (TWEAKS.md TW-143)
  defaultVariants: {
    size: "md",
    variant: "default",
  },
  variants: {
    size: {
      lg: "empty-state--lg",
      md: "",
      sm: "empty-state--sm",
    },
    // Rivet: outline (UI-PORT S7, TWEAKS.md TW-164)
    variant: {
      default: "",
      outline: "empty-state--outline",
    },
  },
});

export type EmptyStateVariants = VariantProps<typeof emptyStateVariants>;
