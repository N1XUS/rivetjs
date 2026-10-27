// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no emoji reaction button). Feature set inspired by
// HeroUI Pro's public Emoji Reaction Button docs (a pill toggle with an emoji and a count; sizes sm / md / lg; read-only);
// independent implementation on HeroUI tokens.
import "../../../out/emoji-reaction-button.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const emojiReactionButtonVariants = tv({
  defaultVariants: {
    size: "md",
  },
  slots: {
    base: "emoji-reaction-button",
    count: "emoji-reaction-button__count",
    emoji: "emoji-reaction-button__emoji",
  },
  variants: {
    size: {
      lg: {base: "emoji-reaction-button--lg"},
      md: {base: "emoji-reaction-button--md"},
      sm: {base: "emoji-reaction-button--sm"},
    },
  },
});

export type EmojiReactionButtonVariants = VariantProps<typeof emojiReactionButtonVariants>;
