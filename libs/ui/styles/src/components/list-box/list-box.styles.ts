// Ported from HeroUI v3.2.6 packages/styles/src/components/list-box/list-box.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/list-box.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const listboxVariants = tv({
  base: "list-box",
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      danger: "list-box--danger",
      default: "list-box--default",
    },
  },
});

export type ListBoxVariants = VariantProps<typeof listboxVariants>;
