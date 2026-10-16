// Ported from HeroUI v3.2.6 packages/styles/src/components/textarea/textarea.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/textarea.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const textAreaVariants = tv({
  base: "textarea",
  defaultVariants: {
    fullWidth: false,
    variant: "primary",
  },
  variants: {
    fullWidth: {
      false: "",
      true: "textarea--full-width",
    },
    variant: {
      primary: "textarea--primary",
      secondary: "textarea--secondary",
    },
  },
});

export type TextAreaVariants = VariantProps<typeof textAreaVariants>;
