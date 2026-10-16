// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no message actions). Feature set inspired by HeroUI
// Pro's public ChatMessageActions docs; independent implementation on HeroUI tokens.
import "../../../out/chat-message-actions.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chatMessageActionsVariants = tv({
  slots: {
    action: "chat-message-actions__action",
    base: "chat-message-actions",
    copiedIcon: "chat-message-actions__copied-icon",
    copyIcon: "chat-message-actions__copy-icon",
  },
});

export type ChatMessageActionsVariants = VariantProps<typeof chatMessageActionsVariants>;
