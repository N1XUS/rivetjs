import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatMessage: Usage",
  summary: "A user bubble and an assistant turn with an avatar, body and actions.",
  tags: ["chat-message"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".chat-message--user .chat-message__bubble" }, { matches: ".chat-message--assistant [aria-label=Copy]" }],
});
