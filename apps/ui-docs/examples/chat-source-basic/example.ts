import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatSource: Usage",
  summary: "Inline citation pills; hover or focus one to preview the source.",
  tags: ["chat-source"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: [".chat-source__trigger", "Popover API"] }, { hover: ".chat-source__trigger" }, { matches: ".chat-source__preview" }],
});
