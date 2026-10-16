// Ported from HeroUI v3.2.6 packages/styles/src/components/time-field/time-field.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/time-field.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const timeFieldVariants = tv({
  base: "time-field",
  defaultVariants: {
    fullWidth: false,
  },
  variants: {
    fullWidth: {
      false: "",
      true: "time-field--full-width",
    },
  },
});

export type TimeFieldVariants = VariantProps<typeof timeFieldVariants>;
