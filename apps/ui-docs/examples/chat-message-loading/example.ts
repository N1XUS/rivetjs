import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatMessage: Loading",
  summary: "An assistant turn waiting for its first token: a loader in the body.",
  tags: ["chat-message"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".chat-message--assistant [role=status]" }],
});
