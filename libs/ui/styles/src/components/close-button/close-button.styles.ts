// Ported from HeroUI v3.2.6 packages/styles/src/components/close-button/close-button.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/close-button.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const closeButtonVariants = tv({
  base: "close-button",
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      default: "close-button--default",
    },
  },
});

export type CloseButtonVariants = VariantProps<typeof closeButtonVariants>;
