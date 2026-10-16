// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no item morph): iOS context-menu style preview of a list
// item (backdrop opaque / blur / transparent) on HeroUI tokens.
import "../../../out/item-morph.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const itemMorphVariants = tv({
  defaultVariants: {
    backdrop: "blur",
  },
  slots: {
    backdrop: "item-morph__backdrop",
    base: "item-morph",
    close: "item-morph__close",
    panel: "item-morph__panel",
  },
  variants: {
    backdrop: {
      blur: {backdrop: "item-morph__backdrop--blur"},
      opaque: {backdrop: "item-morph__backdrop--opaque"},
      transparent: {backdrop: "item-morph__backdrop--transparent"},
    },
  },
});

export type ItemMorphVariants = VariantProps<typeof itemMorphVariants>;
