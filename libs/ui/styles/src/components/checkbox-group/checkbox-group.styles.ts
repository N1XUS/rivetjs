// Ported from HeroUI v3.2.6 packages/styles/src/components/checkbox-group/checkbox-group.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/checkbox.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const checkboxGroupVariants = tv({
  base: "checkbox-group",
  defaultVariants: {
    variant: "primary",
  },
  variants: {
    variant: {
      primary: "checkbox-group--primary",
      secondary: "checkbox-group--secondary",
    },
  },
});

export type CheckboxGroupVariants = VariantProps<typeof checkboxGroupVariants>;
