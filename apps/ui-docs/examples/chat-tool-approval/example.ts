import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatTool: Approval",
  summary: "A call waiting for the user (`requires-action`) opens with Approve / Reject; the choice moves it to a result or an error.",
  tags: ["chat-tool"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".chat-tool[data-state=requires-action] .chat-tool__approval" },
    { click: ".chat-tool__approval-actions button:last-child" },
    { matches: ".chat-tool[data-state=output-available]" },
  ],
});
