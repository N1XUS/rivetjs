// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no morph). Feature set inspired by HeroUI Pro's public
// MorphButton docs (variant primary / secondary, eight directions); independent implementation on HeroUI tokens.
import "../../../out/morph.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const morphVariants = tv({
  defaultVariants: {
    direction: "top",
    variant: "primary",
  },
  slots: {
    base: "morph",
    close: "morph__close",
    collapsed: "morph__collapsed",
    expanded: "morph__expanded",
    surface: "morph__surface",
    trigger: "morph__trigger",
  },
  variants: {
    direction: {
      bottom: {base: "morph--bottom"},
      "bottom-end": {base: "morph--bottom-end"},
      "bottom-start": {base: "morph--bottom-start"},
      end: {base: "morph--end"},
      start: {base: "morph--start"},
      top: {base: "morph--top"},
      "top-end": {base: "morph--top-end"},
      "top-start": {base: "morph--top-start"},
    },
    variant: {
      primary: {base: "morph--primary"},
      secondary: {base: "morph--secondary"},
    },
  },
});

export type MorphVariants = VariantProps<typeof morphVariants>;
