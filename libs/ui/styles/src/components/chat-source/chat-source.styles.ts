// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no citations). Feature set inspired by HeroUI Pro's
// public ChatSource docs (class names follow the documented `.chat-source*` / `.chat-sources*` list); independent styles.
import "../../../out/chat-source.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chatSourceVariants = tv({
  slots: {
    base: "chat-source",
    documentIcon: "chat-source__document-icon",
    favicon: "chat-sources__favicon",
    favicons: "chat-sources__favicons",
    group: "chat-sources",
    groupBody: "chat-sources__body",
    groupContent: "chat-sources__content",
    groupHeading: "chat-sources__heading",
    groupIndicator: "chat-sources__indicator",
    groupTrigger: "chat-sources__trigger",
    icon: "chat-source__icon",
    iconFallback: "chat-source__icon-fallback",
    list: "chat-sources__list",
    preview: "chat-source__preview",
    previewDescription: "chat-source__preview-description",
    previewDomain: "chat-source__preview-domain",
    previewSite: "chat-source__preview-site",
    previewTitle: "chat-source__preview-title",
    title: "chat-source__title",
    trigger: "chat-source__trigger",
    triggerLink: "chat-source__trigger-link",
  },
});

export type ChatSourceVariants = VariantProps<typeof chatSourceVariants>;
