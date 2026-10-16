// Ported from HeroUI v3.2.6 packages/styles/src/components/radio-group/radio-group.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/radio-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const radioGroupVariants = tv({
  base: "radio-group",
  defaultVariants: {
    variant: "primary",
  },
  variants: {
    variant: {
      primary: "radio-group--primary",
      secondary: "radio-group--secondary",
    },
  },
});

export type RadioGroupVariants = VariantProps<typeof radioGroupVariants>;
