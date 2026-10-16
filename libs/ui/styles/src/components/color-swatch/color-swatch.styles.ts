// Ported from HeroUI v3.2.6 packages/styles/src/components/color-swatch/color-swatch.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/color-swatch.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const colorSwatchVariants = tv({
  base: "color-swatch",
  defaultVariants: {
    shape: "circle",
    size: "md",
  },
  variants: {
    shape: {
      circle: "color-swatch--circle",
      square: "color-swatch--square",
    },
    size: {
      lg: "color-swatch--lg",
      md: "color-swatch--md",
      sm: "color-swatch--sm",
      xl: "color-swatch--xl",
      xs: "color-swatch--xs",
    },
  },
});

export type ColorSwatchVariants = VariantProps<typeof colorSwatchVariants>;
