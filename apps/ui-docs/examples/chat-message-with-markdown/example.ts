import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatMessage: With Markdown",
  summary: "An assistant body rendered by `Markdown`: headings, lists and a code block.",
  tags: ["chat-message"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".chat-message--assistant .markdown__list--ordered" }],
});
