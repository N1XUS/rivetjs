// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no item card). Feature set inspired by HeroUI Pro's
// public Item Card docs (row with icon, title, description and a trailing action; five surface variants); independent
// implementation on HeroUI tokens.
import "../../../out/item-card.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const itemCardVariants = tv({
  defaultVariants: {
    variant: "default",
  },
  slots: {
    action: "item-card__action",
    base: "item-card",
    content: "item-card__content",
    description: "item-card__description",
    icon: "item-card__icon",
    indicator: "item-card__indicator",
    title: "item-card__title",
  },
  variants: {
    variant: {
      default: {base: "item-card--default"},
      outline: {base: "item-card--outline"},
      secondary: {base: "item-card--secondary"},
      tertiary: {base: "item-card--tertiary"},
      transparent: {base: "item-card--transparent"},
    },
  },
});

export type ItemCardVariants = VariantProps<typeof itemCardVariants>;
