// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no card-style radio group). Feature set inspired by HeroUI
// Pro's public docs (RadioButtonGroup `layout` flex / grid); independent implementation on HeroUI tokens.
// Rivet: loaded before this component's stylesheet: rules here override it at equal specificity (TWEAKS.md TW-121).
import "../../../out/label.css";
import "../../../out/radio-button-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const radioButtonGroupVariants = tv({
  defaultVariants: {
    layout: "flex",
  },
  slots: {
    base: "radio-button-group",
    field: "radio-button-group__field",
    indicator: "radio-button-group__indicator",
    item: "radio-button-group__item",
    itemContent: "radio-button-group__item-content",
    itemIcon: "radio-button-group__item-icon",
  },
  variants: {
    layout: {
      flex: {
        base: "radio-button-group--flex",
      },
      grid: {
        base: "radio-button-group--grid",
      },
    },
  },
});

export type RadioButtonGroupVariants = VariantProps<typeof radioButtonGroupVariants>;
