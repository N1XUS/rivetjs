// Ported from HeroUI v3.2.6 packages/styles/src/components/textfield/textfield.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/textfield.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const textFieldVariants = tv({
  base: "textfield",
  defaultVariants: {
    fullWidth: false,
  },
  variants: {
    fullWidth: {
      false: "",
      true: "textfield--full-width",
    },
  },
});

export type TextFieldVariants = VariantProps<typeof textFieldVariants>;
