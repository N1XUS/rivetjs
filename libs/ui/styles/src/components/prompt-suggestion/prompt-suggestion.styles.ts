// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no prompt suggestion). Feature set inspired by HeroUI
// Pro's public PromptSuggestion docs; independent implementation on HeroUI tokens.
import "../../../out/prompt-suggestion.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const promptSuggestionVariants = tv({
  defaultVariants: {
    variant: "pill",
  },
  slots: {
    base: "prompt-suggestion",
    description: "prompt-suggestion__description",
    header: "prompt-suggestion__header",
    item: "prompt-suggestion__item",
    itemDescription: "prompt-suggestion__item-description",
    itemFooter: "prompt-suggestion__item-footer",
    itemMeta: "prompt-suggestion__item-meta",
    itemTags: "prompt-suggestion__item-tags",
    itemTitle: "prompt-suggestion__item-title",
    items: "prompt-suggestion__items",
    title: "prompt-suggestion__title",
  },
  variants: {
    variant: {
      card: {base: "prompt-suggestion--card"},
      pill: {base: "prompt-suggestion--pill"},
    },
  },
});

export type PromptSuggestionVariants = VariantProps<typeof promptSuggestionVariants>;
