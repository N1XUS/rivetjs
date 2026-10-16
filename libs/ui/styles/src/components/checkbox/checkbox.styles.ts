// Ported from HeroUI v3.2.6 packages/styles/src/components/checkbox/checkbox.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/checkbox.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const checkboxVariants = tv({
  defaultVariants: {
    variant: "primary",
  },
  slots: {
    base: "checkbox",
    content: "checkbox__content",
    control: "checkbox__control",
    indicator: "checkbox__indicator",
  },
  variants: {
    variant: {
      primary: {
        base: "checkbox--primary",
      },
      secondary: {
        base: "checkbox--secondary",
      },
    },
  },
});

export type CheckboxVariants = VariantProps<typeof checkboxVariants>;
