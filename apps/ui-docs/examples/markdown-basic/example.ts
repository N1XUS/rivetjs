import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Markdown: Usage",
  summary: "A model answer rendered from Markdown: headings, emphasis, lists, a task list, a table, a quote and fenced code.",
  tags: ["markdown"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".markdown__table" }, { matches: ".markdown .code-block" }, { matches: ".markdown__task-checkbox" }],
});
