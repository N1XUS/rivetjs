// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no native select). Feature set inspired by HeroUI Pro's public
// docs (NativeSelect `variant` primary / secondary, `fullWidth`); independent implementation on HeroUI field tokens.
import "../../../out/morph-icon.css";
import "../../../out/native-select.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const nativeSelectVariants = tv({
  defaultVariants: {
    fullWidth: false,
    variant: "primary",
  },
  slots: {
    base: "native-select",
    indicator: "native-select__indicator",
    optGroup: "native-select__optgroup",
    option: "native-select__option",
    select: "native-select__select",
    trigger: "native-select__trigger",
  },
  variants: {
    fullWidth: {
      false: "",
      true: {
        base: "native-select--full-width",
        trigger: "native-select__trigger--full-width",
      },
    },
    variant: {
      primary: {
        base: "native-select--primary",
      },
      secondary: {
        base: "native-select--secondary",
      },
    },
  },
});

export type NativeSelectVariants = VariantProps<typeof nativeSelectVariants>;
