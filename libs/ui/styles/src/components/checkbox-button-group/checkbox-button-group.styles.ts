// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no card-style checkbox group). Feature set inspired by HeroUI
// Pro's public docs (CheckboxButtonGroup `layout` flex / grid); independent implementation on HeroUI tokens.
// Rivet: loaded before this component's stylesheet: rules here override it at equal specificity (TWEAKS.md TW-121).
import "../../../out/label.css";
import "../../../out/checkbox-button-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const checkboxButtonGroupVariants = tv({
  defaultVariants: {
    layout: "flex",
  },
  slots: {
    base: "checkbox-button-group",
    field: "checkbox-button-group__field",
    indicator: "checkbox-button-group__indicator",
    item: "checkbox-button-group__item",
    itemContent: "checkbox-button-group__item-content",
    itemIcon: "checkbox-button-group__item-icon",
  },
  variants: {
    layout: {
      flex: {
        base: "checkbox-button-group--flex",
      },
      grid: {
        base: "checkbox-button-group--grid",
      },
    },
  },
});

export type CheckboxButtonGroupVariants = VariantProps<typeof checkboxButtonGroupVariants>;
