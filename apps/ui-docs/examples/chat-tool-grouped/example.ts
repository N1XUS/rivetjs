import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatTool: Grouped",
  summary: "`ChatToolGroup` folds several calls of one turn under a single trigger.",
  tags: ["chat-tool"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [{ click: ".chat-tool-group__trigger" }, { expect: [".chat-tool-group__body", "searchHotels"] }],
});
