// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no chat loader). Feature set inspired by HeroUI Pro's
// public ChatLoader docs; independent implementation on HeroUI tokens.
import "../../../out/chat-loader.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chatLoaderVariants = tv({
  slots: {
    avatar: "chat-loader__avatar",
    base: "chat-loader",
    content: "chat-loader__content",
    dot: "chat-loader__dot",
    dots: "chat-loader__dots",
    line: "chat-loader__line",
    pulse: "chat-loader__pulse",
    pulseDot: "chat-loader__pulse-dot",
    spinner: "chat-loader__spinner",
  },
});

export type ChatLoaderVariants = VariantProps<typeof chatLoaderVariants>;
