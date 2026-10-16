import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatSource: Document",
  summary: "A source without `href` is a document: file icon, no link.",
  tags: ["chat-source"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".chat-source__document-icon" }],
});
