// Ported from HeroUI v3.2.6 packages/styles/src/components/skeleton/skeleton.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/skeleton.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const skeletonVariants = tv({
  defaultVariants: {
    animationType: "shimmer",
  },
  slots: {
    base: "skeleton",
  },
  variants: {
    animationType: {
      none: "skeleton--none",
      pulse: "skeleton--pulse",
      shimmer: "skeleton--shimmer",
    },
  },
});

export type SkeletonVariants = VariantProps<typeof skeletonVariants>;
