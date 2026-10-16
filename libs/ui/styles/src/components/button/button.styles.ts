// Ported from HeroUI v3.2.6 packages/styles/src/components/button/button.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/button.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const buttonVariants = tv({
  base: "button",
  defaultVariants: {
    fullWidth: false,
    isIconOnly: false,
    size: "md",
    variant: "primary",
  },
  variants: {
    fullWidth: {
      false: "",
      true: "button--full-width",
    },
    isIconOnly: {
      true: "button--icon-only",
    },
    size: {
      lg: "button--lg",
      md: "button--md",
      sm: "button--sm",
    },
    variant: {
      brand: "button--brand",
      danger: "button--danger",
      "danger-soft": "button--danger-soft",
      ghost: "button--ghost",
      outline: "button--outline",
      primary: "button--primary",
      secondary: "button--secondary",
      tertiary: "button--tertiary",
    },
  },
});

export type ButtonVariants = VariantProps<typeof buttonVariants>;
