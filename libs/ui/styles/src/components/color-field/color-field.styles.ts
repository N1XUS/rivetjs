// Ported from HeroUI v3.2.6 packages/styles/src/components/color-field/color-field.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/color-field.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const colorFieldVariants = tv({
  base: "color-field",
  defaultVariants: {
    fullWidth: false,
  },
  variants: {
    fullWidth: {
      false: "",
      true: "color-field--full-width",
    },
  },
});

export type ColorFieldVariants = VariantProps<typeof colorFieldVariants>;
