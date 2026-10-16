// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 and HeroUI Pro have no compare). Before / after
// comparison slots on HeroUI tokens (`components/compare.css`).
import "../../../out/compare.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const compareVariants = tv({
  slots: {
    after: "compare__after",
    base: "compare",
    before: "compare__before",
    divider: "compare__divider",
    handle: "compare__handle",
    label: "compare__label",
    thumb: "compare__thumb",
  },
});

export type CompareVariants = VariantProps<typeof compareVariants>;
