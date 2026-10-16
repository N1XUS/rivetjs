import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatMessageActions: Usage",
  summary: "Copy, regenerate, rate and share under an assistant answer.",
  tags: ["chat-message-actions"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[aria-label='Good response']" }, { expect: ["#feedback", "Thanks for the feedback"] }],
});
