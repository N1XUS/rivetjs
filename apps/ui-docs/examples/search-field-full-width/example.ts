import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Full Width",
  summary: 'SearchField demo "Full Width".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".search-field--full-width" }],
});
