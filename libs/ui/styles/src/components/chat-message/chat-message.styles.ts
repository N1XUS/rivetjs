// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no chat message). Feature set inspired by HeroUI Pro's
// public ChatMessage docs; independent implementation on HeroUI tokens.
import "../../../out/chat-message.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chatMessageVariants = tv({
  slots: {
    actions: "chat-message__actions",
    assistant: "chat-message--assistant",
    avatar: "chat-message__avatar",
    base: "chat-message",
    body: "chat-message__body",
    bubble: "chat-message__bubble",
    content: "chat-message__content",
    meta: "chat-message__meta",
    user: "chat-message--user",
  },
});

export type ChatMessageVariants = VariantProps<typeof chatMessageVariants>;
