// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no tool-call card). Feature set inspired by HeroUI
// Pro's public ChatTool docs (class names follow the documented `.chat-tool*` list); independent styles.
import "../../../out/chat-tool.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chatToolVariants = tv({
  slots: {
    approval: "chat-tool__approval",
    approvalActions: "chat-tool__approval-actions",
    approvalText: "chat-tool__approval-text",
    args: "chat-tool__args",
    base: "chat-tool",
    body: "chat-tool__body",
    code: "chat-tool__code",
    content: "chat-tool__content",
    error: "chat-tool__error",
    errorIcon: "chat-tool__error-icon",
    errorText: "chat-tool__error-text",
    group: "chat-tool-group",
    groupBody: "chat-tool-group__body",
    groupTrigger: "chat-tool-group__trigger",
    heading: "chat-tool__heading",
    indicator: "chat-tool__indicator",
    result: "chat-tool__result",
    statusIcon: "chat-tool__status-icon",
    toolIcon: "chat-tool__tool-icon",
    toolName: "chat-tool__tool-name",
    trigger: "chat-tool__trigger",
    triggerLabel: "chat-tool__trigger-label",
  },
});

export type ChatToolVariants = VariantProps<typeof chatToolVariants>;
