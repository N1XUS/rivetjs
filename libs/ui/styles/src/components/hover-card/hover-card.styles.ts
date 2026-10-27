// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no hover card). Feature set inspired by HeroUI Pro's
// public Hover Card docs (a preview card on hover / focus / long press, optional arrow); independent implementation on
// HeroUI tokens.
import "../../../out/hover-card.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const hoverCardVariants = tv({
  slots: {
    arrow: "hover-card__arrow",
    content: "hover-card__content",
    trigger: "hover-card__trigger",
  },
});

export type HoverCardVariants = VariantProps<typeof hoverCardVariants>;
