import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatTool: Error",
  summary: "A failed call shows its error text (`output-error`).",
  tags: ["chat-tool"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".chat-tool[data-state=output-error] [role=alert]" }],
});
