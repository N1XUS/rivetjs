// Ported from HeroUI v3.2.6 packages/styles/src/components/card/card.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/card.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

const cardVariants = tv({
  defaultVariants: {
    variant: "default",
  },
  slots: {
    base: "card",
    content: "card__content",
    description: "card__description",
    footer: "card__footer",
    header: "card__header",
    title: "card__title",
  },
  variants: {
    variant: {
      default: {
        base: "card--default",
      },
      secondary: {
        base: "card--secondary",
      },
      tertiary: {
        base: "card--tertiary",
      },
      transparent: {
        base: "card--transparent",
      },
    },
  },
});

export {cardVariants};
export type CardVariants = VariantProps<typeof cardVariants>;
