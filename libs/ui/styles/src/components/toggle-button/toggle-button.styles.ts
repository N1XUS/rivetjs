// Ported from HeroUI v3.2.6 packages/styles/src/components/toggle-button/toggle-button.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/toggle-button.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const toggleButtonVariants = tv({
  base: "toggle-button",
  defaultVariants: {
    isIconOnly: false,
    size: "md",
    variant: "default",
  },
  variants: {
    isIconOnly: {
      true: "toggle-button--icon-only",
    },
    size: {
      lg: "toggle-button--lg",
      md: "toggle-button--md",
      sm: "toggle-button--sm",
    },
    variant: {
      default: "toggle-button--default",
      ghost: "toggle-button--ghost",
    },
  },
});

export type ToggleButtonVariants = VariantProps<typeof toggleButtonVariants>;
