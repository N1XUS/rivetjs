// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no conversation view). Feature set inspired by
// HeroUI Pro's public ChatConversation docs (class names follow the documented `.chat-conversation*` list); own styles.
import "../../../out/chat-conversation.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chatConversationVariants = tv({
  slots: {
    base: "chat-conversation",
    content: "chat-conversation__content",
    scrollAnchor: "chat-conversation__scroll-anchor",
    scrollButton: "chat-conversation__scroll-button",
    scrollButtonContainer: "chat-conversation__scroll-button-container",
    stack: "chat-conversation__stack",
  },
});

export type ChatConversationVariants = VariantProps<typeof chatConversationVariants>;
