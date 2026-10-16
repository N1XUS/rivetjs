// Ported from HeroUI v3.2.6 packages/styles/src/components/date-field/date-field.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/date-field.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const dateFieldVariants = tv({
  base: "date-field",
  defaultVariants: {
    fullWidth: false,
  },
  variants: {
    fullWidth: {
      false: "",
      true: "date-field--full-width",
    },
  },
});

export type DateFieldVariants = VariantProps<typeof dateFieldVariants>;
