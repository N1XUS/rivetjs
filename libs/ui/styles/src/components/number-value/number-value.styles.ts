// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no number display). Feature set inspired by HeroUI
// Pro's public Number Value docs (locale-aware formatted number with prefix / suffix); independent implementation on
// HeroUI tokens.
import "../../../out/number-value.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const numberValueVariants = tv({
  defaultVariants: {
    isTabular: false,
  },
  slots: {
    base: "number-value",
    prefix: "number-value__prefix",
    suffix: "number-value__suffix",
    value: "number-value__value",
  },
  variants: {
    isTabular: {
      true: {base: "number-value--tabular"},
    },
  },
});

export type NumberValueVariants = VariantProps<typeof numberValueVariants>;
