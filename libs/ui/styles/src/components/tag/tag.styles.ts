// Ported from HeroUI v3.2.6 packages/styles/src/components/tag/tag.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
// Rivet: loaded before this component's stylesheet: rules here override it at equal specificity (TWEAKS.md TW-121).
import "../../../out/close-button.css";
import "../../../out/tag.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const tagVariants = tv({
  defaultVariants: {
    size: "md",
    variant: "default",
  },
  slots: {
    base: "tag",
    removeButton: "tag__remove-button",
  },
  variants: {
    size: {
      lg: {
        base: "tag--lg",
      },
      md: {
        base: "tag--md",
      },
      sm: {
        base: "tag--sm",
      },
    },
    variant: {
      default: {
        base: "tag--default",
      },
      surface: {
        base: "tag--surface",
      },
    },
  },
});

export type TagVariants = VariantProps<typeof tagVariants>;
