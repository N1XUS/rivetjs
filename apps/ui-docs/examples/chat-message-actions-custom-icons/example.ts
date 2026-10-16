import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatMessageActions: Custom Icons",
  summary: "Any lucide icon works as an action; give each icon-only button an `aria-label`.",
  tags: ["chat-message-actions"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[aria-label='Answer tools'] [aria-label='Read aloud']" }],
});
