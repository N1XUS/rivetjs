// Ported from HeroUI v3.2.6 packages/styles/src/components/label/label.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/label.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const labelVariants = tv({
  base: "label",
  defaultVariants: {
    isDisabled: false,
    isInvalid: false,
    isRequired: false,
  },
  variants: {
    isDisabled: {
      true: "label--disabled",
    },
    isInvalid: {
      true: "label--invalid",
    },
    isRequired: {
      true: "label--required",
    },
  },
});

export type LabelVariants = VariantProps<typeof labelVariants>;
