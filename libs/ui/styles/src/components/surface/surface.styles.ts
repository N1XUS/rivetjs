// Ported from HeroUI v3.2.6 packages/styles/src/components/surface/surface.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/surface.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const surfaceVariants = tv({
  base: "surface",
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      default: "surface--default",
      secondary: "surface--secondary",
      tertiary: "surface--tertiary",
      transparent: "surface--transparent",
    },
  },
});

export type SurfaceVariants = VariantProps<typeof surfaceVariants>;
