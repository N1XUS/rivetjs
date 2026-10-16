// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no chat attachments). Feature set inspired by HeroUI
// Pro's public ChatAttachment docs (class names follow the documented `.chat-attachment*` list); independent styles.
// Rivet: loaded before this component's stylesheet: rules here override it at equal specificity (TWEAKS.md TW-121).
import "../../../out/close-button.css";
import "../../../out/chat-attachment.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chatAttachmentVariants = tv({
  slots: {
    base: "chat-attachment",
    dropzone: "chat-attachment-input__dropzone",
    fileInput: "chat-attachment-input__file",
    group: "chat-attachment-group",
    icon: "chat-attachment__icon",
    info: "chat-attachment__info",
    input: "chat-attachment-input",
    name: "chat-attachment__name",
    preview: "chat-attachment__preview",
    previewImage: "chat-attachment__preview-image",
    previewVideo: "chat-attachment__preview-video",
    remove: "chat-attachment__remove",
    size: "chat-attachment__size",
    trigger: "chat-attachment-input__trigger",
  },
});

export type ChatAttachmentVariants = VariantProps<typeof chatAttachmentVariants>;
