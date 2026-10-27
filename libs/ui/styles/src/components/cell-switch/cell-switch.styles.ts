// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no cell switch). Feature set inspired by HeroUI Pro's
// public Cell Switch docs (a settings row: label start, switch end, the whole row toggles; variants default / secondary);
// independent implementation on HeroUI tokens.
import "../../../out/switch.css";
import "../../../out/cell-switch.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const cellSwitchVariants = tv({
  defaultVariants: {
    variant: "default",
  },
  slots: {
    base: "cell-switch",
    control: "cell-switch__control",
    description: "cell-switch__description",
    label: "cell-switch__label",
    trigger: "cell-switch__trigger",
  },
  variants: {
    variant: {
      default: {
        trigger: "cell-switch__trigger--default",
      },
      secondary: {
        base: "cell-switch--secondary",
        control: "cell-switch__control--secondary",
        trigger: "cell-switch__trigger--secondary",
      },
    },
  },
});

export type CellSwitchVariants = VariantProps<typeof cellSwitchVariants>;
