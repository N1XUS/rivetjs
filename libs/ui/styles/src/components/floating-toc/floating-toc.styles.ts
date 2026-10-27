// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no floating TOC). Feature set inspired by HeroUI Pro's
// public Floating TOC docs (`.floating-toc__*` parts, `--floating-toc-*` variables); independent implementation on HeroUI tokens.
import "../../../out/floating-toc.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const floatingTocVariants = tv({
  slots: {
    bar: "floating-toc__bar",
    content: "floating-toc__content",
    item: "floating-toc__item",
    trigger: "floating-toc__trigger",
  },
});

export type FloatingTocVariants = VariantProps<typeof floatingTocVariants>;
