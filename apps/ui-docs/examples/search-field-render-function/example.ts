import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Render Function",
  summary: 'SearchField demo "Render Function".',
  tags: ["search-field"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-custom=foo][data-slot=search-field]" }],
});
