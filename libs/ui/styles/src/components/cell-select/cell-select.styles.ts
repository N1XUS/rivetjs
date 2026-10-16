// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no cell select). Feature set inspired by HeroUI Pro's
// public docs (CellSelect `variant` default / secondary on the trigger); independent implementation on HeroUI tokens. The popover
// reuses the vendored `select__popover` look.
// Rivet: the stylesheets of the classes these slots compose (TWEAKS.md TW-122), in components/index.css order.
import "../../../out/morph-icon.css";
import "../../../out/list-box-item.css";
import "../../../out/select.css";
import "../../../out/cell-select.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const cellSelectVariants = tv({
  defaultVariants: {
    variant: "default",
  },
  slots: {
    base: "cell-select",
    indicator: "cell-select__indicator",
    label: "cell-select__label",
    popover: "select__popover cell-select__popover",
    trigger: "cell-select__trigger",
    value: "cell-select__value",
  },
  variants: {
    variant: {
      default: {
        trigger: "cell-select__trigger--default",
      },
      secondary: {
        trigger: "cell-select__trigger--secondary",
      },
    },
  },
});

export type CellSelectVariants = VariantProps<typeof cellSelectVariants>;
