// Ported from HeroUI v3.2.6 packages/styles/src/components/input/input.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/input.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const inputVariants = tv({
  base: "input",
  defaultVariants: {
    fullWidth: false,
    variant: "primary",
  },
  variants: {
    fullWidth: {
      false: "",
      true: "input--full-width",
    },
    variant: {
      primary: "input--primary",
      secondary: "input--secondary",
    },
  },
});

export type InputVariants = VariantProps<typeof inputVariants>;
