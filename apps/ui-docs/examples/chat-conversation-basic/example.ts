import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatConversation: Usage",
  summary: "A scrolling conversation log that starts and stays at the newest message.",
  tags: ["chat-conversation"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".chat-conversation[role=log][data-at-bottom=true]" }],
});
