import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatAttachment: Grouped",
  summary: "A `ChatAttachmentGroup` over a keyed list; remove buttons update the list signal.",
  tags: ["chat-attachment"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["#attach-count", "4 files"] }, { click: ".chat-attachment-group .chat-attachment__remove" }, { expect: ["#attach-count", "3 files"] }],
});
