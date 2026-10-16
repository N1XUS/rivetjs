import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatAttachment: Usage",
  summary: "Attachment chips: an image preview, a document with its size, and a removable file.",
  tags: ["chat-attachment"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".chat-attachment[data-variant=media]" },
    { expect: [".chat-attachment-group", "Q3-report.pdf"] },
    { click: "#notes-file .chat-attachment__remove" },
    { absent: "#notes-file" },
  ],
});
