// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no message composer). Feature set inspired by
// HeroUI Pro's public PromptInput docs (class names follow the documented `.prompt-input*` list); independent styles.
import "../../../out/prompt-input.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const promptInputVariants = tv({
  slots: {
    action: "prompt-input__action",
    attachments: "prompt-input__attachments",
    base: "prompt-input",
    content: "prompt-input__content",
    footer: "prompt-input__footer",
    queue: "prompt-input__queue",
    queueItem: "prompt-input__queue-item",
    queueItemAction: "prompt-input__queue-item-action",
    queueItemActions: "prompt-input__queue-item-actions",
    queueItemAttachments: "prompt-input__queue-item-attachments",
    queueItemAttachmentsOverflow: "prompt-input__queue-item-attachments-overflow",
    queueItemBody: "prompt-input__queue-item-body",
    queueItemContent: "prompt-input__queue-item-content",
    queueItemDescription: "prompt-input__queue-item-description",
    queueItemHandle: "prompt-input__queue-item-handle",
    queueItemIcon: "prompt-input__queue-item-icon",
    queueList: "prompt-input__queue-list",
    send: "prompt-input__send",
    sendIcon: "prompt-input__send-icon",
    shell: "prompt-input__shell",
    textarea: "prompt-input__textarea",
    toolbar: "prompt-input__toolbar",
    toolbarEnd: "prompt-input__toolbar-end",
    toolbarStart: "prompt-input__toolbar-start",
  },
});

export type PromptInputVariants = VariantProps<typeof promptInputVariants>;
