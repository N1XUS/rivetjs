// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no chat list). Feature set inspired by HeroUI Pro's
// public ChatListView docs; independent implementation on HeroUI tokens.
import "../../../out/chat-list-view.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chatListViewVariants = tv({
  defaultVariants: {
    variant: "default",
  },
  slots: {
    base: "chat-list-view",
    icon: "chat-list-view__icon",
    item: "chat-list-view__item",
    itemContent: "chat-list-view__item-content",
    meta: "chat-list-view__meta",
    preview: "chat-list-view__preview",
    section: "chat-list-view__section",
    title: "chat-list-view__title",
  },
  variants: {
    variant: {
      compact: {base: "chat-list-view--compact"},
      default: {base: "chat-list-view--default"},
    },
  },
});

export type ChatListViewVariants = VariantProps<typeof chatListViewVariants>;
