import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Variants",
  summary: 'SearchField demo "Variants".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".search-field--secondary" }],
});
