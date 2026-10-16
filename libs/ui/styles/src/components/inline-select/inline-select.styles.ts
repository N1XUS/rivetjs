// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no inline select). Feature set inspired by HeroUI Pro's
// public docs (InlineSelect parts and classes); independent implementation on HeroUI tokens. The popover reuses the vendored
// `select__popover` look.
// Rivet: the stylesheets of the classes these slots compose (TWEAKS.md TW-122), in components/index.css order.
import "../../../out/list-box-item.css";
import "../../../out/select.css";
import "../../../out/inline-select.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const inlineSelectVariants = tv({
  slots: {
    base: "inline-select",
    indicator: "inline-select__indicator",
    popover: "select__popover inline-select__popover",
    trigger: "inline-select__trigger",
    value: "inline-select__value",
  },
});

export type InlineSelectVariants = VariantProps<typeof inlineSelectVariants>;
