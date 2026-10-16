import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatMessageActions: Minimal",
  summary: "Only copy and regenerate.",
  tags: ["chat-message-actions"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[role=group][aria-label='Message actions'] [aria-label=Copy]" }],
});
