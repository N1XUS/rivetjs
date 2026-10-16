import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: In Surface",
  summary: 'SearchField demo "In Surface".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 272, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=surface] [data-slot=search-field]" }],
});
