import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatTool: Composable",
  summary: "Build the trigger and the content from the parts.",
  tags: ["chat-tool"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: [".chat-tool__result", "Resumability guide"] }, { matches: ".chat-tool__status-icon[aria-label=Completed]" }],
});
