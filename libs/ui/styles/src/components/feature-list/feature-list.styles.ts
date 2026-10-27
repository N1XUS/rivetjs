// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no feature list): a list of perks / plan features
// with a leading icon (check by default) on HeroUI tokens.
import "../../../out/feature-list.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const featureListVariants = tv({
  defaultVariants: {
    color: "success",
  },
  slots: {
    base: "feature-list",
    icon: "feature-list__icon",
    item: "feature-list__item",
    label: "feature-list__label",
  },
  variants: {
    color: {
      accent: {base: "feature-list--accent"},
      default: {base: "feature-list--default"},
      success: {base: "feature-list--success"},
    },
  },
});

export type FeatureListVariants = VariantProps<typeof featureListVariants>;
